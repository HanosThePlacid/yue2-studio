import { json } from '@sveltejs/kit';
import { listJobs } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json(listJobs());
