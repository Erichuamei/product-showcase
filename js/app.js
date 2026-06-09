// 展示页面逻辑

var loadedProducts = [];

/**
 * 根据图片路径生成 Supabase Storage 公开访问 URL
 * @param {string} imagePath - 图片在 Storage 中的路径
 * @returns {string} 完整的公开访问 URL
 */
function getPublicImageUrl(imagePath) {
  if (!imagePath) return '';
  if (/^https?:\/\//i.test(String(imagePath))) {
    return String(imagePath);
  }
  if (CONFIG.DEMO_MODE) {
    // 本地测试模式：从 localStorage 读取 base64 图片
    try {
      var images = JSON.parse(localStorage.getItem('demo_images') || '{}');
      return images[imagePath] || '';
    } catch (e) {
      return '';
    }
  }
  return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/${CONFIG.STORAGE_BUCKET}/${imagePath}`;
}

/**
 * 将商品对象渲染为 HTML 卡片字符串
 * @param {Object} product - 商品对象
 * @returns {string} HTML 卡片字符串
 */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

var PURCHASE_BUYER_NAME_KEY = 'purchase_buyer_name';

function getSavedBuyerName() {
  try {
    return (localStorage.getItem(PURCHASE_BUYER_NAME_KEY) || '').trim();
  } catch (e) {
    return '';
  }
}

function saveBuyerName(name) {
  try {
    if (name) localStorage.setItem(PURCHASE_BUYER_NAME_KEY, name);
  } catch (e) { /* ignore */ }
}

function getReserveButtonLabel(product) {
  if (isProductInStock(product)) return '我很快来拿';
  return '帮我留一件';
}

function getPurchaseSubmitLabel(product) {
  var saved = getSavedBuyerName();
  if (saved) {
    return isProductInStock(product) ? '一键确认来拿' : '一键确认留货';
  }
  return getReserveButtonLabel(product);
}

function renderProductPriceHtml(product) {
  var priceNum = Number(product.price);
  var price = priceNum.toFixed(2);
  var originalNum = product.original_price != null && product.original_price !== ''
    ? Number(product.original_price)
    : NaN;
  if (!isNaN(originalNum) && originalNum > priceNum) {
    return '<span class="product-card-price-original">¥' + originalNum.toFixed(2) + '</span>' +
      '<span class="product-card-price-current">¥' + price + '</span>';
  }
  return '<span class="product-card-price-current">¥' + price + '</span>';
}

function renderProductCard(product) {
  var paths = getProductImagePaths(product);
  var coverPath = paths.length > 0 ? paths[0] : (product.image_url || '');
  var imageUrl = coverPath ? getPublicImageUrl(coverPath) : '';
  var huohao = product.sku || '-';
  var quantity = product.quantity != null ? product.quantity : 0;
  var safeName = escapeHtml(product.name);
  var countBadge = paths.length > 1
    ? '<span class="product-image-count">' + paths.length + ' 张</span>'
    : '';
  var stockBadge = isProductInStock(product)
    ? '<span class="product-in-stock-badge">现货</span>'
    : '';
  var imageBlock = imageUrl
    ? '<div class="product-card-image-wrap" role="button" tabindex="0" title="点击查看大图" onclick="openImageGallery(\'' + product.id + '\', 0)" onkeydown="if(event.key===\'Enter\')openImageGallery(\'' + product.id + '\', 0)">' +
        '<img class="product-card-image" src="' + imageUrl + '" alt="' + safeName + '" loading="lazy">' +
        stockBadge +
        countBadge +
      '</div>'
    : '<div class="product-card-image-wrap product-card-image-wrap--empty">' +
        stockBadge +
        '<span>暂无图片</span>' +
      '</div>';

  var productJson = JSON.stringify(product).replace(/'/g, '&#39;');
  var buyLabel = getReserveButtonLabel(product);
  var buyButton = quantity > 0
    ? '<button class="btn btn-buy" onclick=\'openPurchaseModal(' + productJson + ')\'>' + buyLabel + '</button>'
    : '<button class="btn btn-buy" disabled>暂不可约</button>';
  var cardClass = 'product-card' + (isProductInStock(product) ? ' product-card--in-stock' : '');

  return '<div class="' + cardClass + '">' +
      imageBlock +
      '<div class="product-card-body">' +
        '<div class="product-card-info">' +
          '<div class="product-card-name">' + safeName + '</div>' +
          '<div class="product-card-price">' + renderProductPriceHtml(product) + '</div>' +
          '<div class="product-card-meta"><span>货号：' + escapeHtml(huohao) + '</span></div>' +
          '<div class="product-card-remark"' + (product.remark ? ' title="' + escapeHtml(product.remark) + '"' : '') + '>' +
            (product.remark ? escapeHtml(product.remark) : '') +
          '</div>' +
        '</div>' +
        '<div class="product-card-actions">' + buyButton + '</div>' +
      '</div>' +
    '</div>';
}

/**
 * 从 Supabase 加载在售商品并渲染到页面
 */
async function loadProducts() {
  const grid = document.getElementById('product-grid');
  const emptyState = document.getElementById('empty-state');
  const errorState = document.getElementById('error-state');

  try {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 隐藏错误状态
    errorState.classList.add('hidden');

    if (!data || data.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    loadedProducts = data;
    grid.innerHTML = data.map(renderProductCard).join('');
  } catch (err) {
    grid.innerHTML = '';
    emptyState.classList.add('hidden');
    errorState.classList.remove('hidden');
  }
}

// 页面加载完成后自动加载商品并记录访问
document.addEventListener('DOMContentLoaded', function () {
  loadProducts();
  if (typeof logBrowsePageView === 'function') {
    logBrowsePageView();
  }
});

// ============================================================
// 商品大图浏览
// ============================================================

var galleryPaths = [];
var galleryIndex = 0;
var galleryProductName = '';
var galleryZoomScale = 1;
var GALLERY_ZOOM_MIN = 1;
var GALLERY_ZOOM_MAX = 4;

function resetGalleryZoom() {
  galleryZoomScale = 1;
  applyGalleryZoom();
}

function applyGalleryZoom() {
  var mainImg = document.getElementById('gallery-main-image');
  if (mainImg) {
    mainImg.style.transform = 'scale(' + galleryZoomScale + ')';
  }
}

function isGalleryOpen() {
  var modal = document.getElementById('gallery-modal');
  return modal && !modal.classList.contains('hidden');
}

/**
 * 大图打开时：Ctrl+滚轮只缩放图片，阻止浏览器缩放整页
 */
function handleGalleryWheel(e) {
  if (!isGalleryOpen()) return;
  if (!e.ctrlKey && !e.metaKey) return;

  e.preventDefault();
  var step = e.deltaY > 0 ? -0.12 : 0.12;
  galleryZoomScale = Math.min(
    GALLERY_ZOOM_MAX,
    Math.max(GALLERY_ZOOM_MIN, Math.round((galleryZoomScale + step) * 100) / 100)
  );
  applyGalleryZoom();
}

function findProductById(productId) {
  for (var i = 0; i < loadedProducts.length; i++) {
    if (loadedProducts[i].id === productId) {
      return loadedProducts[i];
    }
  }
  return null;
}

function renderGalleryView() {
  var mainImg = document.getElementById('gallery-main-image');
  var caption = document.getElementById('gallery-caption');
  var thumbs = document.getElementById('gallery-thumbs');
  var prevBtn = document.querySelector('.gallery-prev');
  var nextBtn = document.querySelector('.gallery-next');

  if (!mainImg || galleryPaths.length === 0) return;

  resetGalleryZoom();
  mainImg.src = getPublicImageUrl(galleryPaths[galleryIndex]);
  mainImg.alt = galleryProductName;

  if (caption) {
    caption.textContent = galleryProductName + '（' + (galleryIndex + 1) + ' / ' + galleryPaths.length + '）';
  }

  var showNav = galleryPaths.length > 1;
  if (prevBtn) prevBtn.style.display = showNav ? '' : 'none';
  if (nextBtn) nextBtn.style.display = showNav ? '' : 'none';

  if (thumbs) {
    thumbs.innerHTML = galleryPaths.map(function (path, idx) {
      var active = idx === galleryIndex ? ' gallery-thumb--active' : '';
      return '<button type="button" class="gallery-thumb' + active + '" onclick="galleryGoTo(' + idx + ')">' +
        '<img src="' + getPublicImageUrl(path) + '" alt="">' +
      '</button>';
    }).join('');
    thumbs.style.display = showNav ? 'flex' : 'none';
  }
}

function openImageGallery(productId, startIndex) {
  var product = findProductById(productId);
  if (!product) return;

  galleryPaths = getProductImagePaths(product);
  if (galleryPaths.length === 0) return;

  galleryProductName = product.name || '';
  galleryIndex = startIndex || 0;
  if (galleryIndex < 0) galleryIndex = 0;
  if (galleryIndex >= galleryPaths.length) galleryIndex = galleryPaths.length - 1;

  if (typeof logBrowseProductEvent === 'function') {
    logBrowseProductEvent('view_product', product);
  }

  var modal = document.getElementById('gallery-modal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.classList.add('gallery-open');
    document.body.style.overflow = 'hidden';
  }
  renderGalleryView();
}

function closeImageGallery() {
  var modal = document.getElementById('gallery-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.classList.remove('gallery-open');
    document.body.style.overflow = '';
  }
  resetGalleryZoom();
  galleryPaths = [];
  galleryIndex = 0;
}

function galleryGoTo(index) {
  if (index < 0 || index >= galleryPaths.length) return;
  galleryIndex = index;
  renderGalleryView();
}

function galleryPrev() {
  if (galleryPaths.length <= 1) return;
  galleryIndex = (galleryIndex - 1 + galleryPaths.length) % galleryPaths.length;
  renderGalleryView();
}

function galleryNext() {
  if (galleryPaths.length <= 1) return;
  galleryIndex = (galleryIndex + 1) % galleryPaths.length;
  renderGalleryView();
}

// ============================================================
// 购买模态框逻辑
// ============================================================

// 当前选中的购买商品
var currentPurchaseProduct = null;
var purchaseUseSavedName = false;

function updatePurchaseBuyerUi() {
  var saved = getSavedBuyerName();
  var tip = document.getElementById('purchase-saved-name-tip');
  var display = document.getElementById('purchase-saved-name-display');
  var buyerGroup = document.getElementById('purchase-buyer-group');
  var buyerInput = document.getElementById('purchase-buyer');
  var submitBtn = document.getElementById('purchase-submit-btn');

  purchaseUseSavedName = !!saved;

  if (saved && tip && display && buyerGroup) {
    display.textContent = saved;
    tip.classList.remove('hidden');
    buyerGroup.classList.add('hidden');
    if (buyerInput) buyerInput.value = saved;
  } else if (tip && buyerGroup) {
    tip.classList.add('hidden');
    buyerGroup.classList.remove('hidden');
  }

  if (submitBtn && currentPurchaseProduct) {
    submitBtn.textContent = getPurchaseSubmitLabel(currentPurchaseProduct);
  }
}

function useDifferentBuyerName() {
  purchaseUseSavedName = false;
  var tip = document.getElementById('purchase-saved-name-tip');
  var buyerGroup = document.getElementById('purchase-buyer-group');
  var buyerInput = document.getElementById('purchase-buyer');
  if (tip) tip.classList.add('hidden');
  if (buyerGroup) buyerGroup.classList.remove('hidden');
  if (buyerInput) {
    buyerInput.value = '';
    buyerInput.focus();
  }
  if (currentPurchaseProduct) {
    var submitBtn = document.getElementById('purchase-submit-btn');
    if (submitBtn) submitBtn.textContent = getReserveButtonLabel(currentPurchaseProduct);
  }
}

/**
 * 打开购买模态框
 * @param {Object} product - 商品对象
 */
function openPurchaseModal(product) {
  currentPurchaseProduct = product;

  var modal = document.getElementById('purchase-modal');
  var productName = document.getElementById('modal-product-name');
  var quantityInput = document.getElementById('purchase-quantity');
  var productIdInput = document.getElementById('purchase-product-id');
  var buyerInput = document.getElementById('purchase-buyer');
  var buyerError = document.getElementById('buyer-error');
  var purchaseError = document.getElementById('purchase-error');
  var purchaseMessage = document.getElementById('purchase-message');
  var submitBtn = document.getElementById('purchase-submit-btn');

  productName.textContent = product.name;
  productIdInput.value = product.id;
  quantityInput.value = 1;
  quantityInput.max = product.quantity;

  var remarkInput = document.getElementById('purchase-remark');
  if (remarkInput) remarkInput.value = '';
  buyerError.textContent = '';
  buyerError.classList.remove('visible');
  purchaseError.textContent = '';
  purchaseError.classList.remove('visible');
  purchaseMessage.textContent = '';
  purchaseMessage.classList.remove('visible');
  submitBtn.disabled = false;

  updatePurchaseBuyerUi();
  modal.classList.remove('hidden');
}

/**
 * 关闭购买模态框
 */
function closePurchaseModal() {
  var modal = document.getElementById('purchase-modal');
  var buyerInput = document.getElementById('purchase-buyer');
  var quantityInput = document.getElementById('purchase-quantity');
  var buyerError = document.getElementById('buyer-error');
  var purchaseError = document.getElementById('purchase-error');
  var purchaseMessage = document.getElementById('purchase-message');

  modal.classList.add('hidden');
  currentPurchaseProduct = null;
  purchaseUseSavedName = false;

  buyerInput.value = '';
  quantityInput.value = 1;
  var remarkInputClose = document.getElementById('purchase-remark');
  if (remarkInputClose) remarkInputClose.value = '';
  buyerError.textContent = '';
  buyerError.classList.remove('visible');
  purchaseError.textContent = '';
  purchaseError.classList.remove('visible');
  purchaseMessage.textContent = '';
  purchaseMessage.classList.remove('visible');
}

// 点击遮罩层外部区域关闭模态框
document.addEventListener('DOMContentLoaded', function () {
  var modal = document.getElementById('purchase-modal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closePurchaseModal();
      }
    });
  }

  var galleryModal = document.getElementById('gallery-modal');
  if (galleryModal) {
    galleryModal.addEventListener('click', function (e) {
      if (e.target === galleryModal) {
        closeImageGallery();
      }
    });
    galleryModal.addEventListener('wheel', handleGalleryWheel, { passive: false });
  }

  document.addEventListener('wheel', handleGalleryWheel, { passive: false, capture: true });

  document.addEventListener('keydown', function (e) {
    var galleryEl = document.getElementById('gallery-modal');
    if (!galleryEl || galleryEl.classList.contains('hidden')) return;

    if (e.key === 'Escape') {
      closeImageGallery();
    } else if (e.key === 'ArrowLeft') {
      galleryPrev();
    } else if (e.key === 'ArrowRight') {
      galleryNext();
    }
  });

  // 购买数量输入框 change 事件：限制值在 [1, 库存] 范围内
  var quantityInput = document.getElementById('purchase-quantity');
  if (quantityInput) {
    quantityInput.addEventListener('change', function () {
      if (!currentPurchaseProduct) return;
      var val = parseInt(this.value);
      if (isNaN(val) || val < 1) {
        this.value = 1;
      } else if (val > currentPurchaseProduct.quantity) {
        this.value = currentPurchaseProduct.quantity;
      }
    });
  }
});

/**
 * 提交购买请求
 */
async function submitPurchase() {
  var buyerInput = document.getElementById('purchase-buyer');
  var quantityInput = document.getElementById('purchase-quantity');
  var buyerError = document.getElementById('buyer-error');
  var purchaseError = document.getElementById('purchase-error');
  var purchaseMessage = document.getElementById('purchase-message');
  var submitBtn = document.getElementById('purchase-submit-btn');

  // 清除之前的提示
  buyerError.textContent = '';
  buyerError.classList.remove('visible');
  purchaseError.textContent = '';
  purchaseError.classList.remove('visible');
  purchaseMessage.textContent = '';
  purchaseMessage.classList.remove('visible');

  var buyerName = purchaseUseSavedName ? getSavedBuyerName() : buyerInput.value.trim();
  if (!buyerName && buyerInput) buyerName = buyerInput.value.trim();
  var remarkInput = document.getElementById('purchase-remark');
  var buyerRemark = remarkInput ? remarkInput.value.trim() : '';
  var qty = parseInt(quantityInput.value);
  var submitLabel = currentPurchaseProduct ? getPurchaseSubmitLabel(currentPurchaseProduct) : '帮我留一件';

  if (!buyerName) {
    buyerError.textContent = '请填写预约人姓名';
    buyerError.classList.add('visible');
    return;
  }

  // 禁用按钮，显示处理中
  submitBtn.disabled = true;
  submitBtn.textContent = '处理中...';

  try {
    // 获取购买人 IP（用于防恶意点击）
    var buyerIp = '';
    try {
      var ipRes = await fetch('https://myip.ipip.net/json');
      var ipData = await ipRes.json();
      buyerIp = (ipData.data && ipData.data.ip) || '';
    } catch (e1) {
      try {
        var ipRes2 = await fetch('https://api.ipify.org?format=json');
        var ipData2 = await ipRes2.json();
        buyerIp = ipData2.ip || '';
      } catch (e2) {
        buyerIp = 'unknown';
      }
    }

    var result = await supabaseClient.rpc('purchase_product', {
      p_product_id: currentPurchaseProduct.id,
      p_quantity: qty,
      p_buyer_name: buyerName,
      p_buyer_ip: buyerIp,
      p_buyer_remark: buyerRemark
    });

    if (result.error) {
      var errMsg = result.error.message || '';
      if (errMsg.indexOf('insufficient_stock') !== -1) {
        purchaseError.textContent = '可预约数量不足，请减少数量';
      } else {
        purchaseError.textContent = '预约失败，请重试';
      }
      purchaseError.classList.add('visible');
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
      return;
    }

    saveBuyerName(buyerName);
    purchaseMessage.textContent = '预约成功';
    purchaseMessage.classList.add('visible');

    setTimeout(function () {
      closePurchaseModal();
      loadProducts();
    }, 2000);

  } catch (err) {
    purchaseError.textContent = '预约失败，请重试';
    purchaseError.classList.add('visible');
    submitBtn.disabled = false;
    submitBtn.textContent = submitLabel;
  }
}
