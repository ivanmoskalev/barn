import path from 'path';
import execa from 'execa';
import fse from 'fs-extra';
import {BarnAndroidConfig, BarnConfig, BarnIosConfig} from "./config";
import * as Util from './util';
import * as os from "os";

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
        await Util.cleanDirectory(`${tempProductsDir}/jsbundle-ios`);
        await Util.cleanDirectory(`${tempProductsDir}/jsbundle-android`);
        await Util.cleanDirectory(`${tempProductsDir}/ios`);
        await Util.cleanDirectory(`${tempProductsDir}/android`);

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

    await execa(
        'xcodebuild',
        [
            '-exportArchive',
            '-archivePath', `${outputDirectory}/${iosConfig.xcodeSchemeName}-${iosConfig.xcodeConfigName}.xcarchive`,
            '-exportPath', `${outputDirectory}/${iosConfig.xcodeSchemeName}-${iosConfig.xcodeConfigName}`,
            '-exportFormat', 'ipa',
            '-exportProvisioningProfile', iosConfig.codesigning.provisioningProfileName
        ]
    );

    console.log('[barn] [ios] Build finished');

    return true;
}

interface BuildAndroidParams {
    projectDirectory: string;
    outputDirectory: string;
    config: BarnAndroidConfig;
}

async function buildAndroid({projectDirectory, outputDirectory, config}: BuildAndroidParams): Promise<boolean> {
    console.log('[barn] [android] Running gradle build');

    await execa(
        './gradlew',
        [
            `assemble${config.gradleTarget}`
        ],
        {cwd: `${projectDirectory}/android`}
    );

    console.log('[barn] [android] Copying .apk files');

    const dirContents = await Util.findFilesRecursively({dir: `${projectDirectory}/android`, matching: /\.apk$/});
    dirContents.forEach(file => fse.copyFileSync(`${file}`, `${outputDirectory}/${path.basename(file)}`));

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
