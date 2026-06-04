// 商品多图工具 — 展示页与管理后台共用

/**
 * 解析商品的图片路径列表（兼容旧字段 image_url）
 * @param {Object} product
 * @returns {string[]}
 */
function getProductImagePaths(product) {
  if (!product) return [];

  var urls = product.image_urls;
  if (Array.isArray(urls)) {
    return urls.filter(function (p) { return p && String(p).trim(); });
  }
  if (typeof urls === 'string' && urls.trim()) {
    try {
      var parsed = JSON.parse(urls);
      if (Array.isArray(parsed)) {
        return parsed.filter(function (p) { return p && String(p).trim(); });
      }
    } catch (e) { /* 非 JSON 则忽略 */ }
  }
  if (product.image_url && String(product.image_url).trim()) {
    return [String(product.image_url).trim()];
  }
  return [];
}

/**
 * 封面图路径（列表主图，取第一张）
 */
function getProductCoverPath(product) {
  var paths = getProductImagePaths(product);
  return paths.length > 0 ? paths[0] : '';
}

/**
 * 是否标记为现货
 */
function isProductInStock(product) {
  return !!(product && (product.in_stock === true || product.in_stock === 'true'));
}
