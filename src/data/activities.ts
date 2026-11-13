import type { ActivityRecord } from '../lib/activity';

// First publications are supplied by Content Collections, once per article on pubDate.
// Add only confirmed activities here. A substantive article update may use writing/count: 1.
// Do not add metadata, formatting or whitespace-only edits, or infer activity from every Git commit.
// Repeated substantive updates need explicit records; never duplicate the automatic publication event.
// Blog feature work is recorded once per completed change, not once per file or commit.
export const activities: ActivityRecord[] = [
  {
    date: '2026-11-11',
    type: 'site',
    count: 1,
    description: '工具栏目改为外链导航，增加分类分区与可维护的链接配置。',
  },
  {
    date: '2026-11-13',
    type: 'site',
    count: 1,
    description: '知识点标签覆盖信息安全与网络安全全部 35 篇笔记目录，支持分类色块、多标签交集筛选与 URL 状态恢复。',
  },
];
