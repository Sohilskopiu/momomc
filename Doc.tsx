// Renders plain text written in the admin panel:
// "# Title" is a heading, lines starting with "- " are bullets, everything else is a paragraph.
export default function Doc({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return (
    <div className="doc-body">
      {blocks.map((b, i) => {
        if (b.startsWith('# ')) {
          const [head, ...rest] = b.split('\n')
          const lines = rest.map((l) => l.trim()).filter(Boolean)
          return (
            <div key={i}>
              <h3>{head.slice(2)}</h3>
              {lines.length > 0 && <DocLines lines={lines} />}
            </div>
          )
        }
        return <DocLines key={i} lines={b.split('\n').map((l) => l.trim()).filter(Boolean)} />
      })}
    </div>
  )
}

function DocLines({ lines }: { lines: string[] }) {
  if (lines.every((l) => l.startsWith('- '))) return <ul>{lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}</ul>
  return <p>{lines.join(' ')}</p>
}
