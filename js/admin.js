// 管理后台逻辑

// ============================================================
// 登录验证模块
// ============================================================

/**
 * 检查登录状态
 * 已登录：隐藏登录页面，显示管理后台内容
 * 未登录：显示登录页面，隐藏管理后台内容
 * @returns {boolean} 是否已登录
 */
function checkAuth() {
  const loginPage = document.getElementById('login-page');
  const adminContent = document.getElementById('admin-content');
  const isAuthenticated = localStorage.getItem('admin_authenticated') === 'true';

  if (isAuthenticated) {
    loginPage.style.display = 'none';
    adminContent.classList.remove('hidden');
    return true;
  } else {
    loginPage.style.display = '';
    adminContent.classList.add('hidden');
    return false;
  }
}

/**
 * 登录验证
 * @param {string} password 用户输入的密码
 */
function login(password) {
  const loginError = document.getElementById('login-error');

  if (password === CONFIG.ADMIN_PASSWORD) {
    localStorage.setItem('admin_authenticated', 'true');
    loginError.textContent = '';
    loginError.classList.remove('visible');
    checkAuth();
    loadProductList('all');
    loadOrderList();
    loadBrowseLogList();
    loadLotteryAdminList();
  } else {
    loginError.textContent = '密码错误';
    loginError.classList.add('visible');
  }
}

// ============================================================
// 事件监听
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  // 检查登录状态
  var isLoggedIn = checkAuth();

  // 登录按钮点击事件
  document.getElementById('login-btn').addEventListener('click', function () {
    const password = document.getElementById('login-password').value;
    login(password);
  });

  // 密码输入框回车事件
  document.getElementById('login-password').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      login(this.value);
    }
  });

  // 图片选择与处理事件监听
  document.getElementById('upload-area').addEventListener('click', function () {
    document.getElementById('image-input').click();
  });

  document.getElementById('image-input').addEventListener('change', function () {
    if (this.files && this.files.length > 0) {
      handleImageFilesSelect(this.files);
    }
    this.value = '';
  });

  var maxCountEl = document.getElementById('image-max-count');
  if (maxCountEl && CONFIG.MAX_PRODUCT_IMAGES) {
    maxCountEl.textContent = CONFIG.MAX_PRODUCT_IMAGES;
  }

  // 表单提交事件监听
  document.getElementById('submit-btn').addEventListener('click', function () {
    addProduct();
  });

  // 筛选标签点击事件监听
  var filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      filterTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      loadProductList(tab.getAttribute('data-filter'));
    });
  });

  initQuickUploadTable();

  // 登录成功后加载商品列表和购买记录
  if (isLoggedIn) {
    loadProductList('all');
    loadOrderList();
    loadBrowseLogList();
    loadLotteryAdminList();
  }

});

// ============================================================
// 图片处理模块（任务 6.1）
// ============================================================

// 待上传的新图片文件
var selectedImageFiles = [];
// 编辑模式下已有的 Storage 路径
var currentEditImagePaths = [];

function getTotalImageCount() {
  return currentEditImagePaths.length + selectedImageFiles.length;
}

function renderImagePreviewList() {
  var listEl = document.getElementById('image-preview-list');
  if (!listEl) return;

  var html = '';
  var i;

  for (i = 0; i < currentEditImagePaths.length; i++) {
    html += '<div class="image-preview-item">' +
      '<img src="' + getImageUrl(currentEditImagePaths[i]) + '" alt="">' +
      (i === 0 ? '<span class="preview-cover-tag">封面</span>' : '') +
      '<button type="button" class="preview-remove" onclick="removeExistingImage(' + i + ')" title="移除">&times;</button>' +
      '</div>';
  }

  for (i = 0; i < selectedImageFiles.length; i++) {
    var coverIdx = currentEditImagePaths.length + i;
    html += '<div class="image-preview-item">' +
      '<img src="' + URL.createObjectURL(selectedImageFiles[i]) + '" alt="">' +
      (coverIdx === 0 ? '<span class="preview-cover-tag">封面</span>' : '') +
      '<button type="button" class="preview-remove" onclick="removeNewImage(' + i + ')" title="移除">&times;</button>' +
      '</div>';
  }

  listEl.innerHTML = html;
}

function removeExistingImage(index) {
  currentEditImagePaths.splice(index, 1);
  renderImagePreviewList();
}

function removeNewImage(index) {
  selectedImageFiles.splice(index, 1);
  renderImagePreviewList();
}

/**
 * 处理多图选择
 */
function handleImageFilesSelect(fileList) {
  var imageError = document.getElementById('image-error');
  var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  var max = CONFIG.MAX_PRODUCT_IMAGES || 9;
  var added = 0;

  imageError.textContent = '';
  imageError.classList.remove('visible');

  for (var i = 0; i < fileList.length; i++) {
    if (getTotalImageCount() >= max) {
      imageError.textContent = '最多上传 ' + max + ' 张图片';
      imageError.classList.add('visible');
      break;
    }
    var file = fileList[i];
    if (!allowedTypes.includes(file.type)) {
      imageError.textContent = '仅支持 JPG、PNG、WebP 格式';
      imageError.classList.add('visible');
      continue;
    }
    selectedImageFiles.push(file);
    added++;
  }

  if (added > 0) {
    renderImagePreviewList();
  }
}

/**
 * 上传多个文件到 Storage，返回路径数组
 */
async function uploadImageFiles(files) {
  var paths = [];
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var blob = await compressImage(file);
    var ext = file.name.split('.').pop();
    var filename = Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.' + ext;
    var uploadResult = await supabaseClient.storage
      .from(CONFIG.STORAGE_BUCKET)
      .upload(filename, blob);
    if (uploadResult.error) {
      throw new Error('upload_failed');
    }
    paths.push(filename);
  }
  return paths;
}

/**
 * 使用 Canvas API 压缩图片至 5MB 以内
 * @param {File} file 原始图片文件
 * @returns {Promise<Blob>} 压缩后的图片 Blob（或原文件）
 */
