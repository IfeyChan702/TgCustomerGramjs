import { Buffer } from "buffer/";
import { MessageContainer } from "../tl/core";
import { TLMessage } from "../tl/core";
import { BinaryWriter } from "./BinaryWriter";
import type { MTProtoState } from "../network/MTProtoState";
import type { RequestState } from "../network/RequestState";
const USE_INVOKE_AFTER_WITH = new Set([
    "messages.SendMessage",
    "messages.SendMedia",
    "messages.SendMultiMedia",
    "messages.ForwardMessages",
    "messages.SendInlineBotResult",
]);

export class MessagePacker {
    private _state: MTProtoState;
    public _pendingStates: RequestState[];
    private _queue: any[];
    private _ready: Promise<unknown>;
    private setReady: ((value?: any) => void) | undefined;
    private _log: any;

    constructor(state: MTProtoState, logger: any) {
        this._state = state;
        this._queue = [];
        this._pendingStates = [];

        this._ready = new Promise((resolve) => {
            this.setReady = resolve;
        });
        this._log = logger;
    }

    values() {
        return this._queue;
    }

    append(state?: RequestState, setReady = true, atStart = false) {
        // We need to check if there is already a `USE_INVOKE_AFTER_WITH` request
        if (state && USE_INVOKE_AFTER_WITH.has(state.request.className)) {
            if (atStart) {
                // Assign `after` for the previously first `USE_INVOKE_AFTER_WITH` request
                for (let i = 0; i < this._queue.length; i++) {
                    if (
                        USE_INVOKE_AFTER_WITH.has(
                            this._queue[i]?.request.className
                        )
                    ) {
                        this._queue[i].after = state;
                        break;
                    }
                }
            } else {
                // Assign after for the previous `USE_INVOKE_AFTER_WITH` request
                for (let i = this._queue.length - 1; i >= 0; i--) {
                    if (
                        USE_INVOKE_AFTER_WITH.has(
                            this._queue[i]?.request.className
                        )
                    ) {
                        state.after = this._queue[i];
                        break;
                    }
                }
            }
        }

        if (atStart) {
            this._queue.unshift(state);
        } else {
            this._queue.push(state);
        }

        if (setReady && this.setReady) {
            this.setReady(true);
        }

        // 1658238041=MsgsAck, we don't care about MsgsAck here because they never resolve anyway.
        if (state && state.request.CONSTRUCTOR_ID !== 1658238041) {
            this._pendingStates.push(state);
            state
                .promise! // Using finally causes triggering `unhandledrejection` event
                .catch((err) => {})
                .finally(() => {
                    this._pendingStates = this._pendingStates.filter(
                        (s) => s !== state
                    );
                });
        }
    }

    prepend(states: RequestState[]) {
        states.reverse().forEach((state) => {
            this.append(state, false, true);
        });
        if (this.setReady) {
            this.setReady(true);
        }
    }

    extend(states: RequestState[]) {
        states.forEach((state) => {
            this.append(state, false);
        });
        if (this.setReady) {
            this.setReady(true);
        }
    }
    clear() {
        this._queue = [];
        this.append(undefined);
    }

    async wait() {
        if (!this._queue.length) {
            this._ready = new Promise((resolve) => {
                this.setReady = resolve;
            });
            await this._ready;
        }
    }

    async get() {
        if (!this._queue[this._queue.length - 1]) {
            this._queue = this._queue.filter(Boolean);
            return undefined;
        }

        let data;
        let buffer = new BinaryWriter(Buffer.alloc(0));

        const batch = [];
        let size = 0;
        while (
            this._queue.length &&
            batch.length <= MessageContainer.MAXIMUM_LENGTH
        ) {
            const state = this._queue.shift();
            if (!state) {
                continue;
            }

            size += state.data.length + TLMessage.SIZE_OVERHEAD;
            if (size <= MessageContainer.MAXIMUM_SIZE) {
                let afterId;
                if (state.after) {
                    afterId = state.after.msgId;
                }
                if (state.after) {
                    afterId = state.after.msgId;
                }
                state.msgId = await this._state.writeDataAsMessage(
                    buffer,
                    state.data,
                    state.request.classType === "request",
                    afterId
                );
                this._log.debug(
                    `Assigned msgId = ${state.msgId} to ${
                        state.request.className ||
                        state.request.constructor.name
                    }`
                );
                batch.push(state);
                continue;
            }
            if (batch.length) {
                this._queue.unshift(state);
                break;
            }
            this._log.warn(
                `Message payload for ${
                    state.request.className || state.request.constructor.name
                } is too long ${state.data.length} and cannot be sent`
            );
            state.promise.reject("Request Payload is too big");
            size = 0;
        }
        if (!batch.length) {
            return null;
        }
        if (batch.length > 1) {
            const b = Buffer.alloc(8);
            b.writeUInt32LE(MessageContainer.CONSTRUCTOR_ID, 0);
            b.writeInt32LE(batch.length, 4);
            data = Buffer.concat([b, buffer.getValue()]);
            buffer = new BinaryWriter(Buffer.alloc(0));
            const containerId = await this._state.writeDataAsMessage(
                buffer,
                data,
                false
            );
            for (const s of batch) {
                s.containerId = containerId;
            }
        }

        data = buffer.getValue();
        return { batch, data };
    }
}
