import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const writeFile = fs.promises.writeFile;
const mkdir = fs.promises.mkdir;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

(async () => {
  await writeFile(path.join(__dirname, 'generated.txt'), 'hello\nworld');
  await mkdir(path.join(__dirname, 'generated'), { recursive: true });
  await writeFile(path.join(__dirname, 'generated', 'hello.txt'), 'hello');
  await writeFile(path.join(__dirname, 'generated', 'world.txt'), 'world');
})();
