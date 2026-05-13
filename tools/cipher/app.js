import { buildEncryptMap, buildDecryptMap, applyMap } from './cipher.js';

// ========== 主题 ==========
const themeToggle = document.getElementById('themeToggle');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
let currentTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}
setTheme(currentTheme);

themeToggle.addEventListener('click', () => {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(currentTheme);
});

// ========== DOM 引用 ==========
const importBtn = document.getElementById('importBtn');
const encryptBtn = document.getElementById('encryptBtn');
const decryptBtn = document.getElementById('decryptBtn');
const exportBtn = document.getElementById('exportBtn');
const fileInfo = document.getElementById('fileInfo');
const previewArea = document.getElementById('previewArea');
const previewEmpty = document.getElementById('previewEmpty');
const previewImg = document.getElementById('previewImg');
const previewCanvas = document.getElementById('previewCanvas');
const navRow = document.getElementById('navRow');
const navCounter = document.getElementById('navCounter');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const restoreBtn = document.getElementById('restoreBtn');
const fileInput = document.getElementById('fileInput');
const hiddenVideo = document.getElementById('hiddenVideo');
const loadingOverlay = document.getElementById('loadingOverlay');
const videoProgressBar = document.getElementById('videoProgressBar');
const videoProgressFill = document.getElementById('videoProgressFill');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// 弹窗
const encryptModal = document.getElementById('encryptModal');
const decryptModal = document.getElementById('decryptModal');
const exportModal = document.getElementById('exportModal');
const encConfirmBtn = document.getElementById('encConfirmBtn');
const decConfirmBtn = document.getElementById('decConfirmBtn');
const exportConfirmBtn = document.getElementById('exportConfirmBtn');

// ========== 状态 ==========
const state = {
  files: [],
  currentIndex: 0,
  processed: [],
  isProcessing: false,
  videoPlaying: false,
  videoFileUrl: null,
  // WebGL2
  gl: null,
  glProgram: null,
  offscreenCanvas: null,
  videoTexture: null,
  uvTexture: null,
  vao: null,
  uniformLoc: {},
  displayCtx: null,
  currentMap: null,
  mapCache: new Map(),
  rafId: null,
};

// ========== 工具函数 ==========
function classifyFile(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return null;
}

function showLoading(show) {
  loadingOverlay.classList.toggle('active', show);
}

function setProgress(ratio) {
  const pct = Math.round(ratio * 100);
  progressBar.value = pct;
  progressText.textContent = pct + '%';
}

function resetProgress() {
  progressBar.value = 0;
  progressText.textContent = '0%';
}

function updateButtons() {
  const hasFiles = state.files.length > 0;
  const hasProcessed = state.processed[state.currentIndex] != null;
  encryptBtn.disabled = !hasFiles || state.isProcessing;
  decryptBtn.disabled = !hasFiles || state.isProcessing;
  exportBtn.disabled = !hasProcessed || state.isProcessing;
  restoreBtn.disabled = !hasProcessed || state.isProcessing;
}

function updateNav() {
  if (state.files.length === 0) {
    navRow.style.display = 'none';
    return;
  }
  navRow.style.display = 'flex';
  navCounter.textContent = `${state.currentIndex + 1} / ${state.files.length}`;
}

function updateFileInfo() {
  if (state.files.length === 0) {
    fileInfo.textContent = '未导入文件';
    return;
  }
  const f = state.files[state.currentIndex];
  const typeTag = f.type === 'video'
    ? '<span class="file-tag">视频</span>'
    : '<span class="file-tag">图片</span>';
  fileInfo.innerHTML = `${typeTag} ${f.file.name}`;
}

function stopVideoPlayback() {
  state.videoPlaying = false;
  hiddenVideo.pause();
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }
}

function showPreview() {
  const f = state.files[state.currentIndex];
  if (!f) return;

  previewEmpty.style.display = 'none';
  stopVideoPlayback();

  const processed = state.processed[state.currentIndex];
  const url = processed ? processed.url : f.originalUrl;

  if (f.type === 'image') {
    previewImg.classList.add('active');
    previewCanvas.classList.remove('active');
    videoProgressBar.style.display = 'none';
    previewImg.src = url;
  } else {
    previewImg.classList.remove('active');
    previewCanvas.classList.add('active');
    videoProgressBar.style.display = 'block';

    if (processed) {
      // 处理后的视频需要通过 WebGL2 实时渲染
      startVideoPlayback();
    } else {
      // 原始视频：直接播放到 canvas
      hiddenVideo.src = f.originalUrl;
      hiddenVideo.load();
      hiddenVideo.onloadedmetadata = () => {
        previewCanvas.width = hiddenVideo.videoWidth;
        previewCanvas.height = hiddenVideo.videoHeight;
        const ctx = previewCanvas.getContext('2d');
        hiddenVideo.play();
        function drawLoop() {
          if (!state.videoPlaying && hiddenVideo.paused) return;
          ctx.drawImage(hiddenVideo, 0, 0);
          state.rafId = requestAnimationFrame(drawLoop);
        }
        state.videoPlaying = true;
        drawLoop();
        hiddenVideo.onended = () => { state.videoPlaying = false; };
      };
    }
  }
}

