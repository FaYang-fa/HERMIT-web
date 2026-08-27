"use strict";

(() => {
    const canvas = document.getElementById("ambientCanvas");
    const shell = document.querySelector(".app-shell");
    const controlPanel = document.querySelector(".control-panel");
    const workspace = document.querySelector(".visualization-workspace");
    if (!canvas || !shell) {
        return;
    }

    const context = canvas.getContext("2d");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const palette = [
        [104, 76, 145],
        [22, 121, 111],
        [52, 127, 184],
        [201, 147, 37]
    ];
    const pointer = {active: false, x: 0, y: 0, side: null};
    let nodes = [];
    let pulses = [];
    let width = 0;
    let height = 0;
    let deviceScale = 1;
    let zones = null;
    let lastFrame = 0;

    function seededRandom(seed) {
        return () => {
            seed |= 0;
            seed = seed + 0x6d2b79f5 | 0;
            let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
            value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
            return ((value ^ value >>> 14) >>> 0) / 4294967296;
        };
    }

    function rgba(color, alpha) {
        return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
    }

    function zoneForPoint(x) {
        if (!zones) {
            return null;
        }
        if (x >= zones.left.min && x <= zones.left.max) {
            return "left";
        }
        if (x >= zones.right.min && x <= zones.right.max) {
            return "right";
        }
        return null;
    }

    function createNodes() {
        nodes = [];
        if (!zones) {
            return;
        }
        const random = seededRandom(0x4845524d);
        ["left", "right"].forEach((side, sideIndex) => {
            const zone = zones[side];
            const zoneWidth = zone.max - zone.min;
            const count = Math.max(10, Math.min(32, Math.round(height / 100 + zoneWidth / 32)));
            for (let index = 0; index < count; index += 1) {
                const angle = random() * Math.PI * 2;
                const speed = reducedMotion ? 0 : 0.08 + random() * 0.14;
                nodes.push({
                    color: palette[(index + sideIndex) % palette.length],
                    radius: 1.3 + random() * 1.5,
                    side,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    x: zone.min + 12 + random() * Math.max(1, zoneWidth - 24),
                    y: 30 + random() * Math.max(1, height - 60)
                });
            }
        });
    }

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        deviceScale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * deviceScale);
        canvas.height = Math.round(height * deviceScale);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
        const shellRect = shell.getBoundingClientRect();
        const controlRect = controlPanel?.getBoundingClientRect();
        const workspaceRect = workspace?.getBoundingClientRect();
        const edgeInset = 10;
        const contentGap = 12;
        const leftMax = (controlRect?.left ?? shellRect.left) - contentGap;
        const rightMin = (workspaceRect?.right ?? shellRect.right) + contentGap;
        const minimumZoneWidth = 36;
        zones = leftMax - edgeInset >= minimumZoneWidth && width - edgeInset - rightMin >= minimumZoneWidth
            ? {
                left: {min: edgeInset, max: leftMax},
                right: {min: rightMin, max: width - edgeInset}
            }
            : null;
        pointer.active = false;
        pulses = [];
        createNodes();
    }

    function updateNodes() {
        if (!zones || reducedMotion) {
            return;
        }
        nodes.forEach((node) => {
            const zone = zones[node.side];
            node.x += node.vx;
            node.y += node.vy;
            if (node.x <= zone.min + 4 || node.x >= zone.max - 4) {
                node.vx *= -1;
                node.x = Math.max(zone.min + 4, Math.min(zone.max - 4, node.x));
            }
            if (node.y <= 12 || node.y >= height - 12) {
                node.vy *= -1;
                node.y = Math.max(12, Math.min(height - 12, node.y));
            }
        });
    }

    function drawLine(start, end, color, alpha, widthValue = 1) {
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.lineWidth = widthValue;
        context.strokeStyle = rgba(color, alpha);
        context.stroke();
    }

    function drawNetwork() {
        nodes.forEach((node, index) => {
            for (let otherIndex = index + 1; otherIndex < nodes.length; otherIndex += 1) {
                const other = nodes[otherIndex];
                if (node.side !== other.side) {
                    continue;
                }
                const distance = Math.hypot(node.x - other.x, node.y - other.y);
                if (distance < 135) {
                    drawLine(node, other, node.color, (1 - distance / 135) * 0.19);
                }
            }
        });

        nodes.forEach((node) => {
            context.beginPath();
            context.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
            context.fillStyle = rgba(node.color, 0.06);
            context.fill();
            context.beginPath();
            context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            context.fillStyle = rgba(node.color, 0.62);
            context.fill();
        });
    }

    function drawShellConnections() {
        if (!zones) {
            return;
        }
        ["left", "right"].forEach((side) => {
            const sideNodes = nodes.filter((node) => node.side === side);
            [0.24, 0.5, 0.76].forEach((position, index) => {
                const anchor = {
                    x: side === "left" ? zones.left.max + 18 : zones.right.min - 18,
                    y: height * position
                };
                const closest = [...sideNodes]
                    .sort((first, second) => Math.hypot(first.x - anchor.x, first.y - anchor.y)
                        - Math.hypot(second.x - anchor.x, second.y - anchor.y))[0];
                if (closest) {
                    drawLine(closest, anchor, palette[index], 0.13);
                    context.beginPath();
                    context.arc(anchor.x, anchor.y, 2.2, 0, Math.PI * 2);
                    context.fillStyle = rgba(palette[index], 0.45);
                    context.fill();
                }
            });
        });
    }

    function drawPointerConnections() {
        if (!pointer.active) {
            return;
        }
        nodes
            .filter((node) => node.side === pointer.side)
            .map((node) => ({node, distance: Math.hypot(node.x - pointer.x, node.y - pointer.y)}))
            .filter((item) => item.distance < 190)
            .sort((first, second) => first.distance - second.distance)
            .slice(0, 7)
            .forEach((item) => {
                drawLine(pointer, item.node, item.node.color, (1 - item.distance / 190) * 0.42, 1.2);
            });
        context.beginPath();
        context.arc(pointer.x, pointer.y, 3, 0, Math.PI * 2);
        context.fillStyle = rgba(palette[1], 0.7);
        context.fill();
    }

    function drawPulses(time) {
        pulses = pulses.filter((pulse) => time - pulse.started < 1300);
        pulses.forEach((pulse) => {
            const progress = Math.min(1, (time - pulse.started) / 1300);
            const alpha = 1 - progress;
            const nearest = nodes
                .filter((node) => node.side === pulse.side)
                .map((node) => ({node, distance: Math.hypot(node.x - pulse.x, node.y - pulse.y)}))
                .sort((first, second) => first.distance - second.distance)
                .slice(0, 9);
            nearest.forEach((item, index) => {
                drawLine(pulse, item.node, pulse.color, alpha * (0.48 - index * 0.035), 1.35);
            });
            context.beginPath();
            context.arc(pulse.x, pulse.y, 8 + progress * 58, 0, Math.PI * 2);
            context.lineWidth = 1.4;
            context.strokeStyle = rgba(pulse.color, alpha * 0.5);
            context.stroke();
        });
    }

    function render(time) {
        window.requestAnimationFrame(render);
        if (document.hidden || time - lastFrame < 32) {
            return;
        }
        lastFrame = time;
        context.clearRect(0, 0, width, height);
        if (!zones) {
            return;
        }
        updateNodes();
        drawNetwork();
        drawShellConnections();
        drawPointerConnections();
        drawPulses(time);
    }

    document.addEventListener("pointermove", (event) => {
        const side = zoneForPoint(event.clientX);
        pointer.active = Boolean(side);
        pointer.side = side;
        pointer.x = event.clientX;
        pointer.y = event.clientY;
    }, {passive: true});

    document.addEventListener("pointerleave", () => {
        pointer.active = false;
    });

    document.addEventListener("click", (event) => {
        const side = zoneForPoint(event.clientX);
        if (!side || event.target.closest("a, button, input")) {
            return;
        }
        pulses.push({
            color: palette[pulses.length % palette.length],
            side,
            started: performance.now(),
            x: event.clientX,
            y: event.clientY
        });
    });

    window.addEventListener("resize", resize, {passive: true});
    resize();
    window.requestAnimationFrame(render);
})();
