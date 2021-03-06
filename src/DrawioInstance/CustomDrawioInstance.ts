import { EventEmitter } from "@hediet/std/events";
import { DrawioInstance } from "./DrawioInstance";

/**
 * Enhances the drawio client with custom events and methods.
 * They require modifications of the official drawio source or plugins.
 */
export class CustomDrawioInstance extends DrawioInstance<
	CustomDrawioAction,
	CustomDrawioEvent
> {
	private readonly onNodeSelectedEmitter = new EventEmitter<{
		label: string;
		linkedData: unknown;
	}>();
	public readonly onNodeSelected = this.onNodeSelectedEmitter.asEvent();

	private readonly onCustomPluginLoadedEmitter = new EventEmitter<{
		pluginId: string;
	}>();
	public readonly onCustomPluginLoaded = this.onCustomPluginLoadedEmitter.asEvent();

	private readonly onCursorChangeEmitter = new EventEmitter<{
		newPosition: { x: number; y: number } | undefined;
	}>();
	public readonly onCursorChanged = this.onCursorChangeEmitter.asEvent();

	private readonly onSelectionsChangedEmitter = new EventEmitter<{
		selectedCellIds: string[];
	}>();
	public readonly onSelectionsChanged = this.onSelectionsChangedEmitter.asEvent();

	private readonly onFocusChangedEmitter = new EventEmitter<{
		hasFocus: boolean;
	}>();
	public readonly onFocusChanged = this.onFocusChangedEmitter.asEvent();

	public linkSelectedNodeWithData(linkedData: unknown) {
		this.sendCustomAction({
			action: "linkSelectedNodeWithData",
			linkedData,
		});
	}

	public async getVertices(): Promise<{ id: string; label: string }[]> {
		const response = await this.sendCustomActionExpectResponse({
			action: "getVertices",
		});
		if (response.event !== "getVertices") {
			throw new Error("Invalid Response");
		}

		return response.vertices;
	}

	public setNodeSelectionEnabled(enabled: boolean): void {
		this.sendCustomAction({
			action: "setNodeSelectionEnabled",
			enabled,
		});
	}

	public updateVertices(verticesToUpdate: { id: string; label: string }[]) {
		this.sendCustomAction({
			action: "updateVertices",
			verticesToUpdate,
		});
	}

	public addVertices(vertices: { label: string }[]) {
		this.sendCustomAction({
			action: "addVertices",
			vertices,
		});
	}

	public updateGhostCursors(cursorUpdateInfos: CursorUpdateInfo[]) {
		this.sendCustomAction({
			action: "updateGhostCursors",
			cursors: cursorUpdateInfos,
		});
	}

	public updateGhostSelections(
		selectionsUpdateInfos: SelectionsUpdateInfo[]
	) {
		this.sendCustomAction({
			action: "updateGhostSelections",
			selections: selectionsUpdateInfos,
		});
	}

	protected async handleEvent(evt: CustomDrawioEvent): Promise<void> {
		if (evt.event === "nodeSelected") {
			this.onNodeSelectedEmitter.emit({
				label: evt.label,
				linkedData: evt.linkedData,
			});
		} else if (evt.event === "pluginLoaded") {
			this.onCustomPluginLoadedEmitter.emit({ pluginId: evt.pluginId });
		} else if (evt.event === "focusChanged") {
			this.onFocusChangedEmitter.emit({ hasFocus: evt.hasFocus });
		} else if (evt.event === "cursorChanged") {
			this.onCursorChangeEmitter.emit({ newPosition: evt.position });
		} else if (evt.event === "selectionChanged") {
			this.onSelectionsChangedEmitter.emit({
				selectedCellIds: evt.selectedCellIds,
			});
		} else {
			await super.handleEvent(evt);
		}
	}
}
