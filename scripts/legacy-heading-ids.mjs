// Explicit Markdown heading IDs keep links to the original HTML guides working.
export function legacyHeadingIds() {
  return function transform(tree) {
    function visit(node) {
      if (node.type === 'heading') {
        const last = node.children.at(-1)
        const match = last?.type === 'text' && last.value.match(/\s+\{#([a-zA-Z][\w:-]*)\}$/)
        if (match) {
          last.value = last.value.slice(0, -match[0].length)
          node.data ??= {}
          node.data.hProperties = { ...node.data.hProperties, id: match[1] }
        }
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}
