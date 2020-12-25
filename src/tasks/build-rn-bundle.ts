import execa from "execa";
import {Task} from "./common";

export interface ReactNativeBundleParams extends Task {
    platform: 'ios' | 'android'
    includeSourcemaps: boolean
}

export default async function buildReactNativeBundle(params: ReactNativeBundleParams): Promise<boolean> {
    const {platform, outputDirectory, projectDirectory, includeSourcemaps} = params;
    console.log(`[rnb] [${platform}] [jsbundle] Running 'react-native bundle'`);

    const bundleFileName = platform === 'ios' ? 'main.jsbundle' : 'index.android.bundle';
    const sourcemapParameters = includeSourcemaps ? [
        '--sourcemap-output', `${outputDirectory}/${bundleFileName.replace(/(\.jsbundle|\.bundle)/, '.map')}`
    ] : [];

    await execa(
        'yarn',
        [
            'react-native',
            'bundle',
            '--entry-file', 'index.js',
            '--platform', platform,
            '--dev', 'false',
            '--bundle-output', `${outputDirectory}/${bundleFileName}`,
            '--assets-dest', `${outputDirectory}`,
            ...sourcemapParameters,
        ],
        {cwd: projectDirectory}
    );

    console.log(`[rnb] [${platform}] [jsbundle] Build finished`);

    return true;
}
