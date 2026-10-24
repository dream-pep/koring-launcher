import electron from 'electron';
import { listNews, getNewsTypes } from '../core/news';

const { ipcMain } = electron;

export function registerNewsHandlers() {
  ipcMain.handle('news:list', async (_event, payload?: {
    /** 精确匹配分类，"Minecraft: Java Edition" 等 */
    category?: string;
    /** 平台筛选：Java / Bedrock / Dungeons / DungeonsII / Legends */
    newsType?: string;
    /** 标题 + 摘要关键字（不区分大小写） */
    search?: string;
    limit?: number;
    offset?: number;
    /** true = 跳过 10 分钟缓存强制刷新 */
    refresh?: boolean;
  }) => {
    try {
      const data = await listNews(
        {
          category: payload?.category,
          newsType: payload?.newsType,
          search: payload?.search,
          limit: payload?.limit,
          offset: payload?.offset,
        },
        Boolean(payload?.refresh)
      );
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('news:types', async (_event, payload?: { refresh?: boolean }) => {
    try {
      const data = await getNewsTypes(Boolean(payload?.refresh));
      return { success: true, data, error: null };
    } catch (e: unknown) {
      return { success: false, data: null, error: e instanceof Error ? e.message : String(e) };
    }
  });
}
