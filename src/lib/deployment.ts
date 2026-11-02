/** Read at runtime so one built image can be deployed behind any domain. */
export function appUrl(): string {
  const value = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('APP_URL must be the website origin, for example https://loyalty.example.com');
  }
  if (process.env.DEPLOYMENT_MODE === 'server' && (!process.env.APP_URL || url.protocol !== 'https:')) {
    throw new Error('Online deployments require APP_URL=https://your-domain');
  }
  return url.origin;
}
export function secureCookies(): boolean { return new URL(appUrl()).protocol === 'https:'; }
export function backupFolder(): string { return process.env.BACKUP_DIR || 'backups'; }
export function redirectBase(requestUrl: string, host: string | null): URL {
  if (process.env.DEPLOYMENT_MODE === 'server') return new URL(appUrl());
  const base=new URL(requestUrl);base.host=host??base.host;return base;
}
