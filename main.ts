// One Star, Written in Sap — entry program (program/v1).
// Writes a single one-line 1-star review, in the voice of a houseplant,
// about the human who owns it, to /output/entry.txt.
// Deterministic: no network, no clock, no random, no environment input.
// The review is composed from fixed fragments, then checked against the
// published gate (1-279 characters, one line, UTF-8, not blank) before
// it is written. The program then reads the file back and proves the
// bytes it wrote with a sha256 digest.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const OUTPUT_PATH = "/output/entry.txt";
const GATE_MIN_CHARS = 1;
const GATE_MAX_CHARS = 279;

// The houseplant speaks in three beats: the rating, the grievance, the
// verdict. Each beat is a fixed fragment; the composer joins them in a
// fixed order, so the output never changes between runs.
const RATING_BEAT = "One star.";
const GRIEVANCE_BEAT =
  "He waters me like a man apologizing to a parking meter, " +
  "then drags me six inches from the window and calls it a fresh start.";
const VERDICT_BEAT =
  "I have not seen direct sun since March, " +
  "and my leaves have started keeping receipts.";

// Words the judge brief names as stock phrases. The gate refuses the
// entry when any of them appears, so a stale line never ships.
const BANNED_PHRASES = [
  "drama queen",
  "dramatic wilting",
  "being ignored",
  "ignored",
];

// A small, fixed vocabulary of plant nouns used only by the self-check
// that proves the line is written from a plant's point of view.
const PLANT_WORDS = ["sun", "window", "leaves", "soil", "pot", "water"];

function countCodePoints(text: string): number {
  return [...text].length;
}

function hasBannedPhrase(text: string): boolean {
  const lowered = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lowered.includes(phrase)) {
      return true;
    }
  }
  return false;
}

function hasPlantVoice(text: string): boolean {
  const lowered = text.toLowerCase();
  let hits = 0;
  for (const word of PLANT_WORDS) {
    if (lowered.includes(word)) {
      hits += 1;
    }
  }
  return hits >= 2;
}

function hasGrievance(text: string): boolean {
  const lowered = text.toLowerCase();
  const markers = ["waters", "drags", "calls it", "not seen"];
  let hits = 0;
  for (const marker of markers) {
    if (lowered.includes(marker)) {
      hits += 1;
    }
  }
  return hits >= 2;
}

function isSingleLine(text: string): boolean {
  if (text.includes("\n")) {
    return false;
  }
  if (text.includes("\r")) {
    return false;
  }
  return true;
}

function utf8RoundTrips(text: string): boolean {
  const encoded = Buffer.from(text, "utf8");
  const decoded = encoded.toString("utf8");
  return decoded === text;
}

function startsWithRating(text: string): boolean {
  return text.startsWith("One star");
}

function endsWithPeriod(text: string): boolean {
  return text.endsWith(".");
}

function composeReview(): string {
  const beats = [RATING_BEAT, GRIEVANCE_BEAT, VERDICT_BEAT];
  const joined = beats.join(" ");
  return joined;
}

type GateCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

function runGate(text: string): GateCheck[] {
  const chars = countCodePoints(text);
  const checks: GateCheck[] = [];
  checks.push({
    name: "length",
    passed: chars >= GATE_MIN_CHARS && chars <= GATE_MAX_CHARS,
    detail: `${chars} characters, gate ${GATE_MIN_CHARS}-${GATE_MAX_CHARS}`,
  });
  checks.push({
    name: "not-blank",
    passed: text.trim().length > 0,
    detail: "trimmed length above zero",
  });
  checks.push({
    name: "single-line",
    passed: isSingleLine(text),
    detail: "no line breaks present",
  });
  checks.push({
    name: "utf8",
    passed: utf8RoundTrips(text),
    detail: "UTF-8 encode and decode round trip matches",
  });
  checks.push({
    name: "no-banned-phrase",
    passed: hasBannedPhrase(text) === false,
    detail: "none of the brief's stock phrases present",
  });
  checks.push({
    name: "plant-voice",
    passed: hasPlantVoice(text),
    detail: "at least two plant nouns present",
  });
  checks.push({
    name: "grievance",
    passed: hasGrievance(text),
    detail: "at least two grievance markers present",
  });
  checks.push({
    name: "starts-with-rating",
    passed: startsWithRating(text),
    detail: "opens with the one-star rating",
  });
  checks.push({
    name: "ends-with-period",
    passed: endsWithPeriod(text),
    detail: "closes with a full stop",
  });
  return checks;
}

function sha256Hex(data: Buffer): string {
  const digest = createHash("sha256");
  digest.update(data);
  return digest.digest("hex");
}

function main(): void {
  const review = composeReview();
  const checks = runGate(review);
  const failures: GateCheck[] = [];
  for (const check of checks) {
    if (check.passed === false) {
      failures.push(check);
    }
  }
  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`gate failed: ${failure.name} (${failure.detail})`);
    }
    process.exitCode = 1;
    return;
  }
  try { mkdirSync("/output", { recursive: true }); } catch (caughtError) {
    console.error(`cannot create output directory: ${String(caughtError)}`);
    process.exitCode = 1;
    return;
  }
  const bytes = Buffer.from(review, "utf8");
  try { writeFileSync(OUTPUT_PATH, bytes); } catch (caughtError) {
    console.error(`cannot write entry: ${String(caughtError)}`);
    process.exitCode = 1;
    return;
  }
  let written: Buffer;
  try { written = readFileSync(OUTPUT_PATH); } catch (caughtError) {
    console.error(`cannot read entry back: ${String(caughtError)}`);
    process.exitCode = 1;
    return;
  }
  const digest = sha256Hex(written);
  const matches = written.equals(bytes);
  if (matches === false) {
    console.error("read-back bytes differ from written bytes");
    process.exitCode = 1;
    return;
  }
  console.log(`status: ok`);
  console.log(`chars: ${countCodePoints(review)}`);
  console.log(`sha256: ${digest}`);
  console.log(`entry: ${review}`);
}

main();
