import path from 'path';
import execa from 'execa';
import fse from 'fs-extra';
import {BarnAndroidConfig, BarnConfig, BarnIosConfig} from "./config";
import {FsUtil} from './util';
import * as os from "os";
import * as plist from 'plist'
import del from 'del';

interface BuildContext {
    projectDirectory: string,
    outputDirectory: string,
    cacheDirectory: string,
    parallel: boolean,
    config: BarnConfig,
}

export async function build(context: BuildContext): Promise<boolean> {
    const projectDirectory = path.resolve(context.projectDirectory);
    const outputDirectory = path.resolve(context.outputDirectory);
    const cacheDirectory = path.resolve(context.cacheDirectory);
    const tempDirectory = fse.mkdtempSync(`${os.tmpdir()}/ivanmoskalev-barn-`);

    console.log('[barn] Starting build...')

    await preBuild(context);

    {
        const tempProductsDir = path.resolve(`${tempDirectory}/artifacts/`);
        await FsUtil.cleanDirectory(`${tempProductsDir}/jsbundle-ios`);
        await FsUtil.cleanDirectory(`${tempProductsDir}/jsbundle-android`);
        await FsUtil.cleanDirectory(`${tempProductsDir}/ios`);
        await FsUtil.cleanDirectory(`${tempProductsDir}/android`);

        const iosJsBundle = buildReactNativeBundle(projectDirectory, `${tempProductsDir}/jsbundle-ios`, 'ios');

        const androidJsBundle = buildReactNativeBundle(projectDirectory, `${tempProductsDir}/jsbundle-android`, 'android');

        const iosNative = iosJsBundle.then(() => buildIos({
            projectDirectory,
            outputDirectory: `${tempProductsDir}/ios`,
            cacheDirectory,
            iosConfig: context.config.ios
        }));

        const androidNative = androidJsBundle.then(() => buildAndroid({
            projectDirectory,
            outputDirectory: `${tempProductsDir}/android`,
            cacheDirectory: `${cacheDirectory}/gradle`,
            config: context.config.android
        }));

        if (context.parallel) {
            await Promise.all([
                iosJsBundle,
                androidJsBundle,
                iosNative,
                androidNative
            ]);
        } else {
            await iosJsBundle;
            await androidJsBundle;
            await iosNative;
            await androidNative;
        }

        await fse.copy(tempProductsDir, outputDirectory, { recursive: true });
    }

    await postBuild(context);

    return true;
}


export async function preBuild(context: BuildContext) {
}


export async function postBuild(context: BuildContext) {
}

interface BuildIosParams {
    projectDirectory: string,
    outputDirectory: string,
    cacheDirectory: string,
    iosConfig: BarnIosConfig,
}

