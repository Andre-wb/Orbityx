import type { OSValue } from './index.js';
import type { BlockExpr, ASTNode } from '../ast/index.js';

export interface OSClosure {
    __type: 'closure';
    params: Array<{ name: string; typeAnnotation?: string }>;
    body: BlockExpr | ASTNode;
    capturedEnv: Map<string, OSValue>;
}
