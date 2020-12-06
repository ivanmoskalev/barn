export interface BarnConfig {
    ios: BarnIosConfig
    android: BarnAndroidConfig
}

export interface BarnIosConfig {
    xcodeSchemeName: string
    xcodeWorkspaceName: string
    xcodeConfigName: string
}

export interface BarnAndroidConfig {
    gradleTarget: string,
}

