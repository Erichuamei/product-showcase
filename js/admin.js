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
    if (this.files && this.files[0]) {
      handleImageSelect(this.files[0]);
    }
  });

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

  // 登录成功后加载商品列表和购买记录
  if (isLoggedIn) {
    loadProductList('all');
    loadOrderList();
  }

});

// ============================================================
// 图片处理模块（任务 6.1）
// ============================================================

// 当前选中的图片文件（供表单提交时使用）
let selectedImageFile = null;

/**
 * 处理图片选择：格式校验 + 预览显示
 * @param {File} file 用户选择的文件
 */
function handleImageSelect(file) {
  const imageError = document.getElementById('image-error');
  const imagePreview = document.getElementById('image-preview');
  const uploadArea = document.getElementById('upload-area');
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  // 格式校验
  if (!allowedTypes.includes(file.type)) {
    imageError.textContent = '仅支持 JPG、PNG、WebP 格式的图片';
    imageError.classList.add('visible');
    return;
  }

  // 清除之前的错误提示
  imageError.textContent = '';
  imageError.classList.remove('visible');

  // 存储选中的文件
  selectedImageFile = file;

  // 显示图片预览
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.removeAttribute('hidden');

  // 隐藏上传区域的图标和文字
  const uploadIcon = uploadArea.querySelector('.upload-icon');
  const uploadText = uploadArea.querySelector('.upload-text');
  if (uploadIcon) uploadIcon.style.display = 'none';
  if (uploadText) uploadText.style.display = 'none';
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

  // 校验图片（新增时必填，编辑时如果已有图片则可选）
  if (!selectedImageFile && !editId) {
    var imageError = document.getElementById('image-error');
    imageError.textContent = '此项为必填';
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

  return isValid;
}

/**
 * 重置表单到初始状态
 */
function resetForm() {
  // 清空所有输入值
  document.getElementById('product-name').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-sku').value = '';
  document.getElementById('product-quantity').value = '';
  document.getElementById('product-product-sku').value = '';
  document.getElementById('product-remark').value = '';

  // 重置图片预览
  var imagePreview = document.getElementById('image-preview');
  imagePreview.src = '';
  imagePreview.setAttribute('hidden', '');

  // 恢复上传区域的图标和文字
  var uploadArea = document.getElementById('upload-area');
  var uploadIcon = uploadArea.querySelector('.upload-icon');
  var uploadText = uploadArea.querySelector('.upload-text');
  if (uploadIcon) uploadIcon.style.display = '';
  if (uploadText) uploadText.style.display = '';

  // 清除选中的图片文件
  selectedImageFile = null;
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
    return;
  }

  // 获取表单值
  var name = document.getElementById('product-name').value.trim();
  var price = parseFloat(document.getElementById('product-price').value);
  var sku = document.getElementById('product-sku').value.trim();
  var quantity = document.getElementById('product-quantity').value ? parseInt(document.getElementById('product-quantity').value) : 0;
  var productSku = document.getElementById('product-product-sku').value.trim();
  var remark = document.getElementById('product-remark').value.trim();

  // 禁用提交按钮
  submitBtn.disabled = true;

  try {
    // 压缩图片（如需要）
    var blob = await compressImage(selectedImageFile);

    // 生成唯一文件名
    var ext = selectedImageFile.name.split('.').pop();
    var filename = Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.' + ext;

    // 上传图片到 Supabase Storage
    var uploadResult = await supabaseClient.storage
      .from(CONFIG.STORAGE_BUCKET)
      .upload(filename, blob);

    if (uploadResult.error) {
      formMessage.textContent = '图片上传失败，请重试';
      formMessage.classList.add('message-error');
      submitBtn.disabled = false;
      return;
    }

    // 插入商品记录到 Supabase Database
    var insertResult = await supabaseClient
      .from('products')
      .insert({
        name: name,
        price: price,
        sku: sku,
        quantity: quantity,
        product_sku: productSku,
        remark: remark,
        image_url: filename,
        status: 'active'
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
// 商品列表与管理模块（任务 8.1 - 8.4）
// ============================================================

// 当前筛选条件（默认 'all'）
var currentFilter = 'all';

// 编辑模式下保存的原始图片 URL
var currentEditImageUrl = '';

/**
 * 根据图片路径生成 Supabase Storage 公开访问 URL（admin 页面本地版本）
 * @param {string} imagePath - 图片在 Storage 中的路径
 * @returns {string} 完整的公开访问 URL
 */
function getImageUrl(imagePath) {
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
    var query = supabaseClient.from('products').select('*').order('created_at', { ascending: false });

    if (filter === 'active' || filter === 'inactive') {
      query = query.eq('status', filter);
    }

    var result = await query;
    if (result.error) throw result.error;

    var data = result.data;

    if (!data || data.length === 0) {
      tbody.innerHTML = '';
      table.style.display = 'none';
      emptyState.classList.remove('hidden');
      return;
    }

    table.style.display = '';
    emptyState.classList.add('hidden');

    tbody.innerHTML = data.map(function (product) {
      var imageUrl = getImageUrl(product.image_url);
      var price = '¥' + Number(product.price).toFixed(2);
      var qty = product.quantity != null ? product.quantity : 0;
      var sku = product.sku || '-';
      var productSku = product.product_sku || '-';
      var statusText = product.status === 'active' ? '在售' : '已下架';
      var statusClass = 'status-badge ' + product.status;
      var toggleLabel = product.status === 'active' ? '下架' : '上架';
      var toggleStatus = product.status === 'active' ? 'inactive' : 'active';

      return '<tr>' +
        '<td><img src="' + imageUrl + '" class="thumb" width="48" height="48" alt="' + product.name + '"></td>' +
        '<td>' + product.name + '</td>' +
        '<td>' + price + '</td>' +
        '<td>' + qty + '</td>' +
        '<td>' + productSku + '</td>' +
        '<td>' + sku + '</td>' +
        '<td><span class="cell-truncate" data-tip="' + (product.remark || '').replace(/"/g, '&quot;') + '">' + (product.remark || '-') + '</span></td>' +
        '<td><span class="' + statusClass + '">' + statusText + '</span></td>' +
        '<td>' +
          '<button class="btn-link" onclick=\'startEdit(' + JSON.stringify(product).replace(/'/g, "&#39;") + ')\'>编辑</button>' +
          '<button class="btn-link" onclick="toggleProductStatus(\'' + product.id + '\', \'' + toggleStatus + '\')">' + toggleLabel + '</button>' +
          '<button class="btn-link danger" onclick="deleteProduct(\'' + product.id + '\', \'' + product.image_url + '\')">删除</button>' +
        '</td>' +
        '</tr>';
    }).join('');

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
  document.getElementById('product-sku').value = product.sku || '';
  document.getElementById('product-quantity').value = product.quantity != null ? product.quantity : '';
  document.getElementById('product-product-sku').value = product.product_sku || '';
  document.getElementById('product-remark').value = product.remark || '';

  // 设置编辑 ID
  document.getElementById('edit-id').value = product.id;

  // 保存原始图片 URL
  currentEditImageUrl = product.image_url || '';

  // 显示图片预览
  var imagePreview = document.getElementById('image-preview');
  imagePreview.src = getImageUrl(product.image_url);
  imagePreview.removeAttribute('hidden');

  // 隐藏上传区域的图标和文字
  var uploadArea = document.getElementById('upload-area');
  var uploadIcon = uploadArea.querySelector('.upload-icon');
  var uploadText = uploadArea.querySelector('.upload-text');
  if (uploadIcon) uploadIcon.style.display = 'none';
  if (uploadText) uploadText.style.display = 'none';

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
    return;
  }

  // 获取表单值
  var name = document.getElementById('product-name').value.trim();
  var price = parseFloat(document.getElementById('product-price').value);
  var sku = document.getElementById('product-sku').value.trim();
  var quantity = document.getElementById('product-quantity').value ? parseInt(document.getElementById('product-quantity').value) : 0;
  var productSku = document.getElementById('product-product-sku').value.trim();
  var remark = document.getElementById('product-remark').value.trim();

  submitBtn.disabled = true;

  try {
    var imageUrl = currentEditImageUrl;

    // 如果选择了新图片，先上传
    if (selectedImageFile) {
      var blob = await compressImage(selectedImageFile);
      var ext = selectedImageFile.name.split('.').pop();
      var filename = Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.' + ext;

      var uploadResult = await supabaseClient.storage
        .from(CONFIG.STORAGE_BUCKET)
        .upload(filename, blob);

      if (uploadResult.error) {
        formMessage.textContent = '图片上传失败，请重试';
        formMessage.classList.add('message-error');
        submitBtn.disabled = false;
        return;
      }

      imageUrl = filename;
    }

    // 更新商品记录
    var updateResult = await supabaseClient
      .from('products')
      .update({
        name: name,
        price: price,
        sku: sku,
        quantity: quantity,
        product_sku: productSku,
        remark: remark,
        image_url: imageUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', editId);

    if (updateResult.error) {
      formMessage.textContent = '修改失败，请重试';
      formMessage.classList.add('message-error');
      submitBtn.disabled = false;
      return;
    }

    // 修改成功
    formMessage.textContent = '修改成功';
    formMessage.classList.add('message-success');
    resetForm();
    loadProductList(currentFilter);

  } catch (err) {
    formMessage.textContent = '修改失败，请重试';
    formMessage.classList.add('message-error');
  }

  submitBtn.disabled = false;
}

/**
 * 删除商品及其图片
 * @param {string} id - 商品 ID
 * @param {string} imagePath - 图片在 Storage 中的路径
 */
async function deleteProduct(id, imagePath) {
  if (!confirm('确定要删除该商品吗？')) {
    return;
  }

  try {
    var deleteResult = await supabaseClient
      .from('products')
      .delete()
      .eq('id', id);

    if (deleteResult.error) {
      alert('删除失败，请重试');
      return;
    }

    // 删除 Storage 中的图片
    await supabaseClient.storage
      .from(CONFIG.STORAGE_BUCKET)
      .remove([imagePath]);

    // 刷新商品列表
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
var orderPageSize = 20;

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
      allOrders.sort(function (a, b) {
        return a.created_at < b.created_at ? 1 : -1;
      });
    } else {
      var result = await supabaseClient
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (result.error) throw result.error;
      allOrders = result.data || [];
    }

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

  } catch (err) {
    tbody.innerHTML = '';
    table.style.display = 'none';
    pagination.classList.add('hidden');
    emptyState.classList.remove('hidden');
  }
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
    return '<tr>' +
      '<td>' + order.product_name + '</td>' +
      '<td>' + order.buyer_name + '</td>' +
      '<td>' + order.quantity + '</td>' +
      '<td>' + (order.buyer_ip || '-') + '</td>' +
      '<td>' + formatDateTime(order.created_at) + '</td>' +
      '<td><button class="btn-link danger" onclick="deleteOrder(\'' + order.id + '\')">删除</button></td>' +
      '</tr>';
  }).join('');

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
// 导出购买记录为 Excel（CSV 格式）
// ============================================================

/**
 * 导出购买记录为 CSV 文件
 */
async function exportOrders() {
  try {
    var orders = [];

    if (CONFIG.DEMO_MODE) {
      try {
        orders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
      } catch (e) {
        orders = [];
      }
      orders.sort(function (a, b) {
        return a.created_at < b.created_at ? 1 : -1;
      });
    } else {
      var result = await supabaseClient
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (result.error) throw result.error;
      orders = result.data || [];
    }

    if (orders.length === 0) {
      alert('暂无购买记录可导出');
      return;
    }

    // 构建 CSV 内容（带 BOM 头，确保 Excel 正确识别中文）
    var bom = '\uFEFF';
    var header = '商品名称,购买人,数量,IP地址,购买时间\n';
    var rows = orders.map(function (order) {
      return '"' + (order.product_name || '') + '",' +
             '"' + (order.buyer_name || '') + '",' +
             order.quantity + ',' +
             '"' + (order.buyer_ip || '') + '",' +
             '"' + formatDateTime(order.created_at) + '"';
    }).join('\n');

    var csv = bom + header + rows;

    // 创建下载链接
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '购买记录_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('导出失败，请重试');
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
