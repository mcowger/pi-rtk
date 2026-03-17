const GIT_SUBCOMMANDS = ["diff", "status", "log", "show", "stash"];

// Matches "git <sub>" at the start of a string OR after a shell chain operator
// (&&, ||, ;, |). Handles both bare "git status" and "cd /path && git status".
const GIT_COMMAND_RE = new RegExp(
	`(?:^|&&\\s*|\\|\\|\\s*|;\\s*|\\|\\s*)git\\s+(${GIT_SUBCOMMANDS.join("|")})(?:\\s|$)`,
	"m"
);

export function isGitCommand(command: string | undefined | null): boolean {
	if (typeof command !== "string" || command.length === 0) {
		return false;
	}
	return GIT_COMMAND_RE.test(command);
}

// Extract the first matching git subcommand from a (possibly compound) command.
function getGitSubcommand(command: string): string | null {
	const m = GIT_COMMAND_RE.exec(command);
	return m ? m[1] : null;
}

export function compactDiff(output: string, maxLines: number = 50): string {
	const lines = output.split("\n");
	const result: string[] = [];
	let currentFile = "";
	let added = 0;
	let removed = 0;
	let inHunk = false;
	let hunkLines = 0;
	const maxHunkLines = 10;

	for (const line of lines) {
		if (result.length >= maxLines) {
			result.push("\n... (more changes truncated)");
			break;
		}

		// New file
		if (line.startsWith("diff --git")) {
			// Flush previous file stats
			if (currentFile && (added > 0 || removed > 0)) {
				result.push(`  +${added} -${removed}`);
			}

			// Extract filename
			const match = line.match(/diff --git a\/(.+) b\/(.+)/);
			currentFile = match ? match[2] : "unknown";
			result.push(`\n📄 ${currentFile}`);
			added = 0;
			removed = 0;
			inHunk = false;
			continue;
		}

		// Hunk header
		if (line.startsWith("@@")) {
			inHunk = true;
			hunkLines = 0;
			const hunkInfo = line.match(/@@ .+ @@/)?.[0] || "@@";
			result.push(`  ${hunkInfo}`);
			continue;
		}

		// Hunk content
		if (inHunk) {
			if (line.startsWith("+") && !line.startsWith("+++")) {
				added++;
				if (hunkLines < maxHunkLines) {
					result.push(`  ${line}`);
					hunkLines++;
				}
			} else if (line.startsWith("-") && !line.startsWith("---")) {
				removed++;
				if (hunkLines < maxHunkLines) {
					result.push(`  ${line}`);
					hunkLines++;
				}
			} else if (hunkLines < maxHunkLines && !line.startsWith("\\")) {
				if (hunkLines > 0) {
					result.push(`  ${line}`);
					hunkLines++;
				}
			}

			if (hunkLines === maxHunkLines) {
				result.push("  ... (truncated)");
				hunkLines++;
			}
		}
	}

	// Flush last file stats
	if (currentFile && (added > 0 || removed > 0)) {
		result.push(`  +${added} -${removed}`);
	}

	return result.join("\n");
}

interface StatusStats {
	staged: number;
	modified: number;
	untracked: number;
	conflicts: number;
	stagedFiles: string[];
	modifiedFiles: string[];
	untrackedFiles: string[];
}

export function compactStatus(output: string): string | null {
	const lines = output.split("\n");

	if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === "")) {
		return "Clean working tree";
	}

	// Guard: `git status` without -s/--short produces verbose prose output that
	// this parser cannot handle — it expects porcelain format (two-char status
	// codes, optional "##" branch header). Verbose output starts with English
	// sentences; passing it through produces garbage like:
	//   "Staged: 1 files / nges not staged for commit:"
	// Return null to leave the output unchanged.
	const firstNonEmpty = lines.find((l) => l.trim().length > 0) ?? "";
	const looksVerbose =
		firstNonEmpty.startsWith("On branch") ||
		firstNonEmpty.startsWith("HEAD detached") ||
		firstNonEmpty.startsWith("nothing to commit") ||
		firstNonEmpty.startsWith("No commits yet");
	if (looksVerbose) {
		return null;
	}

	const stats: StatusStats = {
		staged: 0,
		modified: 0,
		untracked: 0,
		conflicts: 0,
		stagedFiles: [],
		modifiedFiles: [],
		untrackedFiles: [],
	};

	let branchName = "";

	for (const line of lines) {
		// Extract branch name from first line
		if (line.startsWith("##")) {
			const match = line.match(/## (.+)/);
			if (match) {
				branchName = match[1].split("...")[0];
			}
			continue;
		}

		if (line.length < 3) {
			continue;
		}

		const status = line.slice(0, 2);
		const filename = line.slice(3);

		// Parse two-character status
		const indexStatus = status[0];
		const worktreeStatus = status[1];

		if (["M", "A", "D", "R", "C"].includes(indexStatus)) {
			stats.staged++;
			stats.stagedFiles.push(filename);
		}

		if (indexStatus === "U") {
			stats.conflicts++;
		}

		if (["M", "D"].includes(worktreeStatus)) {
			stats.modified++;
			stats.modifiedFiles.push(filename);
		}

		if (status === "??") {
			stats.untracked++;
			stats.untrackedFiles.push(filename);
		}
	}

	// Build summary
	let result = `📌 ${branchName}\n`;

	if (stats.staged > 0) {
		result += `✅ Staged: ${stats.staged} files\n`;
		const shown = stats.stagedFiles.slice(0, 5);
		for (const file of shown) {
			result += `  ${file}\n`;
		}
		if (stats.staged > 5) {
			result += `  ... +${stats.staged - 5} more\n`;
		}
	}

	if (stats.modified > 0) {
		result += `📝 Modified: ${stats.modified} files\n`;
		const shown = stats.modifiedFiles.slice(0, 5);
		for (const file of shown) {
			result += `  ${file}\n`;
		}
		if (stats.modified > 5) {
			result += `  ... +${stats.modified - 5} more\n`;
		}
	}

	if (stats.untracked > 0) {
		result += `❓ Untracked: ${stats.untracked} files\n`;
		const shown = stats.untrackedFiles.slice(0, 3);
		for (const file of shown) {
			result += `  ${file}\n`;
		}
		if (stats.untracked > 3) {
			result += `  ... +${stats.untracked - 3} more\n`;
		}
	}

	if (stats.conflicts > 0) {
		result += `⚠️  Conflicts: ${stats.conflicts} files\n`;
	}

	return result.trim();
}

export function compactLog(output: string, limit: number = 20): string {
	const lines = output.split("\n");
	const result: string[] = [];

	for (const line of lines.slice(0, limit)) {
		if (line.length > 80) {
			result.push(line.slice(0, 77) + "...");
		} else {
			result.push(line);
		}
	}

	if (lines.length > limit) {
		result.push(`... and ${lines.length - limit} more commits`);
	}

	return result.join("\n");
}

export function compactGitOutput(
	output: string,
	command: string | undefined | null
): string | null {
	if (typeof command !== "string" || !isGitCommand(command)) {
		return null;
	}

	const sub = getGitSubcommand(command);

	if (sub === "diff") {
		return compactDiff(output);
	}

	if (sub === "status") {
		// compactStatus returns null for verbose output — pass through unchanged.
		return compactStatus(output);
	}

	if (sub === "log") {
		return compactLog(output);
	}

	return null;
}
