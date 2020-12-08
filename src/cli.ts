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
            const projectDirectory = path.resolve(options.projectDir);
        const outputDirectory = path.resolve(options.outputDir || `${projectDirectory}/build`);
        const cacheDirectory = path.resolve(options.cacheDir || `${projectDirectory}/caches`);
        const configPath = path.resolve(options.config || `${projectDirectory}/barn.config.js`);
        const config = loadConfig(configPath);
        await build({ projectDirectory, outputDirectory, cacheDirectory, schemes: config.schemes })
    });

export default program;
