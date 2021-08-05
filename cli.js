#!/usr/bin/env node

import chalk from 'chalk';
import del from 'del';
import { diffLines } from 'diff';
import execa from 'execa';
import fs from 'fs';
import { globby } from 'globby';
import isPathCwd from 'is-path-cwd';
import isPathInside from 'is-path-inside';
import meow from 'meow';
import moveFile from 'move-file';
import pathExists from 'path-exists';

const readFile = fs.promises.readFile;

const cli = meow(
  `
  Verify that a command generates files which match existing files on disk.
  Files matching the path/glob specified by '-p' will be renamed with a '.tmp' suffix, then the
  command will be executed, and newly-generated files will be compared with the existing '.tmp'
  files. If a diff is found, then diff-verify will exit with a status code of 1.
  
  Usage
    $ diff-verify -p <path|glob> -- <command> [...args]

  Examples
    $ diff-verify -p apps/bot-studio-web/graphql-types.ts -- node_modules/.bin/graphql-codegen --config apps/bot-studio-web/codegen.yml

    $ diff-verify -p apps/admin-web/locales -- nx run admin-web:linguiExtract
`,
  {
    importMeta: import.meta,
    flags: {
      dryRun: {
        type: 'boolean',
      },
      path: {
        type: 'string',
        alias: 'p',
        isRequired: true,
        isMultiple: true,
      },
    },
  },
);

const log = (prefix, message) => {
  let p = '';
  switch (prefix) {
    case 'rename':
      p = chalk.blue('rename');
      break;
    case 'emit':
      p = chalk.yellow('emit');
      break;
    case 'diff':
      p = chalk.green('diff');
      break;
    case 'delete':
      p = chalk.magenta('delete');
      break;
    case 'error':
      p = chalk.red('error');
      break;
    default:
      p = prefix;
      break;
  }
  const out = `[${p}]`.padEnd(20) + message;
  if (prefix === 'error') {
    console.error(out);
  } else {
    console.log(out);
  }
};

(async () => {
  const emitCommand = cli.input;
  if (emitCommand.length === 0) {
    log('error', 'Missing command');
    cli.showHelp(1);
    return;
  }

  const dryRun = cli.flags.dryRun;
  const files = await globby(cli.flags.path);

  // Rename each file to *.tmp
  for (const file of files) {
    const tempFile = `${file}.tmp`;
    if (isPathCwd(file)) {
      throw new Error(`"${file}": Cannot rename the current working directory.`);
    }
    if (!isPathInside(file, process.cwd())) {
      throw new Error(
        `"${file}": Cannot rename files/directories outside the current working directory.`,
      );
    }
    if (await pathExists(tempFile)) {
      throw new Error(`"${tempFile}" already exists. It must be deleted to proceed.`);
    }
  }
  for (const file of files) {
    const tempFile = `${file}.tmp`;
    log('rename', `"${file}" -> "${tempFile}"`);
    if (dryRun) continue;

    await moveFile(file, tempFile);
  }

  // Run emit command
  log('emit', emitCommand.join(' '));
  if (!dryRun) {
    await execa(emitCommand[0], emitCommand.slice(1), { stdio: 'inherit' });
  }

  // Expect files to be emitted
  let emitFailed = false;
  for (const file of files) {
    if (!(await pathExists(file))) {
      log('error', `Command failed to emit "${file}".`);
      emitFailed = true;
    }
  }
  if (emitFailed) {
    process.exitCode = 1;
    return;
  }

  // Diff each file
  let diffFound = false;
  for (const file of files) {
    const tempFile = `${file}.tmp`;
    log('diff', `"${file}" <> "${tempFile}"`);
    if (dryRun) continue;

    const fileContents = await readFile(file, { encoding: 'utf8' });
    const tempFileContents = await readFile(tempFile, { encoding: 'utf8' });
    const diff = diffLines(fileContents, tempFileContents);
    if (diff.length > 1) {
      log('error', `Found diff in "${file}".`);
      diffFound = true;
    }
  }

  if (diffFound) {
    process.exitCode = 1;
    return;
  }

  for (const file of files) {
    log('delete', `"${file}.tmp"`);
    if (dryRun) continue;

    await del(`${file}.tmp`);
  }
})();
