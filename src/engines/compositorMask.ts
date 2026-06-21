export function expandHullToViewport(
  hull: { x: number; y: number }[],
  margin: number,
  width: number,
  height: number,
): { x: number; y: number }[] {
  if (hull.length < 3) return hull;
  const result: { x: number; y: number }[] = [];
  const count = hull.length;
  for (let index = 0; index < count; index++) {
    const prev = hull[(index - 1 + count) % count];
    const current = hull[index];
    const next = hull[(index + 1) % count];
    const dx1 = current.x - prev.x;
    const dy1 = current.y - prev.y;
    const dx2 = next.x - current.x;
    const dy2 = next.y - current.y;
    const len1 = Math.hypot(dx1, dy1) || 1;
    const len2 = Math.hypot(dx2, dy2) || 1;
    const nx1 = dy1 / len1;
    const ny1 = -dx1 / len1;
    const nx2 = dy2 / len2;
    const ny2 = -dx2 / len2;
    const nx = (nx1 + nx2) / 2;
    const ny = (ny1 + ny2) / 2;
    const normalLength = Math.hypot(nx, ny) || 1;
    result.push({
      x: Math.max(0, Math.min(width, current.x + (nx / normalLength) * margin)),
      y: Math.max(0, Math.min(height, current.y + (ny / normalLength) * margin)),
    });
  }
  return result;
}

export function featherHullEdge(
  ctx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  hull: { x: number; y: number }[],
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  intensity: number,
): void {
  const maskContext = maskCanvas.getContext('2d');
  if (!maskContext) return;
  maskContext.clearRect(0, 0, rw, rh);
  maskContext.save();
  maskContext.filter = `blur(${Math.max(3, 6 * intensity)}px)`;
  maskContext.fillStyle = '#ffffff';
  maskContext.beginPath();
  maskContext.moveTo(hull[0].x - rx, hull[0].y - ry);
  for (let index = 1; index < hull.length; index++) {
    maskContext.lineTo(hull[index].x - rx, hull[index].y - ry);
  }
  maskContext.closePath();
  maskContext.fill();
  maskContext.restore();

  ctx.save();
  ctx.globalAlpha = 0.4 * intensity;
  ctx.filter = `blur(${Math.max(2, 4 * intensity)}px)`;
  ctx.strokeStyle = 'rgba(0,0,0,0)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(hull[0].x, hull[0].y);
  for (let index = 1; index < hull.length; index++) {
    ctx.lineTo(hull[index].x, hull[index].y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}
