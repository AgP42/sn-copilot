/**
 * Tests for src/storage/debugLogFile — the USB-readable diagnostic
 * appender for devices without adb. Pins: append + timestamp prefix,
 * size cap, and swallow-all-failures.
 */
import {appendDebugLine, DEBUG_LOG_PATH} from '../src/storage/debugLogFile';
import {createInMemoryFileIo} from './helpers/inMemoryFileIo';

const readLog = async (io: ReturnType<typeof createInMemoryFileIo>) => {
  const bytes = await io.readBytes(DEBUG_LOG_PATH);
  return bytes === null ? '' : new TextDecoder().decode(bytes);
};

describe('appendDebugLine', () => {
  it('appends timestamped lines in order', async () => {
    const io = createInMemoryFileIo();
    await appendDebugLine(io, '[unlock] attempt len=6 → wrong-pin');
    await appendDebugLine(io, '[unlock] attempt len=6 → ok');
    const text = await readLog(io);
    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.*wrong-pin$/);
    expect(lines[1]).toMatch(/ok$/);
  });

  it('caps the file size, keeping the newest lines', async () => {
    const io = createInMemoryFileIo();
    for (let i = 0; i < 200; i++) {
      await appendDebugLine(io, `line ${i} ${'x'.repeat(80)}`);
    }
    const text = await readLog(io);
    expect(text.length).toBeLessThanOrEqual(8_192);
    expect(text).toContain('line 199');
    expect(text).not.toContain('line 0 ');
  });

  it('starts fresh when the existing log is unreadable (read throws)', async () => {
    const io = createInMemoryFileIo();
    const originalRead = io.readBytes.bind(io);
    io.readBytes = async (path: string) => {
      if ((io.readBytes as unknown as {threwOnce?: boolean}).threwOnce !== true) {
        (io.readBytes as unknown as {threwOnce?: boolean}).threwOnce = true;
        throw new Error('io boom');
      }
      return originalRead(path);
    };
    await appendDebugLine(io, 'after read failure');
    const text = await readLog(io);
    expect(text).toContain('after read failure');
  });

  it('swallows write failures silently', async () => {
    const io = createInMemoryFileIo();
    io.writeBytes = async () => {
      throw new Error('disk full');
    };
    await expect(
      appendDebugLine(io, 'must not throw'),
    ).resolves.toBeUndefined();
  });
});
