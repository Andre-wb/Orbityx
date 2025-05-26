import {
	CandlestickData,
	CustomData,
} from 'orbityx-charts';

export interface RoundedCandleSeriesData
	extends CandlestickData,
		CustomData {
	rounded?: boolean;
}
