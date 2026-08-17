const PROJECT_ID_KEY = 'conker.walletConnectProjectId';

export function getProjectId(): string {
  try {
    return localStorage.getItem(PROJECT_ID_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setProjectId(id: string): void {
  try {
    localStorage.setItem(PROJECT_ID_KEY, id.trim());
  } catch {
    /* ignore (storage unavailable) */
  }
}
