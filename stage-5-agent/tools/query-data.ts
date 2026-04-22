import { tool } from 'ai';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 本地 JSON 数据查询工具
 * 读取本地 JSON 文件，支持按条件过滤、排序和分页
 */

function loadData(filePath: string): any[] {
  const fullPath = resolve(filePath);
  const content = readFileSync(fullPath, 'utf-8');
  const data = JSON.parse(content);
  return Array.isArray(data) ? data : [data];
}

function filterData(data: any[], conditions: Record<string, string>): any[] {
  return data.filter(item => {
    for (const [key, value] of Object.entries(conditions)) {
      const itemValue = getNestedValue(item, key);
      if (itemValue === undefined) return false;

      const strValue = String(itemValue).toLowerCase();
      const searchValue = value.toLowerCase();

      if (!strValue.includes(searchValue)) {
        return false;
      }
    }
    return true;
  });
}

function filterByRange(data: any[], rangeConditions: Record<string, { min?: number; max?: number }>): any[] {
  return data.filter(item => {
    for (const [key, range] of Object.entries(rangeConditions)) {
      const itemValue = getNestedValue(item, key);
      if (itemValue === undefined || typeof itemValue !== 'number') continue;

      if (range.min !== undefined && itemValue < range.min) return false;
      if (range.max !== undefined && itemValue > range.max) return false;
    }
    return true;
  });
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

export const queryData = tool({
  description: '查询本地 JSON 数据文件。支持按字段过滤（字符串包含匹配）、范围过滤（数值比较）、排序和分页。适合从结构化数据中获取信息，如产品列表、用户数据等。',
  inputSchema: z.object({
    filePath: z.string().describe('JSON 数据文件路径（相对或绝对）'),
    filter: z.record(z.string(), z.string()).optional().describe('字符串过滤条件，如 { category: "手机", brand: "apple" }，支持部分匹配'),
    rangeFilter: z.record(z.string(), z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    })).optional().describe('数值范围过滤，如 { price: { max: 5000 }, stock: { min: 1 } }'),
    sortBy: z.string().optional().describe('排序字段，如 "price"'),
    sortOrder: z.enum(['asc', 'desc']).optional().describe('排序方向，默认 asc'),
    limit: z.number().optional().describe('返回最大条数，默认 10'),
  }),
  execute: async ({ filePath, filter, rangeFilter, sortBy, sortOrder = 'asc', limit = 10 }) => {
    console.log(`[工具调用] query_data: 文件="${filePath}", 过滤=${JSON.stringify(filter)}, 范围=${JSON.stringify(rangeFilter)}`);
    try {
      let data = loadData(filePath);
      const totalBeforeFilter = data.length;

      if (filter && Object.keys(filter).length > 0) {
        data = filterData(data, filter);
      }

      if (rangeFilter && Object.keys(rangeFilter).length > 0) {
        data = filterByRange(data, rangeFilter);
      }

      if (sortBy) {
        data.sort((a, b) => {
          const aVal = getNestedValue(a, sortBy);
          const bVal = getNestedValue(b, sortBy);
          if (aVal === undefined || bVal === undefined) return 0;

          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
          }
          return sortOrder === 'asc'
            ? String(aVal).localeCompare(String(bVal))
            : String(bVal).localeCompare(String(aVal));
        });
      }

      const filtered = data.length;
      const results = data.slice(0, limit);

      return {
        filePath,
        totalBeforeFilter,
        filtered,
        returned: results.length,
        results,
      };
    } catch (error) {
      return {
        filePath,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        results: [],
        totalBeforeFilter: 0,
        filtered: 0,
        returned: 0,
      };
    }
  },
});