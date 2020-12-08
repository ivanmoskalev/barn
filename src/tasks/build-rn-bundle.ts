import execa from "execa";

export default async function buildReactNativeBundle(projectDirectory: string, outputDirectory: string, platform: 'ios' | 'android') {
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
