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
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
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
    
    // Normalizar a posição do mouse para o intervalo [0, 1]
    const normalizedX = mouseX / rect.width
    // Mapear para as coordenadas do SVG
    const svgMouseX = normalizedX * svgWidth

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

    const targetPt = points[nearestIdx]
    const clientX = rect.left + (targetPt.x / svgWidth) * rect.width
    const clientY = rect.top + (targetPt.y / svgHeight) * rect.height

    setTooltipPos({
      x: clientX - rect.left,
      y: clientY - rect.top - 50
    })
  }

  const handleMouseLeave = () => {
    setHoverIndex(null)
  }

  return (
    <div className="relative w-full overflow-visible group" style={{ height: `${svgHeight}px` }}>
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
      </svg>

      {/* Tooltip */}
      {hoverIndex !== null && (
        <div
          className="absolute z-30 pointer-events-none bg-primary text-on-primary text-xs font-semibold py-sm px-md rounded-xl shadow-lg border border-primary-container flex flex-col gap-0.5"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%)',
            transition: 'left 0.05s ease, top 0.05s ease',
          }}
        >
          <span className="opacity-80 text-[10px] uppercase tracking-wider">{points[hoverIndex].label}</span>
          <span className="font-mono text-sm">
            {points[hoverIndex].value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
      )}
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
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
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

    // Normalizar a posição do mouse para o intervalo [0, 1]
    const normalizedX = mouseX / rect.width
    // Mapear para as coordenadas do SVG
    const svgMouseX = normalizedX * svgWidth

    const groupWidth = chartWidth / data.length
    let nearestIdx = Math.floor((svgMouseX - paddingLeft) / groupWidth)
    if (nearestIdx < 0) nearestIdx = 0
    if (nearestIdx >= data.length) nearestIdx = data.length - 1

    setHoverIndex(nearestIdx)

    const groupX = paddingLeft + nearestIdx * groupWidth + groupWidth / 2
    const clientX = rect.left + (groupX / svgWidth) * rect.width
    const clientY = rect.top + (paddingTop / svgHeight) * rect.height

    setTooltipPos({
      x: clientX - rect.left,
      y: clientY - rect.top - 10
    })
  }

  const handleMouseLeave = () => {
    setHoverIndex(null)
  }

  return (
    <div className="relative w-full overflow-visible group" style={{ height: `${svgHeight}px` }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full overflow-visible select-none cursor-default"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
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
          const barGap = 6

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
      </svg>

      {/* Floating Tooltip */}
      {hoverIndex !== null && (
        <div
          className="absolute z-30 pointer-events-none bg-primary text-on-primary text-xs font-semibold py-sm px-md rounded-xl shadow-lg border border-primary-container flex flex-col gap-1 w-44"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%)',
            transition: 'left 0.05s ease, top 0.05s ease',
          }}
        >
          <span className="opacity-80 text-[10px] uppercase tracking-wider text-center border-b border-primary-container/30 pb-0.5 mb-0.5">
            {data[hoverIndex].label}
          </span>
          <div className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-1.5 font-normal">
              <span className="w-2.5 h-2.5 rounded-full bg-on-primary-container" style={{ backgroundColor: '#ffffff' }}></span>
              Receitas:
            </span>
            <span className="font-mono">
              {data[hoverIndex].income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
