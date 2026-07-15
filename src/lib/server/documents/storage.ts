import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

export class UploadError extends Error {}

export interface StoredFile {
	storagePath: string;
	mimeType: string;
	sizeBytes: number;
}

const MAX_BYTES = 25 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([
	'.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.ps1', '.sh', '.js', '.vbs', '.jar'
]);

export const DEFAULT_UPLOAD_ROOT = resolve('data/uploads');

/** Absoluten Zielpfad bilden und sicherstellen, dass er im Wurzelverzeichnis bleibt */
function resolveInside(root: string, relativePath: string): string {
	const absoluteRoot = resolve(root);
	const absolute = resolve(absoluteRoot, relativePath);
	if (absolute !== absoluteRoot && !absolute.startsWith(absoluteRoot + sep)) {
		throw new UploadError('Ungültiger Dateipfad.');
	}
	return absolute;
}

export async function saveUpload(
	file: File,
	companyId: string,
	root: string = DEFAULT_UPLOAD_ROOT
): Promise<StoredFile> {
	if (file.size === 0) throw new UploadError('Datei ist leer.');
	if (file.size > MAX_BYTES) throw new UploadError('Datei ist größer als 25 MB.');

	const extension = extname(file.name).toLowerCase();
	if (BLOCKED_EXTENSIONS.has(extension)) {
		throw new UploadError('Dieser Dateityp ist nicht erlaubt.');
	}

	// Pfad besteht nur aus companyId (UUID aus der DB) und frischer UUID — nie aus Nutzereingaben
	const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
	const storagePath = join(companyId, `${randomUUID()}${safeExtension}`);
	const absolute = resolveInside(root, storagePath);

	await mkdir(join(resolve(root), companyId), { recursive: true });
	await writeFile(absolute, Buffer.from(await file.arrayBuffer()));

	return {
		storagePath,
		mimeType: file.type || 'application/octet-stream',
		sizeBytes: file.size
	};
}

export async function deleteStoredFile(
	storagePath: string,
	root: string = DEFAULT_UPLOAD_ROOT
): Promise<void> {
	const absolute = resolveInside(root, storagePath);
	await rm(absolute, { force: true });
}

export function storedFilePath(storagePath: string, root: string = DEFAULT_UPLOAD_ROOT): string {
	return resolveInside(root, storagePath);
}
