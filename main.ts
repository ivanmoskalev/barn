import { Command } from "commander";
import * as path from "path";
import {build} from './src';

const program = new Command('barn');

program
    .command('build')
    .option('--project-dir <projectdir>', 'Root of the React Native project you want to build', path.resolve('.'))
    .option('--output-dir <outputdir>', 'Path to the output directory')
    .option('--cache-dir <cachedir>', 'Path to the caches directory')
    .action((options) => {
        console.log(options.projectDir);
        const outputDirectory = options.outputDir || `${options.projectDir}/build`;
        const cacheDirectory =  options.cacheDir || `${options.projectDir}/caches`;
        build({ projectDirectory: options.projectDir, outputDirectory, cacheDirectory, parallel: true });
    });

program.parse(process.argv);
