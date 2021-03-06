import {
	workspace,
	Uri,
	env,
	commands,
	window,
	ColorThemeKind,
	ConfigurationTarget,
} from "vscode";
import { computed, autorun } from "mobx";
import { DrawioLibraryData } from "./DrawioInstance";
import {
	VsCodeSetting,
	serializerWithDefault,
} from "./vscode-utils/VsCodeSetting";
import { mapObject } from "./utils/mapObject";
import { SimpleTemplate } from "./utils/SimpleTemplate";
import { Extension } from "./Extension";
import { readFileSync } from "fs";

const extensionId = "hediet.vscode-drawio";
const experimentalFeaturesEnabled = "vscode-drawio.experimentalFeaturesEnabled";

export async function setContext(
	key: string,
	value: string | boolean
): Promise<void> {
	return (await commands.executeCommand("setContext", key, value)) as any;
}

export class Config {
	public readonly packageJson: {
		version: string;
		versionName: string | undefined;
		name: string;
		feedbackUrl?: string;
	} = JSON.parse(readFileSync(this.packageJsonPath, { encoding: "utf-8" }));

	public get feedbackUrl(): Uri | undefined {
		if (this.packageJson.feedbackUrl) {
			return Uri.parse(this.packageJson.feedbackUrl);
		}
		return undefined;
	}

	public get isInsiders() {
		return (
			this.packageJson.name === "vscode-drawio-insiders-build" ||
			process.env.DEV === "1"
		);
	}

	constructor(private readonly packageJsonPath: string) {
		autorun(() => {
			setContext(
				experimentalFeaturesEnabled,
				this.experimentalFeaturesEnabled
			);
		});
	}

	public getConfig(uri: Uri): DiagramConfig {
		return new DiagramConfig(uri);
	}

	private readonly _experimentalFeatures = new VsCodeSetting(
		`${extensionId}.enableExperimentalFeatures`,
		{
			serializer: serializerWithDefault<boolean>(false),
		}
	);

	public get experimentalFeaturesEnabled(): boolean {
		return this._experimentalFeatures.get();
	}

	private readonly _lastVersionAskedToTest = new VsCodeSetting<
		string | undefined
	>(`${extensionId}.version-asked-for-feedback`, {
		serializer: serializerWithDefault<undefined | string>(undefined),
	});

	public get alreadyAskedToTest(): boolean {
		return this._lastVersionAskedToTest.get() === this.packageJson.version;
	}

	public async markAskedToTest(): Promise<void> {
		await this._lastVersionAskedToTest.set(this.packageJson.version);
	}

	private readonly _knownPlugins = new VsCodeSetting<
		{ pluginId: string; fingerprint: string; allowed: boolean }[]
	>(`${extensionId}.knownPlugins`, {
		serializer: serializerWithDefault<any>([]),
		// Don't use workspace settings here!
		target: ConfigurationTarget.Global,
	});

	public isPluginAllowed(
		pluginId: string,
		fingerprint: string
	): boolean | undefined {
		const data = this._knownPlugins.get();
		const entry = data.find(
			(d) => d.pluginId === pluginId && d.fingerprint === fingerprint
		);
		if (!entry) {
			return undefined;
		}
		return entry.allowed;
	}

	public async addKnownPlugin(
		pluginId: string,
		fingerprint: string,
		allowed: boolean
	): Promise<void> {
		const plugins = [...this._knownPlugins.get()].filter(
			(p) => p.pluginId !== pluginId || p.fingerprint !== fingerprint
		);

		plugins.push({ pluginId, fingerprint, allowed });
		await this._knownPlugins.set(plugins);
	}
}

export class DiagramConfig {
	// #region Theme

	private readonly _theme = new VsCodeSetting(`${extensionId}.theme`, {
		scope: this.uri,
		serializer: serializerWithDefault("automatic"),
	});

	@computed
	public get theme(): string {
		const theme = this._theme.get();

		if (theme !== "automatic") {
			return theme;
		}

		return {
			[ColorThemeKind.Light]: "Kennedy",
			[ColorThemeKind.Dark]: "dark",
			[ColorThemeKind.HighContrast]: "Kennedy",
		}[window.activeColorTheme.kind];
	}

	public async setTheme(value: string): Promise<void> {
		await this._theme.set(value);
	}

	// #endregion

	// #region Mode

	private readonly _useOfflineMode = new VsCodeSetting(
		`${extensionId}.offline`,
		{
			scope: this.uri,
			serializer: serializerWithDefault(true),
		}
	);

	private readonly _onlineUrl = new VsCodeSetting(
		`${extensionId}.online-url`,
		{
			scope: this.uri,
			serializer: serializerWithDefault("https://embed.diagrams.net/"),
		}
	);

	@computed
	public get mode(): { kind: "offline" } | { kind: "online"; url: string } {
		if (this._useOfflineMode.get()) {
			return { kind: "offline" };
		} else {
			return { kind: "online", url: this._onlineUrl.get() };
		}
	}

	// #endregion

	// #region Code Link Activated

