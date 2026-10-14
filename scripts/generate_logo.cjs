const fs = require('fs');

function generateLogo() {
  const cx = 130;
  const cy = 130;
  const numPeople = 28;
  
  // 1. Generate Ring of People Holding Hands
  let peoplePaths = '';
  for (let i = 0; i < numPeople; i++) {
    const angDeg = (i * 360) / numPeople;
    const ang = (angDeg * Math.PI) / 180;
    const nextAng = (((i + 1) * 360) / numPeople) * Math.PI / 180;
    const prevAng = (((i - 1) * 360) / numPeople) * Math.PI / 180;
    const halfStep = (Math.PI / numPeople);

    // Head (Circle)
    const headDist = 114;
    const hx = cx + headDist * Math.cos(ang);
    const hy = cy + headDist * Math.sin(ang);
    peoplePaths += `<circle cx="${hx.toFixed(2)}" cy="${hy.toFixed(2)}" r="4.2" fill="#0077c8"/>\n`;

    // Torso & Arms
    // Center shoulder
    const shoulderR = 104;
    const sx = cx + shoulderR * Math.cos(ang);
    const sy = cy + shoulderR * Math.sin(ang);

    // Linked hands with next person
    const handR = 103;
    const handX = cx + handR * Math.cos(ang + halfStep);
    const handY = cy + handR * Math.sin(ang + halfStep);

    // Waist / Inward body base
    const waistR = 86;
    const w1x = cx + waistR * Math.cos(ang - halfStep * 0.35);
    const w1y = cy + waistR * Math.sin(ang - halfStep * 0.35);
    const w2x = cx + waistR * Math.cos(ang + halfStep * 0.35);
    const w2y = cy + waistR * Math.sin(ang + halfStep * 0.35);

    // Body polygon
    peoplePaths += `<polygon points="${sx.toFixed(2)},${sy.toFixed(2)} ${handX.toFixed(2)},${handY.toFixed(2)} ${w2x.toFixed(2)},${w2y.toFixed(2)} ${w1x.toFixed(2)},${w1y.toFixed(2)}" fill="#0077c8"/>\n`;
  }

  // 2. Islamic Arabesque Star Pattern in inner circle (radius 82)
  let arabesque = '';
  // 8-pointed star rosette pattern in background
  const starR = 82;
  for (let i = 0; i < 8; i++) {
    const a1 = (i * 45 * Math.PI) / 180;
    const a2 = ((i * 45 + 22.5) * Math.PI) / 180;
    const a3 = (((i + 1) * 45) * Math.PI) / 180;
    
    // Outer points
    const p1x = cx + starR * Math.cos(a1);
    const p1y = cy + starR * Math.sin(a1);
    const p2x = cx + (starR * 0.72) * Math.cos(a2);
    const p2y = cy + (starR * 0.72) * Math.sin(a2);
    const p3x = cx + starR * Math.cos(a3);
    const p3y = cy + starR * Math.sin(a3);

    arabesque += `<line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="#cbd5e1" stroke-width="1.2"/>\n`;
    arabesque += `<line x1="${p2x.toFixed(1)}" y1="${p2y.toFixed(1)}" x2="${p3x.toFixed(1)}" y2="${p3y.toFixed(1)}" stroke="#cbd5e1" stroke-width="1.2"/>\n`;
    arabesque += `<line x1="${p2x.toFixed(1)}" y1="${p2y.toFixed(1)}" x2="${cx}" y2="${cy}" stroke="#e2e8f0" stroke-width="0.8"/>\n`;
  }
  // Secondary geometric lattice lines
  for (let i = 0; i < 16; i++) {
    const a = (i * 22.5 * Math.PI) / 180;
    const x1 = cx + (starR * 0.5) * Math.cos(a);
    const y1 = cy + (starR * 0.5) * Math.sin(a);
    const aOpp = a + Math.PI * 0.6;
    const x2 = cx + (starR * 0.5) * Math.cos(aOpp);
    const y2 = cy + (starR * 0.5) * Math.sin(aOpp);
    arabesque += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#e2e8f0" stroke-width="0.75" stroke-dasharray="3,3"/>\n`;
  }

  // 3. Central Mosque & Minarets + Crescent
  // Dome Center at (130, 118)
  const mosque = `
    <!-- Mosque Dome Base & Onion Arch -->
    <path d="M 96,152 C 96,128 108,110 130,86 C 152,110 164,128 164,152 Z" fill="#0066b2"/>
    <path d="M 104,152 C 104,132 114,118 130,96 C 146,118 156,132 156,152 Z" fill="#0077c8" opacity="0.35"/>
    <path d="M 128,88 Q 130,82 130,76 Q 130,82 132,88 Z" fill="#0066b2"/>
    <!-- Crescent Moon on Spire -->
    <circle cx="130" cy="72" r="4.5" fill="#0066b2"/>
    <circle cx="131.5" cy="71" r="3.6" fill="#f8fafc"/>
    <line x1="130" y1="76" x2="130" y2="86" stroke="#0066b2" stroke-width="1.8"/>

    <!-- Left Minaret -->
    <rect x="73" y="106" width="9" height="54" rx="1" fill="#0066b2"/>
    <polygon points="71,106 84,106 82,101 73,101" fill="#005596"/>
    <rect x="73.5" y="93" width="8" height="8" rx="0.5" fill="#0066b2"/>
    <path d="M 73.5,93 C 73.5,88 77.5,84 77.5,84 C 77.5,84 81.5,88 81.5,93 Z" fill="#0066b2"/>
    <line x1="77.5" y1="84" x2="77.5" y2="80" stroke="#0066b2" stroke-width="1.2"/>
    <circle cx="77.5" cy="79.5" r="1.2" fill="#0066b2"/>
    <rect x="75" y="118" width="5" height="7" rx="2.5" fill="#ffffff" opacity="0.8"/>
    <rect x="75" y="134" width="5" height="7" rx="2.5" fill="#ffffff" opacity="0.8"/>

    <!-- Right Minaret -->
    <rect x="178" y="106" width="9" height="54" rx="1" fill="#0066b2"/>
    <polygon points="176,106 189,106 187,101 178,101" fill="#005596"/>
    <rect x="178.5" y="93" width="8" height="8" rx="0.5" fill="#0066b2"/>
    <path d="M 178.5,93 C 178.5,88 182.5,84 182.5,84 C 182.5,84 186.5,88 186.5,93 Z" fill="#0066b2"/>
    <line x1="182.5" y1="84" x2="182.5" y2="80" stroke="#0066b2" stroke-width="1.2"/>
    <circle cx="182.5" cy="79.5" r="1.2" fill="#0066b2"/>
    <rect x="180" y="118" width="5" height="7" rx="2.5" fill="#ffffff" opacity="0.8"/>
    <rect x="180" y="134" width="5" height="7" rx="2.5" fill="#ffffff" opacity="0.8"/>
  `;

  // 4. Stylized Intertwined "UMU" / "IMU" Calligraphic Monogram
  // Bold Navy Blue with clean white outline for maximum contrast
  const monogram = `
    <!-- Intertwined UMU Ribbon Monogram -->
    <g stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <!-- Left U / I Stem -->
      <path d="M 88,124 C 88,142 88,162 98,172 C 108,181 118,178 122,162 L 122,130"/>
      <!-- Right M / U Loop -->
      <path d="M 172,124 C 172,142 172,162 162,172 C 152,181 142,178 138,162 L 138,130"/>
      <!-- Center Arch Connection -->
      <path d="M 112,138 C 112,126 122,118 130,118 C 138,118 148,126 148,138 L 148,166 C 148,176 138,182 130,182 C 122,182 112,176 112,166 Z"/>
    </g>

    <g stroke="#003366" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <!-- Left loop -->
      <path d="M 90,126 C 90,144 90,163 100,173 C 108,181 116,177 120,163 L 120,132"/>
      <!-- Right loop -->
      <path d="M 170,126 C 170,144 170,163 160,173 C 152,181 144,177 140,163 L 140,132"/>
      <!-- Center loop -->
      <path d="M 114,138 C 114,126 122,120 130,120 C 138,120 146,126 146,138 L 146,166 C 146,174 138,180 130,180 C 122,180 114,174 114,166 Z"/>
    </g>

    <!-- Calligraphy decorative terminal dots -->
    <circle cx="90" cy="122" r="4.5" fill="#003366"/>
    <circle cx="170" cy="122" r="4.5" fill="#003366"/>
    <circle cx="130" cy="138" r="3.2" fill="#003366"/>
  `;

  // EMBLEM ONLY SVG (Square 260x260)
  const emblemSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260" width="260" height="260">
  <defs>
    <radialGradient id="emblemBg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#eef2f6"/>
    </radialGradient>
  </defs>
  <!-- Background disc -->
  <circle cx="130" cy="130" r="124" fill="url(#emblemBg)"/>
  <circle cx="130" cy="130" r="83" fill="#ffffff" stroke="#0077c8" stroke-width="2.5"/>

  <!-- Arabesque Pattern -->
  <g id="arabesque-pattern">
    ${arabesque}
  </g>

  <!-- Mosque & Minarets -->
  <g id="mosque-structure">
    ${mosque}
  </g>

  <!-- Central Monogram -->
  <g id="monogram">
    ${monogram}
  </g>

  <!-- Ring of People (Unity) -->
  <g id="people-ring">
    ${peoplePaths}
  </g>
</svg>`;

  // FULL HORIZONTAL LOGO SVG (880 x 260)
  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 260" width="880" height="260">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=El+Messiri:wght@600;700&amp;family=Cinzel:wght@600;700&amp;display=swap');
      
      .brand-title {
        font-family: 'El Messiri', 'Cinzel', 'Plus Jakarta Sans', serif, sans-serif;
        font-weight: 700;
        font-size: 47px;
        fill: #50555a;
        letter-spacing: 2px;
      }
      .brand-country {
        font-family: 'El Messiri', 'Cinzel', 'Plus Jakarta Sans', serif, sans-serif;
        font-weight: 600;
        font-size: 34px;
        fill: #50555a;
        letter-spacing: 5px;
      }
      .brand-estd {
        font-family: 'El Messiri', 'Cinzel', 'Plus Jakarta Sans', serif, sans-serif;
        font-weight: 600;
        font-size: 21px;
        fill: #50555a;
        letter-spacing: 6px;
      }
    </style>
    <radialGradient id="emblemBgFull" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#eef2f6"/>
    </radialGradient>
  </defs>

  <!-- Emblem on Left -->
  <g id="logo-emblem" transform="translate(0, 0)">
    <circle cx="130" cy="130" r="124" fill="url(#emblemBgFull)"/>
    <circle cx="130" cy="130" r="83" fill="#ffffff" stroke="#0077c8" stroke-width="2.5"/>

    <!-- Arabesque -->
    <g id="arabesque-pattern">
      ${arabesque}
    </g>

    <!-- Mosque -->
    <g id="mosque-structure">
      ${mosque}
    </g>

    <!-- Monogram -->
    <g id="monogram">
      ${monogram}
    </g>

    <!-- People Ring -->
    <g id="people-ring">
      ${peoplePaths}
    </g>
  </g>

  <!-- Typography on Right matching the image -->
  <!-- Line 1: UDYAVAR MUSLIM UNITY -->
  <text x="278" y="112" class="brand-title">UDYAVAR MUSLIM UNITY</text>

  <!-- Line 2: UAE (Centered relative to text block) -->
  <text x="578" y="165" text-anchor="middle" class="brand-country">uaɛ</text>

  <!-- Line 3: ESTD 2008 -->
  <text x="578" y="206" text-anchor="middle" class="brand-estd">ESTD 2008</text>
</svg>`;

  fs.writeFileSync('public/logo.svg', fullSvg);
  fs.writeFileSync('public/logo-emblem.svg', emblemSvg);
  fs.writeFileSync('public/icon.svg', emblemSvg);
  console.log('Successfully generated public/logo.svg, public/logo-emblem.svg, and public/icon.svg');
}

generateLogo();
