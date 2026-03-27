import type { Directive } from '../../lang/ast/index.js';
import type { TokenStream } from './token-stream.js';
import type { parseExpr as ParseExprFn } from './expr-parser.js';
export declare function parseDirective(ts: TokenStream, parseExpr: typeof ParseExprFn): Directive;
//# sourceMappingURL=directive-parser.d.ts.map