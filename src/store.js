import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const file = path.join(directory, 'store.json');

const blankStore = () => ({
  guilds: {},
  submissions: {},
  posts: {},
  notifications: {},
});

export const store = blankStore();

let saveQueue = Promise.resolve();

export async function loadStore() {
  await mkdir(directory, { recursive: true });
  try {
    const saved = JSON.parse(await readFile(file, 'utf8'));
    Object.assign(store, blankStore(), saved);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await saveStore();
  }
}

export function saveStore() {
  const snapshot = JSON.stringify(store, null, 2);
  saveQueue = saveQueue.then(async () => {
    await mkdir(directory, { recursive: true });
    const temporary = `${file}.tmp`;
    await writeFile(temporary, snapshot, 'utf8');
    await rename(temporary, file);
  });
  return saveQueue;
}
