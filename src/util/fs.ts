import fse from 'fs-extra';
import path from 'path';

export async function cleanDirectory(directory: string) {
    await fse.remove(directory);
    await fse.mkdirp(directory);
}

interface FindFilesRecursively {
    dir: string;
    matching: RegExp;
}

export async function findFilesRecursively(params: FindFilesRecursively): Promise<string[]> {
    const { dir, matching } = params;
    let files: string[] = [];
    const items = await fse.readdir(dir);
    for (const filename of items) {
        const filepath = path.join(dir, filename);
        const isDirectory = (await fse.stat(filepath)).isDirectory();
        if (isDirectory) {
            files = files.concat(await findFilesRecursively({ dir: filepath, matching }));
        } else if (matching.test(filename)) {
            files.push(filepath);
        }
    }
    return files;
}
