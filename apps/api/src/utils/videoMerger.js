/**
 * Video merger utility using fluent-ffmpeg.
 *
 * Downloads individual clips to a temp directory, concatenates them with
 * FFmpeg's concat demuxer (no re-encode, stream copy → fast + lossless),
 * and returns the path of the merged file.
 *
 * The caller is responsible for uploading the merged file and cleaning up
 * the temp directory via cleanupTempDir().
 */

import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import logger from './logger.js';

// Point fluent-ffmpeg at the bundled binary so no system FFmpeg is needed.
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Create a temporary directory for this merge operation.
 * @returns {Promise<string>} Absolute path of the temp dir.
 */
export async function createTempDir() {
  const dir = join(tmpdir(), `vmerge-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Remove the temporary directory and all its contents.
 * Call this after you have finished uploading the merged file.
 * @param {string} dir
 */
export async function cleanupTempDir(dir) {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch (err) {
    logger.warn(`videoMerger: failed to clean temp dir ${dir}: ${err.message}`);
  }
}

/**
 * Download a remote video URL to a local file.
 * @param {string} url   - Public URL of the video.
 * @param {string} dest  - Absolute path to write to.
 * @returns {Promise<void>}
 */
export async function downloadVideo(url, dest) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video (${response.status}): ${url}`);
  }
  await pipeline(response.body, createWriteStream(dest));
}

/**
 * Concatenate an ordered list of local video files into a single output file
 * using FFmpeg's concat demuxer (stream copy — no re-encode).
 *
 * All input clips MUST share the same codec, resolution, and frame rate
 * (GeminiGen guarantees this for clips from the same model/resolution).
 *
 * @param {string[]} inputPaths  - Ordered array of absolute file paths.
 * @param {string}   outputPath  - Absolute path for the merged output.
 * @returns {Promise<string>}    - Resolves with outputPath on success.
 */
export async function concatVideos(inputPaths, outputPath) {
  if (inputPaths.length === 0) throw new Error('concatVideos: no input files');
  if (inputPaths.length === 1) {
    // Nothing to merge — just return the single file path as-is.
    return inputPaths[0];
  }

  // Write FFmpeg concat list file
  const listPath = outputPath.replace(/\.mp4$/, '_list.txt');
  const listContent = inputPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  await writeFile(listPath, listContent, 'utf8');

  logger.info(`videoMerger: concatenating ${inputPaths.length} clips → ${outputPath}`);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(outputPath)
      .on('start', (cmd) => logger.info(`videoMerger FFmpeg: ${cmd}`))
      .on('end', () => {
        logger.info(`videoMerger: merge complete → ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error(`videoMerger: FFmpeg error: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

/**
 * High-level helper: download all clip URLs and merge them.
 *
 * @param {string[]} clipUrls   - Ordered list of public clip URLs.
 * @param {string}   tempDir    - Temp directory to use for downloads.
 * @returns {Promise<string>}   - Absolute path of the merged output file.
 */
export async function downloadAndMerge(clipUrls, tempDir) {
  if (clipUrls.length === 0) throw new Error('downloadAndMerge: no clip URLs');

  // Download all clips in parallel
  const downloadPaths = clipUrls.map((_, i) => join(tempDir, `clip_${String(i).padStart(3, '0')}.mp4`));

  await Promise.all(
    clipUrls.map((url, i) => downloadVideo(url, downloadPaths[i]))
  );

  if (clipUrls.length === 1) {
    return downloadPaths[0];
  }

  const outputPath = join(tempDir, 'merged.mp4');
  return concatVideos(downloadPaths, outputPath);
}
