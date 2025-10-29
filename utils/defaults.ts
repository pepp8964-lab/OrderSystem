import { AppSettings } from '../types';

export const defaultSettings: AppSettings = {
    autoSaveInterval: 0,
    backupPath: '',
    dbFilePath: '',
    highlightOnHover: false,
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
    }
};