import fse from "fs-extra";
import {assertType, is} from "typescript-is";

export interface BarnConfig {
    schemes: Map<string, BarnSchemeConfig>
}

export interface BarnSchemeConfig {
    ios: BarnIosConfig
    android: BarnAndroidConfig
}

export interface BarnIosConfig {
    xcodeSchemeName: string
    xcodeWorkspaceName: string
    xcodeConfigName: string
    codesigning?: BarnIosCodesigningConfig
}

export interface BarnIosCodesigningConfig {
    signingIdentity: string
    provisioningProfileName: string
}

export interface BarnAndroidConfig {
    gradleTarget: string,
}

export default function loadConfig(configPath: string): BarnConfig {
    const exists = fse.pathExistsSync(configPath);
    if (!exists) {
        throw `Failed to load config from '${configPath}': file does not exist.`
    }
    const config = require(configPath);
    for (const [schemeName, scheme] of Object.entries(config.schemes)) {
        assertType<BarnSchemeConfig>(scheme);
    }
    return config;
}
