#!/usr/bin/env node

import { Command } from "commander";
import * as path from "path";
import {build} from './src';
import fse from 'fs-extra';

const program = new Command('barn');

program
    .command('build')
    .option('--project-dir <projectdir>', 'Root of the React Native project you want to build', path.resolve('.'))
    .option('--output-dir [outputdir]', 'Path to the output directory')
    .option('--cache-dir [cachedir]', 'Path to the caches directory')
    .option('--config [configPath]', 'Path to the config')
    .action((options) => {
        const outputDirectory = options.outputDir || `${options.projectDir}/build`;
        const cacheDirectory =  options.cacheDir || `${options.projectDir}/caches`;
        const configPath = options.config || `${options.projectDir}/barn.config.json`;
        const config = (fse.existsSync(configPath) && fse.readJsonSync(configPath)) || {};
        console.log(config);
        build({ projectDirectory: options.projectDir, outputDirectory, cacheDirectory, config });
    });

program.parse(process.argv);
