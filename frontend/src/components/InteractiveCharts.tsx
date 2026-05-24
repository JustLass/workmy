import React, { useState, useRef } from 'react'

export interface LineChartPoint {
  label: string
  value: number
}

interface LineChartProps {
  data: LineChartPoint[]
  height?: number
  strokeColor?: string
}

export function InteractiveLineChart({ data, height = 200, strokeColor = '#173124' }: LineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-secondary opacity-60 font-body-md">
        Nenhum dado financeiro disponível
      </div>
    )
  }

  const values = data.map(d => d.value)
  const maxValue = Math.max(...values, 1000)
  const minValue = Math.min(...values, 0)
  const range = maxValue - minValue

  const svgWidth = 800
  const svgHeight = height

  const paddingLeft = 60
  const paddingRight = 40
  const paddingTop = 20
  const paddingBottom = 30

  const chartWidth = svgWidth - paddingLeft - paddingRight
  const chartHeight = svgHeight - paddingTop - paddingBottom

  // Generate points
  const points = data.map((d, index) => {
    const x = paddingLeft + (index / Math.max(1, data.length - 1)) * chartWidth
    const normalizedValue = range === 0 ? 0.5 : (d.value - minValue) / range
    const y = svgHeight - paddingBottom - normalizedValue * chartHeight
    return { x, y, ...d }
  })

  // Build SVG path
  let pathD = ''
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`
    }
  }

  // Linear gradient path
  let areaD = ''
  if (points.length > 0) {
    areaD = `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingBottom} L ${points[0].x} ${svgHeight - paddingBottom} Z`
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    
    // Calcula os fatores de escala e offsets devido à preservação da proporção (aspect ratio) do SVG
    const svgAspect = svgWidth / svgHeight
    const rectAspect = rect.width / rect.height
    
    let scale = 1
    let offsetX = 0
    
    if (rectAspect > svgAspect) {
      // Pilarbox: espaços em branco nas laterais esquerda e direita
      scale = rect.height / svgHeight
      const drawnWidth = svgWidth * scale
      offsetX = (rect.width - drawnWidth) / 2
    } else {
      // Letterbox: espaços em branco no topo e na base
      scale = rect.width / svgWidth
    }

    // Traduz a coordenada física do mouse para a coordenada lógica do viewBox do SVG
    const localMouseX = mouseX - offsetX
    const svgMouseX = localMouseX / scale

    let minDistance = Infinity
    let nearestIdx = 0

    points.forEach((pt, idx) => {
      const dist = Math.abs(pt.x - svgMouseX)
      if (dist < minDistance) {
        minDistance = dist
        nearestIdx = idx
      }
    })

    setHoverIndex(nearestIdx)
  }

  const handleMouseLeave = () => {
    setHoverIndex(null)
  }

  return (
    <div className="relative w-full max-w-[800px] mx-auto overflow-visible group" style={{ height: `${svgHeight}px` }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full overflow-visible select-none cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="chartGradientInteractive" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#173124" stopOpacity="0.15"></stop>
            <stop offset="100%" stopColor="#173124" stopOpacity="0"></stop>
          </linearGradient>
          <filter id="tooltipShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((val, idx) => {
          const y = paddingTop + val * chartHeight
          const gridVal = maxValue - val * range
          return (
            <g key={idx} className="opacity-40">
              <line
                x1={paddingLeft}
                y1={y}
                x2={svgWidth - paddingRight}
                y2={y}
                stroke="#c2c8c2"
                strokeWidth="0.5"
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                className="text-[10px] fill-on-surface-variant font-mono"
                textAnchor="end"
              >
                {gridVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
              </text>
            </g>
          )
        })}

        {/* Shaded Area */}
        {areaD && (
          <path d={areaD} fill="url(#chartGradientInteractive)" />
        )}

        {/* Main Line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* X Axis Labels */}
        {points.map((pt, idx) => {
          const shouldShowLabel = points.length <= 12 || idx % Math.ceil(points.length / 6) === 0
          if (!shouldShowLabel) return null

          return (
            <text
              key={idx}
              x={pt.x}
              y={svgHeight - 10}
              className="text-[11px] fill-on-surface-variant font-bold text-center"
              textAnchor="middle"
            >
              {pt.label}
            </text>
          )
        })}

        {/* Hover marker elements */}
        {hoverIndex !== null && (
          <g>
            <line
              x1={points[hoverIndex].x}
              y1={paddingTop}
              x2={points[hoverIndex].x}
              y2={svgHeight - paddingBottom}
              stroke={strokeColor}
              strokeWidth="1.5"
              strokeDasharray="3 3"
              className="opacity-60"
            />
            <circle
              cx={points[hoverIndex].x}
              cy={points[hoverIndex].y}
              r="8"
              fill={strokeColor}
              className="opacity-20 animate-pulse"
            />
            <circle
              cx={points[hoverIndex].x}
              cy={points[hoverIndex].y}
              r="5"
              fill={strokeColor}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </g>
        )}

        {/* Native SVG Tooltip */}
        {hoverIndex !== null && (() => {
          const pt = points[hoverIndex]
          const tooltipWidth = 140
          const tooltipHeight = 50
          const tx = Math.max(10, Math.min(svgWidth - tooltipWidth - 10, pt.x - tooltipWidth / 2))
          const ty = Math.max(10, pt.y - tooltipHeight - 15)
          const valueFormatted = pt.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
          return (
            <g className="pointer-events-none">
              <rect
                x={tx}
                y={ty}
                width={tooltipWidth}
                height={tooltipHeight}
                rx="8"
                fill="#173124"
                filter="url(#tooltipShadow)"
              />
              <text
                x={tx + tooltipWidth / 2}
                y={ty + 18}
                textAnchor="middle"
                className="text-[9px] font-bold fill-white/80 tracking-wider uppercase font-sans"
              >
                {pt.label}
              </text>
              <text
                x={tx + tooltipWidth / 2}
                y={ty + 36}
                textAnchor="middle"
                className="text-[12px] font-bold fill-white font-mono"
              >
                {valueFormatted}
              </text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}

export interface BarChartItem {
  label: string
  income: number
  expense: number
}

interface BarChartProps {
  data: BarChartItem[]
  height?: number
}

export function InteractiveBarChart({ data, height = 250 }: BarChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-secondary opacity-60 font-body-md">
        Nenhum dado de fluxo de caixa disponível
      </div>
    )
  }

  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1000)
  const svgWidth = 800
  const svgHeight = height

  const paddingLeft = 70
  const paddingRight = 20
  const paddingTop = 20
  const paddingBottom = 40

  const chartWidth = svgWidth - paddingLeft - paddingRight
  const chartHeight = svgHeight - paddingTop - paddingBottom

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left

    // Calcula os fatores de escala e offsets devido à proporção do SVG
    const svgAspect = svgWidth / svgHeight
    const rectAspect = rect.width / rect.height
    
    let scale = 1
    let offsetX = 0
    
    if (rectAspect > svgAspect) {
      scale = rect.height / svgHeight
      const drawnWidth = svgWidth * scale
      offsetX = (rect.width - drawnWidth) / 2
    } else {
      scale = rect.width / svgWidth
    }

    const localMouseX = mouseX - offsetX
    const svgMouseX = localMouseX / scale

    const groupWidth = chartWidth / data.length
    let nearestIdx = Math.floor((svgMouseX - paddingLeft) / groupWidth)
    if (nearestIdx < 0) nearestIdx = 0
    if (nearestIdx >= data.length) nearestIdx = data.length - 1

    setHoverIndex(nearestIdx)
  }

  const handleMouseLeave = () => {
    setHoverIndex(null)
  }

  return (
    <div className="relative w-full max-w-[800px] mx-auto overflow-visible group" style={{ height: `${svgHeight}px` }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full overflow-visible select-none cursor-default"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <filter id="tooltipShadowBar" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((val, idx) => {
          const y = paddingTop + val * chartHeight
          const gridVal = maxVal - val * maxVal
          return (
            <g key={idx} className="opacity-40">
              <line
                x1={paddingLeft}
                y1={y}
                x2={svgWidth - paddingRight}
                y2={y}
                stroke="#c2c8c2"
                strokeWidth="0.5"
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                className="text-[10px] fill-on-surface-variant font-mono"
                textAnchor="end"
              >
                {gridVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
              </text>
            </g>
          )
        })}

        {/* Columns & Bars */}
        {data.map((item, idx) => {
          const groupWidth = chartWidth / data.length
          const groupX = paddingLeft + idx * groupWidth

          const barWidth = Math.min(18, groupWidth * 0.28)

          const incomeHeight = (item.income / maxVal) * chartHeight

          const incomeX = groupX + (groupWidth - barWidth) / 2

          const isHovered = hoverIndex === idx

          return (
            <g key={idx}>
              {/* Columns background overlay */}
              {isHovered && (
                <rect
                  x={groupX + 4}
                  y={paddingTop - 10}
                  width={groupWidth - 8}
                  height={chartHeight + 20}
                  fill="#eaead1"
                  className="opacity-50"
                  rx="8"
                />
              )}

              {/* Revenue bar (Forest Green) */}
              <rect
                x={incomeX}
                y={svgHeight - paddingBottom - incomeHeight}
                width={barWidth}
                height={incomeHeight}
                fill="#173124"
                className={`transition-all duration-200 ${isHovered ? 'brightness-110' : 'opacity-90'}`}
                rx="4"
              />

              {/* Labels */}
              <text
                x={groupX + groupWidth / 2}
                y={svgHeight - 15}
                className={`text-[11px] font-bold text-center ${isHovered ? 'fill-primary font-extrabold text-xs' : 'fill-on-surface-variant'}`}
                textAnchor="middle"
              >
                {item.label}
              </text>
            </g>
          )
        })}

        {/* Native SVG Tooltip for Bar Chart */}
        {hoverIndex !== null && (() => {
          const groupWidth = chartWidth / data.length
          const groupX = paddingLeft + hoverIndex * groupWidth + groupWidth / 2
          
          const tooltipWidth = 140
          const tooltipHeight = 50
          const tx = Math.max(10, Math.min(svgWidth - tooltipWidth - 10, groupX - tooltipWidth / 2))
          const ty = Math.max(5, paddingTop)
          
          const item = data[hoverIndex]
          const valueFormatted = item.income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
          return (
            <g className="pointer-events-none">
              <rect
                x={tx}
                y={ty}
                width={tooltipWidth}
                height={tooltipHeight}
                rx="8"
                fill="#173124"
                filter="url(#tooltipShadowBar)"
              />
              <text
                x={tx + tooltipWidth / 2}
                y={ty + 18}
                textAnchor="middle"
                className="text-[9px] font-bold fill-white/80 tracking-wider uppercase font-sans"
              >
                {item.label}
              </text>
              <text
                x={tx + tooltipWidth / 2}
                y={ty + 36}
                textAnchor="middle"
                className="text-[12px] font-bold fill-white font-mono"
              >
                {valueFormatted}
              </text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}
