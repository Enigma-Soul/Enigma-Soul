/**
 * 双射加密/解密核心算法
 *
 * 提供两种加密方式：
 *   1. 吉尔伯特曲线 (Gilbert Curve)  — 像素级空间填充曲线重映射
 *   2. 块打乱 (Block Shuffle)         — 分块 Fisher-Yates 洗牌重映射
 *
 * 所有函数均为纯函数，不依赖 DOM 或浏览器 API，可在 Node.js / Worker 中使用。
 */

// ─── 工具函数 ───────────────────────────────────────────

/**
 * 简单字符串哈希 (djb2 变体)
 * @param {string} str
 * @returns {number} 正整数
 */
export function simpleHash(str) {
  let h = 0;
  if (!str) return 123456;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * 基于种子的伪随机数生成器 (LCG)
 * @param {number} seed
 * @returns {Function} 每次调用返回 [0, 1) 的浮点数
 */
export function createSeededRNG(seed) {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

/**
 * 反转映射表: inv[map[i]] = i
 * @param {Uint32Array} map
 * @param {number} len
 * @returns {Uint32Array}
 */
export function invertMap(map, len) {
  const inv = new Uint32Array(len);
  for (let i = 0; i < len; i++) inv[map[i]] = i;
  return inv;
}

// ─── 吉尔伯特曲线 ───────────────────────────────────────

/**
 * 递归生成吉尔伯特曲线坐标（内部）
 */
function gilbertGenerate(x, y, ax, ay, bx, by, coords, imgWidth) {
  const w = Math.abs(ax + ay);
  const h = Math.abs(bx + by);
  const dax = Math.sign(ax) || 0, day = Math.sign(ay) || 0;
  const dbx = Math.sign(bx) || 0, dby = Math.sign(by) || 0;

  if (h === 1) {
    for (let i = 0; i < w; i++) {
      coords.push(y * imgWidth + x);
      x += dax;
      y += day;
    }
    return;
  }
  if (w === 1) {
    for (let i = 0; i < h; i++) {
      coords.push(y * imgWidth + x);
      x += dbx;
      y += dby;
    }
    return;
  }

  let ax2 = Math.floor(ax / 2), ay2 = Math.floor(ay / 2);
  let bx2 = Math.floor(bx / 2), by2 = Math.floor(by / 2);

  if (2 * w > 3 * h) {
    if ((Math.abs(ax2 + ay2) % 2) !== 0 && w > 2) { ax2 += dax; ay2 += day; }
    gilbertGenerate(x, y, ax2, ay2, bx, by, coords, imgWidth);
    gilbertGenerate(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by, coords, imgWidth);
  } else {
    if ((Math.abs(bx2 + by2) % 2) !== 0 && h > 2) { bx2 += dbx; by2 += dby; }
    gilbertGenerate(x, y, bx2, by2, ax2, ay2, coords, imgWidth);
    gilbertGenerate(x + bx2, y + by2, ax, ay, bx - bx2, by - by2, coords, imgWidth);
    gilbertGenerate(
      x + (ax - dax) + (bx2 - dbx),
      y + (ay - day) + (by2 - dby),
      -bx2, -by2, -(ax - ax2), -(ay - ay2),
      coords, imgWidth
    );
  }
}

/**
 * 生成吉尔伯特曲线的线性索引序列
 * @param {number} width
 * @param {number} height
 * @returns {Uint32Array} 长度 width*height，每个值是像素线性索引
 */
export function getGilbertIndices(width, height) {
  const coords = [];
  if (width >= height) {
    gilbertGenerate(0, 0, width, 0, 0, height, coords, width);
  } else {
    gilbertGenerate(0, 0, 0, height, width, 0, coords, width);
  }
  return new Uint32Array(coords);
}

/**
 * 计算吉尔伯特曲线偏移量
 * @param {string} key 密钥（可为空）
 * @param {number} totalPixels
 * @returns {number}
 */
export function getGilbertOffset(key, totalPixels) {
  if (!key) {
    return Math.round((Math.sqrt(5) - 1) / 2 * totalPixels);
  }
  const hash = simpleHash(key);
  return hash % totalPixels;
}

/**
 * 构建吉尔伯特曲线加密映射表
 * encMap[dstLinear] = srcLinear
 * @param {number} width
 * @param {number} height
 * @param {string} key
 * @returns {Uint32Array}
 */
export function buildGilbertEncryptMap(width, height, key) {
  const total = width * height;
  const curve = getGilbertIndices(width, height);
  const offset = getGilbertOffset(key, total);

  // 加密：将曲线位置 i 的像素移到 (i+offset)%total
  const encMap = new Uint32Array(total);
  for (let i = 0; i < total; i++) {
    encMap[curve[(i + offset) % total]] = curve[i];
  }
  return encMap;
}

/**
 * 构建吉尔伯特曲线解密映射表
 * decMap[dstLinear] = srcLinear
 * @param {number} width
 * @param {number} height
 * @param {string} key
 * @returns {Uint32Array}
 */
export function buildGilbertDecryptMap(width, height, key) {
  const encMap = buildGilbertEncryptMap(width, height, key);
  return invertMap(encMap, width * height);
}

// ─── 块打乱 ─────────────────────────────────────────────

/**
 * Fisher-Yates 洗牌生成块排列顺序
 * @param {number} numBlocks
 * @param {string} key
 * @returns {number[]} 排列数组
 */
export function generateBlockOrder(numBlocks, key) {
  const seed = simpleHash(key);
  const rng = createSeededRNG(seed);
  const order = Array.from({ length: numBlocks }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * 构建块打乱加密映射表
 * encMap[dstLinear] = srcLinear
 * @param {number} width   图像宽
 * @param {number} height  图像高
 * @param {number} blockW  块宽
 * @param {number} blockH  块高
 * @param {string} key     密钥
 * @returns {Uint32Array}
 */
export function buildBlockEncryptMap(width, height, blockW, blockH, key) {
  const cols = Math.ceil(width / blockW);
  const rows = Math.ceil(height / blockH);
  const totalBlocks = cols * rows;
  const perm = generateBlockOrder(totalBlocks, key);

  const blocks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * blockW, y = r * blockH;
      const w = Math.min(blockW, width - x);
      const h = Math.min(blockH, height - y);
      blocks.push({ x, y, w, h, idx: r * cols + c });
    }
  }

  const encMap = new Uint32Array(width * height);
  for (let dstIdx = 0; dstIdx < width * height; dstIdx++) {
    const dstY = Math.floor(dstIdx / width);
    const dstX = dstIdx % width;
    const dstCol = Math.floor(dstX / blockW);
    const dstRow = Math.floor(dstY / blockH);
    const dstBlockIdx = dstRow * cols + dstCol;
    const srcBlockIdx = perm[dstBlockIdx];
    const srcBlock = blocks[srcBlockIdx];
    const localX = dstX - dstCol * blockW;
    const localY = dstY - dstRow * blockH;
    let srcX = srcBlock.x + localX;
    let srcY = srcBlock.y + localY;
    if (srcX >= width) srcX = width - 1;
    if (srcY >= height) srcY = height - 1;
    encMap[dstIdx] = srcY * width + srcX;
  }
  return encMap;
}

/**
 * 构建块打乱解密映射表
 * @param {number} width
 * @param {number} height
 * @param {number} blockW
 * @param {number} blockH
 * @param {string} key
 * @returns {Uint32Array}
 */
export function buildBlockDecryptMap(width, height, blockW, blockH, key) {
  const encMap = buildBlockEncryptMap(width, height, blockW, blockH, key);
  return invertMap(encMap, width * height);
}

// ─── 统一接口 ───────────────────────────────────────────

/**
 * 构建加密映射表（统一入口）
 * @param {'gilbert'|'block'} method
 * @param {number} width
 * @param {number} height
 * @param {string} key
 * @param {{ blockW?: number, blockH?: number }} [options]
 * @returns {Uint32Array} encMap[dstLinear] = srcLinear
 */
export function buildEncryptMap(method, width, height, key, options = {}) {
  if (method === 'gilbert') {
    return buildGilbertEncryptMap(width, height, key);
  }
  const blockW = options.blockW || 16;
  const blockH = options.blockH || 16;
  return buildBlockEncryptMap(width, height, blockW, blockH, key);
}

/**
 * 构建解密映射表（统一入口）
 * @param {'gilbert'|'block'} method
 * @param {number} width
 * @param {number} height
 * @param {string} key
 * @param {{ blockW?: number, blockH?: number }} [options]
 * @returns {Uint32Array} decMap[dstLinear] = srcLinear
 */
export function buildDecryptMap(method, width, height, key, options = {}) {
  if (method === 'gilbert') {
    return buildGilbertDecryptMap(width, height, key);
  }
  const blockW = options.blockW || 16;
  const blockH = options.blockH || 16;
  return buildBlockDecryptMap(width, height, blockW, blockH, key);
}

/**
 * 将映射表应用到 RGBA 像素数据
 * @param {Uint8ClampedArray} srcData  源像素数据 (RGBA)
 * @param {number} width
 * @param {number} height
 * @param {Uint32Array} map             映射表 map[dst] = src
 * @returns {Uint8ClampedArray}         处理后的像素数据
 */
export function applyMap(srcData, width, height, map) {
  const totalPixels = width * height;
  const newData = new Uint8ClampedArray(srcData.length);
  for (let dstIdx = 0; dstIdx < totalPixels; dstIdx++) {
    const srcIdx = map[dstIdx];
    newData[dstIdx * 4]     = srcData[srcIdx * 4];
    newData[dstIdx * 4 + 1] = srcData[srcIdx * 4 + 1];
    newData[dstIdx * 4 + 2] = srcData[srcIdx * 4 + 2];
    newData[dstIdx * 4 + 3] = srcData[srcIdx * 4 + 3];
  }
  return newData;
}
