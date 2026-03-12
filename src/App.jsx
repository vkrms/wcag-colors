import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle, Copy, Info, Sliders } from 'lucide-react'

function getLuminance(red, green, blue) {
  const [linearRed, linearGreen, linearBlue] = [red, green, blue].map((value) => {
    const normalized = value / 255

    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue
}

function hslToRgb(hue, saturation, lightness) {
  const normalizedSaturation = saturation / 100
  const normalizedLightness = lightness / 100
  const hueOffset = (index) => (index + hue / 30) % 12
  const chroma = normalizedSaturation * Math.min(normalizedLightness, 1 - normalizedLightness)
  const channel = (index) => normalizedLightness - chroma * Math.max(-1, Math.min(hueOffset(index) - 3, Math.min(9 - hueOffset(index), 1)))

  return [
    Math.round(channel(0) * 255),
    Math.round(channel(8) * 255),
    Math.round(channel(4) * 255),
  ]
}

function rgbToHex(red, green, blue) {
  return `#${(1 << 24 | red << 16 | green << 8 | blue).toString(16).slice(1).toUpperCase()}`
}

function getContrastRatio(firstLuminance, secondLuminance) {
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

function findLightnessForTargetLuminance(hue, saturation, targetLuminance) {
  if (targetLuminance <= 0) {
    return 0
  }

  if (targetLuminance >= 1) {
    return 100
  }

  let low = 0
  let high = 100
  let bestLightness = 50

  for (let iteration = 0; iteration < 25; iteration += 1) {
    const midpoint = (low + high) / 2
    const [red, green, blue] = hslToRgb(hue, saturation, midpoint)
    const luminance = getLuminance(red, green, blue)

    if (luminance > targetLuminance) {
      high = midpoint
    } else {
      low = midpoint
    }

    bestLightness = midpoint
  }

  return bestLightness
}

function getWcagRating(ratio) {
  if (ratio >= 7) {
    return {
      text: 'AAA',
      color: 'text-green-700',
      bg: 'bg-green-100',
      icon: <CheckCircle className="h-4 w-4" />,
    }
  }

  if (ratio >= 4.5) {
    return {
      text: 'AA',
      color: 'text-sky-700',
      bg: 'bg-sky-100',
      icon: <CheckCircle className="h-4 w-4" />,
    }
  }

  if (ratio >= 3) {
    return {
      text: 'AA Large',
      color: 'text-amber-700',
      bg: 'bg-amber-100',
      icon: <Info className="h-4 w-4" />,
    }
  }

  return {
    text: 'Fail',
    color: 'text-red-700',
    bg: 'bg-red-100',
    icon: <AlertTriangle className="h-4 w-4" />,
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)
}

function App() {
  const [targetRatio, setTargetRatio] = useState(3)
  const [saturation, setSaturation] = useState(85)
  const [copiedHex, setCopiedHex] = useState(null)
  const [isEditingRatio, setIsEditingRatio] = useState(false)
  const [tempRatio, setTempRatio] = useState('')

  const targetLuminance = useMemo(() => (1.05 / targetRatio) - 0.05, [targetRatio])

  const colors = useMemo(() => {
    const hues = Array.from({ length: 16 }, (_, index) => index * (360 / 16))

    return hues.map((hue) => {
      const lightness = findLightnessForTargetLuminance(hue, saturation, targetLuminance)
      const [red, green, blue] = hslToRgb(hue, saturation, lightness)
      const hex = rgbToHex(red, green, blue)
      const actualLuminance = getLuminance(red, green, blue)
      const actualContrast = getContrastRatio(1, actualLuminance)

      return { hue, hex, lightness, actualContrast }
    })
  }, [saturation, targetLuminance])

  const currentRating = getWcagRating(targetRatio)

  const handleCopy = async (hex) => {
    try {
      await copyText(hex)
      setCopiedHex(hex)
      window.setTimeout(() => setCopiedHex(null), 2000)
    } catch (error) {
      console.error('Failed to copy color value.', error)
    }
  }

  const handleRatioClick = () => {
    setTempRatio(targetRatio.toString())
    setIsEditingRatio(true)
  }

  const handleRatioSubmit = () => {
    let nextRatio = Number.parseFloat(tempRatio)

    if (Number.isNaN(nextRatio)) {
      nextRatio = 3
    }

    nextRatio = Math.min(21, Math.max(1, nextRatio))
    setTargetRatio(nextRatio)
    setIsEditingRatio(false)
  }

  const handleRatioKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleRatioSubmit()
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 antialiased md:flex md:flex-row">
      <aside className="sticky top-0 z-10 flex h-auto w-full flex-col overflow-y-auto border-b border-slate-200 bg-white p-6 shadow-sm md:h-screen md:w-80 md:border-b-0 md:border-r">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-slate-900 p-2 text-white shadow-sm">
            <Sliders size={20} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">WCAG Utility</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Contrast Targeter</h1>
          </div>
        </div>

        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <label htmlFor="contrast" className="text-sm font-semibold text-slate-700">
                Target Contrast Ratio
              </label>
              {isEditingRatio ? (
                <input
                  type="number"
                  value={tempRatio}
                  onChange={(event) => setTempRatio(event.target.value)}
                  onBlur={handleRatioSubmit}
                  onKeyDown={handleRatioKeyDown}
                  autoFocus
                  step="0.01"
                  min="1"
                  max="21"
                  className="w-20 border-b-2 border-slate-400 bg-transparent text-right text-xl font-bold text-slate-900 outline-none"
                />
              ) : (
                <button
                  type="button"
                  className="rounded px-1 text-xl font-bold text-slate-900 transition-colors hover:bg-slate-100"
                  onClick={handleRatioClick}
                  title="Click to type a custom value"
                >
                  {targetRatio.toFixed(2)}
                </button>
              )}
            </div>

            <input
              id="contrast"
              type="range"
              min="1.1"
              max="21"
              step="0.1"
              value={targetRatio}
              onChange={(event) => setTargetRatio(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-900"
            />

            <div className={`flex items-center gap-2 rounded-md p-3 text-sm font-medium ${currentRating.bg} ${currentRating.color}`}>
              {currentRating.icon}
              <span>WCAG Rating: {currentRating.text}</span>
            </div>

            <p className="text-xs leading-relaxed text-slate-500">
              Finds colors that produce this contrast ratio against a pure white background.
            </p>
          </section>

          <section className="space-y-3 border-t border-slate-100 pt-6">
            <div className="flex items-end justify-between gap-4">
              <label htmlFor="saturation" className="text-sm font-semibold text-slate-700">
                Color Saturation
              </label>
              <span className="text-sm font-medium text-slate-500">{saturation}%</span>
            </div>

            <input
              id="saturation"
              type="range"
              min="0"
              max="100"
              step="1"
              value={saturation}
              onChange={(event) => setSaturation(Number(event.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-900"
            />
          </section>

          <section className="space-y-3 border-t border-slate-100 pt-6">
            <span className="block text-sm font-semibold text-slate-700">WCAG Presets</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTargetRatio(3)}
                className="rounded bg-slate-100 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-slate-200"
              >
                AA Large (3.0)
              </button>
              <button
                type="button"
                onClick={() => setTargetRatio(4.5)}
                className="rounded bg-slate-100 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-slate-200"
              >
                AA Normal (4.5)
              </button>
              <button
                type="button"
                onClick={() => setTargetRatio(7)}
                className="rounded bg-slate-100 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-slate-200"
              >
                AAA (7.0)
              </button>
            </div>
          </section>
        </div>
      </aside>

      <main className="min-h-screen flex-1 bg-white p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Generated Palette</p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Calibrated Color Set</h2>
              <p className="mt-2 text-slate-500">
                All samples below land at roughly {targetRatio.toFixed(2)}:1 against white.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {colors.map((color) => (
              <article
                key={color.hue}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 shrink-0 rounded-full border border-black/5 shadow-inner"
                      style={{ backgroundColor: color.hex }}
                    />
                    <div className="flex flex-col">
                      <span className="font-mono text-lg font-bold leading-tight" style={{ color: color.hex }}>
                        {color.hex}
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        hsl({Math.round(color.hue)}, {saturation}%, {Math.round(color.lightness)}%)
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(color.hex)}
                    className="self-start rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="Copy hex value"
                  >
                    {copiedHex === color.hex ? (
                      <CheckCircle size={18} className="text-green-600" />
                    ) : (
                      <Copy size={18} />
                    )}
                  </button>
                </div>

                <div className="mb-5 space-y-2">
                  <h3 className="text-xl font-bold" style={{ color: color.hex }}>
                    Heading Text
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: color.hex }}>
                    This sample body copy demonstrates readability while maintaining mathematically controlled contrast at {color.actualContrast.toFixed(2)}:1.
                  </p>
                </div>

                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: color.hex, color: '#ffffff' }}
                  >
                    Solid Button
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-lg border-2 bg-transparent px-4 py-2 font-semibold transition-colors hover:bg-slate-50"
                    style={{ color: color.hex, borderColor: color.hex }}
                  >
                    Outline Button
                  </button>
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      className="text-sm font-medium hover:underline"
                      style={{ color: color.hex }}
                    >
                      Interactive Text Link →
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
