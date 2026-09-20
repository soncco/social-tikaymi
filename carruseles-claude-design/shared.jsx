// Shared Tikaymi components — logo, nav, footer, placeholders
// Exports to window so other Babel scripts can use them.

const TikaymiLogo = ({ size = 34, mono = false }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-label="Tikaymi">
    {/* Mountains */}
    <path
      d="M12 66 L32 40 L44 52 L58 30 L72 48 L88 66 Z"
      fill="none"
      stroke={mono ? 'currentColor' : '#A2C357'}
      strokeWidth="3.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    {/* Little flower/sun */}
    <g transform="translate(72,32)">
      {[0,1,2,3,4].map(i => (
        <ellipse
          key={i}
          cx="0" cy="-6" rx="2.5" ry="5"
          fill={mono ? 'currentColor' : '#E8B339'}
          transform={`rotate(${i * 72})`}
        />
      ))}
      <circle cx="0" cy="0" r="2" fill={mono ? 'currentColor' : '#CD572B'} />
    </g>
    {/* Signature swoosh for "Tikaymi" style */}
    <path
      d="M20 78 Q50 72 82 78"
      fill="none"
      stroke={mono ? 'currentColor' : '#CD572B'}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

const TikaymiWordmark = ({ light = false }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{
      width: 38, height: 38, borderRadius: '50%',
      background: light ? 'rgba(255,255,255,0.95)' : '#fff',
      display: 'grid', placeItems: 'center',
      boxShadow: light ? '0 2px 10px rgba(0,0,0,.2)' : '0 1px 4px rgba(0,0,0,.08)',
    }}>
      <TikaymiLogo size={24} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
      <span style={{
        fontFamily: 'var(--serif)',
        fontSize: 24,
        letterSpacing: '0.01em',
        color: light ? '#fff' : 'var(--teal)',
        fontStyle: 'italic',
        fontWeight: 500,
      }}>Tikaymi</span>
      <span style={{
        fontSize: 9,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        color: light ? 'rgba(255,255,255,.7)' : 'var(--ink-mute)',
        marginTop: 3,
        paddingLeft: 2,
      }}>Travel · Perú</span>
    </div>
  </div>
);

const NAV_ITEMS = [
  { label: 'Tours', has: true },
  { label: 'Destinos', has: true },
  { label: 'Experiencias' },
  { label: 'Eventos' },
  { label: 'Sobre Nosotros' },
  { label: 'Blog' },
  { label: 'Contacto' },
];

const Nav = ({ variant = 'over' }) => {
  // variant: 'over' (transparent over hero) | 'solid' (cream bg) | 'dark-solid' (on dark bg pages)
  const isOver = variant === 'over';
  const isSolid = variant === 'solid';
  return (
    <nav style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
      padding: isSolid ? '14px 40px' : '22px 40px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      color: isOver ? '#fff' : 'var(--ink)',
      background: isSolid ? 'rgba(250,246,240,.97)' : 'transparent',
      backdropFilter: isSolid ? 'blur(14px)' : 'none',
      borderBottom: isSolid ? '1px solid var(--line)' : 'none',
    }}>
      <TikaymiWordmark light={isOver} />
      <div style={{
        display: 'flex', gap: 30,
        fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
      }}>
        {NAV_ITEMS.map(n => (
          <a key={n.label} href="#" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 0', borderBottom: '1px solid transparent',
            transition: 'border-color .25s',
          }}>
            {n.label}
            {n.has && <span style={{ fontSize: 8, opacity: .6 }}>▾</span>}
          </a>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <button aria-label="Buscar" style={{
          width: 34, height: 34, borderRadius: '50%',
          border: isOver ? '1px solid rgba(255,255,255,.4)' : '1px solid var(--line-strong)',
          display: 'grid', placeItems: 'center', color: 'currentColor', background: 'transparent',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, letterSpacing: '0.12em', fontWeight: 600 }}>
          <span style={{ opacity: 1 }}>ES</span>
          <span style={{ opacity: .3 }}>·</span>
          <span style={{ opacity: .6 }}>EN</span>
        </div>
        <span style={{ opacity: .4 }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, letterSpacing: '0.06em' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
          </svg>
          +51 984 287 027
        </div>
        <a href="#" className="btn btn-primary" style={{ padding: '11px 22px', fontSize: 11 }}>
          Reservar
        </a>
      </div>
    </nav>
  );
};

