// 展示页面逻辑

/**
 * 根据图片路径生成 Supabase Storage 公开访问 URL
 * @param {string} imagePath - 图片在 Storage 中的路径
 * @returns {string} 完整的公开访问 URL
 */
function getPublicImageUrl(imagePath) {
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
function renderProductCard(product) {
  const imageUrl = getPublicImageUrl(product.image_url);
  const price = Number(product.price).toFixed(2);
  const sku = product.sku || '-';
  const productSku = product.product_sku || '-';
  const quantity = product.quantity != null ? product.quantity : 0;

  const productJson = JSON.stringify(product).replace(/'/g, "&#39;");
  const buyButton = quantity > 0
    ? `<button class="btn btn-buy" onclick='openPurchaseModal(${productJson})'>我要买</button>`
    : `<button class="btn btn-buy" disabled>已售罄</button>`;

  return `<div class="product-card">
      <img class="product-card-image" src="${imageUrl}" alt="${product.name}" loading="lazy">
      <div class="product-card-body">
        <div class="product-card-name">${product.name}</div>
        <div class="product-card-price">${price}</div>
        <div class="product-card-meta">
          <span>SKU：${productSku}</span>
          <span>库存：${quantity}</span>
        </div>
        ${product.remark ? `<div class="product-card-remark" title="${product.remark}">备注：${product.remark}</div>` : `<div class="product-card-remark">备注：</div>`}
        ${buyButton}
      </div>
    </div>`;
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
    grid.innerHTML = data.map(renderProductCard).join('');
  } catch (err) {
    grid.innerHTML = '';
    emptyState.classList.add('hidden');
    errorState.classList.remove('hidden');
  }
}

// 页面加载完成后自动加载商品
document.addEventListener('DOMContentLoaded', loadProducts);

// ============================================================
// 购买模态框逻辑
// ============================================================

// 当前选中的购买商品
var currentPurchaseProduct = null;

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

  // 填充商品信息
  productName.textContent = product.name;
  productIdInput.value = product.id;

  // 设置数量输入框
  quantityInput.value = 1;
  quantityInput.max = product.quantity;

  // 清空表单
  buyerInput.value = '';
  buyerError.textContent = '';
  buyerError.classList.remove('visible');
  purchaseError.textContent = '';
  purchaseError.classList.remove('visible');
  purchaseMessage.textContent = '';
  purchaseMessage.classList.remove('visible');
  submitBtn.disabled = false;
  submitBtn.textContent = '确认购买';

  // 显示模态框
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

  // 清空表单
  buyerInput.value = '';
  quantityInput.value = 1;
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

  var buyerName = buyerInput.value.trim();
  var qty = parseInt(quantityInput.value);

  // 校验购买人姓名
  if (!buyerName) {
    buyerError.textContent = '请填写购买人姓名';
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
      p_buyer_ip: buyerIp
    });

    if (result.error) {
      var errMsg = result.error.message || '';
      if (errMsg.indexOf('insufficient_stock') !== -1) {
        purchaseError.textContent = '库存不足，请减少购买数量';
      } else {
        purchaseError.textContent = '购买失败，请重试';
      }
      purchaseError.classList.add('visible');
      submitBtn.disabled = false;
      submitBtn.textContent = '确认购买';
      return;
    }

    // 购买成功
    purchaseMessage.textContent = '购买成功';
    purchaseMessage.classList.add('visible');

    setTimeout(function () {
      closePurchaseModal();
      loadProducts();
    }, 2000);

  } catch (err) {
    purchaseError.textContent = '购买失败，请重试';
    purchaseError.classList.add('visible');
    submitBtn.disabled = false;
    submitBtn.textContent = '确认购买';
  }
}
