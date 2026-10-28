import Slugger from 'github-slugger';

const normalize = (value) => value.normalize('NFKC').replace(/[\s/：:·、，,。.!！?？-]/g, '').toLowerCase();

// A factory gives each compile its own state, including concurrent content renders.
export function articleHeadings() {
  const slugger = new Slugger();
  let first = true;
  let shift = false;
  return {
    name: 'article-heading-outline',
    heading(node, context) {
      const frontmatter = context.data.astro?.frontmatter;
      if (!frontmatter?.title) return;
      const text = context.textContent(node);
      // Assign original IDs before removing a duplicate title, including duplicate suffixes.
      const id = node.data?.hProperties?.id ?? slugger.slug(text);
      const duplicate = first && node.depth === 1 && [frontmatter.title, frontmatter.shortTitle].filter(Boolean).some((title) => normalize(title) === normalize(text));
      first = false;
      if (duplicate) {
        context.replaceNode(node, { type: 'html', value: `<span id="${id}" class="article-title-anchor" aria-hidden="true"></span>` });
        return;
      }
      // A source H1 starts a section tree. Only that tree is demoted by one level.
      if (node.depth === 1) shift = true;
      const depth = shift ? Math.min(6, node.depth + 1) : node.depth;
      if (depth !== node.depth) context.setProperty(node, 'depth', depth);
      context.setProperty(node, 'data', { ...node.data, hProperties: { ...node.data?.hProperties, id } });
    },
  };
}
