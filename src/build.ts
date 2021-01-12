import path from 'path';
import fse from 'fs-extra';
import { FsUtil, TimeUtil } from './util';
import * as os from 'os';
import buildReactNativeBundle from './tasks/build-rn-bundle';
import buildAndroidApp from './tasks/build-android';
import buildIosApp from './tasks/build-ios';
import execa from 'execa';
import del from 'del';
import * as Config from './config';
import buildExpoUpdate from './tasks/build-expo-update';

interface BuildContext {
    projectDirectory: string;
    outputDirectory: string;
    cacheDirectory: string;
    config: Config.RnbConfig;
}

export default async function build(context: BuildContext): Promise<boolean> {
    const projectDirectory = path.resolve(context.projectDirectory);
    const outputDirectory = path.resolve(context.outputDirectory);
    const cacheDirectory = path.resolve(context.cacheDirectory);
    const tempRootDir = fse.mkdtempSync(`${os.tmpdir()}/rnb-build-`);

    const stopwatch = new TimeUtil.Stopwatch();

    const schemes = Config.isSingleSchemeConfig(context.config) ? new Map([['', context.config]]) : context.config.schemes;
    console.log('[rnb] Starting build...');

    await preBuild(context, stopwatch);

    for (const [schemeName, scheme] of schemes) {
        const schemeOutputDirectory = path.join(outputDirectory, schemeName);
        console.log(schemeName === '' ? 'Building default scheme...' : `Building scheme '${schemeName}'...`);

        const tempRootDir = fse.mkdtempSync(`${os.tmpdir()}/rnb-build-`);
        const tempProductsDir = path.resolve(path.join(tempRootDir, schemeName, 'artifacts'));
        const tempDirectory = path.resolve(path.join(tempRootDir, schemeName, 'tmp'));
        await FsUtil.cleanDirectory(tempProductsDir);

        let work = scheme.targets.flatMap((target: Config.Target) => {
            stopwatch.splitTime();
            console.log('Building target', target);
            switch (target.target) {
                case 'ios':
                    return buildIosApp({
                        projectDirectory,
                        outputDirectory: path.join(tempProductsDir, target.target),
                        cacheDirectory: path.join(cacheDirectory, target.target),
                        tempDirectory: path.join(tempDirectory, target.target),
                        config: target,
                    });
                case 'android':
                    return buildAndroidApp({
                        projectDirectory,
                        outputDirectory: path.join(tempProductsDir, target.target),
                        cacheDirectory: path.join(cacheDirectory, target.target),
                        tempDirectory: path.join(tempDirectory, target.target),
                        config: target,
                    });
                case 'expo':
                    return buildExpoUpdate({
                        projectDirectory,
                        outputDirectory: path.join(tempProductsDir, target.target),
                        cacheDirectory: path.join(cacheDirectory, target.target),
                        tempDirectory: path.join(tempDirectory, target.target),
                        config: target,
                    });
                case 'rn-bundle':
                    return buildReactNativeBundle({
                        projectDirectory,
                        outputDirectory: path.join(tempProductsDir, target.target),
                        cacheDirectory: path.join(cacheDirectory, target.target),
                        tempDirectory: path.join(tempDirectory, target.target),
                        platform: target.platform,
                        includeSourcemaps: true,
                    });
                default:
                    throw new Error(`Unknown target specified! Target looks like this: ${JSON.stringify(target)}`);
            }
        });

        await Promise.all(work);
        await fse.copy(tempProductsDir, schemeOutputDirectory, { recursive: true });
        console.log(`[rnb] Target built! Execution time: ${TimeUtil.humanReadableDuration(stopwatch.totalDuration())}`);
    }

    await postBuild(context, stopwatch);

    console.log(`[rnb] All done! Execution time: ${TimeUtil.humanReadableDuration(stopwatch.totalDuration())}`);

    return true;
}

export async function preBuild(context: BuildContext, stopwatch: TimeUtil.Stopwatch) {
    const projectDirectory = path.resolve(context.projectDirectory);
    const cacheDirectory = path.resolve(context.cacheDirectory);

    {
        stopwatch.splitTime();
        console.log('[rnb] [prebuild] Installing CocoaPods...');
        await execa('pod', ['install'], { cwd: path.join(projectDirectory, 'ios') });
        console.log(`[rnb] [prebuild] Installing CocoaPods... Done in ${TimeUtil.humanReadableDuration(stopwatch.splitTime())}!`);
    }

    try {
        stopwatch.splitTime();
        console.log('[rnb] [prebuild] Running xcode-archive-cache...');
        await execa(
            'bundle',
            ['exec', 'xcode-archive-cache', 'inject', '--configuration=Release', `--storage=${path.join(cacheDirectory, 'xcode')}`],
            {
                cwd: path.join(projectDirectory, 'ios'),
            }
        );
        console.log(`[rnb] [prebuild] Running xcode-archive-cache... Done in ${TimeUtil.humanReadableDuration(stopwatch.splitTime())}!`);
    } catch (e) {
        console.log('xcode-archive-cache failed, but it is not fatal', e);
    }
}

export async function postBuild(context: BuildContext, stopwatch: TimeUtil.Stopwatch) {
    const cacheDirectory = path.resolve(context.cacheDirectory);
    const projectDirectory = path.resolve(context.projectDirectory);
    const gradleCacheDirectory = path.join(cacheDirectory, 'gradle');

    {
        stopwatch.splitTime();
        console.log('[rnb] [postbuild] Stopping gradle daemon...');
        await execa('./gradlew', ['--stop'], { cwd: path.join(projectDirectory, 'android') });
        console.log(`[rnb] [postbuild] Stopping gradle daemon... Done in ${TimeUtil.humanReadableDuration(stopwatch.splitTime())}!`);
    }
}
