#!/usr/bin/env -S node --experimental-strip-types
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { exit, hrtime } from 'node:process';

type Platform = 'ios' | 'android';

type BuildRecord = {
  id: string;
  appVersion?: string;
  appBuildVersion?: string | number;
  iosVersion?: string;
  iosBuildNumber?: string | number;
  androidVersion?: string;
  androidVersionCode?: string | number;
  buildProfile?: string;
  gitCommitHash?: string;
};

type Args = {
  platform: Platform;
  buildJsonPath: string;
  artifactPath: string;
  outPath: string;
  tag: string;
  commitSha: string;
};

export const parseArgs = (argv: readonly string[]): Args => {
  const get = (flag: string): string => {
    const idx = argv.indexOf(flag);
    if (idx < 0 || idx + 1 >= argv.length) {
      throw new Error(`missing required flag: ${flag}`);
    }
    return argv[idx + 1]!;
  };
  const platform = get('--platform');
  if (platform !== 'ios' && platform !== 'android') {
    throw new Error(`--platform must be 'ios' or 'android', got '${platform}'`);
  }
  return {
    platform,
    buildJsonPath: resolve(get('--build')),
    artifactPath: resolve(get('--artifact')),
    outPath: resolve(get('--out')),
    tag: get('--tag'),
    commitSha: get('--sha'),
  };
};

export const sha256OfFile = async (path: string): Promise<string> => {
  const hash = createHash('sha256');
  await new Promise<void>((res, rej) => {
    createReadStream(path).on('data', (c) => hash.update(c)).on('end', () => res()).on('error', rej);
  });
  return hash.digest('hex');
};

const readBuildRecord = (path: string): BuildRecord => {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as BuildRecord | BuildRecord[];
  const record = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!record || typeof record !== 'object' || !record.id) {
    throw new Error(`expected a build record with 'id' in ${path}`);
  }
  return record;
};

const pickBuildNumber = (platform: Platform, record: BuildRecord): number => {
  const raw =
    platform === 'ios'
      ? record.iosBuildNumber ?? record.appBuildVersion
      : record.androidVersionCode ?? record.appBuildVersion;
  if (raw === undefined || raw === null) {
    throw new Error(`could not derive ${platform} build number from build record`);
  }
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`invalid ${platform} build number: ${String(raw)}`);
  }
  return n;
};

const pickVersion = (platform: Platform, record: BuildRecord, fallbackTag: string): string => {
  const raw = platform === 'ios' ? record.iosVersion ?? record.appVersion : record.androidVersion ?? record.appVersion;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return fallbackTag.replace(/^mobile-v/, '');
};

export const buildManifest = async (args: Args) => {
  const record = readBuildRecord(args.buildJsonPath);
  const stat = statSync(args.artifactPath);
  const sha256 = await sha256OfFile(args.artifactPath);
  return {
    platform: args.platform,
    tag: args.tag,
    version: pickVersion(args.platform, record, args.tag),
    buildNumber: pickBuildNumber(args.platform, record),
    commitSha: args.commitSha,
    profile: record.buildProfile ?? 'release-unsigned',
    builtAt: new Date().toISOString(),
    buildId: record.id,
    artifact: {
      name: basename(args.artifactPath),
      size: stat.size,
      sha256,
    },
  };
};

const main = async () => {
  const start = hrtime.bigint();
  const args = parseArgs(process.argv.slice(2));
  const manifest = await buildManifest(args);
  writeFileSync(args.outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const ms = Number((hrtime.bigint() - start) / 1_000_000n);
  process.stdout.write(`wrote ${args.outPath} in ${ms}ms\n`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    process.stderr.write(`write-build-manifest failed: ${err instanceof Error ? err.message : String(err)}\n`);
    exit(1);
  });
}
