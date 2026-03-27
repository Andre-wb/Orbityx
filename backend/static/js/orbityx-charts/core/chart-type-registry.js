const renderers = new Map();
/** Register a renderer for a chart type. Overwrites existing if present. */
export function registerChartType(type, renderer) {
    renderers.set(type, renderer);
}
/** Get the registered renderer for a chart type. */
export function getChartTypeRenderer(type) {
    return renderers.get(type);
}
/** List all registered chart types. */
export function getRegisteredChartTypes() {
    return Array.from(renderers.keys());
}
//# sourceMappingURL=chart-type-registry.js.map