import path from 'path';
import fse from 'fs-extra';
import {BarnSchemeConfig} from "./config";
import {FsUtil} from './util';
import * as os from 'os';
import buildReactNativeBundle from "./tasks/build-rn-bundle";

import buildAndroidApp from './tasks/build-android';
import buildIosApp from './tasks/build-ios';
import execa from "execa";
import del from "del";

interface BuildContext {
    projectDirectory: string,
    outputDirectory: string,
    cacheDirectory: string,
    schemes: Map<string, BarnSchemeConfig>,
}

export default async function build(context: BuildContext): Promise<boolean> {
    const projectDirectory = path.resolve(context.projectDirectory);
    const outputDirectory = path.resolve(context.outputDirectory);
    const cacheDirectory = path.resolve(context.cacheDirectory);
    const tempDirectory = fse.mkdtempSync(`${os.tmpdir()}/barn-build-`);

    console.log('[barn] Starting build...')

    await preBuild(context);

    for (const [schemeName, scheme] of Object.entries(context.schemes)) {
        const schemeOutputDirectory = path.join(outputDirectory, schemeName);
        console.log(`Building scheme ${schemeName}...`);

        const tempProductsDir = path.resolve(path.join(tempDirectory, 'artifacts'));
        await Promise.all([
            FsUtil.cleanDirectory(path.join(tempProductsDir, 'jsbundle-ios')),
            FsUtil.cleanDirectory(path.join(tempProductsDir, 'jsbundle-android')),
            FsUtil.cleanDirectory(path.join(tempProductsDir, 'ios')),
            FsUtil.cleanDirectory(path.join(tempProductsDir, 'android'))
        ]);

        await Promise.all([
            buildReactNativeBundle(projectDirectory, path.join(tempProductsDir, 'jsbundle-ios'), 'ios'),
            buildReactNativeBundle(projectDirectory, path.join(tempProductsDir, 'jsbundle-android'), 'android'),
            buildIosApp({
                projectDirectory,
                outputDirectory: path.join(tempProductsDir, 'ios'),
                cacheDirectory: path.join(cacheDirectory, 'xcode'),
                config: scheme.ios
            }),
            buildAndroidApp({
                projectDirectory,
                outputDirectory: path.join(tempProductsDir, 'android'),
                cacheDirectory: path.join(cacheDirectory, 'gradle'),
                config: scheme.android
            })
        ]);

        await fse.copy(tempProductsDir, schemeOutputDirectory, {recursive: true});
    }

    await postBuild(context);

    return true;
}


export async function preBuild(context: BuildContext) {
    const projectDirectory = path.resolve(context.projectDirectory);
    const cacheDirectory = path.resolve(context.cacheDirectory);

    console.log('[barn] [prebuild] Install CocoaPods')
    await execa(
        'pod',
        ['install'],
        {cwd: path.join(projectDirectory, 'ios')}
    );

    try {
        console.log('[barn] [prebuild] Run xcode-archive-cache')
        await execa(
            'bundle',
            [
                'exec',
                'xcode-archive-cache', 'inject',
                '--configuration=Release',
                `--storage=${path.join(cacheDirectory, 'xcode')}`
            ],
            {cwd: path.join(projectDirectory, 'ios')}
        );
    }
    catch (e) {
        console.log('xcode-archive-cache failed, but it is not fatal', e);
    }
}

export async function postBuild(context: BuildContext) {
    const cacheDirectory = path.resolve(context.cacheDirectory);
    const projectDirectory = path.resolve(context.projectDirectory);
    const gradleCacheDirectory = path.join(cacheDirectory, 'gradle');

    await execa(
        './gradlew',
        ['--stop'],
        {cwd: path.join(projectDirectory, 'android') }
    );

    await del([
        path.join(gradleCacheDirectory, 'daemon'),
        path.join(gradleCacheDirectory, 'native'),
        path.join(gradleCacheDirectory, 'notifications'),
        path.join(gradleCacheDirectory, 'jdks'),
        path.join(gradleCacheDirectory, '**/*.lock'),
        path.join(gradleCacheDirectory, 'caches/[123456789].[1234567890]'),
    ], {force: true});
}
