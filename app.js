(() => {
  const { studio, beats, genres } = window.SSAR
  const PEAKS = window.SSAR_PEAKS || {}
  const ENV = window.SSAR_ENV || {}
  const PREVIEW = studio.preview, ENV_FPS = studio.envFps
  const PAGE = 8 // beats shown per shelf before "Show more"
  // one line on what each sound is, shown on its shelf
  const ABOUT = {
    'Amapiano': 'Log drums and late nights',
    'Afro': 'Warm, mid tempo, made to sing on',
    'Kalindula Fusion': 'Zambian guitar roots on new drums',
    'Kalindula Trap': 'Kalindula strings over 808s',
    'Kalindula Hip Hop': 'Boom bap with a village heartbeat',
    'Zamrock Trap': 'Fuzz guitar energy, trap bounce'
  }

  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const money = p => p == null ? 'Price on WhatsApp' : `${studio.currency}${p.toLocaleString('en')}`
  const keyShort = k => k.replace(' minor', 'm').replace(' major', '')
  const beat = id => beats.find(b => b.id === id)
  const whatsapp = text => window.open(`https://wa.me/${studio.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  const cover = (b, small) => b.cover ? `<img src="${esc(b.cover)}" alt="">` : window.SSAR_ART(b, PEAKS[b.id], { small })
  const priceTag = b => `<span class="price${b.price == null ? ' ask' : ''}">${money(b.price)}</span>`
  const anyPrice = beats.some(b => b.price != null)

  const ICONS = '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'

  // ---------- order ----------
  let cart = []
  try { cart = JSON.parse(localStorage.getItem('ssar-order') || '[]').filter(beat) } catch {}
  const saveCart = () => { try { localStorage.setItem('ssar-order', JSON.stringify(cart)) } catch {} }
  const inCart = id => cart.includes(id)
  function toggleCart(id) {
    cart = inCart(id) ? cart.filter(x => x !== id) : [...cart, id]
    saveCart(); syncCart()
  }

  // the site stays white and blue; only the glow behind the big cover takes the beat's colour
  function theme(b) { $('#deck').style.setProperty('--c1', b.colors[0]) }
  const BLUE = '#1877f2'

  // ---------- audio ----------
  const audio = new Audio()
  audio.preload = 'none'
  let current = null
  let pendingSeek = null

  function play(id, frac) {
    if (current !== id) {
      current = id
      audio.src = `audio/${id}.mp3`
      pendingSeek = frac ?? null
      theme(beat(id))
      renderDeck(id)
    } else if (frac != null) {
      if (audio.duration) audio.currentTime = frac * audio.duration
      else pendingSeek = frac
    }
    audio.play().catch(() => {})
    syncPlayer()
  }
  function toggle(id) {
    if (current === id && !audio.paused) audio.pause()
    else play(id)
  }
  const progress = id => (id === current && audio.duration ? audio.currentTime / audio.duration : 0)

  audio.addEventListener('loadedmetadata', () => {
    if (pendingSeek != null) { audio.currentTime = pendingSeek * audio.duration; pendingSeek = null }
  })
  for (const ev of ['play', 'pause', 'ended']) audio.addEventListener(ev, syncPlayer)
  audio.addEventListener('play', () => requestAnimationFrame(pulse))
  audio.addEventListener('timeupdate', () => {
    drawWaves(current)
    $('#player-time').textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration || PREVIEW)}`
    $('#player-wave').setAttribute('aria-valuenow', Math.round(audio.currentTime))
  })

  // glow that breathes with the loudness of the beat
  let level = 0
  function pulse() {
    const e = ENV[current]
    const playing = !audio.paused
    const now = playing && e ? (+e[Math.min(e.length - 1, Math.floor(audio.currentTime * ENV_FPS))] || 0) / 9 : 0
    level = Math.max(now, level * 0.88)
    if (level < 0.01) level = 0
    $('#deck').style.setProperty('--lvl', level.toFixed(3))
    if (playing || level > 0) requestAnimationFrame(pulse)
  }

  // ---------- waveforms ----------
  function drawWave(canvas) {
    const id = canvas.dataset.wave
    const peaks = PEAKS[id] || []
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !peaks.length) return
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
    }
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const step = h < 36 ? 4 : 5, bar = step - 2
    const n = Math.max(1, Math.floor(w / step))
    const done = progress(id)
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * peaks.length / n)
      const b = Math.max(a + 1, Math.floor((i + 1) * peaks.length / n))
      let v = 0
      for (let k = a; k < b && k < peaks.length; k++) v = Math.max(v, peaks[k])
      const bh = Math.max(3, v * h)
      ctx.fillStyle = (i + 0.5) / n <= done ? BLUE : 'rgba(28, 30, 33, 0.18)'
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(i * step, (h - bh) / 2, bar, bh, 1.5)
      else ctx.rect(i * step, (h - bh) / 2, bar, bh)
      ctx.fill()
    }
  }
  const drawWaves = id => $$(id ? `canvas[data-wave="${id}"]` : 'canvas[data-wave]').forEach(drawWave)
  let lastWidth = 0
  new ResizeObserver(() => { if (innerWidth !== lastWidth) { lastWidth = innerWidth; drawWaves() } }).observe(document.body)

  // ---------- featured picks: three beats, a new set every 6 hours, the same for everyone ----------
  const SLOT = 6 * 60 * 60 * 1000
  function picks() {
    let h = Math.imul(Math.floor(Date.now() / SLOT), 2654435761) >>> 0
    const out = []
    while (out.length < Math.min(3, beats.length)) {
      h = (Math.imul(h ^ h >>> 15, 2246822519) + 0x9e3779b9) >>> 0
      const pick = beats[h % beats.length]
      if (!out.includes(pick)) out.push(pick)
    }
    return out
  }
  const nextChange = () => {
    const mins = Math.max(1, Math.ceil((SLOT - Date.now() % SLOT) / 60000))
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
  }

  // the big card shows the beat that is playing, or the first pick; the other picks sit under it
  function renderDeck(id) {
    const featured = picks()
    const b = beat(id) || featured[0]
    const others = featured.filter(p => p.id !== b.id).slice(0, 2)
    const el = $('#deck')
    el.dataset.beat = b.id
    el.innerHTML = `
      <div class="feature glass">
        <div class="cover">${cover(b)}<button class="play big" type="button" data-play="${b.id}">${ICONS}</button></div>
        <div class="feature-body">
          <span class="kicker">${current === b.id ? 'Now playing' : 'Featured beat'}</span>
          <h3>${esc(b.title)}</h3>
          <p>${esc(b.genre)}</p>
          <dl class="stats">
            <div><dt>Tempo</dt><dd>${b.bpm}<small>BPM</small></dd></div>
            <div><dt>Key</dt><dd>${esc(keyShort(b.key))}</dd></div>
            <div><dt>Length</dt><dd>${fmt(b.length)}</dd></div>
          </dl>
          <canvas class="wave" data-wave="${b.id}" aria-hidden="true"></canvas>
          <div class="deck-foot">${priceTag(b)}<button class="btn small" type="button" data-add="${b.id}"></button></div>
        </div>
      </div>
      <div class="picks">${others.map(p => `
        <article class="pick glass" data-beat="${p.id}">
          <button class="row-art" type="button" data-play="${p.id}">${cover(p, true)}<span class="row-play">${ICONS}</span></button>
          <div class="row-title"><h4>${esc(p.title)}</h4><p>${esc(p.genre)}, ${p.bpm} BPM</p></div>
          <button class="btn small add" type="button" data-add="${p.id}" data-compact></button>
        </article>`).join('')}</div>
      <p class="picks-note">Fresh picks every 6 hours. Next change in <span id="next-change">${nextChange()}</span>.</p>`
    drawWaves(b.id)
  }
  // keep the countdown honest, and swap the picks in when the 6 hours are up
  setInterval(() => { const n = $('#next-change'); if (n) n.textContent = nextChange() }, 60000)
  const rotate = () => {
    setTimeout(() => { renderDeck(current); syncPlayer(); syncCart(); rotate() }, SLOT - Date.now() % SLOT + 1000)
  }
  rotate()

  // ---------- the crate ----------
  let genre = genres[0], query = '', sort = 'title', limit = PAGE

  const row = (b, i) => `
    <article class="row" data-beat="${b.id}" style="--c1:${b.colors[0]};--c2:${b.colors[1]}">
      <span class="row-n">${String(i + 1).padStart(2, '0')}</span>
      <button class="row-art" type="button" data-play="${b.id}">${cover(b, true)}<span class="row-play">${ICONS}</span></button>
      <div class="row-title">
        <h4>${esc(b.title)}</h4>
        <p><span>${esc(b.genre)}</span><span class="m">${b.bpm} BPM</span><span class="m">${esc(keyShort(b.key))}</span><span class="m">${fmt(b.length)}</span></p>
      </div>
      <span class="row-bpm"><b>${b.bpm}</b> BPM</span>
      <span class="row-key">${esc(b.key)}</span>
      <span class="row-len">${fmt(b.length)}</span>
      <canvas class="wave" data-wave="${b.id}" aria-hidden="true"></canvas>
      <div class="row-buy">${b.price != null ? priceTag(b) : ''}<button class="btn small add" type="button" data-add="${b.id}" data-compact></button></div>
    </article>`

  const head = '<div class="list-head" aria-hidden="true"><span>#</span><span></span><span>Title</span><span>Tempo</span><span>Key</span><span>Length</span><span>Preview</span><span></span></div>'

  // the shelves: one tile per genre, tap one to open its beats
  function renderGenres() {
    $('#genres').innerHTML = genres.map(g => {
      const all = beats.filter(b => b.genre === g)
      const bpms = all.map(b => b.bpm)
      const [c1, c2, c3] = all[0].colors
      const range = Math.min(...bpms) === Math.max(...bpms) ? `${bpms[0]} BPM` : `${Math.min(...bpms)} to ${Math.max(...bpms)} BPM`
      return `<button class="shelf" type="button" data-genre="${esc(g)}" aria-pressed="${g === genre && !query.trim()}" style="--c1:${c1};--c2:${c2};--c3:${c3}">
        <span class="shelf-arts" aria-hidden="true">${all.slice(0, 3).map(b => `<i>${cover(b, true)}</i>`).join('')}</span>
        <strong>${esc(g)}</strong>
        <span class="shelf-about">${esc(ABOUT[g] || '')}</span>
        <span class="shelf-meta"><b>${all.length}</b> ${all.length === 1 ? 'beat' : 'beats'}<i></i>${range}</span>
      </button>`
    }).join('')
  }

  function renderList() {
    const q = query.trim().toLowerCase()
    const pool = q
      ? beats.filter(b => `${b.title} ${b.genre} ${b.key} ${keyShort(b.key)} ${b.bpm} bpm`.toLowerCase().includes(q))
      : beats.filter(b => b.genre === genre)
    const by = { title: (a, b) => a.title.localeCompare(b.title), slow: (a, b) => a.bpm - b.bpm || a.title.localeCompare(b.title), fast: (a, b) => b.bpm - a.bpm || a.title.localeCompare(b.title) }[sort]
    const sorted = [...pool].sort(by), shown = sorted.slice(0, limit)
    const el = $('#beat-list')
    el.style.setProperty('--buy', anyPrice ? '190px' : '96px')
    const count = `${sorted.length} ${sorted.length === 1 ? 'beat' : 'beats'}`
    el.innerHTML = !sorted.length
      ? '<p class="empty">No beats match that. Try another word, or ask the studio for a remake.</p>'
      : `<div class="group-head"><h3>${q ? 'Search results' : esc(genre)}</h3><span>${count}</span></div>${head}${shown.map(row).join('')}${
        sorted.length > shown.length ? `<button class="see-all" type="button" data-more>Show ${Math.min(PAGE, sorted.length - shown.length)} more of ${sorted.length}</button>` : ''}`
    drawWaves(); syncPlayer(); syncCart()
  }

  function syncPlayer() {
    const playing = !!current && !audio.paused
    for (const btn of $$('[data-play]')) {
      const on = playing && btn.dataset.play === current
      btn.classList.toggle('on', on)
      btn.setAttribute('aria-label', `${on ? 'Pause' : 'Play'} ${beat(btn.dataset.play).title} preview`)
    }
    for (const el of $$('[data-beat]')) {
      el.classList.toggle('current', el.dataset.beat === current)
      el.classList.toggle('playing', playing && el.dataset.beat === current)
    }
    if (!current) return
    const b = beat(current)
    const bar = $('#player')
    if (bar.hidden || $('#player-wave').dataset.wave !== current) {
      bar.hidden = false
      document.body.classList.add('has-player')
      $('#player-thumb').innerHTML = cover(b, true)
      $('#player-title').textContent = b.title
      $('#player-specs').textContent = `${b.genre}, ${b.bpm} BPM, ${keyShort(b.key)}`
      $('#player-wave').dataset.wave = current
      drawWaves(current)
    }
    const t = $('#player-toggle')
    t.classList.toggle('on', playing)
    t.setAttribute('aria-label', playing ? 'Pause' : 'Play')
    syncCart()
  }

  function syncCart() {
    for (const btn of $$('[data-add]')) {
      const on = inCart(btn.dataset.add), compact = 'compact' in btn.dataset
      btn.textContent = on ? (compact ? 'Added' : 'In your order') : (compact ? 'Add' : 'Add to order')
      btn.classList.toggle('added', on)
      btn.setAttribute('aria-pressed', on)
      if (compact) btn.setAttribute('aria-label', `${on ? 'Remove' : 'Add'} ${beat(btn.dataset.add).title} ${on ? 'from' : 'to'} your order`)
    }
    const pa = $('#player-add')
    if (current) {
      pa.textContent = inCart(current) ? 'In your order' : 'Add to order'
      pa.classList.toggle('added', inCart(current))
    }
    $('#cart-count').textContent = cart.length
    $('#cart-count').classList.toggle('some', cart.length > 0)
    $('#tab-count').textContent = cart.length
    $('#tab-count').hidden = cart.length === 0
    $('#cart-items').innerHTML = cart.map(id => {
      const b = beat(id)
      return `<li><div class="thumb">${cover(b, true)}</div><div><strong>${esc(b.title)}</strong><span>${esc(b.genre)}, ${b.bpm} BPM</span></div>${priceTag(b)}<button class="icon-btn" type="button" data-remove="${b.id}" aria-label="Remove ${esc(b.title)}">&times;</button></li>`
    }).join('')
    $('#cart-empty').hidden = cart.length > 0
    $('#order-form').hidden = cart.length === 0
    const picked = cart.map(beat)
    const priced = picked.filter(b => b.price != null)
    const sum = priced.reduce((t, b) => t + b.price, 0)
    $('#cart-total').textContent = !picked.length ? ''
      : priced.length === picked.length ? `Total ${money(sum)}`
      : 'The studio confirms your price on WhatsApp.'
  }

  // ---------- events ----------
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-play],[data-add],[data-remove],[data-genre],[data-more],canvas[data-wave]')
    if (!t) return
    if (t.dataset.play) toggle(t.dataset.play)
    else if (t.dataset.add) toggleCart(t.dataset.add)
    else if (t.dataset.remove) toggleCart(t.dataset.remove)
    else if (t.dataset.genre) {
      genre = t.dataset.genre; limit = PAGE; query = ''; $('#search').value = ''
      renderGenres(); renderList()
      $('#beat-list').scrollIntoView({ block: 'nearest' })
    }
    else if ('more' in t.dataset) { limit += PAGE; renderList() }
    else if (t.dataset.wave) {
      const r = t.getBoundingClientRect()
      play(t.dataset.wave, Math.min(0.99, Math.max(0, (e.clientX - r.left) / r.width)))
    }
  })
  $('#search').addEventListener('input', e => { query = e.target.value; limit = PAGE; renderGenres(); renderList() })
  $('#sort').addEventListener('change', e => { sort = e.target.value; limit = PAGE; renderList() })

  $('#player-toggle').innerHTML = ICONS
  $('#player-toggle').addEventListener('click', () => current && toggle(current))
  $('#player-add').addEventListener('click', () => current && toggleCart(current))
  $('#player-wave').setAttribute('aria-valuemax', PREVIEW)
  $('#player-wave').addEventListener('keydown', e => {
    if (!current || !audio.duration || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return
    e.preventDefault()
    audio.currentTime = Math.min(audio.duration - 0.5, Math.max(0, audio.currentTime + (e.key === 'ArrowRight' ? 5 : -5)))
  })

  const drawer = $('#cart')
  const openCart = () => { $('#order-note').textContent = ''; drawer.showModal() }
  $('#open-cart').addEventListener('click', openCart)
  $('#tab-order').addEventListener('click', openCart)
  // the phone tab bar lights up the part of the page you are on
  const tabs = $$('.tabbar [data-tab]')
  const spy = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) tabs.forEach(t => t.classList.toggle('on', t.dataset.tab === en.target.id))
  }), { rootMargin: '-45% 0px -50% 0px' })
  for (const id of ['top', 'beats', 'remake']) spy.observe(document.getElementById(id))
  $('#close-cart').addEventListener('click', () => drawer.close())
  drawer.addEventListener('click', e => { if (e.target === drawer) drawer.close() })
  $('#want-session').addEventListener('change', e => { $('#session-date').hidden = !e.target.checked })

  // the studio gets its own copy of every order, in case the artist never presses send in WhatsApp
  // (it lands in Supabase; the public key below can only call ssar_submit, it cannot read anything)
  const STORE = 'https://nszrjgmicfywprjrgcoq.supabase.co/rest/v1/rpc/ssar_submit', STORE_KEY = 'sb_publishable_szowwpZkwx6IORoDmgcQZA_b74CuBFG'
  const tellStudio = order => fetch(STORE, { method: 'POST', headers: { 'content-type': 'application/json', apikey: STORE_KEY }, body: JSON.stringify({ o: order }), keepalive: true }).catch(() => {})

  $('#order-form').addEventListener('submit', e => {
    e.preventDefault()
    const f = new FormData(e.target)
    const lines = [`Hi ${studio.short}, I want to reserve ${cart.length === 1 ? 'this beat' : 'these beats'}:`]
    cart.map(beat).forEach((b, i) => lines.push(`${i + 1}. ${b.title} (${b.genre}, ${b.bpm} BPM, ${b.key})${b.price != null ? ' ' + money(b.price) : ''}`))
    lines.push('', `Artist name: ${f.get('name').trim()}`)
    if (f.get('session')) lines.push(`I also want to book a recording session${f.get('date') ? ` on ${new Date(f.get('date') + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}.`)
    if (f.get('note').trim()) lines.push(`Note: ${f.get('note').trim()}`)
    tellStudio({ kind: 'order', name: f.get('name'), phone: f.get('phone'), beats: [...cart], session: !!f.get('session'), date: f.get('date'), note: f.get('note'), website: f.get('website') })
    whatsapp(lines.join('\n'))
    $('#order-note').textContent = 'Your order is open in WhatsApp. Press send there to finish.'
  })

  $('#remake-form').addEventListener('submit', e => {
    e.preventDefault()
    const f = new FormData(e.target)
    const lines = [`Hi ${studio.short}, I need a beat remade.`, `Song: ${f.get('song').trim()}`]
    if (f.get('details').trim()) lines.push(`What to change: ${f.get('details').trim()}`)
    tellStudio({ kind: 'remake', song: f.get('song'), details: f.get('details'), phone: f.get('phone'), website: f.get('website') })
    whatsapp(lines.join('\n'))
  })

  // ---------- save the app to the phone ----------
  const installBtn = $('#install'), help = $('#install-help')
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  let installPrompt = null
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; installBtn.hidden = false })
  addEventListener('appinstalled', () => { installPrompt = null; installBtn.hidden = true })
  if (ios && !standalone) installBtn.hidden = false // Safari has no install prompt, so show the steps instead
  installBtn.addEventListener('click', async () => {
    if (!installPrompt) return help.showModal()
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    installPrompt = null
    if (outcome === 'accepted') installBtn.hidden = true
  })
  $('#install-close').addEventListener('click', () => help.close())
  help.addEventListener('click', e => { if (e.target === help) help.close() })
  // every deploy ships a new sw.js. When it takes over, reload once so nobody has to clear a cache.
  if ('serviceWorker' in navigator) {
    const sw = navigator.serviceWorker
    const hadOne = !!sw.controller // first visit: nothing to update from
    const refresh = () => { if (audio.paused) location.reload(); else audio.addEventListener('pause', () => location.reload(), { once: true }) }
    sw.addEventListener('controllerchange', () => { if (hadOne) refresh() })
    addEventListener('load', () => sw.register('sw.js').then(reg => {
      // an app left open, or reopened from the home screen, checks for a new version when it comes back into view
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}) })
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000)
    }).catch(() => {}))
  }

  // sections ease in as they scroll into view
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target) } }), { threshold: 0.04 })
  $$('.section').forEach(s => { s.classList.add('reveal'); io.observe(s) })

  // ---------- partner strip: artists on $ONGCHAINN, scrolling without end ----------
  const partner = (window.SSAR_PARTNER || {}).artists || []
  if (partner.length) {
    const strip = $('#sc-artists')
    const set = hide => partner.map(a => `<span class="sc-artist"${hide ? ' aria-hidden="true"' : ''}><img src="${esc(a.img)}" alt="" width="64" height="64" loading="lazy"><b>${esc(a.name)}</b></span>`).join('')
    strip.innerHTML = `<span class="sc-track">${set(false)}${set(true)}</span>` // two copies, so the loop has no seam
    strip.hidden = false
  }

  // ---------- start ----------
  $('#fact-count').textContent = beats.length
  for (const el of $$('[data-preview]')) el.textContent = PREVIEW
  const featured = picks()[0]
  theme(featured)
  renderDeck(featured.id)
  renderGenres()
  renderList()
  document.fonts?.ready.then(() => drawWaves())
})()
