import { action, ObservableMap } from "mobx";

export interface Point {
	x: number;
	y: number;
}
// is a string
export type NormalizedUri = { __brand: "normalizedUri" };

export type ViewState =
	| {
			activeUri: NormalizedUri;
			currentCursor: Point | undefined;
			selectedCellIds: string[];
	  }
	| undefined;

export class SessionModel {
	public readonly viewStatesByPeerId = new ObservableMap<
		number,
		{ viewState: ViewState; peerId: number }
	>();

	@action
	public apply(update: SessionModelUpdate): void {
		if (update.kind === "updateViewState") {
			const val = this.viewStatesByPeerId.get(update.peerId);
			const newVal = {
				peerId: update.peerId,
				viewState: update.newViewState,
			};
			if (JSON.stringify(val) !== JSON.stringify(newVal)) {
				this.viewStatesByPeerId.set(update.peerId, newVal);
			}
		}
	}
}

export type SessionModelUpdate =
	| {
			kind: "updateViewState";
			peerId: number;
			newViewState: ViewState;
	  }
	| {
			kind: "removePeer";
			peerId: number;
	  }
	| {
			kind: "updateCursor";
			peerId: number;
			cursorPosition: Point | undefined;
	  };
