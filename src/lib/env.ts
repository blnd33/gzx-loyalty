import { appUrl } from './deployment';
export const env = { get appUrl() { return appUrl(); } };
