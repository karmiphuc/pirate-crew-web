/** Original compact character art. Four shared atlases; no per-actor canvases. */
export const PIRATE_FRAMES = {
  idle: ["idle-0", "idle-1", "idle-2"],
  walk: ["walk-0", "walk-1", "walk-2"],
} as const;
export const PIRATE_VARIANTS = PIRATE_FRAMES.idle.length;
export function pirateVariant(pirate: { id: number; role: string }): number {
  return pirate.role === "captain" ? 0 : (pirate.id + 1) % PIRATE_VARIANTS;
}
export function paintPirate(
  ctx: CanvasRenderingContext2D,
  role: number,
  walking: boolean,
  variant = 0,
) {
  const ink = "#20272d",
    skin =
      variant === 2
        ? "#a97552"
        : variant === 1
          ? "#d5a274"
          : role === 2
            ? "#c58f69"
            : "#efbc8e";
  const coat = [
    ["#293f4b", "#974a43", "#557c87", "#d9d0a8"],
    ["#293f4b", "#86483c", "#647a74", "#64765b"],
    ["#293f4b", "#70404a", "#4c697a", "#c9b890"],
  ][variant][role];
  const shape = (color: string, points: number[][], outline = true) => {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };
  const ellipse = (
    color: string,
    x: number,
    y: number,
    rx: number,
    ry: number,
  ) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  const rect = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  ctx.save();
  // Back arm, ponytail and scarf give each role a distinct silhouette.
  if (role === 3 && variant === 0) {
    ellipse("#784638", 9, 15, 4, 7);
    shape("#995143", [
      [8, 15],
      [4, 20],
      [6, 26],
      [10, 22],
    ]);
  }
  shape(coat, [
    [10, 19],
    [6, 21],
    [5, 27],
    [8, 28],
    [11, 23],
  ]);
  ellipse(skin, 6.5, 27, 2, 2.5);
  const stride = walking ? 2 : 0;
  shape("#384b51", [
    [11, 28],
    [15, 28],
    [14 - stride, 36],
    [10 - stride, 36],
  ]);
  shape("#293b43", [
    [16, 28],
    [20, 28],
    [22 + stride, 35],
    [18 + stride, 36],
  ]);
  shape("#3a2c2b", [
    [9 - stride, 34],
    [14 - stride, 34],
    [14 - stride, 38],
    [7 - stride, 38],
    [7 - stride, 36],
  ]);
  shape("#3a2c2b", [
    [18 + stride, 34],
    [22 + stride, 34],
    [25 + stride, 37],
    [25 + stride, 38],
    [18 + stride, 38],
  ]);
  rect("#ba9a65", 9 - stride, 34, 5, 1);
  rect("#ba9a65", 18 + stride, 34, 4, 1);
  shape(coat, [
    [11, 18],
    [20, 18],
    [23, 26],
    [22, 31],
    [17, 29],
    [14, 32],
    [9, 30],
    [9, 24],
  ]);
  if (role === 0) {
    shape(
      "#c3a465",
      [
        [11, 19],
        [13, 20],
        [13, 29],
        [11, 30],
      ],
      false,
    );
    shape(
      "#c3a465",
      [
        [19, 19],
        [20, 19],
        [22, 30],
        [20, 30],
      ],
      false,
    );
    rect("#e7d4a2", 14, 22, 4, 6);
    for (let y = 23; y < 29; y += 3) rect("#efd58b", 19, y, 1, 1);
  } else {
    shape(
      role === 3 ? "#507e73" : "#d1b584",
      [
        [10, 26],
        [21, 25],
        [22, 28],
        [10, 29],
      ],
      false,
    );
    rect("#edd7a0", 14, 26, 3, 2);
    if (role === 2) {
      shape("#293d46", [
        [12, 18],
        [14, 20],
        [14, 25],
        [10, 26],
      ]);
      shape("#293d46", [
        [18, 20],
        [20, 18],
        [22, 26],
        [18, 25],
      ]);
    }
  }
  ellipse(skin, 15, 13, 6, 7);
  shape(
    variant === 2 ? "#855637" : "#b47959",
    [
      [18, 12],
      [21, 13],
      [21, 17],
      [17, 19],
      [15, 18],
    ],
    false,
  );
  // Brows, nose, glint and a little face asymmetry remain legible at game scale.
  rect(ink, 12, 12, 2, 1);
  rect(ink, 18, 12, 2, 1);
  rect("#f9e1b5", 12, 14, 1, 1);
  rect(ink, 13, 14, 1, 2);
  rect(ink, 18, 14, 1, 2);
  rect("#c88a61", 16, 15, 2, 2);
  rect("#8a4b40", 14, 18, 4, 1);
  if (role === 0) {
    shape(
      "#4c352e",
      [
        [11, 17],
        [14, 18],
        [16, 17],
        [19, 17],
        [19, 20],
        [15, 23],
        [12, 20],
      ],
      false,
    );
    shape("#1f303a", [
      [4, 9],
      [8, 4],
      [13, 5],
      [16, 2],
      [21, 4],
      [25, 9],
      [24, 11],
      [5, 11],
    ]);
    shape(
      "#bf9c60",
      [
        [5, 9],
        [12, 8],
        [16, 9],
        [23, 8],
        [24, 10],
        [5, 11],
      ],
      false,
    );
    rect("#eddfb8", 15, 5, 3, 2);
    rect("#eddfb8", 16, 7, 1, 1);
    shape(
      "#ac5c49",
      [
        [24, 6],
        [28, 3],
        [28, 6],
        [25, 9],
      ],
      false,
    );
  } else if (role === 1) {
    shape("#ad4f41", [
      [8, 9],
      [10, 6],
      [18, 6],
      [22, 9],
      [22, 11],
      [8, 11],
    ]);
    shape(
      "#ad4f41",
      [
        [8, 9],
        [5, 11],
        [4, 17],
        [8, 14],
      ],
      false,
    );
    rect(ink, 18, 13, 3, 3);
    shape(
      "#4c352e",
      [
        [11, 18],
        [14, 20],
        [18, 19],
        [16, 23],
        [12, 21],
      ],
      false,
    );
  } else if (role === 2) {
    shape("#324b5a", [
      [8, 9],
      [9, 6],
      [15, 5],
      [21, 8],
      [22, 11],
      [8, 11],
    ]);
    rect("#adbfab", 9, 9, 13, 1);
    shape(
      "#304956",
      [
        [21, 9],
        [26, 11],
        [24, 15],
        [21, 12],
      ],
      false,
    );
    rect("#513b31", 12, 19, 6, 2);
  } else if (variant === 1) {
    // Short curls and a tied olive scarf make the second deckhand a distinct silhouette.
    for (const [x, y] of [
      [10, 8],
      [14, 6],
      [18, 7],
      [21, 10],
    ])
      ellipse("#40322c", x, y, 3, 3);
    shape(
      "#839277",
      [
        [8, 10],
        [21, 10],
        [21, 12],
        [9, 12],
      ],
      false,
    );
    shape(
      "#839277",
      [
        [9, 11],
        [5, 13],
        [6, 18],
        [10, 14],
      ],
      false,
    );
    rect("#594234", 13, 19, 5, 2);
  } else if (variant === 2) {
    for (const [x, y] of [
      [9, 9],
      [12, 6],
      [16, 5],
      [20, 7],
      [22, 10],
    ])
      ellipse("#302c2b", x, y, 3, 3);
    shape(
      "#547887",
      [
        [9, 9],
        [20, 8],
        [22, 11],
        [10, 12],
      ],
      false,
    );
    shape(
      "#547887",
      [
        [21, 10],
        [26, 12],
        [24, 17],
        [21, 14],
      ],
      false,
    );
    ellipse("#d4af66", 9, 16, 1, 2);
  } else {
    shape(
      "#864838",
      [
        [8, 10],
        [10, 6],
        [16, 5],
        [21, 8],
        [22, 12],
        [17, 10],
        [14, 8],
        [12, 12],
      ],
      false,
    );
    shape(
      "#cfa770",
      [
        [9, 8],
        [14, 6],
        [20, 8],
        [21, 10],
        [14, 8],
        [9, 10],
      ],
      false,
    );
  }
  // Forearm and equipment are drawn last, never glued to a rectangular torso.
  shape(coat, [
    [20, 19],
    [23, 21],
    [25, 25],
    [22, 27],
    [19, 23],
  ]);
  ellipse(skin, 24, 27, 2, 2.5);
  if (role === 2) {
    shape("#68513c", [
      [24, 25],
      [27, 25],
      [28, 29],
      [26, 30],
    ]);
    shape("#9aa8a5", [
      [24, 24],
      [31, 24],
      [31, 26],
      [24, 26],
    ]);
    rect(ink, 30, 24, 2, 2);
  } else {
    shape("#d6e0d2", [
      [25, 26],
      [26, 21],
      [29, 16],
      [30, 14],
      [30, 19],
      [28, 25],
      [27, 28],
    ]);
    rect("#d5ad62", 23, 27, 6, 1);
    rect("#6f4a36", 25, 28, 2, 3);
  }
  ctx.restore();
}
