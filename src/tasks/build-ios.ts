import {BarnIosConfig} from "../config";
import execa from "execa";
import {FsUtil} from "../util";
import path from "path";
import fse from "fs-extra";
import plist from 'plist';
import bplist from 'bplist-parser';

interface BuildIosParams {
    projectDirectory: string,
    outputDirectory: string,
    cacheDirectory: string,
    config: BarnIosConfig,
}

export default async function build(params: BuildIosParams): Promise<boolean> {
    const {projectDirectory, outputDirectory, cacheDirectory, config} = params;

    console.log('[barn] [ios] Install CocoaPods')
    await execa(
        'pod',
        ['install'],
        {cwd: `${projectDirectory}/ios`}
    );

    console.log('[barn] [ios] Run xcode-archive-cache')
    await execa(
        'bundle',
        ['exec', 'xcode-archive-cache', 'inject', '--configuration=Release', `--storage=${cacheDirectory}`],
        {cwd: `${projectDirectory}/ios`}
    );

    console.log('[barn] [ios] Run xcodebuild')
    const codesigningParams = (config.codesigning && [
        'CODE_SIGN_STYLE=Manual',
        `CODE_SIGN_IDENTITY=${config.codesigning.signingIdentity}`,
        `PROVISIONING_PROFILE=`,
        `PROVISIONING_PROFILE_SPECIFIER=${config.codesigning.provisioningProfileName}`
    ]) || [];

    const xcarchivePath = path.join(outputDirectory, `${config.xcodeSchemeName}-${config.xcodeConfigName}.xcarchive`);

    await execa(
        'xcodebuild',
        [
            'archive',
            '-workspace', config.xcodeWorkspaceName,
            '-scheme', config.xcodeSchemeName,
            '-configuration', config.xcodeConfigName,
            '-archivePath', xcarchivePath,
            ...codesigningParams,
        ],
        {cwd: `${projectDirectory}/ios`}
    );

    console.log('[barn] [ios] Export IPA from .xcarchive')

    // TODO: this should be done in a temp dir

    const allProvisioningProfileFiles = await findAllProvisioningProfilesInXcarchive(xcarchivePath);
    const bundleIdToProvProfileMapping = await Promise.all(allProvisioningProfileFiles.map(async (mobileprovisionPath) => {
        const directory = path.dirname(mobileprovisionPath);
        const infoPlistPath = path.join(directory, 'Info.plist');
        const infoPlist = await bplist.parseFile(infoPlistPath);
        const bundleId = infoPlist[0]['CFBundleIdentifier'];
        const command = execa.commandSync(`security cms -D -i ${mobileprovisionPath}`);
        const provProfPlist = plist.parse(command.stdout);
        const provProfileUuid = provProfPlist['UUID'];
        return `<key>${bundleId}</key><string>${provProfileUuid}</string>`;
    }));

    const exportPlistPath = `${xcarchivePath}.export.plist`;
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
            '-archivePath', xcarchivePath,
            '-exportPath', `${outputDirectory}`,
            '-exportOptionsPlist', exportPlistPath,
        ]
    );

    console.log('[barn] [ios] Build finished');

    return true;
}

async function findAllProvisioningProfilesInXcarchive(xсarchivePath: string): Promise<string[]> {
    return FsUtil.findFilesRecursively({
        dir: path.join(xсarchivePath, '/Products/'),
        matching: /\.mobileprovision$/
    })
}
