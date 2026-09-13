import { spawnSync } from 'node:child_process';
import { relative, resolve, sep } from 'node:path';

const rootDirectory = process.cwd();
const tscFilesPath = resolve(rootDirectory, 'node_modules/tsc-files/cli.js');
const workspaceDirectories = ['apps/web', 'apps/server', 'packages/types', 'packages/contracts'];

const filesByWorkspace = new Map(
  workspaceDirectories.map((workspaceDirectory) => [workspaceDirectory, []]),
);

for (const filePath of process.argv.slice(2)) {
  const absoluteFilePath = resolve(rootDirectory, filePath);
  const workspaceDirectory = workspaceDirectories.find((candidateDirectory) => {
    const absoluteWorkspaceDirectory = resolve(rootDirectory, candidateDirectory);

    return absoluteFilePath.startsWith(`${absoluteWorkspaceDirectory}${sep}`);
  });

  if (workspaceDirectory === undefined) {
    continue;
  }

  filesByWorkspace
    .get(workspaceDirectory)
    ?.push(relative(resolve(rootDirectory, workspaceDirectory), absoluteFilePath));
}

for (const [workspaceDirectory, filePaths] of filesByWorkspace) {
  if (filePaths.length === 0) {
    continue;
  }

  const result = spawnSync(process.execPath, [tscFilesPath, '--noEmit', ...filePaths], {
    cwd: resolve(rootDirectory, workspaceDirectory),
    stdio: 'inherit',
  });

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
