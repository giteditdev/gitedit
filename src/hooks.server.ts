// @ts-ignore
import { addWorker } from 'atreyu/start-worker.js'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => addWorker(html)
	})

	return response
}
