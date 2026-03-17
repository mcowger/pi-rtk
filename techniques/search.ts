const SEARCH_COMMANDS = ["grep", "rg", "find", "ack", "ag"];

export function isSearchCommand(command: string | undefined | null): boolean {
	if (typeof command !== "string" || command.length === 0) {
		return false;
	}

	const cmdLower = command.toLowerCase();
	return SEARCH_COMMANDS.some((sc) => {
		const escaped = sc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		// Match the command name only at a command position (start of string or
		// after a shell operator), not as a substring of another word.
		// Prevents "ag" matching "agent"/"package", "find" matching path components.
		return new RegExp(`(?:^|[|;&]\\s*)${escaped}(?:\\s|$|[|;&])`, "m").test(cmdLower);
	});
}

interface SearchResult {
	file: string;
	lineNumber: string;
	content: string;
}

export function groupSearchResults(
	output: string,
	maxResults: number = 50
): string | null {
	const lines = output.split("\n");
	const results: SearchResult[] = [];

	// Parse search results
	for (const line of lines) {
		if (!line.trim()) continue;

		// Match patterns like: file:line:content or file:content
		const match = line.match(/^(.+?):(\d+)?:(.+)$/);
		if (match) {
			results.push({
				file: match[1],
				lineNumber: match[2] || "?",
				content: match[3],
			});
		}
	}

	if (results.length === 0) {
		return null;
	}

	// Group by file
	const byFile = new Map<string, SearchResult[]>();
	for (const result of results) {
		const existing = byFile.get(result.file) || [];
		existing.push(result);
		byFile.set(result.file, existing);
	}

	// Build output
	let output_text = `🔍 ${results.length} matches in ${byFile.size} files:\n\n`;

	const files = Array.from(byFile.entries()).sort((a, b) => a[0].localeCompare(b[0]));
	let shown = 0;

	for (const [file, matches] of files) {
		if (shown >= maxResults) {
			break;
		}

		const compactFile = compactPath(file, 50);
		output_text += `📄 ${compactFile} (${matches.length} matches):\n`;

		for (const match of matches.slice(0, 10)) {
			let cleaned = match.content.trim();
			if (cleaned.length > 70) {
				cleaned = cleaned.slice(0, 67) + "...";
			}
			output_text += `    ${match.lineNumber}: ${cleaned}\n`;
			shown++;
		}

		if (matches.length > 10) {
			output_text += `  +${matches.length - 10} more\n`;
		}

		output_text += "\n";
	}

	if (results.length > shown) {
		output_text += `... +${results.length - shown} more\n`;
	}

	return output_text;
}

function compactPath(path: string, maxLength: number): string {
	if (path.length <= maxLength) {
		return path;
	}

	const parts = path.split("/");
	if (parts.length <= 3) {
		return path;
	}

	return `${parts[0]}/.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}
