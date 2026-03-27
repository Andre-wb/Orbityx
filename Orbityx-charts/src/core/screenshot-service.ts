/**
 * @file core/screenshot-service.ts
 * @description Screenshot / export utilities — extracted from ChartEngine (SRP).
 *
 * Single responsibility: capture the canvas as an image and export it
 * (download, clipboard, data URL).
 */

export class ScreenshotService {
    constructor(private canvas: HTMLCanvasElement) {}

    /** Return canvas content as a PNG data URL. */
    toDataURL(): string {
        return this.canvas.toDataURL('image/png');
    }

    /** Trigger a browser download of the chart as PNG. */
    download(filename = 'orbityx-chart.png'): void {
        const url = this.toDataURL();
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    }

    /** Copy chart image to clipboard via the Clipboard API. */
    async copyToClipboard(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.canvas.toBlob(blob => {
                if (!blob) { reject(new Error('Failed to create blob')); return; }
                navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                    .then(resolve).catch(reject);
            }, 'image/png');
        });
    }
}
