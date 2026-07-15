import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { deleteStoredFile, saveUpload, UploadError } from './storage';

const TEST_ROOT = resolve('data-test/uploads');

afterEach(async () => {
	await rm(resolve('data-test'), { recursive: true, force: true });
});

function makeFile(name: string, content = 'inhalt', type = 'application/pdf'): File {
	return new File([content], name, { type });
}

describe('dokumenten-storage', () => {
	it('speichert eine datei unter <root>/<companyId>/<uuid>.<ext>', async () => {
		const stored = await saveUpload(makeFile('vertrag.pdf'), 'firma-1', TEST_ROOT);
		expect(stored.mimeType).toBe('application/pdf');
		expect(stored.sizeBytes).toBeGreaterThan(0);
		expect(stored.storagePath).toMatch(/^firma-1\/[0-9a-f-]+\.pdf$/);
		expect(existsSync(join(TEST_ROOT, stored.storagePath))).toBe(true);
	});

	it('verhindert path traversal über dateinamen', async () => {
		const stored = await saveUpload(makeFile('../../boese.pdf'), 'firma-1', TEST_ROOT);
		const absolute = resolve(TEST_ROOT, stored.storagePath);
		expect(absolute.startsWith(TEST_ROOT)).toBe(true);
		expect(existsSync(absolute)).toBe(true);
	});

	it('lehnt ausführbare dateitypen ab', async () => {
		await expect(saveUpload(makeFile('virus.exe'), 'firma-1', TEST_ROOT)).rejects.toThrow(UploadError);
		await expect(saveUpload(makeFile('script.sh'), 'firma-1', TEST_ROOT)).rejects.toThrow(UploadError);
	});

	it('lehnt dateien über 25 MB ab', async () => {
		const big = new File([new Uint8Array(26 * 1024 * 1024)], 'gross.pdf', {
			type: 'application/pdf'
		});
		await expect(saveUpload(big, 'firma-1', TEST_ROOT)).rejects.toThrow(UploadError);
	});

	it('löscht eine gespeicherte datei', async () => {
		const stored = await saveUpload(makeFile('weg.pdf'), 'firma-1', TEST_ROOT);
		await deleteStoredFile(stored.storagePath, TEST_ROOT);
		expect(existsSync(join(TEST_ROOT, stored.storagePath))).toBe(false);
	});

	it('verhindert path traversal beim löschen', async () => {
		await expect(deleteStoredFile('../ausserhalb.txt', TEST_ROOT)).rejects.toThrow(UploadError);
	});
});
