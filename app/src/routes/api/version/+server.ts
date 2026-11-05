import { json } from '@sveltejs/kit';
import { versionInfo } from '$lib/server/version';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json(versionInfo());
