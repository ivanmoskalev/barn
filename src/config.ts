export interface BarnConfig {
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

