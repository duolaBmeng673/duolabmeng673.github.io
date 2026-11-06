const escapeAttribute = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// These notes contain independent diagrams with overlapping CSS classes and IDs.
// An image document isolates each diagram without changing the Markdown source.
export const articleInlineSvg = {
  name: 'cryptography-inline-svg-images',
  html(node, context) {
    const data = context.data.astro?.frontmatter;
    if (data?.subject !== '信息安全导论' || data.syllabusChapter !== '02') return;
    const value = node.value.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svg) => {
      const label = svg.match(/<svg\b[^>]*\baria-label="([^"]*)"/i)?.[1] ?? '密码学示意图';
      const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
      return `<img src="${src}" alt="${escapeAttribute(label)}" loading="lazy" decoding="async">`;
    });
    if (value !== node.value) context.setProperty(node, 'value', value);
  },
};
