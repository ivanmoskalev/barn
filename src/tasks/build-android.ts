import * as Config from "../config";
import execa from "execa";
import {FsUtil} from "../util";
import fse from "fs-extra";
import path from "path";
import {Task} from "./common";

interface BuildAndroidParams extends Task {
    config: Config.AndroidTarget
    gradleExtraCommandLineArgs?: string[]
}

export default async function buildAndroid(params: BuildAndroidParams): Promise<boolean> {
    const {projectDirectory, outputDirectory, cacheDirectory, config} = params;
    console.log('[rnb] [android] Running gradle build');

    const extraCliArgs = params.gradleExtraCommandLineArgs || [];
    await execa(
        './gradlew',
        [
            `${config.gradleTarget}`,
            '--build-cache',
            '--gradle-user-home', cacheDirectory,
            '--parallel',
            ...extraCliArgs,
        ],
        {cwd: `${projectDirectory}/android`}
    );

    console.log('[rnb] [android] Copying artifact files...');

    const artifactSpec = config.artifacts || ['apk'];

    await Promise.all(artifactSpec.map(async (a) => {
        const files = await FsUtil.findFilesRecursively({
            dir: path.join(projectDirectory, 'android'),
            matching: artifactPatternFor(a)
        });
        files.forEach(srcPath => {
            const dstPath = path.join(outputDirectory, a, path.basename(srcPath));
            console.log(`[rnb] [android] Copying '${srcPath}' to '${dstPath}'`);
            fse.copyFileSync(srcPath, dstPath);
        });
        return Promise.resolve();
    }));

    console.log('[rnb] [android] Build finished')

    return true;
}

function artifactPatternFor(artifactSpec: Config.AndroidArtifact): RegExp {
    switch (artifactSpec) {
        case "aab":
            return /\.aab$/;
        case "apk":
            return /\.apk$/
    }
}
