import { useState, useEffect, useMemo } from 'react'
import { TOKEN, pumpFunUrl } from './config'
import './App.css'

function timeAgo(ts) {
  if (!ts) return ''
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return `${Math.max(sec, 1)}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function shortAddr(addr) {
  if (!addr) return '—'
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

function formatCountdown(sec) {
  if (sec == null) return '5:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function App() {
  const [copied, setCopied] = useState(false)
  const [posts, setPosts] = useState([])
  const [earners, setEarners] = useState([])
  const [payouts, setPayouts] = useState([])
  const [stats, setStats] = useState({})

  useEffect(() => {
    async function load() {
      try {
        const base = TOKEN.apiUrl
        const [p, e, py, st] = await Promise.all([
          fetch(`${base}/recent-posts`).then(r => r.json()).catch(() => []),
          fetch(`${base}/earners`).then(r => r.json()).catch(() => []),
          fetch(`${base}/payouts`).then(r => r.json()).catch(() => []),
          fetch(`${base}/stats`).then(r => r.json()).catch(() => ({})),
        ])
        setPosts(Array.isArray(p) ? p : [])
        setEarners(Array.isArray(e) ? e : [])
        setPayouts(Array.isArray(py) ? py : [])
        setStats(st || {})
      } catch {}
    }
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [])

  const mint = stats.tokenAddress || TOKEN.mintOverride || ''
  const pumpUrl = pumpFunUrl(mint)
  const isLive = Boolean(mint)

  const copyCA = async () => {
    if (!mint) return
    await navigator.clipboard.writeText(mint)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const navCta = useMemo(() => {
    const xLink = (
      <a
        href={TOKEN.twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-icon"
        aria-label={TOKEN.twitterHandle}
        title={TOKEN.twitterHandle}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path
            fill="currentColor"
            d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
          />
        </svg>
      </a>
    )
    if (pumpUrl) {
      return (
        <>
          {xLink}
          <a href={pumpUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            Community
          </a>
          <a href={pumpUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Start yapping
          </a>
        </>
      )
    }
    return (
      <>
        {xLink}
        <span className="btn btn-primary btn-disabled">Launching soon</span>
      </>
    )
  }, [pumpUrl])

  return (
    <div className="page">
      <header className="topbar">
        <a href="#top" className="brand">
          <img src="/logo.png" alt="" className="brand-logo" width={36} height={36} />
          <span className="brand-text">
            <span className="brand-name">Yap to Earn</span>
            <span className="brand-ticker">{TOKEN.ticker}</span>
          </span>
        </a>
        <nav className="topbar-nav">{navCta}</nav>
      </header>

      <main id="top" className="main">
        {!isLive && (
          <div className="launch-banner" role="status">
            <strong>$YAP launches soon.</strong> Contract and treasury wallet are being wired in — feed and payouts
            go live the moment the mint is set on the backend.
          </div>
        )}

        <section className="hero">
          <img src="/logo.png" alt="Yap to Earn" className="hero-logo" width={88} height={88} />
          <p className="eyebrow">Coin Communities · pump.fun</p>
          <h1 className="hero-title">
            Yap to Earn
            <span className="hero-ticker">{TOKEN.ticker}</span>
          </h1>
          <p className="hero-lead">{TOKEN.tagline}</p>
          <p className="hero-detail">
            Creator fees are claimed every 5 minutes and split <strong>equally</strong> among wallets that
            posted in the community and hold at least 1 {TOKEN.ticker}. No likes, no raids — just yap + hold.
          </p>
          <div className="hero-actions">
            {pumpUrl ? (
              <a href={pumpUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg">
                Open community feed
              </a>
            ) : (
              <span className="btn btn-primary btn-lg btn-disabled">Community opens at launch</span>
            )}
            {mint && (
              <button type="button" className="btn btn-outline btn-lg" onClick={copyCA}>
                {copied ? 'Copied' : 'Copy contract'}
              </button>
            )}
          </div>
          {mint && <code className="ca-chip">{mint}</code>}
        </section>

        <section className="metrics" aria-label="Live stats">
          <div className="metric">
            <span className="metric-value">{(stats.poolSol ?? 0).toFixed(3)}</span>
            <span className="metric-label">Rewards pool</span>
          </div>
          <div className="metric">
            <span className="metric-value">{(stats.totalClaimedSol ?? 0).toFixed(3)}</span>
            <span className="metric-label">Fees claimed</span>
          </div>
          <div className="metric">
            <span className="metric-value">{(stats.totalSentSol ?? 0).toFixed(3)}</span>
            <span className="metric-label">Paid to yappers</span>
          </div>
          <div className="metric">
            <span className="metric-value">{stats.uniqueEarners ?? 0}</span>
            <span className="metric-label">Earners</span>
          </div>
          <div className="metric">
            <span className="metric-value metric-accent">{formatCountdown(stats.nextCycleInSec)}</span>
            <span className="metric-label">Next payout</span>
          </div>
        </section>

        <section className="steps">
          <h2 className="section-heading">How it works</h2>
          <ol className="step-list">
            <li>
              <span className="step-n">1</span>
              <div>
                <strong>Buy & hold</strong>
                <p>Keep ≥ 1 {TOKEN.ticker} in the wallet linked to your community account.</p>
              </div>
            </li>
            <li>
              <span className="step-n">2</span>
              <div>
                <strong>Post in the feed</strong>
                <p>Yap on this coin&apos;s pump.fun community — your wallet is attached automatically.</p>
              </div>
            </li>
            <li>
              <span className="step-n">3</span>
              <div>
                <strong>Get SOL</strong>
                <p>Every cycle, the pool divides evenly across all qualifying posters.</p>
              </div>
            </li>
          </ol>
        </section>

        <div className="dashboard">
          <section className="panel panel-feed">
            <div className="panel-head">
              <h2 className="section-heading">Live feed</h2>
              {isLive && (
                <span className="live-pill">
                  <span className="live-dot" />
                  Live
                </span>
              )}
            </div>
            <ul className="feed">
              {!isLive && (
                <li className="feed-empty">Feed starts when the new $YAP mint is configured on the backend.</li>
              )}
              {isLive && posts.length === 0 && (
                <li className="feed-empty">No posts ingested yet. Be the first to yap.</li>
              )}
              {posts.map(p => (
                <li key={p.messageId} className="feed-item">
                  <div className="feed-top">
                    <div className="feed-author">
                      {p.profileImageUrl ? (
                        <img src={p.profileImageUrl} alt="" className="feed-avatar" />
                      ) : (
                        <span className="feed-avatar feed-avatar-fallback">
                          {(p.username || '?')[0]}
                        </span>
                      )}
                      <div>
                        <span className="feed-user">@{p.username || 'anon'}</span>
                        <span className="feed-wallet">{shortAddr(p.wallet)}</span>
                      </div>
                    </div>
                    <time className="feed-time">{timeAgo(p.createdAt)}</time>
                  </div>
                  <p className="feed-body">{p.content}</p>
                  <div className="feed-tags">
                    {p.isHolder && <span className="tag tag-holder">Holder</span>}
                    {p.qualified && <span className="tag tag-qualified">Qualified</span>}
                    {p.paid && (
                      <span className="tag tag-paid">+{p.paidAmount?.toFixed(4)} SOL</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <aside className="sidebar">
            <section className="panel">
              <h2 className="section-heading">Top earners</h2>
              <ul className="rank-list">
                {earners.length === 0 && <li className="rank-empty">No earners yet.</li>}
                {earners.map((e, i) => (
                  <li key={e.wallet} className="rank-item">
                    <span className="rank-pos">{i + 1}</span>
                    <span className="rank-wallet">{shortAddr(e.wallet)}</span>
                    <span className="rank-sol">{e.totalEarnedSol?.toFixed(4)} SOL</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <h2 className="section-heading">Recent payouts</h2>
              <ul className="payout-list">
                {payouts.length === 0 && <li className="rank-empty">No on-chain payouts yet.</li>}
                {payouts.slice(0, 8).map(p => (
                  <li key={p.tx}>
                    <a
                      href={`https://solscan.io/tx/${p.tx}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="payout-link"
                    >
                      <span className="payout-wallet">{shortAddr(p.wallet)}</span>
                      <span className="payout-amt">{p.amount?.toFixed(4)} SOL</span>
                      <span className="payout-arrow" aria-hidden>↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>

      <footer className="footer">
        <nav className="footer-links">
          <a href={TOKEN.twitterUrl} target="_blank" rel="noopener noreferrer">
            {TOKEN.twitterHandle} on X
          </a>
        </nav>
        <p>Yap to Earn · {TOKEN.ticker} · pump.fun creator fees + Coin Communities</p>
      </footer>
    </div>
  )
}
