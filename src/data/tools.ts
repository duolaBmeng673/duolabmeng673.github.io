// Add implemented tools here; top-level navigation stays unchanged.
export const tools = [
  {
    id: 'classrooms',
    name: '哈工大空教室查询',
    description: '按星期、节次与连续空闲时长筛选教室，支持搜索、收藏及离线快照。',
    href: '/tools/classrooms/',
    availability: '离线快照 · 本机实时查询',
    repository: 'https://github.com/duolaBmeng673/hit-classroom-select',
  },
] as const;

export type Tool = (typeof tools)[number];