async function buildIos({projectDirectory, outputDirectory, cacheDirectory, iosConfig}: BuildIosParams): Promise<boolean> {
    console.log('[barn] [ios] Install CocoaPods')
    await execa(
        'pod',
        ['install'],
        {cwd: `${projectDirectory}/ios`}
    );

    console.log('[barn] [ios] Run xcode-archive-cache')
    await execa(
        'bundle',
        ['exec', 'xcode-archive-cache', 'inject', '--configuration=Release', `--storage=${cacheDirectory}/xcode`],
        {cwd: `${projectDirectory}/ios`}
    );

    console.log('[barn] [ios] Run xcodebuild')
    const codesigningParams = (iosConfig.codesigning && [
        'CODE_SIGN_STYLE=Manual',
        `CODE_SIGN_IDENTITY=${iosConfig.codesigning.signingIdentity}`,
        `PROVISIONING_PROFILE=`,
        `PROVISIONING_PROFILE_SPECIFIER=${iosConfig.codesigning.provisioningProfileName}`
    ]) || [];

    await execa(
        'xcodebuild',
        [
            'archive',
            '-workspace', iosConfig.xcodeWorkspaceName,
            '-scheme', iosConfig.xcodeSchemeName,
            '-configuration', iosConfig.xcodeConfigName,
            '-archivePath', `${outputDirectory}/${iosConfig.xcodeSchemeName}-${iosConfig.xcodeConfigName}.xcarchive`,
            ...codesigningParams,
        ],
        {cwd: `${projectDirectory}/ios`}
    );

    console.log('[barn] [ios] Export IPA from .xcarchive')

    // TODO: this should be done in a temp dir

    const allProvisioningProfileFiles = await FsUtil.findFilesRecursively({dir: `${outputDirectory}/${iosConfig.xcodeSchemeName}-${iosConfig.xcodeConfigName}.xcarchive/Products`, matching: /\.mobileprovision$/});
    const bundleIdToProvProfileMapping = await Promise.all(allProvisioningProfileFiles.map(async (mobileprovisionPath) => {
        const directory = path.dirname(mobileprovisionPath);
        console.log(directory);
        const infoPlistPath = path.join(directory, 'Info.plist');
        const bplist = require('bplist-parser');
        const infoPlist = await bplist.parseFile(infoPlistPath);
        const bundleId = infoPlist[0]['CFBundleIdentifier'];
        const command = execa.commandSync(`security cms -D -i ${mobileprovisionPath}`);
        const provProfPlist = plist.parse(command.stdout);
        const provProfileUuid = provProfPlist['UUID'];
        return `<key>${bundleId}</key><string>${provProfileUuid}</string>`;
    }));

    const exportPlistPath = `${outputDirectory}/${iosConfig.xcodeSchemeName}-${iosConfig.xcodeConfigName}.export.plist`;
    const exportPlist = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>provisioningProfiles</key>
  <dict>
    ${bundleIdToProvProfileMapping.join('\n    ')}
  </dict>
</dict>
</plist>`;
    await fse.writeFile(exportPlistPath, exportPlist);

    await execa(
        'xcodebuild',
        [
            '-exportArchive',
            '-archivePath', `${outputDirectory}/${iosConfig.xcodeSchemeName}-${iosConfig.xcodeConfigName}.xcarchive`,
            '-exportPath', `${outputDirectory}`,
            '-exportOptionsPlist', exportPlistPath,
        ]
    );

    console.log('[barn] [ios] Build finished');

    return true;
}

interface BuildAndroidParams {
    projectDirectory: string;
    outputDirectory: string;
    cacheDirectory: string;
    config: BarnAndroidConfig;
}

async function buildAndroid({projectDirectory, outputDirectory, cacheDirectory, config}: BuildAndroidParams): Promise<boolean> {
    console.log('[barn] [android] Running gradle build');

    await execa(
        './gradlew',
        [
            `assemble${config.gradleTarget}`,
            '--build-cache',
            '--gradle-user-home', cacheDirectory,
            '--parallel',
            '--no-daemon'
        ],
        {cwd: `${projectDirectory}/android`}
    );

    console.log('[barn] [android] Copying .apk files');

    const dirContents = await FsUtil.findFilesRecursively({dir: `${projectDirectory}/android`, matching: /\.apk$/});
    dirContents.forEach(file => fse.copyFileSync(`${file}`, `${outputDirectory}/${path.basename(file)}`));

    console.log('[barn] [android] Cleaning up caches dir');

    await del([
        path.join(cacheDirectory, 'daemon'),
        path.join(cacheDirectory, 'native'),
        path.join(cacheDirectory, 'notifications'),
        path.join(cacheDirectory, 'jdks'),
        path.join(cacheDirectory, '**/*.lock'),
        path.join(cacheDirectory, 'caches/[123456789].[1234567890]'),
    ], {force: true});

    console.log('[barn] [android] Build finished')

    return true;
}

async function buildReactNativeBundle(projectDirectory: string, outputDirectory: string, platform: 'ios' | 'android') {
    console.log(`[barn] [${platform}] [jsbundle] Running 'react-native bundle'`);

    await execa(
        'yarn',
        [
            'react-native',
            'bundle',
            '--entry-file', 'index.js',
            '--platform', platform,
            '--dev', 'false',
            '--bundle-output', `${outputDirectory}/${platform === 'ios' ? 'main.jsbundle' : 'index.android.bundle'}`,
            '--assets-dest', `${outputDirectory}`,
        ],
        {cwd: projectDirectory}
    );

    console.log(`[barn] [${platform}] [jsbundle] Build finished`);
}
