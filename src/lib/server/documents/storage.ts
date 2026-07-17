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

export async function saveBuffer(
	buffer: Buffer,
	fileName: string,
	subdir: string,
	mimeType: string,
	root: string = DEFAULT_UPLOAD_ROOT
): Promise<StoredFile> {
	if (buffer.length === 0) throw new UploadError('Datei ist leer.');
	if (buffer.length > MAX_BYTES) throw new UploadError('Datei ist größer als 25 MB.');

	const extension = extname(fileName).toLowerCase();
	if (BLOCKED_EXTENSIONS.has(extension)) {
		throw new UploadError('Dieser Dateityp ist nicht erlaubt.');
	}

	// Pfad besteht nur aus subdir (UUID aus der DB) und frischer UUID — nie aus Nutzereingaben
	const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
	const storagePath = join(subdir, `${randomUUID()}${safeExtension}`);
	const absolute = resolveInside(root, storagePath);

	await mkdir(join(resolve(root), subdir), { recursive: true });
	await writeFile(absolute, buffer);

	return {
		storagePath,
		mimeType: mimeType || 'application/octet-stream',
		sizeBytes: buffer.length
	};
}

export async function saveUpload(
	file: File,
	companyId: string,
	root: string = DEFAULT_UPLOAD_ROOT
): Promise<StoredFile> {
	return saveBuffer(Buffer.from(await file.arrayBuffer()), file.name, companyId, file.type, root);
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
