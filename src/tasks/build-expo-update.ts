import execa from "execa";
import {Task} from "./common";
import {ExpoUpdateTarget} from "../config";

export interface BuildExpoUpdateParams extends Task {
    config: ExpoUpdateTarget
}

export default async function buildExpoUpdate(params: BuildExpoUpdateParams): Promise<boolean> {
    const {outputDirectory, projectDirectory, config} = params;
    console.log(`[rnb] [expo] Running 'expo export'`);

    const assetUrlOverride = config.assetUrl ? [ '-a', config.assetUrl ] : [];
    const assetmapOverride = config.dumpAssetmap ? [ '-d' ] : [];
    const sourcemapOverride = config.artifacts.includes('sourcemaps') ? [ '-s' ] : [];

    await execa(
        'yarn',
        [
            'expo',
            'export',
            '-p', config.publicUrl,
            ...assetUrlOverride,
            ...assetmapOverride,
            ...sourcemapOverride,
            '--target', config.expoTarget,
            '--output-dir', outputDirectory,
            '--force'
        ],
        {cwd: projectDirectory}
    );

    console.log(`[rnb] [expo] Build finished`);

    return true;
}