// ========== 文件导入 ==========
function handleFileImport(fileList) {
  if (state.isProcessing) return;

  stopVideoPlayback();
  // 清理旧 URL
  state.files.forEach(f => URL.revokeObjectURL(f.originalUrl));
  state.processed.forEach(p => { if (p) URL.revokeObjectURL(p.url); });

  const files = Array.from(fileList).filter(f => classifyFile(f));
  if (files.length === 0) return;

  // 如果有视频，只取第一个视频
  const hasVideo = files.some(f => classifyFile(f) === 'video');
  if (hasVideo) {
    const videoFile = files.find(f => classifyFile(f) === 'video');
    state.files = [{
      file: videoFile,
      type: 'video',
      originalUrl: URL.createObjectURL(videoFile),
    }];
  } else {
    state.files = files.map(f => ({
      file: f,
      type: 'image',
      originalUrl: URL.createObjectURL(f),
    }));
  }

  state.currentIndex = 0;
  state.processed = new Array(state.files.length).fill(null);
  state.mapCache.clear();

  if (state.videoFileUrl) URL.revokeObjectURL(state.videoFileUrl);
  if (state.files[0].type === 'video') {
    state.videoFileUrl = state.files[0].originalUrl;
  } else {
    state.videoFileUrl = null;
  }

  updateFileInfo();
  updateNav();
  updateButtons();
  resetProgress();
  showPreview();
}

importBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  if (e.target.files.length) handleFileImport(e.target.files);
  fileInput.value = '';
});

// 拖拽
previewArea.addEventListener('dragover', e => {
  e.preventDefault();
  previewArea.classList.add('drag-over');
});
previewArea.addEventListener('dragleave', () => previewArea.classList.remove('drag-over'));
previewArea.addEventListener('drop', e => {
  e.preventDefault();
  previewArea.classList.remove('drag-over');
  if (e.dataTransfer.files.length) handleFileImport(e.dataTransfer.files);
});

// ========== 导航 ==========
prevBtn.addEventListener('click', () => {
  if (state.files.length <= 1) return;
  stopVideoPlayback();
  state.currentIndex = (state.currentIndex - 1 + state.files.length) % state.files.length;
  updateFileInfo();
  updateNav();
  updateButtons();
  showPreview();
});

nextBtn.addEventListener('click', () => {
  if (state.files.length <= 1) return;
  stopVideoPlayback();
  state.currentIndex = (state.currentIndex + 1) % state.files.length;
  updateFileInfo();
  updateNav();
  updateButtons();
  showPreview();
});

// ========== 还原 ==========
restoreBtn.addEventListener('click', () => {
  const processed = state.processed[state.currentIndex];
  if (!processed) return;
  URL.revokeObjectURL(processed.url);
  state.processed[state.currentIndex] = null;
  updateButtons();
  showPreview();
});

// ========== 弹窗管理 ==========
function openModal(modal) { modal.classList.add('open'); }
function closeModal(modal) { modal.classList.remove('open'); }

// 加密弹窗
encryptBtn.addEventListener('click', () => openModal(encryptModal));
document.querySelectorAll('input[name="encMode"]').forEach(r => {
  r.addEventListener('change', e => {
    const show = e.target.value === 'block';
    document.getElementById('encBlockParams').style.display = show ? 'flex' : 'none';
    document.getElementById('encBlockParamsH').style.display = show ? 'flex' : 'none';
  });
});

// 解密弹窗
decryptBtn.addEventListener('click', () => openModal(decryptModal));
document.querySelectorAll('input[name="decMode"]').forEach(r => {
  r.addEventListener('change', e => {
    const show = e.target.value === 'block';
    document.getElementById('decBlockParams').style.display = show ? 'flex' : 'none';
    document.getElementById('decBlockParamsH').style.display = show ? 'flex' : 'none';
  });
});

