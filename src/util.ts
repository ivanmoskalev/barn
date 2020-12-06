import fse from "fs-extra";
import path from "path";

export async function cleanDirectory(dir: string) {
    await fse.remove(dir);
    await fse.mkdirp(dir);
}

interface FindFilesRecursively {
    dir: string;
    matching: RegExp;
}

export async function findFilesRecursively({dir, matching}: FindFilesRecursively): Promise<string[]> {
    let files: string[] = []
    const items = await fse.readdir(dir);
    for (const filename of items) {
        const filepath = path.join(dir, filename);
        const isDirectory = (await fse.stat(filepath)).isDirectory();
        if (isDirectory) {
            files = files.concat(await findFilesRecursively({dir: filepath, matching}));
        } else if (matching.test(filename)) {
            files.push(filepath);
        }
    }
    return files;
}
