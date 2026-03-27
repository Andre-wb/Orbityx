export interface AlertOutput {
    type: 'alert';
    title: string;
    message: string;
    barIndices: number[];   // bars where condition was true
}
