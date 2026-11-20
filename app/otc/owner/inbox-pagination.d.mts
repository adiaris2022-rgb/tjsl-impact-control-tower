export type InboxCursor = { created_at: string; id: string };
export type InboxRow = { created_at: string; id: string };
export const INBOX_PAGE_SIZE: number;
export function buildInboxCursorFilter(cursor: InboxCursor): string;
export function cursorFromPage(rows: readonly InboxRow[], pageSize?: number): InboxCursor | null;
