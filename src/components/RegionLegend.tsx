export function RegionLegend() {
  return (
    <figure className="region-legend">
      <div className="region-legend__pattern" aria-hidden="true">
        <svg
          className="region-legend__svg"
          viewBox="0 0 260 92"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="region-legend__blob region-legend__blob--a"
            d="M 18 46 C 6 28 10 12 32 8 C 54 4 72 18 78 36 C 84 54 70 72 48 76 C 26 80 10 64 18 46 Z"
          />
          <path
            className="region-legend__blob region-legend__blob--b"
            d="M 72 22 C 96 8 124 14 138 34 C 152 54 142 78 118 84 C 94 90 70 76 64 52 C 58 38 62 28 72 22 Z"
          />
          <path
            className="region-legend__blob region-legend__blob--a"
            d="M 132 18 C 158 6 188 12 202 32 C 216 52 208 80 182 86 C 156 92 128 78 120 50 C 116 34 122 24 132 18 Z"
          />
          <path
            className="region-legend__blob region-legend__blob--b"
            d="M 196 28 C 220 20 246 36 250 58 C 254 80 234 90 212 86 C 190 82 176 64 180 44 C 184 32 188 30 196 28 Z"
          />
          <path
            className="region-legend__blob region-legend__blob--a"
            d="M 88 58 C 104 48 128 52 140 70 C 152 88 130 92 108 88 C 86 84 76 68 88 58 Z"
          />
        </svg>
      </div>
      <figcaption className="region-legend__caption">
        Alueet erottuvat <strong>paksuista rajoista</strong> ja vuorottelevan
        taustan sävyistä. Kuvio on vain epämääräinen malli — todellinen jako
        näkyy yllä olevassa ruudukossa.
      </figcaption>
    </figure>
  )
}
