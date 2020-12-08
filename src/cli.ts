import path from "path";
import {Command} from "commander";
import build from "./build";
import loadConfig from "./config";

const program = new Command('barn');

program
    .command('build')
    .option('--project-dir <projectdir>', 'Root of the React Native project you want to build', path.resolve('.'))
    .option('--output-dir [outputdir]', 'Path to the output directory')
    .option('--cache-dir [cachedir]', 'Path to the caches directory')
    .option('--config [configPath]', 'Path to the config')
    .action(async (options) => {
        const outputDirectory = options.outputDir || `${options.projectDir}/build`;
        const cacheDirectory = options.cacheDir || `${options.projectDir}/caches`;
        const configPath = options.config || `${options.projectDir}/barn.config.js`;
        const config = loadConfig(configPath);
        for (const [schemeName, scheme] of Object.entries(config.schemes)) {
                console.log(`Building scheme ${schemeName}...`);
                await build({
                        projectDirectory: options.projectDir,
                        outputDirectory: path.join(outputDirectory, schemeName),
                        cacheDirectory,
                        config: scheme
                })
        }
    });

export default program;
