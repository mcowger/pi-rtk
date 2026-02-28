import { readFile } from "fs/promises";
import { resolve } from "path";
import { homedir } from "os";

export type FilterLevel = "none" | "minimal" | "aggressive";

export interface RtkConfig {
	enabled: boolean;
	logSavings: boolean;
	showUpdateEvery: number;
	techniques: {
		ansiStripping: boolean;
		truncation: { enabled: boolean; maxChars: number };
		sourceCodeFiltering: { enabled: boolean; level: FilterLevel };
		smartTruncation: { enabled: boolean; maxLines: number };
		testOutputAggregation: boolean;
		buildOutputFiltering: boolean;
		gitCompaction: boolean;
		searchResultGrouping: boolean;
		linterAggregation: boolean;
	};
}

export const DEFAULT_CONFIG: RtkConfig = {
	enabled: true,
	logSavings: true,
	showUpdateEvery: 10,
	techniques: {
		ansiStripping: true,
		truncation: { enabled: true, maxChars: 10000 },
		sourceCodeFiltering: { enabled: true, level: "minimal" },
		smartTruncation: { enabled: true, maxLines: 200 },
		testOutputAggregation: true,
		buildOutputFiltering: true,
		gitCompaction: true,
		searchResultGrouping: true,
		linterAggregation: true,
	},
};

export function mergeConfig(base: RtkConfig, override: Partial<RtkConfig>): RtkConfig {
	const rawShowUpdateEvery = override.showUpdateEvery;
	const showUpdateEvery =
		typeof rawShowUpdateEvery === "number" && Number.isInteger(rawShowUpdateEvery)
			? Math.max(0, rawShowUpdateEvery)
			: base.showUpdateEvery;

	return {
		...base,
		...override,
		showUpdateEvery,
		techniques: {
			...base.techniques,
			...(override.techniques || {}),
			truncation: {
				...base.techniques.truncation,
				...(override.techniques?.truncation || {}),
			},
			sourceCodeFiltering: {
				...base.techniques.sourceCodeFiltering,
				...(override.techniques?.sourceCodeFiltering || {}),
			},
			smartTruncation: {
				...base.techniques.smartTruncation,
				...(override.techniques?.smartTruncation || {}),
			},
		},
	};
}

export async function loadConfig(cwd: string): Promise<RtkConfig> {
	// Try loading from project directory first, then fall back to global config
	const paths = [
		resolve(cwd, ".pi", "rtk-config.json"),
		resolve(homedir(), ".pi", "agent", "rtk-config.json"),
	];

	for (const configPath of paths) {
		try {
			const content = await readFile(configPath, "utf-8");
			const parsed = JSON.parse(content) as Partial<RtkConfig>;
			return mergeConfig(DEFAULT_CONFIG, parsed);
		} catch (error) {
			// Continue to next path
		}
	}

	return DEFAULT_CONFIG;
}
