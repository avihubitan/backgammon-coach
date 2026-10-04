import { memo, useId } from 'react';
import Svg, { Defs, G, Line, LinearGradient, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { columnX, isTopPoint, type BoardMetrics } from './geometry';
import { useBoardPalette } from './palette';

interface BoardArtProps {
  metrics: BoardMetrics;
}

/** Static board artwork: walnut frame, felt, points, bar and bear-off tray. */
function BoardArtImpl({ metrics: m }: BoardArtProps) {
  const boardColors = useBoardPalette();
  // Gradient ids must be unique per board: on web every SVG shares one document,
  // so a second board would otherwise paint itself with the first one's colours.
  const uid = `bg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const ref = (name: string) => `url(#${uid}-${name})`;
  const innerHeight = m.innerBottom - m.innerTop;
  const halfWidth = 6 * m.col;
  // How far the frame's shade reaches onto the felt.
  const shade = m.checker * 0.42;
  const tipLength = m.pointLength * 0.94;

  const triangles = [];
  for (let point = 1; point <= 24; point++) {
    const x = columnX(m, point);
    const top = isTopPoint(point);
    const columnParity = (top ? point - 13 : 12 - point) % 2;
    const dark = top ? columnParity === 0 : columnParity === 1;
    const baseY = top ? m.innerTop : m.innerBottom;
    const tipY = top ? m.innerTop + tipLength : m.innerBottom - tipLength;
    const inset = m.col * 0.04;
    triangles.push(
      <Polygon
        key={point}
        points={`${x + inset},${baseY} ${x + m.col - inset},${baseY} ${x + m.col / 2},${tipY}`}
        fill={ref(`${dark ? 'dark' : 'light'}${top ? 'Top' : 'Bottom'}`)}
      />,
    );
  }

  return (
    <Svg width={m.width} height={m.height} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <LinearGradient id={`${uid}-frame`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={boardColors.frameTop} />
          <Stop offset="1" stopColor={boardColors.frameBottom} />
        </LinearGradient>
        <LinearGradient id={`${uid}-bar`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={boardColors.barBottom} />
          <Stop offset="0.5" stopColor={boardColors.barTop} />
          <Stop offset="1" stopColor={boardColors.barBottom} />
        </LinearGradient>
        <RadialGradient id={`${uid}-felt`} cx="50%" cy="50%" rx="70%" ry="70%" fx="50%" fy="50%">
          <Stop offset="0" stopColor={boardColors.feltCenter} />
          <Stop offset="1" stopColor={boardColors.feltEdge} />
        </RadialGradient>
        <LinearGradient id={`${uid}-lightTop`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={boardColors.pointLightBase} />
          <Stop offset="1" stopColor={boardColors.pointLightTip} />
        </LinearGradient>
        <LinearGradient id={`${uid}-lightBottom`} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={boardColors.pointLightBase} />
          <Stop offset="1" stopColor={boardColors.pointLightTip} />
        </LinearGradient>
        <LinearGradient id={`${uid}-darkTop`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={boardColors.pointDarkBase} />
          <Stop offset="1" stopColor={boardColors.pointDarkTip} />
        </LinearGradient>
        <LinearGradient id={`${uid}-darkBottom`} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={boardColors.pointDarkBase} />
          <Stop offset="1" stopColor={boardColors.pointDarkTip} />
        </LinearGradient>
        {/* The playing surface sits below the frame: its lip shades the felt's edges, most where the light can't reach. */}
        <LinearGradient id={`${uid}-shadeDown`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0.34} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`${uid}-shadeUp`} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#000" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`${uid}-shadeRight`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#000" stopOpacity={0.24} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={`${uid}-shadeLeft`} x1="1" y1="0" x2="0" y2="0">
          <Stop offset="0" stopColor="#000" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </LinearGradient>
        {/* The tray is a channel cut into the wood: dark under its top edge, a little warmer toward the bottom. */}
        <LinearGradient id={`${uid}-tray`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={0.4} />
          <Stop offset="0.25" stopColor="#000" stopOpacity={0.08} />
          <Stop offset="1" stopColor="#FFF" stopOpacity={0.04} />
        </LinearGradient>
      </Defs>

      <Rect x={0} y={0} width={m.width} height={m.height} rx={12} fill={ref('frame')} />
      <Rect
        x={1}
        y={1}
        width={m.width - 2}
        height={m.height - 2}
        rx={11}
        fill="none"
        stroke={boardColors.frameEdge}
        strokeOpacity={0.6}
        strokeWidth={1}
      />

      <Rect x={m.leftX} y={m.innerTop} width={halfWidth} height={innerHeight} fill={ref('felt')} rx={2} />
      <Rect x={m.rightX} y={m.innerTop} width={halfWidth} height={innerHeight} fill={ref('felt')} rx={2} />

      <G>{triangles}</G>

      {[m.leftX, m.rightX].map((x) => (
        <G key={`recess-${x}`}>
          <Rect x={x} y={m.innerTop} width={halfWidth} height={shade} fill={ref('shadeDown')} />
          <Rect x={x} y={m.innerBottom - shade * 0.7} width={halfWidth} height={shade * 0.7} fill={ref('shadeUp')} />
          <Rect x={x} y={m.innerTop} width={shade * 0.8} height={innerHeight} fill={ref('shadeRight')} />
          <Rect x={x + halfWidth - shade * 0.6} y={m.innerTop} width={shade * 0.6} height={innerHeight} fill={ref('shadeLeft')} />
          {/* A crisp edge where the felt meets the wood, with the lip's highlight just outside it. */}
          <Rect x={x - 0.5} y={m.innerTop - 0.5} width={halfWidth + 1} height={innerHeight + 1} rx={2.5} fill="none" stroke="#FFF" strokeOpacity={0.09} strokeWidth={1} />
          <Rect x={x} y={m.innerTop} width={halfWidth} height={innerHeight} rx={2} fill="none" stroke="#000" strokeOpacity={0.5} strokeWidth={1} />
        </G>
      ))}

      <Rect x={m.barX} y={0} width={m.barWidth} height={m.height} fill={ref('bar')} />
      <Line
        x1={m.barX + m.barWidth / 2}
        y1={m.innerTop}
        x2={m.barX + m.barWidth / 2}
        y2={m.innerBottom}
        stroke="#000"
        strokeOpacity={0.25}
        strokeWidth={1}
      />

      <Rect
        x={m.trayX}
        y={m.innerTop}
        width={m.trayWidth}
        height={innerHeight}
        rx={4}
        fill={boardColors.trayFill}
        stroke={boardColors.trayEdge}
        strokeWidth={1}
      />
      <Rect x={m.trayX + 0.5} y={m.innerTop + 0.5} width={m.trayWidth - 1} height={innerHeight - 1} rx={3.5} fill={ref('tray')} />
      <Rect
        x={m.trayX - 0.5}
        y={m.innerTop - 0.5}
        width={m.trayWidth + 1}
        height={innerHeight + 1}
        rx={4.5}
        fill="none"
        stroke="#FFF"
        strokeOpacity={0.08}
        strokeWidth={1}
      />
      <Line
        x1={m.trayX + 4}
        y1={m.midY}
        x2={m.trayX + m.trayWidth - 4}
        y2={m.midY}
        stroke={boardColors.trayEdge}
        strokeWidth={1}
      />
    </Svg>
  );
}

export const BoardArt = memo(BoardArtImpl);
