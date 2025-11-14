// delta-robot.js
// Minimal but robust delta robot: 3 arms + joints on techno grid
(function () {
  let canvas, ctx;
  let width = 800;
  let height = 450;
  let t = 0;

  const cfg = {
    baseRadius: 140,
    L1: 150,
    L2: 150,
    armWidth: 10,
    baseJointR: 10,
    elbowJointR: 8,
    eeR: 9,
    lineBase: "rgba(125,155,255,0.9)",
    lineLink: "rgba(190,205,255,0.9)",
    lineEE: "#ffffff",
    gridColor: "rgba(70,86,180,0.45)",
    glowColor: "rgba(72,88,240,0.30)",
    trailColor: "rgba(214,232,255,1.0)",
    trailLen: 80,
  };

  const trail = [];

  function init() {
    const wrap = document.getElementById("delta-bg");
    if (!wrap) return;

    canvas = document.getElementById("delta-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "delta-canvas";
      wrap.appendChild(canvas);
    }

    ctx = canvas.getContext("2d");

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      width = rect.width || wrap.clientWidth || 800;
      height = rect.height || wrap.clientHeight || 420;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrame(0);
    }

    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(loop);
  }

  function loop(ts) {
    t = ts * 0.001;
    drawFrame(t);
    requestAnimationFrame(loop);
  }

  // 3 base joints
  function getBaseJoints() {
    const cx = width / 2;
    const cy = height * 0.55; // vị trí robot (nhỉnh dưới midpoint)
    const R = cfg.baseRadius;

    const joints = [];
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3; // 90, 210, 330 deg
      joints.push({
        x: cx + R * Math.cos(a),
        y: cy + R * Math.sin(a),
      });
    }
    return { cx, cy, joints };
  }

  // simple Lissajous quỹ đạo EE
  function getEndEffector(cx, cy) {
    const ampX = 90;
    const ampY = 50;
    return {
      x: cx + ampX * Math.sin(t * 0.8 + Math.PI / 4),
      y: cy - 70 + ampY * Math.sin(t * 1.3),
    };
  }

  // planar 2-link IK
  function solveIK(bx, by, ex, ey) {
    const L1 = cfg.L1;
    const L2 = cfg.L2;
    const dx = ex - bx;
    const dy = ey - by;
    const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;

    const c2 = Math.max(-1, Math.min(1, (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2)));
    const A2 = Math.acos(c2);
    const A1 =
      Math.atan2(dy, dx) -
      Math.atan2(L2 * Math.sin(A2), L1 + L2 * Math.cos(A2));

    return {
      jx: bx + L1 * Math.cos(A1),
      jy: by + L1 * Math.sin(A1),
    };
  }

  function clear() {
    ctx.clearRect(0, 0, width, height);
  }

  function drawGrid(cy) {
    ctx.save();
    ctx.strokeStyle = cfg.gridColor;
    ctx.lineWidth = 1;

    const spacing = 24;
    const phase = (t * 20) % spacing;

    // horizontal từ “sàn” trở xuống
    for (let y = cy + 40 + spacing - phase; y < height + spacing; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // vertical
    for (let x = spacing - phase; x < width + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, cy + 40);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGlow(cx, cy) {
    const g = ctx.createRadialGradient(
      cx,
      cy,
      10,
      cx,
      cy + 40,
      Math.max(width, height) * 0.8
    );
    g.addColorStop(0, cfg.glowColor);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function drawTrail() {
    if (trail.length < 2) return;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const alpha = i / trail.length;
      ctx.strokeStyle = `rgba(214,232,255,${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFrame() {
    if (!ctx) return;
    clear();

    const { cx, cy, joints } = getBaseJoints();
    const ee = getEndEffector(cx, cy);

    drawGlow(cx, cy);
    drawGrid(cy);

    // update trail
    trail.push({ x: ee.x, y: ee.y });
    if (trail.length > cfg.trailLen) trail.shift();

    // base triangle
    ctx.strokeStyle = "rgba(120,132,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(joints[0].x, joints[0].y);
    ctx.lineTo(joints[1].x, joints[1].y);
    ctx.lineTo(joints[2].x, joints[2].y);
    ctx.closePath();
    ctx.stroke();

    // arms
    joints.forEach((b) => {
      const { jx, jy } = solveIK(b.x, b.y, ee.x, ee.y);

      // UPPER ARM – shadow + core + highlight
      ctx.strokeStyle = "rgba(10,16,40,0.95)";
      ctx.lineWidth = cfg.armWidth + 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(jx, jy);
      ctx.stroke();

      ctx.strokeStyle = "rgba(215,225,255,0.30)";
      ctx.lineWidth = cfg.armWidth;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(jx, jy);
      ctx.stroke();

      ctx.strokeStyle = cfg.lineBase;
      ctx.lineWidth = cfg.armWidth * 0.6;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(jx, jy);
      ctx.stroke();

      // LOWER ARM
      ctx.strokeStyle = "rgba(10,16,40,0.95)";
      ctx.lineWidth = cfg.armWidth + 3;
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.lineTo(ee.x, ee.y);
      ctx.stroke();

      ctx.strokeStyle = "rgba(215,225,255,0.30)";
      ctx.lineWidth = cfg.armWidth * 0.9;
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.lineTo(ee.x, ee.y);
      ctx.stroke();

      ctx.strokeStyle = cfg.lineLink;
      ctx.lineWidth = cfg.armWidth * 0.6;
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.lineTo(ee.x, ee.y);
      ctx.stroke();

      // BASE JOINT (housing + hub)
      const baseOuter = cfg.baseJointR + 3;
      const baseInner = cfg.baseJointR - 2;

      ctx.beginPath();
      ctx.arc(b.x, b.y, baseOuter, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(14,18,40,0.96)";
      ctx.fill();
      ctx.strokeStyle = "rgba(130,150,255,0.9)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(b.x, b.y, baseInner, 0, Math.PI * 2);
      ctx.fillStyle = "#dde4ff";
      ctx.fill();

      // ELBOW JOINT
      const elbowOuter = cfg.elbowJointR + 2;
      const elbowInner = cfg.elbowJointR - 1;

      ctx.beginPath();
      ctx.arc(jx, jy, elbowOuter, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(20,28,70,0.96)";
      ctx.fill();
      ctx.strokeStyle = "rgba(155,180,255,0.9)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(jx, jy, elbowInner, 0, Math.PI * 2);
      ctx.fillStyle = "#e3e8ff";
      ctx.fill();
    });

    // trail (vẽ sau arms)
    drawTrail();

    // end-effector
    ctx.fillStyle = cfg.lineEE;
    ctx.strokeStyle = "rgba(26,32,68,0.85)";
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.arc(ee.x, ee.y, cfg.eeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
