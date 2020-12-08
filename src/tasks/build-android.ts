import {BarnAndroidConfig} from "../config";
import execa from "execa";
import {FsUtil} from "../util";
import fse from "fs-extra";
import path from "path";
import del from "del";

interface BuildAndroidParams {
    projectDirectory: string
    outputDirectory: string
    cacheDirectory: string
    config: BarnAndroidConfig
    gradleExtraCommandLineArgs?: string[]
}

export default async function buildAndroid(params: BuildAndroidParams): Promise<boolean> {
    const {projectDirectory, outputDirectory, cacheDirectory, config} = params;
    console.log('[barn] [android] Running gradle build');

    const extraCliArgs = params.gradleExtraCommandLineArgs || [];
    await execa(
        './gradlew',
        [
            `assemble${config.gradleTarget}`,
            '--build-cache',
            '--gradle-user-home', cacheDirectory,
            '--parallel',
            ...extraCliArgs,
        ],
        {cwd: `${projectDirectory}/android`}
    );

    console.log('[barn] [android] Copying .apk files');

    const dirContents = await FsUtil.findFilesRecursively({
        dir: path.join(projectDirectory, 'android'),
        matching: /\.apk$/
    });
    dirContents.forEach(file => fse.copyFileSync(`${file}`, path.join(outputDirectory, path.basename(file))));

    console.log('[barn] [android] Cleaning up caches dir');

    await del([
        path.join(cacheDirectory, 'daemon'),
        path.join(cacheDirectory, 'native'),
        path.join(cacheDirectory, 'notifications'),
        path.join(cacheDirectory, 'jdks'),
        path.join(cacheDirectory, '**/*.lock'),
        path.join(cacheDirectory, 'caches/[123456789].[1234567890]'),
    ], {force: true});

    console.log('[barn] [android] Build finished')

    return true;
}
