export const isDebug = process.env.RIVET_AI_PROVIDER_DEBUG === 'true'

export function printObject(obj: unknown): string {
	const seen = new WeakSet()

	return JSON.stringify(
		obj,
		(_, value) => {
			if (typeof value === 'function') {
				return `[Function: ${value.name || 'anonymous'}]`
			}

			if (typeof value === 'object' && value !== null) {
				if (seen.has(value)) {
					return '[Circular]'
				}
				seen.add(value)
			}

			return value
		},
		2 // Indentation level for pretty-printing
	)
}

export const debugLog = (...args: unknown[]) => {
  if (isDebug) {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}
