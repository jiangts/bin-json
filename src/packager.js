/**
 * @private
 *
 * Utilities for concatenating Node buffers and typed arrays.
 * Buffers are encoded in the following format:
 *   [comma-separated buffer lengths][null byte delimiter][actual buffers]
 */

import { small } from './strings';
const getBufferLength = buffer => buffer.byteLength;
const addBufferSize = (acc, buffer) => acc + buffer.byteLength;

/**
 * Mostly the same as TypedArray#slice, but with browser support.
 * (IE, opera, & safari are problem customers).
 * @param  {TypedArray} view - Any of the typed arrays.
 * @param  {Number} start - A zero-based starting index.
 * @param  {Number} end - The ending index (exclusive).
 * @return {ArrayBuffer} - New buffer with the sliced values.
 */
const sliceBuffer = (view, start, end) => {
  const copy = new Uint8Array(end - start);

  for (let idx = start; idx < end; idx += 1) {
    copy[idx - start] = view[idx];
  }

  return copy.buffer;
};

/**
 * Basically TypedArray::findIndex, but with browser support.
 * @param  {TypedArray} buffer - Used to find the value index.
 * @param  {Number} value - A value to locate.
 * @return {Number} - The index, or -1 if not found.
 */
const findIndex = (buffer, value) => {
  for (let idx = 0; idx < buffer.byteLength; idx += 1) {
    if (buffer[idx] === value) {
      return idx;
    }
  }

  return -1;
};

/**
 * Take a list of buffers and copy them into a new buffer.
 * @param  {TypedArray[]} buffers - Typed arrays to join.
 * @return {ArrayBuffer} - All the binary data copied into a new buffer.
 */
const concatBuffers = buffers => {
  // Make a new buffer big enough to hold all the others.
  const size = buffers.reduce(addBufferSize, 0);
  const view = new Uint8Array(size);

  // Add the data from each buffer.
  buffers.reduce((cursor, buffer) => {
    // TypedArray#set() doesn't respect byte sizing.
    if (buffer.BYTES_PER_ELEMENT !== 1) {
      buffer = new Uint8Array(buffer.buffer);
    }

    view.set(buffer, cursor);
    return cursor + buffer.byteLength;
  }, 0);

  return view.buffer;
};

/**
 * Takes a list of buffers (or typed arrays) and combines them,
 * attaching metadata so they can be parsed out later.
 * @param  {TypedArray[]} buffers - Binary values to combine.
 * @return {ArrayBuffer} - A new buffer containing all the new values.
 */
export const pack = buffers => {
  const lengths = buffers.map(getBufferLength).join(',');
  const header = small.encode(`${lengths}\0`);

  return concatBuffers([header].concat(buffers));
};

/**
 * Figures out what lengths the buffers are.
 * @param  {TypedArray} view - A previously packed ArrayBuffer view.
 * @param  {TypedArray} delimiter - A previously packed ArrayBuffer view.
 * @return {Number[]} - The lengths of each buffer.
 */
const getBufferLengths = (view, delimiter) => {
  const codes = sliceBuffer(view, 0, delimiter);
  const text = small.decode(codes);

  return text.split(',').map(Number);
};

/**
 * Pulls out a list of buffers from a packed buffer.
 * @param  {ArrayBuffer} buffer - Something generated by `pack(...)`.
 * @return {ArrayBuffer[]} - Unpacked buffers.
 */
export const unpack = buffer => {
  const view = new Uint8Array(buffer);

  // Locate the null byte delimiter.
  const delimiter = findIndex(view, 0);

  // Find all the sub-buffers.
  const bufferLengths = getBufferLengths(view, delimiter);

  // Extract each sub-buffer.
  const { buffers } = bufferLengths.reduce(
    ({ cursor, buffers }, length) => {
      const end = cursor + length;
      const buffer = sliceBuffer(view, cursor, end);

      return {
        buffers: buffers.concat(buffer),
        cursor: end,
      };
    },
    {
      cursor: delimiter + 1,
      buffers: [],
    },
  );

  return buffers;
};