// 导出弹窗
exportBtn.addEventListener('click', () => {
  const f = state.files[state.currentIndex];
  const formatRow = document.getElementById('exportFormatRow');
  const videoNote = document.getElementById('exportVideoNote');
  if (f && f.type === 'video') {
    formatRow.style.display = 'none';
    videoNote.style.display = 'block';
  } else {
    formatRow.style.display = 'flex';
    videoNote.style.display = 'none';
  }
  openModal(exportModal);
});

// 取消按钮
document.querySelectorAll('.modal-cancel').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.getAttribute('data-close');
    closeModal(document.getElementById(modalId));
  });
});

// 点击遮罩关闭
[encryptModal, decryptModal, exportModal].forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal(modal);
  });
});

// ========== 图片处理 ==========
async function processSingleImage(fileEntry, index, total, mode, method, key, blockW, blockH) {
  const bitmap = await createImageBitmap(fileEntry.file);
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  const buildFn = mode === 'encrypt' ? buildEncryptMap : buildDecryptMap;
  const options = method === 'block' ? { blockW, blockH } : {};
  const map = buildFn(method, width, height, key, options);
  const resultData = applyMap(imageData.data, width, height, map);

  ctx.putImageData(new ImageData(resultData, width, height), 0, 0);

  const format = document.getElementById('exportFormat').value;
  let mime, quality;
  if (format === 'jpg') { mime = 'image/jpeg'; quality = 0.95; }
  else if (format === 'webp') { mime = 'image/webp'; quality = 1.0; }
  else { mime = 'image/png'; quality = undefined; }

  const blob = await canvas.convertToBlob({ type: mime, quality });
  const url = URL.createObjectURL(blob);

  // 清理旧结果
  if (state.processed[index]) URL.revokeObjectURL(state.processed[index].url);
  state.processed[index] = { blob, url };

  setProgress((index + 1) / total);
}

async function processAllImages(mode, method, key, blockW, blockH) {
  const imageFiles = state.files.filter(f => f.type === 'image');
  if (imageFiles.length === 0) return;

  state.isProcessing = true;
  resetProgress();
  updateButtons();

  try {
    // 找到所有图片的索引
    const indices = [];
    for (let i = 0; i < state.files.length; i++) {
      if (state.files[i].type === 'image') indices.push(i);
    }

    for (let j = 0; j < indices.length; j++) {
      const idx = indices[j];
      await processSingleImage(state.files[idx], idx, indices.length, mode, method, key, blockW, blockH);
    }

    // 显示当前文件的预览
    showPreview();
  } catch (e) {
    console.error(e);
    alert('处理失败：' + e.message);
  } finally {
    state.isProcessing = false;
    updateButtons();
  }
}

