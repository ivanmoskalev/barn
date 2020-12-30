import fse from "fs-extra";
import {assertType, is} from "typescript-is";

type SingleSchemeConfig = {
    targets: Target[]
};

export type RnbConfig = {
    schemes: Map<string, SingleSchemeConfig>
} | SingleSchemeConfig;

export function isSingleSchemeConfig(config: RnbConfig): config is SingleSchemeConfig {
    return (config as SingleSchemeConfig).targets !== undefined;
}

export type Target = IosTarget | AndroidTarget | ReactNativeBundleTarget | ExpoUpdateTarget;

export interface IosTarget {
    target: 'ios'
    xcodeSchemeName: string
    xcodeWorkspaceName: string
    xcodeConfigName: string
    codesigning?: IosCodesigningConfig
    xcodebuildExtraCommandLineArgs?: string[]
    ipaExportConfig?: IpaExportConfig
    artifacts?: IosArtifact[]
}

export interface IosCodesigningConfig {
    signingIdentity: string
    provisioningProfileName: string
    ipaExportMethod?: string
}

export interface IpaExportConfig {
    compileBitcode?: boolean
}

export type IosArtifact = 'ipa' | 'xcarchive' | 'dSYM';

export interface AndroidTarget {
    target: 'android'
    gradleTarget: string,
    gradleExtraCommandLineArgs?: string[]
    artifacts?: AndroidArtifact[]
}

export type AndroidArtifact = 'apk' | 'aab';

export interface ReactNativeBundleTarget {
    target: 'rn-bundle'
    platform: 'ios' | 'android'
    artifacts?: ReactNativeBundleArtifact[]
}

export type ReactNativeBundleArtifact = 'jsbundle' | 'sourcemaps';

export interface ExpoUpdateTarget {
    target: 'expo'
    publicUrl: string
    assetUrl?: string
    dumpAssetmap?: boolean
    expoTarget: 'managed' | 'bare'
    artifacts?: ExpoUpdateArtifact[]
}

export type ExpoUpdateArtifact = 'update-package' | 'sourcemaps';

export default function loadConfig(configPath: string): RnbConfig {
    const exists = fse.pathExistsSync(configPath);
    if (!exists) {
        throw `Failed to load config from '${configPath}': file does not exist.`
    }
    // TODO: Use joi, probably
    return require(configPath);
}
