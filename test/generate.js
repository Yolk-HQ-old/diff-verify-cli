import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

fs.writeFileSync(path.join(__dirname, 'generated.txt'), 'hello\nworld');
fs.writeFileSync(path.join(__dirname, 'generated', 'hello.txt'), 'hello');
fs.writeFileSync(path.join(__dirname, 'generated', 'world.txt'), 'world');
