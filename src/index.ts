import path from 'path';
import * as fs from 'fs';
import execa from 'execa';
import fse from 'fs-extra';

interface BuildParams {
    projectDirectory: string,
    outputDirectory: string,
    cacheDirectory: string,
    parallel: boolean,
}

export async function build(params: BuildParams): Promise<boolean> {
    const projectDirectory = path.resolve(params.projectDirectory);
    const outputDirectory = path.resolve(params.outputDirectory);
    const cacheDirectory = path.resolve(params.cacheDirectory);

    console.log('rnb: Starting build...')

    await beforeBuild(projectDirectory);
    await fse.remove(outputDirectory);
    await fse.mkdirp(outputDirectory);

    const iosJsBundle = buildJsBundle(projectDirectory, outputDirectory, 'ios');
    const androidJsBundle = buildJsBundle(projectDirectory, outputDirectory, 'android');
    const iosNative = iosJsBundle.then(() => buildNativeIos(projectDirectory, outputDirectory, cacheDirectory));
    const androidNative = androidJsBundle.then(() => buildAndroid(projectDirectory, outputDirectory));

    if (params.parallel) {
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

    return true;
}

function iterateDir(dir): string[] {
    const files = []
    fse.readdirSync(dir).forEach(filename => {
        const filePath = path.join(dir, filename);
        if (fse.statSync(filePath).isDirectory()) {
            iterateDir(filePath).forEach(file => files.push(file))
        }
        files.push(filePath);
    });
    return files;
}


export async function beforeBuild(projectDirectory: string): Promise<boolean> {
    await execa('yarn', ['install'], {cwd: projectDirectory});
    await execa('yarn', ['jetify'], {cwd: `${projectDirectory}`}); // FIXME: handle monorepo case
    return true;
}

async function buildNativeIos(projectDirectory: string, outputDirectory: string, cacheDirectory: string): Promise<boolean> {
    {
        console.log('rnb: Install CocoaPods')
        const p = execa(
            'pod',
            ['install'],
            {cwd: `${projectDirectory}/ios`}
        );
        // p.stdout.pipe(process.stdout);
        await p;
    }

    {
        console.log('rnb: Prebuild CocoaPods');
        const p = execa(
            'bundle',
            ['exec', 'xcode-archive-cache', 'inject', '--configuration=Release', `--storage=${cacheDirectory}/xcode`],
            {cwd: `${projectDirectory}/ios`}
        );
        // p.stdout.pipe(process.stdout);
        await p;
    }

    {
        // TODO: pass via config or cli
        const workspaceName = 'foo';
        const scheme = 'foo';
        const archiveName = 'foo.xcarchive';
        const p = execa(
            'xcodebuild',
            [
                '-workspace', workspaceName,
                '-scheme', scheme,
                'archive',
                // '-sdk iphoneos',
                '-configuration', 'Release',
                '-archivePath', `${outputDirectory}/${archiveName}`,
            ],
            {cwd: `${projectDirectory}/ios`}
        );
        // p.stdout.pipe(process.stdout);
        await p;
    }

    return true;
}

async function buildAndroid(projectDirectory: string, outputDirectory: string): Promise<boolean> {
    {
        console.log('rnb: Gradle');
        const p = execa(
            './gradlew',
            [
                'assembleRelease'
            ],
            {cwd: `${projectDirectory}/android`}
        );
        // p.stdout.pipe(process.stdout);
        await p;
    }

    {
        console.log('rnb: Copy artifacts');
        const isApk = /\.apk$/;
        iterateDir(`${projectDirectory}/android`)
            .forEach(file => {
                if (isApk.test(file)) {
                    fse.copyFileSync(`${file}`, `${outputDirectory}/${path.basename(file)}`);
                }
            });
    }

    return true;
}

async function buildJsBundle(projectDirectory: string, outputDirectory: string, platform: string) {
    await fse.mkdirp(`${outputDirectory}/jsbundle-${platform}/`);
    const p = execa(
        'yarn',
        [
            'react-native',
            'bundle',
            '--entry-file', 'index.js',
            '--platform', platform,
            '--dev', 'false',
            '--bundle-output', `${outputDirectory}/jsbundle-${platform}/main.jsbundle`,
            '--assets-dest', `${outputDirectory}/jsbundle-${platform}`,
        ],
        {cwd: `${projectDirectory}`}
    );
    // p.stdout.pipe(process.stdout);
    await p;
}
