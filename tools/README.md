# Tools

浏览器端工具集，通过 GitHub Pages 部署。

## cipher/

图片和视频加密解密工具。

### 功能

- 导入图片（支持多张）或视频（单段）
- 吉尔伯特曲线 / 块打乱两种加密方式
- 可选密钥
- 图片实时处理，视频 WebGL2 GPU 加速实时预览
- 导出图片（JPG/PNG/WebP）或视频（WebM）
- 深色/浅色主题，响应式移动端适配
- 全部本地处理，不上传服务器

### 文件结构

```
cipher/
  index.html    HTML 骨架
  style.css     样式（CSS 变量主题、响应式）
  app.js        UI 逻辑（ES module）
  cipher.js     纯算法库（ES module）
```

### UI 规范

- **主题**：`<html data-theme="dark|light">`，CSS 自定义属性，localStorage 持久化
- **响应式**：`750px` 桌面端分界，`400px` 小屏适配
- **按钮**：4 个主操作按钮（导入/加密/解密/导出），弹窗内确定/取消
- **预览**：图片用 `<img>`，视频用 `<canvas>` + WebGL2
- **无外部依赖**：不使用 JSZip/FileSaver 等库

### cipher.js API

```js
import {
  buildEncryptMap,
  buildDecryptMap,
  applyMap,
} from './cipher.js';

// 加密映射：method 为 'gilbert' 或 'block'
const encMap = buildEncryptMap('gilbert', width, height, '密钥');

// 块打乱需要额外参数
const encMap2 = buildEncryptMap('block', width, height, '密钥', {
  blockW: 16,
  blockH: 16,
});

// 解密映射
const decMap = buildDecryptMap('gilbert', width, height, '密钥');

// 应用映射到 RGBA 像素数据
const resultData = applyMap(sourceImageData, width, height, encMap);
```

#### 导出函数

| 函数 | 说明 |
|------|------|
| `simpleHash(str)` | djb2 字符串哈希 |
| `createSeededRNG(seed)` | LCG 伪随机数生成器 |
| `invertMap(map, len)` | 反转映射表 |
| `getGilbertIndices(w, h)` | 吉尔伯特曲线索引 |
| `getGilbertOffset(key, total)` | 曲线偏移量 |
| `buildGilbertEncryptMap(w, h, key)` | 吉尔伯特加密映射 |
| `buildGilbertDecryptMap(w, h, key)` | 吉尔伯特解密映射 |
| `buildBlockEncryptMap(w, h, bw, bh, key)` | 块打乱加密映射 |
| `buildBlockDecryptMap(w, h, bw, bh, key)` | 块打乱解密映射 |
| `buildEncryptMap(method, w, h, key, opts)` | 统一加密接口 |
| `buildDecryptMap(method, w, h, key, opts)` | 统一解密接口 |
| `applyMap(data, w, h, map)` | 应用映射到像素数据 |