function compressImage(file) {
  // 不超过限制则直接返回原文件
  if (file.size <= CONFIG.MAX_IMAGE_SIZE) {
    return Promise.resolve(file);
  }

  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        var quality = 0.8;
        var minQuality = 0.1;

        function tryCompress() {
          canvas.toBlob(
            function (blob) {
              if (blob.size <= CONFIG.MAX_IMAGE_SIZE || quality <= minQuality) {
                resolve(blob);
              } else {
                quality -= 0.1;
                if (quality < minQuality) quality = minQuality;
                tryCompress();
              }
            },
            'image/jpeg',
            quality
          );
        }

        tryCompress();
      };
      img.onerror = function () {
        reject(new Error('图片加载失败'));
      };
      img.src = e.target.result;
    };
    reader.onerror = function () {
      reject(new Error('文件读取失败'));
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================
// 表单验证与商品提交模块（任务 6.2）
// ============================================================

/**
 * 清除所有表单字段的错误提示
 */
function clearFieldErrors() {
  var errorSpans = document.querySelectorAll('.field-error');
  for (var i = 0; i < errorSpans.length; i++) {
    errorSpans[i].textContent = '';
    errorSpans[i].classList.remove('visible');
  }
  var errorInputs = document.querySelectorAll('.input-error');
  for (var i = 0; i < errorInputs.length; i++) {
    errorInputs[i].classList.remove('input-error');
  }
}

/**
 * 校验必填字段（图片、名称、价格）
 * @returns {boolean} 是否通过验证
 */
function validateForm() {
  clearFieldErrors();

  var isValid = true;
  var editId = document.getElementById('edit-id').value;

  // 校验图片（至少一张）
  if (getTotalImageCount() === 0) {
    var imageError = document.getElementById('image-error');
    imageError.textContent = '请至少上传一张商品图片';
    imageError.classList.add('visible');
    isValid = false;
  }

  // 校验商品名称
  var nameInput = document.getElementById('product-name');
  if (!nameInput.value.trim()) {
    nameInput.classList.add('input-error');
    var nameError = nameInput.parentElement.querySelector('.field-error');
    nameError.textContent = '此项为必填';
    nameError.classList.add('visible');
    isValid = false;
  }

  // 校验价格
  var priceInput = document.getElementById('product-price');
  if (!priceInput.value) {
    priceInput.classList.add('input-error');
    var priceError = priceInput.parentElement.querySelector('.field-error');
    priceError.textContent = '此项为必填';
    priceError.classList.add('visible');
    isValid = false;
  }

  // 校验排序序号（可选填；填了必须是正整数）
  var sortOrderInput = document.getElementById('product-sort-order');
  var sortOrderValue = sortOrderInput.value.trim();
  if (sortOrderValue) {
    var sortOrder = parseInt(sortOrderValue, 10);
    if (!/^\d+$/.test(sortOrderValue) || isNaN(sortOrder) || sortOrder <= 0) {
      sortOrderInput.classList.add('input-error');
      var sortOrderError = sortOrderInput.parentElement.querySelector('.field-error');
      sortOrderError.textContent = '请输入大于 0 的整数';
      sortOrderError.classList.add('visible');
      isValid = false;
    }
  }

  return isValid;
}

/**
 * 重置表单到初始状态
 */
function resetForm() {
  // 清空所有输入值
  document.getElementById('product-name').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-original-price').value = '';
  document.getElementById('product-sku').value = '';
  document.getElementById('product-quantity').value = '';
  document.getElementById('product-sort-order').value = '';
  document.getElementById('product-product-sku').value = '';
  document.getElementById('product-remark').value = '';
  var inStockInput = document.getElementById('product-in-stock');
  if (inStockInput) inStockInput.checked = false;

  selectedImageFiles = [];
  currentEditImagePaths = [];
  renderImagePreviewList();
  document.getElementById('image-input').value = '';

  // 清除编辑 ID
  document.getElementById('edit-id').value = '';

  // 重置提交按钮文本
  document.getElementById('submit-btn').textContent = '添加商品';

  // 清除所有字段错误
  clearFieldErrors();
}

/**
 * 上传图片并插入商品记录到 Supabase
 */
async function addProduct() {
  var formMessage = document.getElementById('form-message');
  var submitBtn = document.getElementById('submit-btn');

  // 清除之前的提示信息
  formMessage.textContent = '';
  formMessage.className = 'message';

  // 编辑模式检查
  var editId = document.getElementById('edit-id').value;
  if (editId) {
    // 编辑功能占位（任务 8.2 实现）
    if (typeof editProduct === 'function') {
      editProduct();
    } else {
      formMessage.textContent = '编辑功能即将实现';
      formMessage.classList.add('message-error');
    }
    return;
  }

  // 表单验证
  if (!validateForm()) {
    formMessage.textContent = '请检查表单中标红的项（排序序号须为正整数，或留空表示默认 9999）';
    formMessage.classList.add('message-error');
    formMessage.classList.add('visible');
    return;
  }

  // 获取表单值
  var name = document.getElementById('product-name').value.trim();
  var price = parseFloat(document.getElementById('product-price').value);
  var originalPrice = parseOptionalPrice(document.getElementById('product-original-price').value);
  var sku = document.getElementById('product-sku').value.trim();
  var quantity = document.getElementById('product-quantity').value ? parseInt(document.getElementById('product-quantity').value) : 0;
  var sortOrderInput = document.getElementById('product-sort-order').value.trim();
  var sortOrder = sortOrderInput !== '' ? parseInt(sortOrderInput, 10) : 9999;
  var productSku = document.getElementById('product-product-sku').value.trim();
  var remark = document.getElementById('product-remark').value.trim();
  var inStock = document.getElementById('product-in-stock').checked;

  // 禁用提交按钮
  submitBtn.disabled = true;

  try {
    var imagePaths = await uploadImageFiles(selectedImageFiles);

    // 插入商品记录到 Supabase Database
    var insertResult = await supabaseClient
      .from('products')
      .insert({
        name: name,
        price: price,
        original_price: originalPrice,
        sku: sku,
        quantity: quantity,
        product_sku: productSku,
        remark: remark,
        image_url: imagePaths[0],
        image_urls: imagePaths,
        status: 'active',
        sort_order: sortOrder,
        in_stock: inStock
      });

    if (insertResult.error) {
      formMessage.textContent = '提交失败，请重试';
      formMessage.classList.add('message-error');
      submitBtn.disabled = false;
      return;
    }

    // 提交成功
    formMessage.textContent = '提交成功';
    formMessage.classList.add('message-success');
    resetForm();
    loadProductList(currentFilter);

  } catch (err) {
    formMessage.textContent = '提交失败，请重试';
    formMessage.classList.add('message-error');
  }

  // 重新启用提交按钮
  submitBtn.disabled = false;
}

// ============================================================
// 快速上架模块
// ============================================================

var QUICK_UPLOAD_FIELDS = [
  'name', 'price', 'original_price', 'sku', 'quantity', 'sort_order', 'product_sku', 'remark', 'in_stock', 'image_urls'
];

var QUICK_UPLOAD_HEADER_ALIASES = {
  name: ['商品名称', '名称', 'name'],
  price: ['内购价', '价格', '价格(元)', 'price'],
  original_price: ['原价', '参考价', 'original_price'],
  sku: ['货号'],
  quantity: ['数量', '库存', 'quantity'],
  sort_order: ['排序', '排序序号', 'sort'],
  product_sku: ['sku', 'product_sku'],
  remark: ['说明', '备注', 'remark'],
  in_stock: ['现货', 'in_stock'],
  image_urls: ['图片链接', '图片', 'image', 'image_urls']
};

function initQuickUploadTable() {
  var tbody = document.getElementById('quick-upload-tbody');
  if (!tbody || tbody.children.length > 0) return;
  addQuickUploadRows(5);
}

function buildQuickUploadRowHtml(values) {
  values = values || {};
  return '<tr>' +
    '<td><input type="text" class="quick-cell" data-field="name" value="' + escapeQuickAttr(values.name) + '"></td>' +
    '<td><input type="text" class="quick-cell" data-field="price" value="' + escapeQuickAttr(values.price) + '"></td>' +
    '<td><input type="text" class="quick-cell" data-field="original_price" value="' + escapeQuickAttr(values.original_price) + '"></td>' +
    '<td><input type="text" class="quick-cell" data-field="sku" value="' + escapeQuickAttr(values.sku) + '"></td>' +
    '<td><input type="text" class="quick-cell" data-field="quantity" value="' + escapeQuickAttr(values.quantity) + '"></td>' +
    '<td><input type="text" class="quick-cell" data-field="sort_order" value="' + escapeQuickAttr(values.sort_order) + '"></td>' +
    '<td><input type="text" class="quick-cell" data-field="product_sku" value="' + escapeQuickAttr(values.product_sku) + '"></td>' +
    '<td><input type="text" class="quick-cell" data-field="remark" value="' + escapeQuickAttr(values.remark) + '"></td>' +
    '<td><input type="text" class="quick-cell quick-cell-narrow" data-field="in_stock" value="' + escapeQuickAttr(values.in_stock) + '" placeholder="否"></td>' +
    '<td><input type="text" class="quick-cell" data-field="image_urls" value="' + escapeQuickAttr(values.image_urls) + '"></td>' +
    '</tr>';
}

function escapeQuickAttr(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function addQuickUploadRows(count) {
  var tbody = document.getElementById('quick-upload-tbody');
  if (!tbody) return;
  var html = '';
  for (var i = 0; i < count; i++) {
    html += buildQuickUploadRowHtml();
  }
  tbody.insertAdjacentHTML('beforeend', html);
}

function clearQuickUploadTable() {
  var tbody = document.getElementById('quick-upload-tbody');
  var paste = document.getElementById('quick-upload-paste');
  if (tbody) tbody.innerHTML = '';
  if (paste) paste.value = '';
  clearQuickUploadMessage();
  addQuickUploadRows(5);
}

function clearQuickUploadMessage() {
  var msg = document.getElementById('quick-upload-message');
  if (!msg) return;
  msg.textContent = '';
  msg.className = 'message';
}

function showQuickUploadMessage(text, type) {
  var msg = document.getElementById('quick-upload-message');
  if (!msg) return;
  msg.textContent = text;
  msg.className = 'message visible ' + (type === 'error' ? 'message-error' : 'message-success');
}

function normalizeQuickHeader(cell) {
  return String(cell || '').trim().toLowerCase().replace(/\s+/g, '');
}

function detectQuickUploadColumnMap(cells) {
  var map = {};
  var normalized = cells.map(normalizeQuickHeader);
  QUICK_UPLOAD_FIELDS.forEach(function (field) {
    var aliases = QUICK_UPLOAD_HEADER_ALIASES[field] || [field];
    for (var i = 0; i < normalized.length; i++) {
      for (var j = 0; j < aliases.length; j++) {
        if (normalized[i] === normalizeQuickHeader(aliases[j])) {
          map[field] = i;
          break;
        }
      }
      if (map[field] !== undefined) break;
    }
  });
  var matched = Object.keys(map).length;
  return matched >= 2 ? map : null;
}

function parseQuickUploadText(text) {
  var lines = String(text || '').trim().split(/\r?\n/).filter(function (line) {
    return line.trim() !== '';
  });
  if (lines.length === 0) return [];

  var rows = [];
  var columnMap = null;
  var startIndex = 0;

  var firstCells = splitQuickUploadLine(lines[0]);
  var detectedMap = detectQuickUploadColumnMap(firstCells);
  if (detectedMap) {
    columnMap = detectedMap;
    startIndex = 1;
  }

  for (var i = startIndex; i < lines.length; i++) {
    var cells = splitQuickUploadLine(lines[i]);
    if (cells.length === 0) continue;
    rows.push(mapQuickUploadCells(cells, columnMap));
  }
  return rows;
}

function splitQuickUploadLine(line) {
  if (line.indexOf('\t') >= 0) {
    return line.split('\t').map(function (c) { return c.trim(); });
  }
  return line.split(',').map(function (c) { return c.trim(); });
}

function mapQuickUploadCells(cells, columnMap) {
  var row = {};
  if (columnMap) {
    QUICK_UPLOAD_FIELDS.forEach(function (field) {
      if (columnMap[field] !== undefined && cells[columnMap[field]] !== undefined) {
        row[field] = cells[columnMap[field]];
      }
    });
    return row;
  }
  QUICK_UPLOAD_FIELDS.forEach(function (field, index) {
    if (cells[index] !== undefined) {
      row[field] = cells[index];
    }
  });
  return row;
}

function fillQuickUploadFromPaste() {
  var paste = document.getElementById('quick-upload-paste');
  var tbody = document.getElementById('quick-upload-tbody');
  if (!paste || !tbody) return;

  var rows = parseQuickUploadText(paste.value);
  if (rows.length === 0) {
    showQuickUploadMessage('没有可解析的内容，请粘贴 Excel 表格数据', 'error');
    return;
  }

  tbody.innerHTML = rows.map(function (row) {
    return buildQuickUploadRowHtml(row);
  }).join('');

  showQuickUploadMessage('已填入 ' + rows.length + ' 行，请核对后点击「批量上架」', 'success');
}

function collectQuickUploadRows() {
  var tbody = document.getElementById('quick-upload-tbody');
  if (!tbody) return [];
  var result = [];
  var trs = tbody.querySelectorAll('tr');
  trs.forEach(function (tr, index) {
    var row = { _rowNum: index + 1 };
    var inputs = tr.querySelectorAll('.quick-cell');
    inputs.forEach(function (input) {
      row[input.getAttribute('data-field')] = input.value.trim();
    });
    result.push(row);
  });
  return result;
}

function parseQuickPrice(value) {
  if (!value) return NaN;
  var cleaned = String(value).replace(/[¥￥,\s]/g, '');
  return parseFloat(cleaned);
}

function parseQuickInt(value, defaultValue) {
  if (value == null || value === '') return defaultValue;
  var num = parseInt(String(value).trim(), 10);
  return isNaN(num) ? defaultValue : num;
}

function parseQuickInStock(value) {
  if (!value) return false;
  var v = String(value).trim().toLowerCase();
  return v === '是' || v === '1' || v === 'yes' || v === 'y' || v === 'true' || v === '现货';
}

function parseQuickImageUrls(value) {
  if (!value) return [];
  return String(value)
    .split(/[;|]/)
    .map(function (part) { return part.trim(); })
    .filter(function (part) { return part !== ''; })
    .slice(0, CONFIG.MAX_PRODUCT_IMAGES || 9);
}

function validateQuickUploadRow(row) {
  if (!row.name && !row.price) {
    return { skip: true };
  }
  if (!row.name) {
    return { skip: false, error: '第 ' + row._rowNum + ' 行：商品名称不能为空' };
  }
  var price = parseQuickPrice(row.price);
  if (isNaN(price) || price < 0) {
    return { skip: false, error: '第 ' + row._rowNum + ' 行：价格无效' };
  }
  var sortOrderRaw = row.sort_order;
  if (sortOrderRaw) {
    var sortOrder = parseInt(sortOrderRaw, 10);
    if (!/^\d+$/.test(sortOrderRaw) || isNaN(sortOrder) || sortOrder <= 0) {
      return { skip: false, error: '第 ' + row._rowNum + ' 行：排序须为正整数或留空' };
    }
  }
  return { skip: false, ok: true, price: price };
}

function parseOptionalPrice(value) {
  if (value == null || String(value).trim() === '') return null;
  var num = parseFloat(String(value).replace(/[¥￥,\s]/g, ''));
  return isNaN(num) || num < 0 ? null : num;
}

async function insertQuickUploadProduct(row, price) {
  var imagePaths = parseQuickImageUrls(row.image_urls);
  var payload = {
    name: row.name,
    price: price,
    original_price: parseOptionalPrice(row.original_price),
    sku: row.sku || '',
    quantity: parseQuickInt(row.quantity, 0),
    product_sku: row.product_sku || '',
    remark: row.remark || '',
    image_url: imagePaths[0] || '',
    image_urls: imagePaths,
    status: 'active',
    sort_order: row.sort_order ? parseInt(row.sort_order, 10) : 9999,
    in_stock: parseQuickInStock(row.in_stock)
  };

  var result = await supabaseClient.from('products').insert(payload);
  if (result.error) {
    throw new Error(result.error.message || 'insert_failed');
  }
}

async function submitQuickUpload() {
  var btn = document.getElementById('quick-upload-submit-btn');
  var rows = collectQuickUploadRows();
  clearQuickUploadMessage();

  var pending = [];
  var errors = [];

  rows.forEach(function (row) {
    var check = validateQuickUploadRow(row);
    if (check.skip) return;
    if (check.error) {
      errors.push(check.error);
      return;
    }
    pending.push({ row: row, price: check.price });
  });

  if (errors.length > 0) {
    showQuickUploadMessage(errors.slice(0, 5).join('；') + (errors.length > 5 ? '…' : ''), 'error');
    return;
  }

  if (pending.length === 0) {
    showQuickUploadMessage('请至少填写一行商品名称和价格', 'error');
    return;
  }

  btn.disabled = true;
  var success = 0;
  var failMessages = [];

  try {
    for (var i = 0; i < pending.length; i++) {
      btn.textContent = '上架中 ' + (i + 1) + '/' + pending.length + '…';
      try {
        await insertQuickUploadProduct(pending[i].row, pending[i].price);
        success++;
      } catch (err) {
        failMessages.push('第 ' + pending[i].row._rowNum + ' 行上架失败');
      }
    }

    loadProductList(currentFilter);

    if (success === pending.length) {
      showQuickUploadMessage('成功上架 ' + success + ' 件商品', 'success');
      clearQuickUploadTable();
    } else if (success > 0) {
      showQuickUploadMessage('成功 ' + success + ' 件，失败 ' + failMessages.length + ' 件：' + failMessages.join('；'), 'error');
    } else {
      showQuickUploadMessage('上架失败，请重试', 'error');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '批量上架';
  }
}

// ============================================================
// 商品列表与管理模块（任务 8.1 - 8.4）
// ============================================================

// 当前筛选条件（默认 'all'）
var currentFilter = 'all';
// 当前商品列表（用于上移/下移交换排序值）
var currentProductList = [];
var productSortField = 'sort_order';
var productSortAsc = true;


/**
 * 根据图片路径生成 Supabase Storage 公开访问 URL（admin 页面本地版本）
 * @param {string} imagePath - 图片在 Storage 中的路径
 * @returns {string} 完整的公开访问 URL
 */
function getImageUrl(imagePath) {
  if (!imagePath) return '';
  if (/^https?:\/\//i.test(String(imagePath))) {
    return String(imagePath);
  }
  if (CONFIG.DEMO_MODE) {
    try {
      var images = JSON.parse(localStorage.getItem('demo_images') || '{}');
      return images[imagePath] || '';
    } catch (e) {
      return '';
    }
  }
  return CONFIG.SUPABASE_URL + '/storage/v1/object/public/' + CONFIG.STORAGE_BUCKET + '/' + imagePath;
}

function sortProductList(products) {
  var field = productSortField;
  var asc = productSortAsc;
  products.sort(function (a, b) {
    var va;
    var vb;
    if (field === 'price' || field === 'quantity' || field === 'original_price') {
      va = Number(a[field]) || 0;
      vb = Number(b[field]) || 0;
    } else if (field === 'sort_order') {
      va = a.sort_order == null ? 9999 : Number(a.sort_order);
      vb = b.sort_order == null ? 9999 : Number(b.sort_order);
    } else if (field === 'in_stock') {
      va = isProductInStock(a) ? 1 : 0;
      vb = isProductInStock(b) ? 1 : 0;
    } else if (field === 'status') {
      va = a.status === 'active' ? 0 : 1;
      vb = b.status === 'active' ? 0 : 1;
    } else {
      va = (a[field] == null ? '' : String(a[field])).toLowerCase();
      vb = (b[field] == null ? '' : String(b[field])).toLowerCase();
    }
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
}

function renderProductTableBody(products) {
  var tbody = document.getElementById('product-tbody');
  if (!tbody) return;

  tbody.innerHTML = products.map(function (product) {
    var imageUrl = getImageUrl(getProductCoverPath(product));
    var imageCount = getProductImagePaths(product).length;
    var imageCountLabel = imageCount > 1 ? ' <small>(' + imageCount + '张)</small>' : '';
    var price = '¥' + Number(product.price).toFixed(2);
    var originalPrice = product.original_price != null && product.original_price !== ''
      ? '¥' + Number(product.original_price).toFixed(2)
      : '-';
    var qty = product.quantity != null ? product.quantity : 0;
    var sku = product.sku || '-';
    var productSku = product.product_sku || '-';
    var statusText = product.status === 'active' ? '在售' : '已下架';
    var statusClass = 'status-badge ' + product.status;
    var toggleLabel = product.status === 'active' ? '下架' : '上架';
    var toggleStatus = product.status === 'active' ? 'inactive' : 'active';
    var stockCell = isProductInStock(product)
      ? '<span class="stock-badge stock-badge--yes">有现货</span>'
      : '<span class="stock-badge stock-badge--no">无</span>';

    return '<tr>' +
      '<td><img src="' + imageUrl + '" class="thumb" width="48" height="48" alt="' + product.name + '">' + imageCountLabel + '</td>' +
      '<td>' + product.name + '</td>' +
      '<td>' + price + '</td>' +
      '<td>' + originalPrice + '</td>' +
      '<td>' + (product.sort_order == null ? 9999 : product.sort_order) + '</td>' +
      '<td>' + qty + '</td>' +
      '<td>' + productSku + '</td>' +
      '<td>' + sku + '</td>' +
      '<td><span class="cell-truncate" data-tip="' + (product.remark || '').replace(/"/g, '&quot;') + '">' + (product.remark || '-') + '</span></td>' +
      '<td>' + stockCell + '</td>' +
      '<td><span class="' + statusClass + '">' + statusText + '</span></td>' +
      '<td>' +
        '<button class="btn-link" onclick="moveProductUp(\'' + product.id + '\')">上移</button>' +
        '<button class="btn-link" onclick="moveProductDown(\'' + product.id + '\')">下移</button>' +
        '<button class="btn-link" onclick=\'startEdit(' + JSON.stringify(product).replace(/'/g, "&#39;") + ')\'>编辑</button>' +
        '<button class="btn-link" onclick="toggleProductStatus(\'' + product.id + '\', \'' + toggleStatus + '\')">' + toggleLabel + '</button>' +
        '<button class="btn-link danger" onclick="deleteProduct(\'' + product.id + '\')">删除</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

function sortProductsBy(field) {
  if (productSortField === field) {
    productSortAsc = !productSortAsc;
  } else {
    productSortField = field;
    productSortAsc = true;
  }
  currentProductList = currentProductList.slice();
  sortProductList(currentProductList);
  renderProductTableBody(currentProductList);
  updateProductSortHeaders();
}

function updateProductSortHeaders() {
  var headers = document.querySelectorAll('#product-table .th-sortable');
  headers.forEach(function (th) {
    var field = th.getAttribute('data-product-sort');
    var indicator = th.querySelector('.product-sort-indicator');
    th.classList.remove('sort-asc', 'sort-desc');
    if (field === productSortField) {
      th.classList.add(productSortAsc ? 'sort-asc' : 'sort-desc');
      if (indicator) indicator.textContent = productSortAsc ? ' ▲' : ' ▼';
    } else if (indicator) {
      indicator.textContent = '';
    }
  });
}

/**
 * 加载商品列表并按状态筛选
 * @param {string} filter - 筛选条件：'all' | 'active' | 'inactive'
 */
async function loadProductList(filter) {
  currentFilter = filter || 'all';

  var tbody = document.getElementById('product-tbody');
  var emptyState = document.getElementById('admin-empty');
  var table = document.getElementById('product-table');

  try {
    var query = supabaseClient.from('products').select('*');

    if (filter === 'active' || filter === 'inactive') {
      query = query.eq('status', filter);
    }

    var result = await query;
    if (result.error) throw result.error;

    var data = result.data || [];

    if (data.length === 0) {
      currentProductList = [];
      tbody.innerHTML = '';
      table.style.display = 'none';
      emptyState.classList.remove('hidden');
      return;
    }

    table.style.display = '';
    emptyState.classList.add('hidden');

    currentProductList = data.slice();
    sortProductList(currentProductList);
    renderProductTableBody(currentProductList);
    updateProductSortHeaders();

  } catch (err) {
    tbody.innerHTML = '';
    table.style.display = 'none';
    emptyState.classList.remove('hidden');
  }
}

/**
 * 将商品信息填充到表单中，进入编辑模式
 * @param {Object} product - 商品对象
 */
function startEdit(product) {
  // 填充表单字段
  document.getElementById('product-name').value = product.name || '';
  document.getElementById('product-price').value = product.price || '';
  document.getElementById('product-original-price').value = product.original_price != null ? product.original_price : '';
  document.getElementById('product-sku').value = product.sku || '';
  document.getElementById('product-quantity').value = product.quantity != null ? product.quantity : '';
  document.getElementById('product-sort-order').value = product.sort_order != null ? product.sort_order : '';
  document.getElementById('product-product-sku').value = product.product_sku || '';
  document.getElementById('product-remark').value = product.remark || '';
  var inStockInput = document.getElementById('product-in-stock');
  if (inStockInput) inStockInput.checked = isProductInStock(product);

  // 设置编辑 ID
  document.getElementById('edit-id').value = product.id;

  selectedImageFiles = [];
  currentEditImagePaths = getProductImagePaths(product).slice();
  renderImagePreviewList();

  // 更改提交按钮文本
  document.getElementById('submit-btn').textContent = '保存修改';

  // 清除之前的提示信息
  var formMessage = document.getElementById('form-message');
  formMessage.textContent = '';
  formMessage.className = 'message';

  // 滚动到表单区域
  document.querySelector('.admin-section').scrollIntoView({ behavior: 'smooth' });
}

/**
 * 编辑商品：更新 Supabase Database 中的商品记录
 */
async function editProduct() {
  var formMessage = document.getElementById('form-message');
  var submitBtn = document.getElementById('submit-btn');
  var editId = document.getElementById('edit-id').value;

  // 清除之前的提示信息
  formMessage.textContent = '';
  formMessage.className = 'message';

  // 表单验证
  if (!validateForm()) {
    formMessage.textContent = '请检查表单中标红的项（排序序号须为 1、2、3 这样的正整数，或留空表示默认 9999）';
    formMessage.classList.add('message-error');
    formMessage.classList.add('visible');
    return;
  }

  // 获取表单值
  var name = document.getElementById('product-name').value.trim();
  var price = parseFloat(document.getElementById('product-price').value);
  var originalPrice = parseOptionalPrice(document.getElementById('product-original-price').value);
  var sku = document.getElementById('product-sku').value.trim();
  var quantity = document.getElementById('product-quantity').value ? parseInt(document.getElementById('product-quantity').value) : 0;
  var sortOrderInput = document.getElementById('product-sort-order').value.trim();
  var sortOrder = sortOrderInput !== '' ? parseInt(sortOrderInput, 10) : 9999;
  var productSku = document.getElementById('product-product-sku').value.trim();
  var remark = document.getElementById('product-remark').value.trim();
  var inStock = document.getElementById('product-in-stock').checked;

  submitBtn.disabled = true;

  try {
    var imagePaths = currentEditImagePaths.slice();
    if (selectedImageFiles.length > 0) {
      var newPaths = await uploadImageFiles(selectedImageFiles);
      imagePaths = imagePaths.concat(newPaths);
    }

    if (imagePaths.length === 0) {
      formMessage.textContent = '请至少保留一张商品图片';
      formMessage.classList.add('message-error');
      formMessage.classList.add('visible');
      submitBtn.disabled = false;
      return;
    }

    // 更新商品记录（select 用于确认 sort_order 已写入；缺列或权限问题会在这里报错）
    var updateResult = await supabaseClient
      .from('products')
      .update({
        name: name,
        price: price,
        original_price: originalPrice,
        sku: sku,
        quantity: quantity,
        sort_order: sortOrder,
        product_sku: productSku,
        remark: remark,
        image_url: imagePaths[0],
        image_urls: imagePaths,
        in_stock: inStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', editId)
      .select('id, sort_order')
      .maybeSingle();

    if (updateResult.error) {
      formMessage.textContent = '修改失败：' + (updateResult.error.message || '请检查 Supabase 是否已有 sort_order 字段');
      formMessage.classList.add('message-error');
      formMessage.classList.add('visible');
      submitBtn.disabled = false;
      return;
    }

    if (!updateResult.data) {
      formMessage.textContent = '未更新任何记录，请刷新页面后重试';
      formMessage.classList.add('message-error');
      formMessage.classList.add('visible');
      submitBtn.disabled = false;
      return;
    }

    // 修改成功
    formMessage.textContent = '修改成功（排序序号：' + (updateResult.data.sort_order != null ? updateResult.data.sort_order : '—') + '）';
    formMessage.classList.add('message-success');
    formMessage.classList.add('visible');
    resetForm();
    loadProductList(currentFilter);

  } catch (err) {
    formMessage.textContent = '修改失败：' + (err && err.message ? err.message : '请重试');
    formMessage.classList.add('message-error');
    formMessage.classList.add('visible');
  }

  submitBtn.disabled = false;
}

/**
 * 删除商品及其全部图片
 * @param {string} id - 商品 ID
 */
async function deleteProduct(id) {
  if (!confirm('确定要删除该商品吗？')) {
    return;
  }

  var product = null;
  for (var i = 0; i < currentProductList.length; i++) {
    if (currentProductList[i].id === id) {
      product = currentProductList[i];
      break;
    }
  }
  var imagePaths = product ? getProductImagePaths(product) : [];

  try {
    var deleteResult = await supabaseClient
      .from('products')
      .delete()
      .eq('id', id);

    if (deleteResult.error) {
      alert('删除失败，请重试');
      return;
    }

    if (imagePaths.length > 0) {
      await supabaseClient.storage
        .from(CONFIG.STORAGE_BUCKET)
        .remove(imagePaths);
    }

    loadProductList(currentFilter);

  } catch (err) {
    alert('删除失败，请重试');
  }
}

/**
 * 切换商品上架/下架状态
 * @param {string} id - 商品 ID
 * @param {string} newStatus - 新状态：'active' | 'inactive'
 */
async function toggleProductStatus(id, newStatus) {
  try {
    var updateResult = await supabaseClient
      .from('products')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateResult.error) {
      alert('操作失败，请重试');
      return;
    }

    loadProductList(currentFilter);

  } catch (err) {
    alert('操作失败，请重试');
  }
}

/**
 * 商品上移：与上一条交换 sort_order
 * @param {string} productId - 商品 ID
 */
async function moveProductUp(productId) {
  var idx = currentProductList.findIndex(function (p) { return p.id === productId; });
  if (idx <= 0) return;

  var current = currentProductList[idx];
  var prev = currentProductList[idx - 1];
  var currentOrder = current.sort_order == null ? 9999 : current.sort_order;
  var prevOrder = prev.sort_order == null ? 9999 : prev.sort_order;

  try {
    var r1 = await supabaseClient
      .from('products')
      .update({ sort_order: prevOrder, updated_at: new Date().toISOString() })
      .eq('id', current.id);
    if (r1.error) throw r1.error;

    var r2 = await supabaseClient
      .from('products')
      .update({ sort_order: currentOrder, updated_at: new Date().toISOString() })
      .eq('id', prev.id);
    if (r2.error) throw r2.error;

    loadProductList(currentFilter);
  } catch (err) {
    alert('上移失败，请重试');
  }
}

/**
 * 商品下移：与下一条交换 sort_order
 * @param {string} productId - 商品 ID
 */
async function moveProductDown(productId) {
  var idx = currentProductList.findIndex(function (p) { return p.id === productId; });
  if (idx < 0 || idx >= currentProductList.length - 1) return;

  var current = currentProductList[idx];
  var next = currentProductList[idx + 1];
  var currentOrder = current.sort_order == null ? 9999 : current.sort_order;
  var nextOrder = next.sort_order == null ? 9999 : next.sort_order;

  try {
    var r1 = await supabaseClient
      .from('products')
      .update({ sort_order: nextOrder, updated_at: new Date().toISOString() })
      .eq('id', current.id);
    if (r1.error) throw r1.error;

    var r2 = await supabaseClient
      .from('products')
      .update({ sort_order: currentOrder, updated_at: new Date().toISOString() })
      .eq('id', next.id);
    if (r2.error) throw r2.error;

    loadProductList(currentFilter);
  } catch (err) {
    alert('下移失败，请重试');
  }
}

// ============================================================
// 购买记录模块
// ============================================================

/**
 * 将 ISO 时间字符串格式化为 "YYYY-MM-DD HH:mm"
 * @param {string} isoString - ISO 8601 时间字符串
 * @returns {string} 格式化后的时间字符串
 */
function formatDateTime(isoString) {
  var d = new Date(isoString);
  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  var hours = String(d.getHours()).padStart(2, '0');
  var minutes = String(d.getMinutes()).padStart(2, '0');
  return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
}

// 分页相关变量
var allOrders = [];
var orderPage = 1;
var orderPageSize = 50;
var selectedOrderIds = new Set();
var orderSortField = 'created_at';
var orderSortAsc = false;
var productSkuByProductId = {};

/**
 * 加载购买记录列表并渲染到表格（带分页）
 */
async function loadOrderList() {
  var tbody = document.getElementById('order-tbody');
  var table = document.getElementById('order-table');
  var emptyState = document.getElementById('order-empty');
  var pagination = document.getElementById('order-pagination');

  try {
    if (CONFIG.DEMO_MODE) {
      try {
        allOrders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
      } catch (e) {
        allOrders = [];
      }
      await enrichOrdersWithSkuFromProducts(allOrders);
      sortAllOrders();
    } else {
      var result = await supabaseClient
        .from('orders')
        .select('*');
      if (result.error) throw result.error;
      allOrders = result.data || [];
      await enrichOrdersWithSkuFromProducts(allOrders);
      sortAllOrders();
    }

    selectedOrderIds.clear();
    updateOrderBatchToolbar();

    if (allOrders.length === 0) {
      tbody.innerHTML = '';
      table.style.display = 'none';
      pagination.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    table.style.display = '';
    emptyState.classList.add('hidden');
    orderPage = 1;
    renderOrderPage();
    updateOrderSortHeaders();

  } catch (err) {
    tbody.innerHTML = '';
    table.style.display = 'none';
    pagination.classList.add('hidden');
    emptyState.classList.remove('hidden');
  }
}

/**
 * 为订单补全货号（优先订单冗余字段，否则查商品表）
 */
function enrichOrdersWithSku(orders) {
  orders.forEach(function (order) {
    order.product_sku = getOrderProductSku(order);
  });
}

async function enrichOrdersWithSkuFromProducts(orders) {
  if (CONFIG.DEMO_MODE) {
    try {
      var demoProducts = JSON.parse(localStorage.getItem('demo_products') || '[]');
      demoProducts.forEach(function (p) {
        productSkuByProductId[p.id] = p.sku || '';
      });
    } catch (e) {
      /* ignore */
    }
    enrichOrdersWithSku(orders);
    return;
  }

  var needLookup = [];
  orders.forEach(function (order) {
    if (order.product_sku != null && order.product_sku !== '') {
      return;
    }
    if (order.product_id && productSkuByProductId[order.product_id] !== undefined) {
      order.product_sku = productSkuByProductId[order.product_id];
      return;
    }
    if (order.product_id) {
      needLookup.push(order.product_id);
    }
  });

  var missingIds = needLookup.filter(function (id, index, arr) {
    return arr.indexOf(id) === index && productSkuByProductId[id] === undefined;
  });

  if (missingIds.length > 0) {
    var productsResult = await supabaseClient
      .from('products')
      .select('id, sku')
      .in('id', missingIds);
    if (!productsResult.error && productsResult.data) {
      productsResult.data.forEach(function (p) {
        productSkuByProductId[p.id] = p.sku || '';
      });
    }
  }

  enrichOrdersWithSku(orders);
}

function getOrderProductSku(order) {
  if (order.product_sku != null && order.product_sku !== '') {
    return order.product_sku;
  }
  if (order.product_id && productSkuByProductId[order.product_id] !== undefined) {
    return productSkuByProductId[order.product_id] || '-';
  }
  return '-';
}

function sortAllOrders() {
  var field = orderSortField;
  var asc = orderSortAsc;
  allOrders.sort(function (a, b) {
    var va;
    var vb;
    if (field === 'created_at') {
      va = new Date(a.created_at).getTime();
      vb = new Date(b.created_at).getTime();
    } else if (field === 'quantity') {
      va = Number(a.quantity) || 0;
      vb = Number(b.quantity) || 0;
    } else if (field === 'product_sku') {
      va = getOrderProductSku(a).toLowerCase();
      vb = getOrderProductSku(b).toLowerCase();
    } else {
      va = (a[field] == null ? '' : String(a[field])).toLowerCase();
      vb = (b[field] == null ? '' : String(b[field])).toLowerCase();
    }
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
}

function sortOrdersBy(field) {
  if (orderSortField === field) {
    orderSortAsc = !orderSortAsc;
  } else {
    orderSortField = field;
    orderSortAsc = field === 'created_at' ? false : true;
  }
  sortAllOrders();
  orderPage = 1;
  renderOrderPage();
  updateOrderSortHeaders();
}

function updateOrderSortHeaders() {
  var headers = document.querySelectorAll('#order-table .th-sortable');
  headers.forEach(function (th) {
    var field = th.getAttribute('data-sort');
    var indicator = th.querySelector('.sort-indicator');
    th.classList.remove('sort-asc', 'sort-desc');
    if (field === orderSortField) {
      th.classList.add(orderSortAsc ? 'sort-asc' : 'sort-desc');
      if (indicator) {
        indicator.textContent = orderSortAsc ? ' ▲' : ' ▼';
      }
    } else if (indicator) {
      indicator.textContent = '';
    }
  });
}

/**
 * 渲染当前页的购买记录
 */
function renderOrderPage() {
  var tbody = document.getElementById('order-tbody');
  var pagination = document.getElementById('order-pagination');
  var pageInfo = document.getElementById('order-page-info');
  var prevBtn = document.getElementById('order-prev-btn');
  var nextBtn = document.getElementById('order-next-btn');

  var totalPages = Math.ceil(allOrders.length / orderPageSize);
  var start = (orderPage - 1) * orderPageSize;
  var end = start + orderPageSize;
  var pageOrders = allOrders.slice(start, end);

  tbody.innerHTML = pageOrders.map(function (order) {
    var checked = selectedOrderIds.has(order.id) ? ' checked' : '';
    return '<tr>' +
      '<td class="col-checkbox"><input type="checkbox" class="order-row-select" data-id="' + order.id + '"' + checked +
        ' onchange="toggleOrderSelect(\'' + order.id + '\', this.checked)"></td>' +
      '<td>' + order.product_name + '</td>' +
      '<td>' + getOrderProductSku(order) + '</td>' +
      '<td>' + order.buyer_name + '</td>' +
      '<td>' + (order.buyer_remark ? String(order.buyer_remark).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '-') + '</td>' +
      '<td>' + order.quantity + '</td>' +
      '<td>' + formatDateTime(order.created_at) + '</td>' +
      '<td><button class="btn-link danger" onclick="deleteOrder(\'' + order.id + '\')">删除</button></td>' +
      '</tr>';
  }).join('');

  updateOrderSelectAllCheckbox();
  updateOrderBatchToolbar();

  if (totalPages > 1) {
    pagination.classList.remove('hidden');
    pageInfo.textContent = '第 ' + orderPage + ' / ' + totalPages + ' 页（共 ' + allOrders.length + ' 条）';
    prevBtn.disabled = orderPage <= 1;
    nextBtn.disabled = orderPage >= totalPages;
  } else {
    pagination.classList.add('hidden');
  }
}

/**
 * 切换购买记录页码
 */
function changeOrderPage(delta) {
  var totalPages = Math.ceil(allOrders.length / orderPageSize);
  var newPage = orderPage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    orderPage = newPage;
    renderOrderPage();
  }
}

// ============================================================
// 购买记录 — 批量勾选
// ============================================================

/**
 * 切换单条购买记录的选中状态
 */
function toggleOrderSelect(orderId, checked) {
  if (checked) {
    selectedOrderIds.add(orderId);
  } else {
    selectedOrderIds.delete(orderId);
  }
  updateOrderSelectAllCheckbox();
  updateOrderBatchToolbar();
}

/**
 * 全选 / 取消全选当前页
 */
function toggleSelectAllOrdersOnPage(checked) {
  var totalPages = Math.ceil(allOrders.length / orderPageSize);
  var start = (orderPage - 1) * orderPageSize;
  var end = start + orderPageSize;
  var pageOrders = allOrders.slice(start, end);

  pageOrders.forEach(function (order) {
    if (checked) {
      selectedOrderIds.add(order.id);
    } else {
      selectedOrderIds.delete(order.id);
    }
  });

  var checkboxes = document.querySelectorAll('.order-row-select');
  for (var i = 0; i < checkboxes.length; i++) {
    checkboxes[i].checked = checked;
  }

  updateOrderSelectAllCheckbox();
  updateOrderBatchToolbar();
}

/**
 * 同步表头「全选本页」复选框状态
 */
function updateOrderSelectAllCheckbox() {
  var selectAll = document.getElementById('order-select-all');
  if (!selectAll) return;

  var totalPages = Math.ceil(allOrders.length / orderPageSize);
  var start = (orderPage - 1) * orderPageSize;
  var end = start + orderPageSize;
  var pageOrders = allOrders.slice(start, end);

  if (pageOrders.length === 0) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
    return;
  }

  var selectedOnPage = pageOrders.filter(function (o) {
    return selectedOrderIds.has(o.id);
  }).length;

  selectAll.checked = selectedOnPage === pageOrders.length;
  selectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < pageOrders.length;
}

/**
 * 更新批量操作工具栏（已选数量、按钮可用状态）
 */
function updateOrderBatchToolbar() {
  var countEl = document.getElementById('order-selected-count');
  var exportBtn = document.getElementById('order-export-selected-btn');
  var deleteBtn = document.getElementById('order-delete-selected-btn');
  var count = selectedOrderIds.size;

  if (countEl) {
    countEl.textContent = '已选 ' + count + ' 条';
  }
  if (exportBtn) {
    exportBtn.disabled = count === 0;
  }
  if (deleteBtn) {
    deleteBtn.disabled = count === 0;
  }
}

/**
 * 获取已勾选的购买记录（保持列表原有排序）
 */
function getSelectedOrders() {
  return allOrders.filter(function (order) {
    return selectedOrderIds.has(order.id);
  });
}

/**
 * 将购买记录列表导出为 CSV 并下载
 * @param {Array} orders - 要导出的记录
 * @param {string} filenameSuffix - 文件名后缀，如「选中」或空
 */
function downloadOrdersCsv(orders, filenameSuffix) {
  var bom = '\uFEFF';
  var header = '商品名称,货号,购买人,用户备注,数量,购买时间\n';
  var rows = orders.map(function (order) {
    return '"' + (order.product_name || '') + '",' +
           '"' + getOrderProductSku(order) + '",' +
           '"' + (order.buyer_name || '') + '",' +
           '"' + (order.buyer_remark || '') + '",' +
           order.quantity + ',' +
           '"' + formatDateTime(order.created_at) + '"';
  }).join('\n');

  var csv = bom + header + rows;
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var suffix = filenameSuffix ? '_' + filenameSuffix : '';
  a.download = '购买记录' + suffix + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// 导出购买记录为 Excel（CSV 格式）
// ============================================================

/**
 * 导出全部购买记录
 */
async function exportOrders() {
  try {
    if (allOrders.length === 0) {
      alert('暂无购买记录可导出');
      return;
    }
    downloadOrdersCsv(allOrders, '');
  } catch (err) {
    alert('导出失败，请重试');
  }
}

/**
 * 导出已勾选的购买记录
 */
function exportSelectedOrders() {
  var orders = getSelectedOrders();
  if (orders.length === 0) {
    alert('请先勾选要导出的购买记录');
    return;
  }
  downloadOrdersCsv(orders, '选中');
}

/**
 * 批量删除已勾选的购买记录
 */
async function deleteSelectedOrders() {
  var ids = Array.from(selectedOrderIds);
  if (ids.length === 0) {
    alert('请先勾选要删除的购买记录');
    return;
  }
  if (!confirm('确定要删除已选中的 ' + ids.length + ' 条购买记录吗？此操作不可恢复。')) {
    return;
  }

  try {
    if (CONFIG.DEMO_MODE) {
      var orders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
      orders = orders.filter(function (o) {
        return ids.indexOf(o.id) === -1;
      });
      localStorage.setItem('demo_orders', JSON.stringify(orders));
    } else {
      var result = await supabaseClient.from('orders').delete().in('id', ids);
      if (result.error) {
        alert('批量删除失败，请重试');
        return;
      }
    }
    selectedOrderIds.clear();
    loadOrderList();
  } catch (err) {
    alert('批量删除失败，请重试');
  }
}

// ============================================================
// 删除购买记录
// ============================================================

/**
 * 删除一条购买记录
 * @param {string} orderId - 订单 ID
 */
async function deleteOrder(orderId) {
  if (!confirm('确定要删除该购买记录吗？')) return;

  try {
    if (CONFIG.DEMO_MODE) {
      var orders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
      orders = orders.filter(function (o) { return o.id !== orderId; });
      localStorage.setItem('demo_orders', JSON.stringify(orders));
    } else {
      var result = await supabaseClient.from('orders').delete().eq('id', orderId);
      if (result.error) { alert('删除失败，请重试'); return; }
    }
    loadOrderList();
  } catch (err) {
    alert('删除失败，请重试');
  }
}

// ============================================================
// 抽奖管理（后台查看）
// ============================================================

var allLotteryDraws = [];
var lotteryAdminPrizes = [];
var lotteryAdminEnabled = true;
var selectedLotteryDrawIds = new Set();
var lotterySortField = 'created_at';
var lotterySortAsc = false;

function escapeLotteryConfigAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function updateLotteryEnabledToggleUI() {
  var btn = document.getElementById('lottery-enabled-toggle');
  if (!btn) return;
  if (lotteryAdminEnabled) {
    btn.textContent = '已开启';
    btn.className = 'btn btn-primary btn-sm';
  } else {
    btn.textContent = '已关闭';
    btn.className = 'btn btn-default btn-sm';
  }
}

async function loadLotteryAdminSettings() {
  try {
    if (CONFIG.DEMO_MODE) {
      var demoSettings = typeof getDemoLotterySettings === 'function' ? getDemoLotterySettings() : { enabled: true };
      lotteryAdminEnabled = !!demoSettings.enabled;
    } else {
      var result = await supabaseClient.from('lottery_settings').select('*').eq('id', 1).maybeSingle();
      if (result.error) throw result.error;
      lotteryAdminEnabled = !!(result.data && result.data.enabled);
    }
  } catch (e) {
    lotteryAdminEnabled = false;
  }
  updateLotteryEnabledToggleUI();
}

async function toggleLotteryEnabled() {
  var nextEnabled = !lotteryAdminEnabled;
  try {
    if (CONFIG.DEMO_MODE) {
      if (typeof saveDemoLotterySettings === 'function') {
        saveDemoLotterySettings({ enabled: nextEnabled });
      }
    } else {
      var result = await supabaseClient
        .from('lottery_settings')
        .upsert({ id: 1, enabled: nextEnabled, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (result.error) throw result.error;
    }
    lotteryAdminEnabled = nextEnabled;
    updateLotteryEnabledToggleUI();
  } catch (e) {
    alert('切换抽奖开关失败，请重试');
  }
}

function renderLotteryPrizeConfigTable() {
  var tbody = document.getElementById('lottery-prize-config-tbody');
  if (!tbody) return;

  if (!lotteryAdminPrizes.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无奖品，请点击「添加奖项」</td></tr>';
    return;
  }

  tbody.innerHTML = lotteryAdminPrizes.map(function (p) {
    var tier = escapeLotteryConfigAttr(p.tier);
    return '<tr data-tier="' + tier + '">' +
      '<td><input type="text" class="lottery-config-input lottery-config-label" value="' + escapeLotteryConfigAttr(p.label) + '"></td>' +
      '<td><input type="text" class="lottery-config-input lottery-config-description" value="' + escapeLotteryConfigAttr(p.description) + '"></td>' +
      '<td><input type="number" min="0" class="lottery-config-input lottery-config-total" value="' + (p.total_quota || 0) + '"></td>' +
      '<td><input type="number" min="0" class="lottery-config-input lottery-config-remaining" value="' + (p.remaining_quota || 0) + '"></td>' +
      '<td><input type="number" min="0" class="lottery-config-input lottery-config-sort" value="' + (p.sort_order || 0) + '"></td>' +
      '<td><button type="button" class="btn-link danger" onclick="deleteLotteryPrizeConfigRow(\'' + tier.replace(/'/g, "\\'") + '\')">删除</button></td>' +
      '</tr>';
  }).join('');
}

function addLotteryPrizeConfigRow() {
  var tier = 'tier_' + Date.now().toString(36);
  var nextSort = lotteryAdminPrizes.length + 1;
  lotteryAdminPrizes.push({
    tier: tier,
    label: '',
    description: '',
    total_quota: 1,
    remaining_quota: 1,
    sort_order: nextSort
  });
  renderLotteryPrizeConfigTable();
}

function collectLotteryPrizeConfigRows() {
  var tbody = document.getElementById('lottery-prize-config-tbody');
  if (!tbody) return [];

  var rows = tbody.querySelectorAll('tr[data-tier]');
  var prizes = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var label = row.querySelector('.lottery-config-label');
    var description = row.querySelector('.lottery-config-description');
    var total = row.querySelector('.lottery-config-total');
    var remaining = row.querySelector('.lottery-config-remaining');
    var sort = row.querySelector('.lottery-config-sort');
    var labelVal = label ? label.value.trim() : '';
    var descVal = description ? description.value.trim() : '';
    var totalVal = total ? parseInt(total.value, 10) : 0;
    var remainingVal = remaining ? parseInt(remaining.value, 10) : 0;
    var sortVal = sort ? parseInt(sort.value, 10) : (i + 1);

    if (!labelVal) {
      alert('请填写第 ' + (i + 1) + ' 行的奖项名称');
      return null;
    }
    if (!descVal) {
      alert('请填写第 ' + (i + 1) + ' 行的奖品内容');
      return null;
    }
    if (isNaN(totalVal) || totalVal < 0) {
      alert('第 ' + (i + 1) + ' 行总数量无效');
      return null;
    }
    if (isNaN(remainingVal) || remainingVal < 0) {
      alert('第 ' + (i + 1) + ' 行剩余数量无效');
      return null;
    }
    if (remainingVal > totalVal) {
      alert('第 ' + (i + 1) + ' 行剩余数量不能大于总数量');
      return null;
    }

    prizes.push({
      tier: row.getAttribute('data-tier'),
      label: labelVal,
      description: descVal,
      total_quota: totalVal,
      remaining_quota: remainingVal,
      sort_order: isNaN(sortVal) ? (i + 1) : sortVal
    });
  }
  return prizes;
}

async function saveLotteryPrizeConfig() {
  var prizes = collectLotteryPrizeConfigRows();
  if (!prizes) return;

  try {
    if (CONFIG.DEMO_MODE) {
      if (typeof saveDemoLotteryPrizes === 'function') saveDemoLotteryPrizes(prizes);
    } else {
      var existingRes = await supabaseClient.from('lottery_prizes').select('tier');
      if (existingRes.error) throw existingRes.error;
      var newTiers = prizes.map(function (p) { return p.tier; });
      var oldTiers = (existingRes.data || []).map(function (p) { return p.tier; });
      var removeTiers = oldTiers.filter(function (tier) { return newTiers.indexOf(tier) === -1; });

      if (removeTiers.length) {
        var delRes = await supabaseClient.from('lottery_prizes').delete().in('tier', removeTiers);
        if (delRes.error) {
          alert('删除旧奖项失败：若已有中奖记录关联该奖项，请先保留或清理记录');
          return;
        }
      }

      var upsertRes = await supabaseClient.from('lottery_prizes').upsert(prizes, { onConflict: 'tier' });
      if (upsertRes.error) throw upsertRes.error;
    }

    lotteryAdminPrizes = prizes;
    renderLotteryPrizeConfigTable();
    alert('奖品设置已保存');
  } catch (e) {
    alert('保存奖品设置失败，请重试');
  }
}

async function deleteLotteryPrizeConfigRow(tier) {
  if (!confirm('确定要删除该奖项吗？保存后生效。')) return;
  lotteryAdminPrizes = lotteryAdminPrizes.filter(function (p) { return p.tier !== tier; });
  renderLotteryPrizeConfigTable();
}

function sortAllLotteryDraws() {
  var field = lotterySortField;
  var asc = lotterySortAsc;
  allLotteryDraws.sort(function (a, b) {
    var va;
    var vb;
    if (field === 'created_at') {
      va = new Date(a.created_at).getTime();
      vb = new Date(b.created_at).getTime();
    } else if (field === 'won') {
      va = a.won ? 1 : 0;
      vb = b.won ? 1 : 0;
    } else {
      va = (a[field] == null ? '' : String(a[field])).toLowerCase();
      vb = (b[field] == null ? '' : String(b[field])).toLowerCase();
    }
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
}

function sortLotteryDrawsBy(field) {
  if (lotterySortField === field) {
    lotterySortAsc = !lotterySortAsc;
  } else {
    lotterySortField = field;
    lotterySortAsc = field === 'created_at' ? false : true;
  }
  sortAllLotteryDraws();
  renderLotteryAdminTable();
  updateLotterySortHeaders();
}

function updateLotterySortHeaders() {
  var headers = document.querySelectorAll('#lottery-admin-table .th-sortable');
  headers.forEach(function (th) {
    var field = th.getAttribute('data-sort');
    var indicator = th.querySelector('.sort-indicator');
    th.classList.remove('sort-asc', 'sort-desc');
    if (field === lotterySortField) {
      th.classList.add(lotterySortAsc ? 'sort-asc' : 'sort-desc');
      if (indicator) {
        indicator.textContent = lotterySortAsc ? ' ▲' : ' ▼';
      }
    } else if (indicator) {
      indicator.textContent = '';
    }
  });
}

function renderLotteryAdminTable() {
  var tbody = document.getElementById('lottery-admin-tbody');
  var empty = document.getElementById('lottery-admin-empty');
  var table = document.getElementById('lottery-admin-table');
  if (!tbody) return;

  if (!allLotteryDraws.length) {
    tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (empty) empty.classList.remove('hidden');
    updateLotterySelectAllCheckbox();
    updateLotteryBatchToolbar();
    return;
  }

  if (table) table.style.display = '';
  if (empty) empty.classList.add('hidden');

  tbody.innerHTML = allLotteryDraws.map(function (row) {
    var checked = selectedLotteryDrawIds.has(row.id) ? ' checked' : '';
    return '<tr>' +
      '<td class="col-checkbox"><input type="checkbox" class="lottery-row-select" data-id="' + row.id + '"' + checked +
        ' onchange="toggleLotteryDrawSelect(\'' + row.id + '\', this.checked)"></td>' +
      '<td>' + formatDateTime(row.created_at) + '</td>' +
      '<td>' + (row.visitor_ip || '-') + '</td>' +
      '<td>' + (row.won ? '是' : '否') + '</td>' +
      '<td>' + (row.prize_label || '-') + '</td>' +
      '<td>' + (row.prize_description || '-') + '</td>' +
      '<td>' + (row.consolation_coupon || '-') + '</td>' +
      '<td>' + (row.winner_name || '-') + '</td>' +
      '<td><button class="btn-link danger" onclick="deleteLotteryDraw(\'' + row.id + '\')">删除</button></td>' +
      '</tr>';
  }).join('');

  updateLotterySelectAllCheckbox();
  updateLotteryBatchToolbar();
}

function toggleLotteryDrawSelect(drawId, checked) {
  if (checked) {
    selectedLotteryDrawIds.add(drawId);
  } else {
    selectedLotteryDrawIds.delete(drawId);
  }
  updateLotterySelectAllCheckbox();
  updateLotteryBatchToolbar();
}

function toggleSelectAllLotteryDraws(checked) {
  allLotteryDraws.forEach(function (row) {
    if (checked) {
      selectedLotteryDrawIds.add(row.id);
    } else {
      selectedLotteryDrawIds.delete(row.id);
    }
  });

  var checkboxes = document.querySelectorAll('.lottery-row-select');
  for (var i = 0; i < checkboxes.length; i++) {
    checkboxes[i].checked = checked;
  }

  updateLotterySelectAllCheckbox();
  updateLotteryBatchToolbar();
}

function updateLotterySelectAllCheckbox() {
  var selectAll = document.getElementById('lottery-select-all');
  if (!selectAll) return;

  if (!allLotteryDraws.length) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
    return;
  }

  var selectedCount = allLotteryDraws.filter(function (row) {
    return selectedLotteryDrawIds.has(row.id);
  }).length;

  selectAll.checked = selectedCount === allLotteryDraws.length;
  selectAll.indeterminate = selectedCount > 0 && selectedCount < allLotteryDraws.length;
}

function updateLotteryBatchToolbar() {
  var countEl = document.getElementById('lottery-selected-count');
  var deleteBtn = document.getElementById('lottery-delete-selected-btn');
  var count = selectedLotteryDrawIds.size;

  if (countEl) {
    countEl.textContent = '已选 ' + count + ' 条';
  }
  if (deleteBtn) {
    deleteBtn.disabled = count === 0;
  }
}

async function loadLotteryAdminList() {
  var tbody = document.getElementById('lottery-admin-tbody');
  var empty = document.getElementById('lottery-admin-empty');
  if (!tbody) return;

  try {
    await loadLotteryAdminSettings();

    if (CONFIG.DEMO_MODE) {
      lotteryAdminPrizes = typeof getDemoLotteryPrizes === 'function' ? getDemoLotteryPrizes() : [];
      allLotteryDraws = typeof getDemoLotteryDraws === 'function' ? getDemoLotteryDraws() : [];
    } else {
      var pRes = await supabaseClient.from('lottery_prizes').select('*').order('sort_order', { ascending: true });
      var dRes = await supabaseClient.from('lottery_draws').select('*');
      if (pRes.error) throw pRes.error;
      if (dRes.error) throw dRes.error;
      lotteryAdminPrizes = pRes.data || [];
      allLotteryDraws = dRes.data || [];
    }

    renderLotteryPrizeConfigTable();
    selectedLotteryDrawIds.clear();
    sortAllLotteryDraws();
    renderLotteryAdminTable();
    updateLotterySortHeaders();
  } catch (e) {
    allLotteryDraws = [];
    lotteryAdminPrizes = [];
    renderLotteryPrizeConfigTable();
    tbody.innerHTML = '';
    if (empty) {
      empty.textContent = '抽奖记录加载失败';
      empty.classList.remove('hidden');
    }
  }
}

async function removeLotteryDrawRecord(drawId) {
  if (CONFIG.DEMO_MODE) {
    var draws = typeof getDemoLotteryDraws === 'function' ? getDemoLotteryDraws() : [];
    var draw = draws.find(function (d) { return d.id === drawId; });
    if (draw && draw.won && draw.prize_tier && typeof getDemoLotteryPrizes === 'function') {
      var prizes = getDemoLotteryPrizes();
      var prize = prizes.find(function (p) { return p.tier === draw.prize_tier; });
      if (prize && prize.remaining_quota < prize.total_quota) {
        prize.remaining_quota++;
        if (typeof saveDemoLotteryPrizes === 'function') saveDemoLotteryPrizes(prizes);
      }
    }
    draws = draws.filter(function (d) { return d.id !== drawId; });
    if (typeof saveDemoLotteryDraws === 'function') saveDemoLotteryDraws(draws);
    return true;
  }

  var result = await supabaseClient.rpc('delete_lottery_draw', { p_draw_id: drawId });
  return !result.error;
}

async function deleteLotteryDraw(drawId) {
  if (!confirm('确定要删除该抽奖记录吗？删除后该设备可重新抽奖。')) return;

  try {
    if (await removeLotteryDrawRecord(drawId)) {
      loadLotteryAdminList();
    } else {
      alert('删除失败，请重试');
    }
  } catch (err) {
    alert('删除失败，请重试');
  }
}

async function deleteSelectedLotteryDraws() {
  var ids = Array.from(selectedLotteryDrawIds);
  if (ids.length === 0) {
    alert('请先勾选要删除的抽奖记录');
    return;
  }
  if (!confirm('确定要删除已选中的 ' + ids.length + ' 条抽奖记录吗？删除后对应设备可重新抽奖。')) {
    return;
  }

  var failCount = 0;
  try {
    for (var i = 0; i < ids.length; i++) {
      var ok = await removeLotteryDrawRecord(ids[i]);
      if (!ok) failCount++;
    }
    selectedLotteryDrawIds.clear();
    loadLotteryAdminList();
    if (failCount > 0) {
      alert('有 ' + failCount + ' 条记录删除失败，请重试');
    }
  } catch (err) {
    alert('批量删除失败，请重试');
  }
}

// ============================================================
// 浏览记录模块
// ============================================================

var allBrowseLogs = [];
var browsePage = 1;
var browsePageSize = 50;
var browseFilter = 'page_view';
var browsePageViewMode = 'summary';
var browseSkuFilter = '';
var browseSortField = 'created_at';
var browseSortAsc = false;
var browseSummaryPageSize = 14;

function shortenBrowseText(text, maxLen) {
  var value = text == null ? '' : String(text);
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen) + '…';
}

function summarizeUserAgent(ua) {
  if (!ua) return '-';
  var text = String(ua);
  if (/MicroMessenger/i.test(text)) return '微信';
  if (/iPhone|iPad|iPod/i.test(text)) return 'iOS';
  if (/Android/i.test(text)) return 'Android';
  if (/Windows/i.test(text)) return 'Windows';
  if (/Mac OS/i.test(text)) return 'Mac';
  return shortenBrowseText(text, 24);
}

function getFilteredBrowseLogs() {
  var logs = allBrowseLogs.filter(function (log) {
    return log.event_type === browseFilter;
  });
  if (browseFilter === 'view_product' && browseSkuFilter) {
    var skuKey = browseSkuFilter.toLowerCase();
    logs = logs.filter(function (log) {
      return String(log.product_sku || '').trim().toLowerCase() === skuKey;
    });
  }
  return logs;
}

function formatBrowseDateKey(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function formatBrowseWeekday(dateKey) {
  var parts = dateKey.split('-');
  var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  var names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[date.getDay()] || '';
}

function aggregatePageViewsByDay(logs) {
  var byDay = {};
  logs.forEach(function (log) {
    var date = new Date(log.created_at);
    if (isNaN(date.getTime())) return;
    var dayKey = formatBrowseDateKey(date);
    var hour = date.getHours();
    if (!byDay[dayKey]) {
      byDay[dayKey] = { date: dayKey, total: 0, hours: {} };
    }
    byDay[dayKey].total++;
    byDay[dayKey].hours[hour] = (byDay[dayKey].hours[hour] || 0) + 1;
  });
  return Object.keys(byDay).sort(function (a, b) {
    return a < b ? 1 : -1;
  }).map(function (key) {
    return byDay[key];
  });
}

function buildBrowsePeakHoursText(hoursMap) {
  var list = [];
  for (var h = 0; h < 24; h++) {
    if (hoursMap[h]) {
      list.push({ hour: h, count: hoursMap[h] });
    }
  }
  list.sort(function (a, b) {
    return b.count - a.count || a.hour - b.hour;
  });
  if (list.length === 0) return '-';
  return list.slice(0, 4).map(function (item) {
    return String(item.hour).padStart(2, '0') + ':00(' + item.count + '次)';
  }).join(' ');
}

function buildBrowseHourChartHtml(hoursMap) {
  var max = 0;
  for (var h = 0; h < 24; h++) {
    if (hoursMap[h] > max) max = hoursMap[h];
  }
  if (max === 0) max = 1;
  var html = '<div class="browse-hour-chart">';
  for (var hour = 0; hour < 24; hour++) {
    var count = hoursMap[hour] || 0;
    var height = Math.round((count / max) * 100);
    html += '<div class="browse-hour-cell" title="' + String(hour).padStart(2, '0') + ':00  ' + count + ' 次">' +
      '<div class="browse-hour-bar' + (count > 0 ? ' browse-hour-bar--active' : '') + '" style="height:' + height + '%"></div>' +
      '<span class="browse-hour-label">' + hour + '</span>' +
      '</div>';
  }
  html += '</div>';
  return html;
}

function updateBrowseTableView() {
  var table = document.getElementById('browse-table');
  var skuBar = document.getElementById('browse-sku-filter-bar');
  var modeBar = document.getElementById('browse-pageview-mode-bar');
  var detailWrap = document.getElementById('browse-detail-wrap');
  var summaryWrap = document.getElementById('browse-summary-wrap');
  var isPageView = browseFilter === 'page_view';
  var isSummary = isPageView && browsePageViewMode === 'summary';

  if (table) {
    table.classList.remove('browse-view-page_view', 'browse-view-view_product');
    table.classList.add(browseFilter === 'view_product' ? 'browse-view-view_product' : 'browse-view-page_view');
  }
  if (skuBar) skuBar.classList.toggle('hidden', browseFilter !== 'view_product');
  if (modeBar) modeBar.classList.toggle('hidden', !isPageView);
  if (detailWrap) detailWrap.classList.toggle('hidden', isSummary);
  if (summaryWrap) summaryWrap.classList.toggle('hidden', !isSummary);
}

function setBrowsePageViewMode(mode) {
  browsePageViewMode = mode === 'detail' ? 'detail' : 'summary';
  browsePage = 1;
  var tabs = document.querySelectorAll('.browse-pageview-mode .filter-tab');
  tabs.forEach(function (tab) {
    tab.classList.toggle('active', tab.getAttribute('data-pageview-mode') === browsePageViewMode);
  });
  updateBrowseTableView();
  renderBrowsePage();
}

function sortBrowseLogsList(logs) {
  var field = browseSortField;
  var asc = browseSortAsc;
  logs.sort(function (a, b) {
    var va;
    var vb;
    if (field === 'created_at') {
      va = new Date(a.created_at).getTime();
      vb = new Date(b.created_at).getTime();
    } else {
      va = (a[field] == null ? '' : String(a[field])).toLowerCase();
      vb = (b[field] == null ? '' : String(b[field])).toLowerCase();
    }
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
}

async function loadBrowseLogList() {
  var tbody = document.getElementById('browse-tbody');
  var table = document.getElementById('browse-table');
  var emptyState = document.getElementById('browse-empty');
  var pagination = document.getElementById('browse-pagination');
  if (!tbody) return;

  try {
    if (CONFIG.DEMO_MODE) {
      allBrowseLogs = getDemoBrowseLogs();
    } else {
      var result = await supabaseClient
        .from('browse_logs')
        .select('*');
      if (result.error) throw result.error;
      allBrowseLogs = result.data || [];
    }
    allBrowseLogs = allBrowseLogs.filter(function (log) {
      return log.event_type === 'page_view' || log.event_type === 'view_product';
    });

    browsePage = 1;
    updateBrowseTableView();
    renderBrowsePage();
    updateBrowseSortHeaders();
  } catch (err) {
    tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (pagination) pagination.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
  }
}

function renderBrowseSummary() {
  var tbody = document.getElementById('browse-summary-tbody');
  var emptyState = document.getElementById('browse-empty');
  var pagination = document.getElementById('browse-pagination');
  var pageInfo = document.getElementById('browse-page-info');
  var prevBtn = document.getElementById('browse-prev-btn');
  var nextBtn = document.getElementById('browse-next-btn');
  if (!tbody) return;

  var logs = getFilteredBrowseLogs();
  var dayRows = aggregatePageViewsByDay(logs);

  if (dayRows.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    pagination.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  var totalPages = Math.ceil(dayRows.length / browseSummaryPageSize);
  var start = (browsePage - 1) * browseSummaryPageSize;
  var pageRows = dayRows.slice(start, start + browseSummaryPageSize);

  tbody.innerHTML = pageRows.map(function (row) {
    return '<tr>' +
      '<td>' + row.date + ' ' + formatBrowseWeekday(row.date) + '</td>' +
      '<td><strong>' + row.total + '</strong> 次</td>' +
      '<td class="browse-peak-hours">' + buildBrowsePeakHoursText(row.hours) + '</td>' +
      '<td>' + buildBrowseHourChartHtml(row.hours) + '</td>' +
      '</tr>';
  }).join('');

  if (totalPages > 1) {
    pagination.classList.remove('hidden');
    pageInfo.textContent = '第 ' + browsePage + ' / ' + totalPages + ' 页（共 ' + dayRows.length + ' 天）';
    prevBtn.disabled = browsePage <= 1;
    nextBtn.disabled = browsePage >= totalPages;
  } else {
    pagination.classList.add('hidden');
  }
}

function renderBrowsePage() {
  updateBrowseTableView();

  if (browseFilter === 'page_view' && browsePageViewMode === 'summary') {
    renderBrowseSummary();
    return;
  }

  var tbody = document.getElementById('browse-tbody');
  var table = document.getElementById('browse-table');
  var emptyState = document.getElementById('browse-empty');
  var pagination = document.getElementById('browse-pagination');
  var pageInfo = document.getElementById('browse-page-info');
  var prevBtn = document.getElementById('browse-prev-btn');
  var nextBtn = document.getElementById('browse-next-btn');
  if (!tbody) return;

  var logs = getFilteredBrowseLogs();
  sortBrowseLogsList(logs);

  if (logs.length === 0) {
    tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (pagination) pagination.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (table) table.style.display = '';
  if (emptyState) emptyState.classList.add('hidden');

  var totalPages = Math.ceil(logs.length / browsePageSize);
  var start = (browsePage - 1) * browsePageSize;
  var pageLogs = logs.slice(start, start + browsePageSize);

  tbody.innerHTML = pageLogs.map(function (log) {
    return '<tr>' +
      '<td class="browse-col-time">' + formatDateTime(log.created_at) + '</td>' +
      '<td class="browse-col-product">' + (log.product_name || '-') + '</td>' +
      '<td class="browse-col-product">' + (log.product_sku || '-') + '</td>' +
      '<td class="browse-col-ip">' + (log.visitor_ip || '-') + '</td>' +
      '<td class="browse-col-device" title="' + String(log.user_agent || '').replace(/"/g, '&quot;') + '">' + summarizeUserAgent(log.user_agent) + '</td>' +
      '<td class="browse-col-action"><button class="btn-link danger" onclick="deleteBrowseLog(\'' + log.id + '\')">删除</button></td>' +
      '</tr>';
  }).join('');

  if (totalPages > 1) {
    pagination.classList.remove('hidden');
    pageInfo.textContent = '第 ' + browsePage + ' / ' + totalPages + ' 页';
    prevBtn.disabled = browsePage <= 1;
    nextBtn.disabled = browsePage >= totalPages;
  } else {
    pagination.classList.add('hidden');
  }
}

function filterBrowseLogs(filter) {
  browseFilter = filter || 'page_view';
  if (browseFilter !== 'view_product') {
    browseSkuFilter = '';
    var skuInput = document.getElementById('browse-sku-filter-input');
    if (skuInput) skuInput.value = '';
  }
  browsePage = 1;
  var tabs = document.querySelectorAll('.browse-filter-tabs .filter-tab');
  tabs.forEach(function (tab) {
    tab.classList.toggle('active', tab.getAttribute('data-browse-filter') === browseFilter);
  });
  updateBrowseTableView();
  renderBrowsePage();
  updateBrowseSortHeaders();
}

function applyBrowseSkuFilter() {
  var skuInput = document.getElementById('browse-sku-filter-input');
  browseSkuFilter = skuInput ? skuInput.value.trim() : '';
  browsePage = 1;
  renderBrowsePage();
}

function clearBrowseSkuFilter() {
  browseSkuFilter = '';
  var skuInput = document.getElementById('browse-sku-filter-input');
  if (skuInput) skuInput.value = '';
  browsePage = 1;
  renderBrowsePage();
}

function sortBrowseLogsBy(field) {
  if (browseSortField === field) {
    browseSortAsc = !browseSortAsc;
  } else {
    browseSortField = field;
    browseSortAsc = field === 'created_at' ? false : true;
  }
  browsePage = 1;
  renderBrowsePage();
  updateBrowseSortHeaders();
}

function updateBrowseSortHeaders() {
  var headers = document.querySelectorAll('#browse-table .th-sortable');
  headers.forEach(function (th) {
    var field = th.getAttribute('data-browse-sort');
    var indicator = th.querySelector('.browse-sort-indicator');
    th.classList.remove('sort-asc', 'sort-desc');
    if (field === browseSortField) {
      th.classList.add(browseSortAsc ? 'sort-asc' : 'sort-desc');
      if (indicator) indicator.textContent = browseSortAsc ? ' ▲' : ' ▼';
    } else if (indicator) {
      indicator.textContent = '';
    }
  });
}

function changeBrowsePage(delta) {
  var totalPages;
  if (browseFilter === 'page_view' && browsePageViewMode === 'summary') {
    totalPages = Math.ceil(aggregatePageViewsByDay(getFilteredBrowseLogs()).length / browseSummaryPageSize);
  } else {
    totalPages = Math.ceil(getFilteredBrowseLogs().length / browsePageSize);
  }
  var newPage = browsePage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    browsePage = newPage;
    renderBrowsePage();
  }
}

async function deleteBrowseLog(logId) {
  if (!confirm('确定要删除该浏览记录吗？')) return;
  try {
    if (CONFIG.DEMO_MODE) {
      var logs = getDemoBrowseLogs().filter(function (log) { return log.id !== logId; });
      saveDemoBrowseLogs(logs);
    } else {
      var result = await supabaseClient.from('browse_logs').delete().eq('id', logId);
      if (result.error) { alert('删除失败，请重试'); return; }
    }
    loadBrowseLogList();
  } catch (err) {
    alert('删除失败，请重试');
  }
}

async function clearAllBrowseLogs() {
  if (!confirm('确定要清空全部浏览记录吗？此操作不可恢复。')) return;
  try {
    if (CONFIG.DEMO_MODE) {
      saveDemoBrowseLogs([]);
    } else {
      var result = await supabaseClient.from('browse_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (result.error) { alert('清空失败，请重试'); return; }
    }
    loadBrowseLogList();
  } catch (err) {
    alert('清空失败，请重试');
  }
}

// ============================================================
// 气泡提示（备注悬停）
// ============================================================

document.addEventListener('mouseover', function (e) {
  var el = e.target.closest('.cell-truncate');
  if (!el) return;
  var tip = el.getAttribute('data-tip');
  if (!tip || tip === '-' || tip === '') return;

  var bubble = document.createElement('div');
  bubble.className = 'tooltip-bubble';
  bubble.textContent = tip;
  document.body.appendChild(bubble);

  var rect = el.getBoundingClientRect();
  bubble.style.left = rect.left + 'px';
  bubble.style.top = (rect.top - bubble.offsetHeight - 8) + 'px';

  el._bubble = bubble;
});

document.addEventListener('mouseout', function (e) {
  var el = e.target.closest('.cell-truncate');
  if (!el || !el._bubble) return;
  el._bubble.remove();
  el._bubble = null;
});