const Footer = () => (
  <footer className="footer">
    <div className="container">
      <div className="footer-grid">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 46, height: 46, borderRadius: '50%', background: '#fff',
              display: 'grid', placeItems: 'center',
            }}>
              <TikaymiLogo size={30} />
            </div>
            <div className="footer-logo" style={{ margin: 0, fontStyle: 'italic' }}>Tikaymi</div>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: '#C9BFA8', marginBottom: 24, maxWidth: 320 }}>
            Agencia de viajes local en Cusco. Diseñamos experiencias auténticas por los Andes, el Amazonas y la costa peruana desde 2014.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            {['FB','IG','TW','YT','TA'].map(s => (
              <div key={s} style={{
                width: 36, height: 36, border: '1px solid rgba(255,255,255,.2)', borderRadius: '50%',
                display: 'grid', placeItems: 'center', fontSize: 10, letterSpacing: '0.1em', color: '#fff',
              }}>{s}</div>
            ))}
          </div>
        </div>

        <div>
          <h4>Tours</h4>
          <ul>
            <li><a href="#">Machu Picchu</a></li>
            <li><a href="#">Camino Inca</a></li>
            <li><a href="#">Valle Sagrado</a></li>
            <li><a href="#">Salkantay Trek</a></li>
            <li><a href="#">Rainbow Mountain</a></li>
            <li><a href="#">Lago Titicaca</a></li>
          </ul>
        </div>
        <div>
          <h4>Destinos</h4>
          <ul>
            <li><a href="#">Cusco</a></li>
            <li><a href="#">Arequipa</a></li>
            <li><a href="#">Puno</a></li>
            <li><a href="#">Amazonía</a></li>
            <li><a href="#">Lima</a></li>
            <li><a href="#">Costa Norte</a></li>
          </ul>
        </div>
        <div>
          <h4>Compañía</h4>
          <ul>
            <li><a href="#">Sobre Tikaymi</a></li>
            <li><a href="#">Nuestro equipo</a></li>
            <li><a href="#">Turismo responsable</a></li>
            <li><a href="#">Prensa</a></li>
            <li><a href="#">Testimonios</a></li>
            <li><a href="#">Blog</a></li>
          </ul>
        </div>
        <div>
          <h4>Contacto</h4>
          <ul>
            <li style={{ color: '#C9BFA8', fontSize: 14 }}>Urb. Tupac Amaru J-16<br/>Wanchaq, Cusco — Perú</li>
            <li><a href="#">reservas@tikaymi.com</a></li>
            <li><a href="#">+51 984 287 027</a></li>
            <li><a href="#">WhatsApp 24/7</a></li>
          </ul>
          <div style={{ marginTop: 20, padding: 14, border: '1px solid rgba(255,255,255,.12)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#fff', marginBottom: 6 }}>Certificado</div>
            <div style={{ fontSize: 12, color: '#C9BFA8' }}>MINCETUR · RNR-7238 · Tour Operador oficial</div>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div>© 2026 Tikaymi Travel · Todos los derechos reservados</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="#">Términos</a>
          <a href="#">Privacidad</a>
          <a href="#">Cookies</a>
        </div>
      </div>
    </div>
  </footer>
);

const Placeholder = ({ children, style, dark, seed }) => {
  const bg = dark
    ? `repeating-linear-gradient(135deg, rgba(255,255,255,.04) 0 8px, rgba(255,255,255,.08) 8px 9px), #0A4947`
    : `repeating-linear-gradient(135deg, rgba(14,100,98,.05) 0 8px, rgba(14,100,98,.09) 8px 9px), #F4EDE2`;
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
      background: bg, display: 'grid', placeItems: 'center',
      color: dark ? 'rgba(255,255,255,.7)' : 'var(--ink-soft)',
      ...style,
    }}>
      {/* subtle decorative triangle motif */}
      {seed !== undefined && (
        <svg style={{ position: 'absolute', inset: 0, opacity: dark ? 0.06 : 0.08 }} viewBox="0 0 200 200" preserveAspectRatio="none">
          <polygon points={`0,${120 + (seed%40)} ${40 + (seed%30)},${80} ${90 + (seed%20)},${100} ${140 - (seed%20)},${70} 200,${110}`} fill="currentColor" />
          <polygon points={`0,200 200,200 200,${140 + (seed%30)} ${140},${120} ${80},${150} 0,${170}`} fill="currentColor" opacity="0.5"/>
        </svg>
      )}
      <div style={{
        position: 'relative', zIndex: 2,
        fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
        padding: '6px 12px',
        background: dark ? 'rgba(0,0,0,.45)' : 'rgba(250,246,240,.92)',
        color: dark ? 'rgba(255,255,255,.9)' : 'var(--ink-soft)',
        borderRadius: 2,
      }}>
        {children || '◦ imagen'}
      </div>
    </div>
  );
};

Object.assign(window, {
  TikaymiLogo, TikaymiWordmark, Nav, Footer, Placeholder, NAV_ITEMS,
});
