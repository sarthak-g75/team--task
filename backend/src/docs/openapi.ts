import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const specPath = resolve(process.cwd(), 'openapi.yaml');

export const openapiSpec = parse(readFileSync(specPath, 'utf8')) as Record<string, unknown>;
