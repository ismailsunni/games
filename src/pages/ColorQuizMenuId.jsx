// Sub-menu for Indonesian color quiz: Warna→Nama or Nama→Warna, choose Infinite or 5-Round
export default function ColorQuizMenuId({ type }) {
  // type: 'swatch' | 'name'
  const isReverse = type === 'swatch'
  const base      = isReverse ? '#/colorguesser/idswatchquiz' : '#/colorguesser/idquiz'
  const title     = isReverse ? '🎨 Warna → Nama' : '🏷️ Nama → Warna'
  const desc      = isReverse
    ? 'Lihat warna, tebak namanya dalam bahasa Indonesia.'
    : 'Lihat nama warna Indonesia, pilih warna yang tepat.'

  return (
    <div className="min-h-screen bg-paper font-body flex flex-col">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-canvas px-4 py-3 flex items-center gap-3">
        <a href="#/colorguesser" className="text-accent hover:underline text-sm font-medium">← Back</a>
        <h1 className="font-display text-xl font-bold text-ink flex-1 text-center">{title}</h1>
        <div className="w-12" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 max-w-md mx-auto w-full gap-6">
        <div className="text-center">
          <div className="text-2xl mb-1">🇮🇩</div>
          <p className="text-ink/60 text-sm">{desc}</p>
        </div>

        {/* 5-Round */}
        <a
          href={`${base}/play`}
          className="w-full bg-white border border-ink/10 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">🏁</div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">
                5 Pertanyaan
              </div>
              <div className="text-sm text-ink/60 mt-1">
                Kuis klasik — 5 ronde, nilai berdasarkan kecepatan dan ketepatan.
              </div>
            </div>
            <span className="text-accent font-medium text-sm self-center group-hover:underline whitespace-nowrap">Main →</span>
          </div>
        </a>

        {/* Infinite */}
        <a
          href={`${base}/infinite`}
          className="w-full bg-white border border-ink/10 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="text-4xl">♾️</div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors">
                Mode Tanpa Batas
              </div>
              <div className="text-sm text-ink/60 mt-1">
                Satu salah langsung tamat. Seberapa jauh kamu bisa bertahan?
              </div>
            </div>
            <span className="text-accent font-medium text-sm self-center group-hover:underline whitespace-nowrap">Main →</span>
          </div>
        </a>

        <a href="#/colorguesser"
          className="w-full text-center border border-ink/20 text-ink/60 font-medium py-3 rounded-xl hover:border-accent hover:text-accent transition-colors text-sm">
          ← Kembali ke Color Guesser
        </a>
      </div>
    </div>
  )
}
