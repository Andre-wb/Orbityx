export class Scope {
    vars = new Map();
    get(name) { return this.vars.get(name); }
    set(name, entry) { this.vars.set(name, entry); }
    has(name) { return this.vars.has(name); }
}
//# sourceMappingURL=scope.js.map