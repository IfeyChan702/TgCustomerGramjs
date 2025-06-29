import { Buffer } from "buffer/";
export class MTProtoRequest {
    private sent: boolean;
    private sequence: number;
    private msgId: number;
    private readonly dirty: boolean;
    private sendTime: number;
    private confirmReceived: boolean;
    private constructorId: number;
    private readonly confirmed: boolean;
    private responded: boolean;

    constructor() {
        this.sent = false;
        this.msgId = 0; // long
        this.sequence = 0;

        this.dirty = false;
        this.sendTime = 0;
        this.confirmReceived = false;

        // These should be overrode

        this.constructorId = 0;
        this.confirmed = false;
        this.responded = false;
    }

    // these should not be overrode
    onSendSuccess() {
        this.sendTime = new Date().getTime();
        this.sent = true;
    }

    onConfirm() {
        this.confirmReceived = true;
    }

    needResend() {
        return (
            this.dirty ||
            (this.confirmed &&
                !this.confirmReceived &&
                new Date().getTime() - this.sendTime > 3000)
        );
    }

    // These should be overrode
    onSend() {
        throw Error("Not overload " + this.constructor.name);
    }

    onResponse(buffer: Buffer) {}

    onException(exception: Error) {}
}
