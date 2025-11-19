import { AppSettings } from '../types';

export const defaultSettings: AppSettings = {
    autoSaveInterval: 0,
    backupPath: '',
    dbFilePath: '',
    highlightOnHover: true,
    experimentalFeatures: {
      enabled: false,
      autofillEnabled: true,
      quickAnalysisEnabled: true,
      dutySwapEnabled: false,
      trendAnalysisEnabled: true,
      glassmorphismEnabled: false,
      improvedDutyForecastEnabled: false,
      aiStructureDeclensionEnabled: false,
      quickDbLoadEnabled: true,
    },
    fontSettings: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: 13,
        textColor: '',
    },
    defaultTheme: 'dark',
};