/**
 * @file core/screenshot-service.ts
 * @description Screenshot / export utilities — extracted from ChartEngine (SRP).
 *
 * Single responsibility: capture the canvas as an image and export it
 * (download, clipboard, data URL).
 */
export declare class ScreenshotService {
    private canvas;
    constructor(canvas: HTMLCanvasElement);
    /** Return canvas content as a PNG data URL. */
    toDataURL(): string;
    /** Trigger a browser download of the chart as PNG. */
    download(filename?: string): void;
    /** Copy chart image to clipboard via the Clipboard API. */
    copyToClipboard(): Promise<void>;
}
//# sourceMappingURL=screenshot-service.d.ts.map