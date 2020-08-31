
import path from 'path';
import os from 'os';
import * as utils from '../lib/utils';
import fs from 'fs-extra';
import leveldown from 'leveldown';
import {AbstractLevelDOWN} from 'abstract-leveldown';
import childProcess from 'child_process';

const du = (absPath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    childProcess.exec(`du -s ${absPath}`, (err: Error|null, stdout: string) => {
      if (err) reject(err);
      else resolve(parseInt(`${stdout.split(/\s+/)[0]}`));
    });
  });
}

export const disk = async (fn: (backend: AbstractLevelDOWN, checkDiskUsage: () => Promise<number>) => Promise<any>): Promise<void> => {
  const dir = path.join(os.tmpdir(), `node-quadstore-${utils.nanoid()}`);
  const checkDiskUsage = () => du(dir);
  const backend = leveldown(dir);
  await fn(backend, checkDiskUsage);
  await fs.remove(dir);
};

export const time = async <T>(fn: () => Promise<T>): Promise<{time: number, value: T }> => {
  const start = Date.now();
  const value = await fn();
  return { time: Date.now() - start, value };
};
