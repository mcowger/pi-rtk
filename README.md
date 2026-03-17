# RTK Plugin for Pi-Coding-Agent

A token reduction plugin for pi-coding-agent that intelligently filters tool output to reduce token consumption by 60-90% while preserving essential information.

Based on the RTK (Rust Token Killer) specification from [RTK](https://github.com/rtk-ai/rtk).

## Features

- **Source Code Filtering**: Remove comments and normalize whitespace (minimal) or keep only signatures (aggressive)
- **Build Output Filtering**: Remove compilation noise, keep only errors and warnings
- **Test Output Aggregation**: Summarize test results, show failures only
- **Git Compaction**: Compact diffs, status, and log output
- **Search Result Grouping**: Group grep results by file with counts
- **Linter Aggregation**: Summarize lint errors by rule and file
- **ANSI Stripping**: Remove color codes and formatting
- **Smart Truncation**: Intelligently truncate large outputs

## Installation

Recommended: install the package via the pi package manager.

### Using pi install (recommended)

```bash
pi install npm:pi-rtk
```

Or add the package to your pi agent config to load automatically. Edit ~/.pi/agent/settings.json and include:

```json
{
  "packages": [
    "npm:pi-rtk"
  ]
}
```

If you need to install manually (older pi versions), you can clone into the extensions directory:

```bash
git clone https://github.com/mcowger/pi-rtk ~/.pi/agent/extensions/pi-rtk
```

## Configuration

Create `~/.pi/agent/rtk-config.json`:

```json
{
  "enabled": true,
  "logSavings": true,
  "showUpdateEvery": 10,
  "techniques": {
    "ansiStripping": true,
    "truncation": { "enabled": true, "maxChars": 10000 },
    "sourceCodeFiltering": { "enabled": true, "level": "minimal" },
    "smartTruncation": { "enabled": true, "maxLines": 200 },
    "testOutputAggregation": true,
    "buildOutputFiltering": true,
    "gitCompaction": true,
    "searchResultGrouping": true,
    "linterAggregation": true
  }
}
```

### Filter Levels

- `minimal`: Remove comments, normalize whitespace
- `aggressive`: Keep only signatures and structure

Source code filtering can be toggled independently of its level via commands or the `rtk_configure` tool.

## Commands

- `/rtk-stats` - Show token savings statistics
- `/rtk-on` / `/rtk-off` - Enable/disable token reduction
- `/rtk-clear` - Clear metrics history
- `/rtk-what` - Show current technique configuration
- `/rtk-toggle-ansiStripping` - Toggle ANSI stripping
- `/rtk-toggle-truncation` - Toggle output truncation
- `/rtk-toggle-sourceCodeFiltering` - Toggle source code filtering
- `/rtk-toggle-smartTruncation` - Toggle smart truncation
- `/rtk-toggle-testOutputAggregation` - Toggle test output aggregation
- `/rtk-toggle-buildOutputFiltering` - Toggle build output filtering
- `/rtk-toggle-gitCompaction` - Toggle git compaction
- `/rtk-toggle-searchResultGrouping` - Toggle search result grouping
- `/rtk-toggle-linterAggregation` - Toggle linter aggregation

## Agent Tool

The `rtk_configure` tool is registered for use by the AI agent to programmatically adjust any RTK parameter at runtime. This is particularly useful when file edits fail due to text-matching errors: the agent can temporarily disable `sourceCodeFiltering`, re-read the file, apply the edit, and re-enable filtering.

## Supported Languages

- TypeScript/JavaScript
- Python
- Rust
- Go
- Java
- C/C++

## Token Savings

| Output Type | Expected Savings |
|-------------|------------------|
| Source code | 60-90% (aggressive mode) |
| Build output | 70-90% |
| Test results | 50-80% |
| Git output | 60-80% |
| Search results | 40-60% |

## Architecture

The plugin intercepts `tool_result` events and applies appropriate filtering based on:
- Tool type (bash, read, grep)
- Command context (build, test, git, etc.)
- File extension for source code

Metrics are tracked in-memory and can be viewed with `/rtk-stats`.

## Known issues

### `isSearchCommand` / `isLinterCommand`: substring false positives

`includes()` matches anywhere in the command string, not just at the command name position:

| Check | False positive examples |
|---|---|
| `includes("ag")` | `npm run agent`, `manage.py`, any path containing "package" |
| `includes("find")` | paths containing "find", `findall()` calls |
| `includes("black")` | `blacklist`, any path with "black" in it |
| `includes("ruff")` | any path containing "ruff" |

When a false positive fires the command's output is silently replaced with a reformatted summary, discarding the real output the agent needed. `isTestCommand` had the same bug and was fixed in commit 2245040 — `isSearchCommand` and `isLinterCommand` need the same treatment.

### `isGitCommand`: `startsWith` never matches in practice

`startsWith("git status")` requires the command to begin with `git`. Agents routinely prefix with a directory change: `cd /repo && git status`. In practice this means gitCompaction is silently inert for compound commands.

### `compactStatus`: corrupts verbose `git status` output

`compactStatus` expects porcelain format (`git status -s` / `--short`). When called with plain `git status` output, the parser misreads English prose as two-char status codes — `"Changes not staged for commit:"` is read as `status[0] = 'C'` (staged), producing output like `"Staged: 1 files / nges not staged for commit:"` while real modified files go unreported.

## License

MIT - Based on the RTK specification
