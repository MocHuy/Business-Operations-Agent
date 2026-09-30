export default function AgentMascot() {
  return (
    <svg className="agent-mascot" viewBox="0 0 188 160" role="img" aria-label="Hình chatbot trợ lý vận hành" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bot-shell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fffef9" />
          <stop offset="1" stopColor="#dcefe5" />
        </linearGradient>
        <linearGradient id="bot-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#267a68" />
          <stop offset="1" stopColor="#114c47" />
        </linearGradient>
      </defs>
      <ellipse cx="94" cy="147" rx="60" ry="8" fill="#166653" opacity=".12" />
      <path d="M94 37V23" stroke="#245f55" strokeWidth="5" strokeLinecap="round" />
      <circle cx="94" cy="20" r="7" fill="#76dca7" stroke="#245f55" strokeWidth="3" />
      <rect x="44" y="106" width="100" height="38" rx="19" fill="url(#bot-body)" />
      <circle cx="43" cy="120" r="12" fill="#b6e3cb" stroke="#2c7764" strokeWidth="3" />
      <circle cx="145" cy="120" r="12" fill="#b6e3cb" stroke="#2c7764" strokeWidth="3" />
      <rect x="77" y="112" width="34" height="22" rx="11" fill="#d3f3df" opacity=".9" />
      <path d="M88 123h12m-6-6v12" stroke="#23745b" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="20" y="68" width="17" height="30" rx="8" fill="#78c6a8" stroke="#275f57" strokeWidth="3" />
      <rect x="151" y="68" width="17" height="30" rx="8" fill="#78c6a8" stroke="#275f57" strokeWidth="3" />
      <rect x="31" y="38" width="126" height="80" rx="31" fill="url(#bot-shell)" stroke="#245f55" strokeWidth="3.5" />
      <rect x="45" y="53" width="98" height="52" rx="22" fill="#174f49" />
      <ellipse cx="73" cy="78" rx="6" ry="9" fill="#99edbc" />
      <ellipse cx="115" cy="78" rx="6" ry="9" fill="#99edbc" />
      <circle cx="58" cy="92" r="5" fill="#e6a6a1" opacity=".8" />
      <circle cx="130" cy="92" r="5" fill="#e6a6a1" opacity=".8" />
      <path d="M86 88c4 5 12 5 16 0" fill="none" stroke="#a7eec2" strokeWidth="3" strokeLinecap="round" />
      <path d="m24 36 2.5-7 2.5 7 7 2.5-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5Z" fill="#7bd6a1" opacity=".85" />
      <path d="m163 30 1.8-5 1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8Z" fill="#94e3b0" />
    </svg>
  );
}