	private readonly _codeLinkActivated = new VsCodeSetting(
		`${extensionId}.codeLinkActivated`,
		{
			scope: this.uri,
			serializer: serializerWithDefault(false),
		}
	);

	public get codeLinkActivated(): boolean {
		return this._codeLinkActivated.get();
	}

	public setCodeLinkActivated(value: boolean): Promise<void> {
		return this._codeLinkActivated.set(value);
	}

	// #endregion

	// #region Local Storage

	private readonly _localStorage = new VsCodeSetting<Record<string, string>>(
		`${extensionId}.local-storage`,
		{
			scope: this.uri,
			serializer: {
				deserialize: (value) => {
					if (typeof value === "object") {
						// stringify setting
						// https://github.com/microsoft/vscode/issues/98001
						mapObject(value, (item) =>
							typeof item === "string"
								? item
								: JSON.stringify(item)
						);
						return mapObject(value, (item) =>
							typeof item === "string"
								? item
								: JSON.stringify(item)
						);
					} else {
						const str = new Buffer(value || "", "base64").toString(
							"utf-8"
						);
						return JSON.parse(str);
					}
				},
				serializer: (val) => {
					function tryJsonParse(val: string): string | any {
						try {
							return JSON.parse(val);
						} catch (e) {
							return val;
						}
					}

					if (process.env.DEV === "1") {
						// jsonify obj
						const val2 = mapObject(val, (item) =>
							tryJsonParse(item)
						);
						return val2;
					}

					return Buffer.from(JSON.stringify(val), "utf-8").toString(
						"base64"
					);
				},
			},
		}
	);

	public get localStorage(): Record<string, string> {
		return this._localStorage.get();
	}

	public setLocalStorage(value: Record<string, string>): void {
		this._localStorage.set(value);
	}

	//#endregion

	private readonly _plugins = new VsCodeSetting<{ file: string }[]>(
		`${extensionId}.plugins`,
		{
			scope: this.uri,
			serializer: serializerWithDefault<any[]>([]),
		}
	);

	public get plugins(): { file: string }[] {
		return this._plugins.get().map((entry) => {
			const fullFilePath = this.evaluateTemplate(entry.file);
			return { file: fullFilePath };
		});
	}

	// #region Custom Libraries

	private readonly _customLibraries = new VsCodeSetting<
		DrawioCustomLibrary[]
	>(`${extensionId}.customLibraries`, {
		scope: this.uri,
		serializer: serializerWithDefault<DrawioCustomLibrary[]>([]),
	});

	@computed
	public get customLibraries(): Promise<DrawioLibraryData[]> {
		const normalizeLib = async (
			lib: DrawioCustomLibrary
		): Promise<DrawioLibraryData> => {
			function parseJson(json: string): unknown {
				return JSON.parse(json);
			}

			function parseXml(xml: string): unknown {
				const parse = require("xml-parser-xo");
				const parsedXml = parse(xml);
				return JSON.parse(parsedXml.root.children[0].content);
			}

			let data: DrawioLibraryData["data"];
			if ("json" in lib) {
				data = { kind: "value", value: parseJson(lib.json) };
			} else if ("xml" in lib) {
				data = {
					kind: "value",
					value: parseXml(lib.xml),
				};
			} else if ("file" in lib) {
				const file = this.evaluateTemplate(lib.file);
				const buffer = await workspace.fs.readFile(Uri.file(file));
				const content = Buffer.from(buffer).toString("utf-8");
				if (file.endsWith(".json")) {
					data = {
						kind: "value",
						value: parseJson(content),
					};
				} else {
					data = {
						kind: "value",
						value: parseXml(content),
					};
				}
			} else {
				data = { kind: "url", url: lib.url };
			}

			return {
				libName: lib.libName,
				entryId: lib.entryId,
				data,
			};
		};

		return Promise.all(
			this._customLibraries.get().map((lib) => normalizeLib(lib))
		);
	}

	private evaluateTemplate(template: string): string {
		const tpl = new SimpleTemplate(template);
		return tpl.render({
			workspaceFolder: () => {
				const workspaceFolder = workspace.getWorkspaceFolder(this.uri);
				if (!workspaceFolder) {
					throw new Error(
						"No workspace is opened - '${workspaceFolder} cannot be used'!"
					);
				}
				return workspaceFolder.uri.fsPath;
			},
		});
	}

	// #endregion

	// #region Custom Fonts

	private readonly _customFonts = new VsCodeSetting<string[]>(
		`${extensionId}.customFonts`,
		{
			scope: this.uri,
			serializer: serializerWithDefault<string[]>([]),
		}
	);

	@computed
	public get customFonts(): string[] {
		return this._customFonts.get();
	}

	// #endregion

	constructor(public readonly uri: Uri) {}

	@computed
	public get language(): string {
		const lang = env.language.split("-")[0].toLowerCase();
		return lang;
	}
}

type DrawioCustomLibrary = (
	| {
			xml: string;
	  }
	| {
			url: string;
	  }
	| {
			json: string;
	  }
	| {
			file: string;
	  }
) & { libName: string; entryId: string };
