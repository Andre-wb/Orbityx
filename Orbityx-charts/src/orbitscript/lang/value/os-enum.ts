import type { OSValue } from './index.js';

export interface OSEnum {
    __type: 'enum';
    __name: string;      // enum type name, e.g. "Trend"
    __variant: string;   // variant name,   e.g. "Up"
    __data: OSValue[];   // associated data (may be empty)
}
