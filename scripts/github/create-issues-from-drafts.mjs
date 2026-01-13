import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--dir") args.dir = argv[++i];
    else if (a === "--repo") args.repo = argv[++i];
    else if (a === "--skip-existing") args.skipExisting = true;
    else args._.push(a);
  }
  return args;
}

function findSection(lines, header) {
  const idx = lines.findIndex((l) => l.trim() === header);
  return idx;
}

function parseTitle(lines) {
  const idx = findSection(lines, "## Title");
  if (idx === -1) return null;
  for (let i = idx + 1; i < lines.length; i += 1) {
    const t = lines[i].trim();
    if (t.length === 0) continue;
    if (t.startsWith("## ")) return null;
    return t;
  }
  return null;
}

function parseLabels(lines) {
  const idx = findSection(lines, "## Labels");
  if (idx === -1) return [];
  const labels = [];
  for (let i = idx + 1; i < lines.length; i += 1) {
    const l = lines[i].trim();
    if (l.length === 0) continue;
    if (l.startsWith("## ")) break;
    if (l.startsWith("- ")) labels.push(l.slice(2).trim());
  }
  return labels;
}

function stripTitleAndLabelsSections(content) {
  const lines = content.split(/\r?\n/);
  const sectionsToStrip = new Set(["## Title", "## Labels"]);

  const out = [];
  let stripping = false;
  let strippedAny = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      if (sectionsToStrip.has(trimmed)) {
        stripping = true;
        strippedAny = true;
        continue;
      }
      stripping = false;
    }

    if (!stripping) out.push(line);
  }

  // If file format is unexpected, fall back to full content.
  return strippedAny ? out.join("\n").trim() + "\n" : content.trim() + "\n";
}

function gh(args) {
  return execFileSync("gh", args, { stdio: ["ignore", "pipe", "pipe"] }).toString("utf8");
}

function issueExists({ title, repo }) {
  // Exact title match check (best-effort) to avoid duplicates.
  const out = gh([
    "issue",
    "list",
    "--repo",
    repo,
    "--search",
    `in:title "${title.replaceAll('"', '\\"')}"`,
    "--json",
    "title,number",
    "--limit",
    "20",
  ]);
  const issues = JSON.parse(out);
  return issues.some((i) => i.title === title);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = args.dir
    ? path.resolve(process.cwd(), args.dir)
    : path.resolve(process.cwd(), "docs/issue-drafts");
  const repo = args.repo || process.env.GH_REPO || "Akkkkkkki/curio";
  const dryRun = Boolean(args.dryRun);
  const skipExisting = Boolean(args.skipExisting);

  if (!fs.existsSync(dir)) {
    console.error(`Draft directory not found: ${dir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log(`No draft files found in ${dir}`);
    return;
  }

  console.log(`Repo: ${repo}`);
  console.log(`Drafts: ${dir}`);
  console.log(`Mode: ${dryRun ? "DRY RUN (no issues created)" : "CREATE"}`);
  console.log(`Skip existing by exact title match: ${skipExisting ? "yes" : "no"}`);
  console.log("");

  for (const f of files) {
    const fullPath = path.join(dir, f);
    const raw = fs.readFileSync(fullPath, "utf8");
    const lines = raw.split(/\r?\n/);
    const title = parseTitle(lines);
    if (!title) {
      console.warn(`Skipping (missing title section): ${f}`);
      continue;
    }
    const labels = parseLabels(lines);
    const body = stripTitleAndLabelsSections(raw);

    if (skipExisting && !dryRun) {
      if (issueExists({ title, repo })) {
        console.log(`SKIP (already exists): ${title}`);
        continue;
      }
    }

    const tmp = path.join(os.tmpdir(), `curio-issue-${Date.now()}-${Math.random().toString(16).slice(2)}.md`);
    fs.writeFileSync(
      tmp,
      `<!-- Imported from ${path.relative(process.cwd(), fullPath)} -->\n\n${body}`,
      "utf8",
    );

    const ghArgs = ["issue", "create", "--repo", repo, "--title", title, "--body-file", tmp];
    for (const l of labels) ghArgs.push("--label", l);

    if (dryRun) {
      console.log(`DRY: ${title}`);
      console.log(`  file: ${path.relative(process.cwd(), fullPath)}`);
      console.log(`  labels: ${labels.join(", ") || "(none)"}`);
    } else {
      const url = gh(ghArgs).trim();
      console.log(`CREATED: ${title}`);
      console.log(`  ${url}`);
    }

    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
}

main();

