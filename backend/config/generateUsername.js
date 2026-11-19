import crypto from "crypto";
import User from "../models/User.js";

/*
  Builds short, readable usernames from a first and last name plus two digits.
  Only a-z and 0-9 are used, so the result always passes the schema's /^[a-z0-9_.]+$/ rule,
  and it is at most 12 characters.

  Adaeze Okafor       -> adaeze47, okafor23
  Chukwuemeka Nwosu   -> chukwu38, cnwosu52, nwosu16
  Ibrahim Musa        -> ibrahim21, imusa84, ibra60
*/

const MAX_BASE = 10; // letters before the digits, so usernames stay <= 12 characters
const MIN_BASE = 3;
const AVOID = new Set(["69", "13"]); // numbers people tend to dislike

// "Chukwuemeka" -> "chukwuemeka", "Zoë" -> "zoe", "O'Brien" -> "obrien"
const clean = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

// Long names are cut right after a vowel so they still sound like a name:
// "ibrahim" -> "ibra", "oluwaseun" -> "oluwa", "emmanuel" -> "emma"
const shorten = (name, keepWhole = 6) => {
  if (name.length <= keepWhole) return name;
  const head = name.slice(0, keepWhole);
  for (let i = 3; i < head.length; i++) {
    if ("aeiou".includes(head[i])) return head.slice(0, i + 1);
  }
  return head;
};

const twoDigits = () => {
  let n;
  do {
    n = String(crypto.randomInt(10, 100));
  } while (AVOID.has(n));
  return n;
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Different shapes of the same person, all short. Exported so it can be tested without a database.
export const buildBases = (firstName, lastName) => {
  const f = clean(firstName);
  const l = clean(lastName);
  const fs = shorten(f);
  const ls = shorten(l);
  const fi = f[0] || "";
  const li = l[0] || "";

  // Joining two pieces must not double a letter ("oluwaa") or clash two vowels ("adaezeo")
  const joinOk = (left, right) => {
    if (!left || !right) return false;
    const a = left[left.length - 1];
    const b = right[0];
    return a !== b && !("aeiou".includes(a) && "aeiou".includes(b));
  };

  const variants = [
    f.length <= 8 ? f : "", //                  adaeze47
    fs, //                                      adaeze47, ibra47
    l.length <= 8 ? l : "", //                  okafor52
    joinOk(fi, l) ? fi + l : "", //             aokafor81 (first initial + last name)
    joinOk(fs, li) ? fs + li : "", //           adaezek23 (first name + last initial)
  ];

  const unique = [...new Set(variants)].filter((b) => b.length >= MIN_BASE && b.length <= MAX_BASE);
  return unique.length ? unique : ["user"];
};

/**
 * Returns a username that is not taken yet (soft-deleted accounts count as taken).
 * The unique index on User.username is still the final guard against two signups
 * picking the same name in the same instant.
 */
export async function generateUsername(firstName, lastName) {
  const bases = buildBases(firstName, lastName);

  for (let round = 0; round < 3; round++) {
    const candidates = [...new Set(shuffle(bases).flatMap((b) => [b + twoDigits(), b + twoDigits()]))];

    // One query for all candidates instead of one per candidate
    const taken = await User.find({ username: { $in: candidates } })
      .select("username")
      .setOptions({ withDeleted: true })
      .lean();
    const takenSet = new Set(taken.map((u) => u.username));

    const free = candidates.find((c) => !takenSet.has(c));
    if (free) return free;
  }

  // Very common name: fall back to a longer number
  const base = bases[0];
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}${crypto.randomInt(1000, 10000)}`;
    if (!(await User.exists({ username: candidate }).setOptions({ withDeleted: true }))) return candidate;
  }
  return `${base}${Date.now().toString().slice(-6)}`;
}