export function timeAgo(epochSeconds: number): string {
	const s = Math.max(0, Date.now() / 1000 - epochSeconds);
	if (s < 60) return 'just now';
	if (s < 3600) return `${Math.floor(s / 60)}m ago`;
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
	return `${Math.floor(s / 86400)}d ago`;
}

export function duration(ms: number | null | undefined): string {
	if (!ms) return '–';
	const total = Math.round(ms / 1000);
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function dayLabel(epochSeconds: number): string {
	const d = new Date(epochSeconds * 1000);
	const today = new Date();
	const yesterday = new Date(Date.now() - 86400_000);
	const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
	if (same(d, today)) return 'Today';
	if (same(d, yesterday)) return 'Yesterday';
	return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

export function dateTime(epochSeconds: number): string {
	return new Date(epochSeconds * 1000).toLocaleString();
}
