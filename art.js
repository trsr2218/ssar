// Draws a beat's cover as SVG. Six layouts in the manner of designed record sleeves: few colours,
// strong type, plenty of space. Which layout a beat gets is fixed by its id, so it never changes.
//   SSAR_ART(beat, peaks)                  full cover with the title set as type
//   SSAR_ART(beat, peaks, { small: true }) the same sleeve without type, for thumbnails
(() => {
  let n = 0
  const INK = '#0c0c10', PAPER = '#f3f0e8'
  const FONT = 'font-family="Outfit, Arial Black, Arial, sans-serif" font-weight="700"'
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

  // type sized to span a width: grows until it fills W or reaches max
  const fit = (str, W, max) => {
    const size = Math.min(max, W / (0.64 * str.length))
    return { size, len: size >= max ? '' : ` textLength="${W}" lengthAdjust="spacingAndGlyphs"` }
  }
  const text = (x, y, str, size, fill, extra = '') => `<text x="${x}" y="${y}" ${FONT} font-size="${size.toFixed(1)}" fill="${fill}" ${extra}>${esc(str)}</text>`
  const small = (x, y, str, fill, anchor = 'start') => `<text x="${x}" y="${y}" font-family="Outfit, Arial, sans-serif" font-weight="600" font-size="17" letter-spacing="3.5" fill="${fill}" text-anchor="${anchor}">${esc(str)}</text>`

  window.SSAR_ART = (b, peaks, { small: mini = false } = {}) => {
    const [c1, c2, c3] = b.colors
    let seed = [...b.id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0
    const layout = b.layout ?? seed % 6
    const rnd = () => {
      seed = seed + 0x6D2B79F5 | 0
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
      return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
    const uid = `art${n++}`
    const T = b.title.toUpperCase()
    const meta = `${b.bpm} BPM  /  ${b.key.replace(' minor', ' MIN').replace(' major', ' MAJ').toUpperCase()}`
    const P = peaks && peaks.length ? peaks : Array.from({ length: 64 }, rnd)
    let defs = '', art = '', type = ''

    if (layout === 0) {
      // soft colour field: blurred light, a quiet title in the corner
      const blobs = [[c3, 0.2, 0.25, 420], [c1, 0.8, 0.3, 360], [c2, 0.35, 0.85, 380], [c1, 0.9, 0.9, 300]]
      blobs.forEach(([c, x, y, r], i) => {
        const cx = (x + (rnd() - 0.5) * 0.3) * 600, cy = (y + (rnd() - 0.5) * 0.3) * 600
        defs += `<radialGradient id="${uid}m${i}" gradientUnits="userSpaceOnUse" cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r}"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`
        art += `<rect width="600" height="600" fill="url(#${uid}m${i})"/>`
      })
      defs += `<linearGradient id="${uid}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="${INK}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity="0.78"/></linearGradient>`
      art = `<rect width="600" height="600" fill="${INK}"/>${art}<rect width="600" height="600" fill="url(#${uid}v)"/>`
      const f = fit(T, 440, 96)
      type = text(40, 548, T, f.size, PAPER, `letter-spacing="-1"${f.len}`) + small(40, 548 - f.size - 4, b.genre.toUpperCase(), PAPER) + small(560, 62, 'SSAR', PAPER, 'end')
    } else if (layout === 1) {
      // colour block and oversized type, after the classic jazz sleeves
      const w = 230 + Math.floor(rnd() * 110)
      art = `<rect width="600" height="600" fill="${PAPER}"/><rect width="${w}" height="600" fill="${c1}"/><rect y="486" width="600" height="114" fill="${INK}"/><circle cx="${(470 + rnd() * 50).toFixed(0)}" cy="${(130 + rnd() * 40).toFixed(0)}" r="74" fill="${c2}"/>`
      const f = fit(T, 540, 176)
      type = text(30, 452, T, f.size, INK, `letter-spacing="-3"${f.len}`) + small(30, 552, meta, PAPER) + small(570, 552, 'SSAR', PAPER, 'end')
    } else if (layout === 2) {
      // the title repeated: three faded, one solid
      art = `<rect width="600" height="600" fill="${c1}"/>`
      const f = fit(T, 540, 150)
      const step = f.size * 0.92, top = 290 - step * 2 + f.size * 0.82
      for (let i = 0; i < 4; i++) {
        const solid = i === 2
        type += text(30, top + i * step, T, f.size, INK, `letter-spacing="-2"${f.len}${solid ? '' : ' fill-opacity="0.16"'}`)
      }
      type += small(30, 566, meta, INK) + small(570, 566, 'SSAR', INK, 'end')
      if (mini) art += `<rect x="90" y="150" width="420" height="78" fill="${INK}" fill-opacity="0.16"/><rect x="90" y="261" width="420" height="78" fill="${INK}"/><rect x="90" y="372" width="420" height="78" fill="${INK}" fill-opacity="0.16"/>`
    } else if (layout === 3) {
      // the beat's own waveform as stacked ridgelines
      art = `<rect width="600" height="600" fill="${INK}"/>`
      const rows = mini ? 8 : 20, N = 40
      for (let r = 0; r < rows; r++) {
        const base = 150 + r * (320 / (rows - 1)), shift = Math.floor(rnd() * P.length)
        let d = `M70 ${base.toFixed(1)}`
        for (let i = 0; i <= N; i++) {
          const x = 70 + i / N * 460, edge = Math.sin(Math.PI * i / N) ** 2
          const v = P[(Math.floor(i / N * (P.length - 1)) + shift) % P.length]
          d += ` L${x.toFixed(1)} ${(base - edge * (10 + 46 * v * (0.4 + 0.6 * rnd()))).toFixed(1)}`
        }
        art += `<path d="${d} L530 ${base.toFixed(1)}" fill="${INK}" stroke="${r === Math.floor(rows * 0.6) ? c1 : PAPER}" stroke-width="${mini ? 5 : 1.8}" stroke-linejoin="round"/>`
      }
      const f = fit(T, 300, 40)
      type = `<text x="300" y="548" ${FONT} font-size="${f.size.toFixed(1)}" fill="${PAPER}" text-anchor="middle" letter-spacing="10">${esc(T)}</text>` + small(300, 76, 'SSAR', PAPER, 'middle')
    } else if (layout === 4) {
      // one sun, cut by the horizon
      defs += `<linearGradient id="${uid}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient>`
      const cy = mini ? 300 : 262, R = mini ? 210 : 176
      art = `<rect width="600" height="600" fill="${PAPER}"/><circle cx="300" cy="${cy}" r="${R}" fill="url(#${uid}s)"/>`
      for (let i = 0; i < 6; i++) art += `<rect x="0" y="${cy + 18 + i * 27}" width="600" height="${(4 + i * 3.4).toFixed(1)}" fill="${PAPER}"/>`
      const f = fit(T, 420, 64)
      type = `<text x="300" y="528" ${FONT} font-size="${f.size.toFixed(1)}" fill="${INK}" text-anchor="middle" letter-spacing="6">${esc(T)}</text>` + small(300, 566, meta, INK, 'middle') + small(300, 58, 'SSAR', INK, 'middle')
    } else {
      // an arch of colour on black
      defs += `<linearGradient id="${uid}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c3}"/></linearGradient>`
      const top = mini ? 70 : 78, bottom = mini ? 600 : 430
      art = `<rect width="600" height="600" fill="${INK}"/><path d="M150 ${bottom} V${top + 150} a150 150 0 0 1 300 0 V${bottom}Z" fill="url(#${uid}a)"/><circle cx="${(390 + rnd() * 40).toFixed(0)}" cy="${(top + 120 + rnd() * 60).toFixed(0)}" r="62" fill="${c2}"/>`
      const f = fit(T, 500, 86)
      type = `<text x="300" y="528" ${FONT} font-size="${f.size.toFixed(1)}" fill="${PAPER}" text-anchor="middle" letter-spacing="2">${esc(T)}</text>` + small(300, 566, meta, PAPER, 'middle')
    }

    const grain = `<filter id="${uid}g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${Math.floor(rnd() * 99)}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.42 0"/></filter>`
    return `<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>${defs}${mini ? '' : grain}</defs>
      ${art}${mini ? '' : type + `<rect width="600" height="600" filter="url(#${uid}g)" style="mix-blend-mode:overlay"/>`}
    </svg>`
  }
})()
