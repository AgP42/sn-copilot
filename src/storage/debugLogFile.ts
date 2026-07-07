// Append-style diagnostic log in the user-visible key-file folder.
//
// The Nomad/A5X have no adb access for end users, so when a secure
// flow misbehaves on-device (see the unlock-fails-with-correct-PIN
// report) the only way to get signal back is a file the user can
// read over USB and paste into an issue. Lines carry NO secrets:
// lengths, booleans, result kinds, salt PREFIXES (salts are public
// by construction).
//
// Failures are swallowed — diagnostics must never break the flow
// they observe. The file is capped so it can't grow unbounded.

import type {FileIo} from './fileIo';
import {decodeUtf8, encodeUtf8} from '../sdk/utf8';

export const DEBUG_LOG_PATH =
  '/storage/emulated/0/MyStyle/SnCopilot/copilot-debug.log';

const MAX_BYTES = 8_192;

export const appendDebugLine = async (
  io: FileIo,
  line: string,
): Promise<void> => {
  try {
    const existing = await io.readBytes(DEBUG_LOG_PATH).catch(() => null);
    const prev = existing === null ? '' : decodeUtf8(existing);
    const next = `${prev}${new Date().toISOString()} ${line}\n`;
    const capped =
      next.length > MAX_BYTES ? next.slice(next.length - MAX_BYTES) : next;
    await io.writeBytes(DEBUG_LOG_PATH, encodeUtf8(capped));
  } catch {
    // Diagnostics never take the caller down.
  }
};
