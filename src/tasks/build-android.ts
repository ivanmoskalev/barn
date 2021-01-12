import * as Config from '../config';
import execa from 'execa';
import { FsUtil, TimeUtil } from '../util';
import fse from 'fs-extra';
import path from 'path';
import { Task } from './common';

interface BuildAndroidParams extends Task {
    config: Config.AndroidTarget;
    gradleExtraCommandLineArgs?: string[];
}

export default async function buildAndroid(params: BuildAndroidParams): Promise<boolean> {
    const { projectDirectory, outputDirectory, cacheDirectory, config } = params;

    const stopwatch = new TimeUtil.Stopwatch();
    console.log('[rnb] [android] Starting build...');

    {
        console.log('[rnb] [android] Running gradle build...');
        const extraCliArgs = params.gradleExtraCommandLineArgs || [];
        await execa('./gradlew', [`${config.gradleTarget}`, '--build-cache', '--gradle-user-home', cacheDirectory, '--parallel', ...extraCliArgs], {
            cwd: `${projectDirectory}/android`,
        });
        console.log(`[rnb] [android] Running gradle build... Done in ${TimeUtil.humanReadableDuration(stopwatch.splitTime())}!`);
    }

    {
        const artifactSpec = config.artifacts || ['apk'];
        console.log(`[rnb] [android] Copying artifact files: ${artifactSpec}...`);

        await Promise.all(
            artifactSpec.map(async (a) => {
                const files = await FsUtil.findFilesRecursively({
                    dir: path.join(projectDirectory, 'android'),
                    matching: artifactPatternFor(a),
                });
                files.forEach((srcPath) => {
                    const dstPath = path.join(outputDirectory, a, path.basename(srcPath));
                    fse.mkdirpSync(path.join(outputDirectory, a));
                    console.log(`[rnb] [android] Copying '${srcPath}' to '${dstPath}'`);
                    fse.copyFileSync(srcPath, dstPath);
                });
                return Promise.resolve();
            })
        );

        console.log(`[rnb] [android] Copying artifact files... Done in ${TimeUtil.humanReadableDuration(stopwatch.splitTime())}!`);
    }

    console.log(`[rnb] [android] Build finished in ${TimeUtil.humanReadableDuration(stopwatch.totalDuration())}!`);

    return true;
}

function artifactPatternFor(artifactSpec: Config.AndroidArtifact): RegExp {
    switch (artifactSpec) {
        case 'aab':
            return /\.aab$/;
        case 'apk':
            return /\.apk$/;
    }
}
