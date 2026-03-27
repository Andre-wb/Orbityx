import type { OSValue } from './index.js';

export interface OSStruct {
    __type: 'struct';
    __name: string;
    fields: Record<string, OSValue>;
}