// ========== WebGL2 视频处理 ==========
function initWebGL() {
  if (state.gl) return true;

  const oc = document.createElement('canvas');
  const gl = oc.getContext('webgl2', {
    alpha: false, desynchronized: true, antialias: false,
    depth: false, stencil: false, powerPreference: 'high-performance',
  });
  if (!gl) return false;

  state.displayCtx = previewCanvas.getContext('2d');
  if (!state.displayCtx) { state.gl = null; return false; }

  const vsSrc = `#version 300 es
    layout(location = 0) in vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;
  const fsSrc = `#version 300 es
    precision highp float;
    precision highp sampler2D;
    uniform sampler2D uVideoTex;
    uniform sampler2D uUvTex;
    out vec4 outColor;
    void main() {
      ivec2 coord = ivec2(gl_FragCoord.xy);
      vec4 uvData = texelFetch(uUvTex, coord, 0);
      vec2 uv = uvData.rg;
      outColor = texture(uVideoTex, uv);
    }
  `;

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSrc);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(vs)); return false; }

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(fs)); return false; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); return false; }
  gl.useProgram(prog);

  state.uniformLoc.videoSampler = gl.getUniformLocation(prog, 'uVideoTex');
  state.uniformLoc.uvSampler = gl.getUniformLocation(prog, 'uUvTex');

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const videoTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, videoTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_2D, null);

  const uvTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, uvTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.bindTexture(gl.TEXTURE_2D, null);

  state.gl = gl;
  state.glProgram = prog;
  state.offscreenCanvas = oc;
  state.videoTexture = videoTex;
  state.uvTexture = uvTex;
  state.vao = vao;
  return true;
}

function updateUvTexture(map, width, height) {
  const gl = state.gl;
  if (!gl || !state.uvTexture) return;
  const total = width * height;
  const uvData = new Float32Array(total * 4);
  for (let i = 0; i < total; i++) {
    const srcIdx = map[i];
    uvData[i * 4] = (srcIdx % width + 0.5) / width;
    uvData[i * 4 + 1] = (Math.floor(srcIdx / width) + 0.5) / height;
  }
  gl.bindTexture(gl.TEXTURE_2D, state.uvTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, uvData);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

function webglRenderFrame() {
  const gl = state.gl;
  if (!gl || !state.glProgram || !hiddenVideo.videoWidth) return false;

  const vw = hiddenVideo.videoWidth, vh = hiddenVideo.videoHeight;
  if (state.offscreenCanvas.width !== vw || state.offscreenCanvas.height !== vh) {
    state.offscreenCanvas.width = vw;
    state.offscreenCanvas.height = vh;
    previewCanvas.width = vw;
    previewCanvas.height = vh;
    gl.viewport(0, 0, vw, vh);
  }

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.videoTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, hiddenVideo);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.uvTexture);
  gl.useProgram(state.glProgram);
  gl.uniform1i(state.uniformLoc.videoSampler, 0);
  gl.uniform1i(state.uniformLoc.uvSampler, 1);
  gl.bindVertexArray(state.vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);

  // 复制到显示 canvas
  state.displayCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  state.displayCtx.drawImage(state.offscreenCanvas, 0, 0);
  return true;
}

function startVideoPlayback() {
  const f = state.files[state.currentIndex];
  if (!f || f.type !== 'video') return;

  const processed = state.processed[state.currentIndex];
  if (!processed) return;

  hiddenVideo.src = f.originalUrl;
  hiddenVideo.load();

  hiddenVideo.onloadedmetadata = () => {
    const vw = hiddenVideo.videoWidth, vh = hiddenVideo.videoHeight;

    if (!initWebGL()) {
      alert('WebGL2 不可用，无法处理视频');
      return;
    }

    // 生成映射表
    const params = processed.params;
    const buildFn = params.mode === 'encrypt' ? buildEncryptMap : buildDecryptMap;
    const options = params.method === 'block' ? { blockW: params.blockW, blockH: params.blockH } : {};
    const map = buildFn(params.method, vw, vh, params.key, options);
    updateUvTexture(map, vw, vh);

    state.videoPlaying = true;
    hiddenVideo.play();

    function renderLoop() {
      if (!state.videoPlaying || hiddenVideo.paused || hiddenVideo.ended) return;
      webglRenderFrame();
      if (hiddenVideo.duration) {
        videoProgressFill.style.width = (hiddenVideo.currentTime / hiddenVideo.duration * 100) + '%';
      }
      state.rafId = requestAnimationFrame(renderLoop);
    }
    renderLoop();
    hiddenVideo.onended = () => { state.videoPlaying = false; };
  };
}

async function processVideo(mode, method, key, blockW, blockH) {
  const f = state.files[state.currentIndex];
  if (!f || f.type !== 'video') return;

  state.isProcessing = true;
  showLoading(true);
  updateButtons();

  try {
    // 存储 processed 结果（params + 标记）
    if (state.processed[state.currentIndex]) {
      URL.revokeObjectURL(state.processed[state.currentIndex].url);
    }
    // 创建占位结果，包含参数信息供 startVideoPlayback 使用
    state.processed[state.currentIndex] = {
      blob: null,
      url: f.originalUrl, // 视频使用原始 URL，WebGL2 实时渲染
      params: { mode, method, key, blockW, blockH },
    };

    showPreview();
  } catch (e) {
    console.error(e);
    alert('处理失败：' + e.message);
  } finally {
    state.isProcessing = false;
    showLoading(false);
    updateButtons();
  }
}

// ========== 确认按钮 ==========
encConfirmBtn.addEventListener('click', () => {
  closeModal(encryptModal);
  const method = document.querySelector('input[name="encMode"]:checked').value;
  const key = document.getElementById('encKeyInput').value;
  const blockW = parseInt(document.getElementById('encBlockW').value, 10) || 16;
  const blockH = parseInt(document.getElementById('encBlockH').value, 10) || 16;
  const hasVideo = state.files.some(f => f.type === 'video');
  if (hasVideo) {
    processVideo('encrypt', method, key, blockW, blockH);
  } else {
    processAllImages('encrypt', method, key, blockW, blockH);
  }
});

decConfirmBtn.addEventListener('click', () => {
  closeModal(decryptModal);
  const method = document.querySelector('input[name="decMode"]:checked').value;
  const key = document.getElementById('decKeyInput').value;
  const blockW = parseInt(document.getElementById('decBlockW').value, 10) || 16;
  const blockH = parseInt(document.getElementById('decBlockH').value, 10) || 16;
  const hasVideo = state.files.some(f => f.type === 'video');
  if (hasVideo) {
    processVideo('decrypt', method, key, blockW, blockH);
  } else {
    processAllImages('decrypt', method, key, blockW, blockH);
  }
});

// ========== 导出 ==========
exportConfirmBtn.addEventListener('click', async () => {
  closeModal(exportModal);
  const processed = state.processed[state.currentIndex];
  const f = state.files[state.currentIndex];
  if (!processed) return;

  if (f.type === 'video') {
    await exportVideo();
  } else if (processed.blob) {
    downloadBlob(processed.blob, getExportName(f.file.name));
  }
});

function getExportName(originalName) {
  const format = document.getElementById('exportFormat').value;
  const ext = format === 'jpg' ? 'jpg' : format;
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  return `${baseName}_processed.${ext}`;
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function exportVideo() {
  const f = state.files[state.currentIndex];
  if (!f || f.type !== 'video') return;

  const params = state.processed[state.currentIndex]?.params;
  if (!params) return;

  state.isProcessing = true;
  showLoading(true);
  updateButtons();

  try {
    // 设置视频
    const video = document.createElement('video');
    video.src = f.originalUrl;
    video.preload = 'auto';
    video.playsInline = true;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
    });

    const vw = video.videoWidth, vh = video.videoHeight;

    // 初始化 WebGL2
    if (!initWebGL()) {
      alert('WebGL2 不可用');
      return;
    }

    // 生成映射
    const buildFn = params.mode === 'encrypt' ? buildEncryptMap : buildDecryptMap;
    const options = params.method === 'block' ? { blockW: params.blockW, blockH: params.blockH } : {};
    const map = buildFn(params.method, vw, vh, params.key, options);
    updateUvTexture(map, vw, vh);

    // 录制
    const stream = previewCanvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    });

    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    const done = new Promise(resolve => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };
    });

    recorder.start();
    video.currentTime = 0;
    await video.play();

    function renderLoop() {
      if (video.paused || video.ended) return;
      webglRenderFrameWithVideo(video);
      state.rafId = requestAnimationFrame(renderLoop);
    }
    renderLoop();

    video.onended = () => {
      setTimeout(() => recorder.stop(), 100);
    };

    const blob = await done;
    const baseName = f.file.name.replace(/\.[^/.]+$/, '');
    downloadBlob(blob, `${baseName}_processed.webm`);
  } catch (e) {
    console.error(e);
    alert('视频导出失败：' + e.message);
  } finally {
    state.isProcessing = false;
    showLoading(false);
    updateButtons();
  }
}

function webglRenderFrameWithVideo(video) {
  const gl = state.gl;
  if (!gl || !state.glProgram || !video.videoWidth) return;

  const vw = video.videoWidth, vh = video.videoHeight;
  if (state.offscreenCanvas.width !== vw || state.offscreenCanvas.height !== vh) {
    state.offscreenCanvas.width = vw;
    state.offscreenCanvas.height = vh;
    previewCanvas.width = vw;
    previewCanvas.height = vh;
    gl.viewport(0, 0, vw, vh);
  }

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.videoTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, state.uvTexture);
  gl.useProgram(state.glProgram);
  gl.uniform1i(state.uniformLoc.videoSampler, 0);
  gl.uniform1i(state.uniformLoc.uvSampler, 1);
  gl.bindVertexArray(state.vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);

  state.displayCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  state.displayCtx.drawImage(state.offscreenCanvas, 0, 0);
}

// ========== 视频进度条拖动 ==========
videoProgressBar.addEventListener('click', e => {
  if (!hiddenVideo.duration) return;
  const rect = videoProgressBar.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  hiddenVideo.currentTime = ratio * hiddenVideo.duration;
});

// ========== 清理 ==========
window.addEventListener('beforeunload', () => {
  stopVideoPlayback();
  state.files.forEach(f => URL.revokeObjectURL(f.originalUrl));
  state.processed.forEach(p => { if (p) URL.revokeObjectURL(p.url); });
  if (state.videoFileUrl) URL.revokeObjectURL(state.videoFileUrl);
});
