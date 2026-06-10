// 前台浏览记录 — 展示页写入、管理后台读取

var BROWSE_EVENT_LABELS = {
  page_view: '打开页面',
  view_product: '查看大图'
};

function getBrowseEventLabel(eventType) {
  return BROWSE_EVENT_LABELS[eventType] || eventType || '-';
}

var BROWSE_BUYER_NAME_KEY = 'purchase_buyer_name';

function getBrowseBuyerName() {
  if (typeof getSavedBuyerName === 'function') {
    return getSavedBuyerName();
  }
  try {
    return (localStorage.getItem(BROWSE_BUYER_NAME_KEY) || '').trim();
  } catch (e) {
    return '';
  }
}

function getBrowseSessionId() {
  var key = 'browse_session_id';
  try {
    var existing = localStorage.getItem(key);
    if (existing) return existing;
    var id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
    localStorage.setItem(key, id);
    return id;
  } catch (e) {
    return 'unknown';
  }
}

function getDemoBrowseLogs() {
  try {
    return JSON.parse(localStorage.getItem('demo_browse_logs') || '[]');
  } catch (e) {
    return [];
  }
}

function saveDemoBrowseLogs(logs) {
  localStorage.setItem('demo_browse_logs', JSON.stringify(logs));
}

var cachedVisitorIp = '';
var cachedVisitorIpAt = 0;
var visitorIpFetchPromise = null;
var VISITOR_IP_CACHE_MS = 5 * 60 * 1000;
var VISITOR_IP_TIMEOUT_MS = 2500;

async function fetchVisitorIpFromNetwork() {
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, VISITOR_IP_TIMEOUT_MS) : null;
  try {
    var ipRes = await fetch('https://myip.ipip.net/json', controller ? { signal: controller.signal } : undefined);
    var ipData = await ipRes.json();
    var ip = (ipData.data && ipData.data.ip) || '';
    if (ip) return ip;
  } catch (e1) { /* try fallback */ }
  finally {
    if (timer) clearTimeout(timer);
  }

  controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  timer = controller ? setTimeout(function () { controller.abort(); }, VISITOR_IP_TIMEOUT_MS) : null;
  try {
    var ipRes2 = await fetch('https://api.ipify.org?format=json', controller ? { signal: controller.signal } : undefined);
    var ipData2 = await ipRes2.json();
    return ipData2.ip || '';
  } catch (e2) {
    return '';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchVisitorIp() {
  if (cachedVisitorIp && (Date.now() - cachedVisitorIpAt) < VISITOR_IP_CACHE_MS) {
    return cachedVisitorIp;
  }
  if (!visitorIpFetchPromise) {
    visitorIpFetchPromise = fetchVisitorIpFromNetwork().then(function (ip) {
      cachedVisitorIp = ip || '';
      cachedVisitorIpAt = Date.now();
      visitorIpFetchPromise = null;
      return cachedVisitorIp;
    }).catch(function () {
      visitorIpFetchPromise = null;
      return '';
    });
  }
  return visitorIpFetchPromise;
}

/**
 * 记录前台浏览行为（静默失败，不阻塞用户操作）
 */
function logBrowseEvent(options) {
  options = options || {};
  var record = {
    event_type: options.eventType || 'page_view',
    page: options.page || 'index',
    product_id: options.productId || null,
    product_name: options.productName || '',
    product_sku: options.productSku || '',
    session_id: getBrowseSessionId(),
    visitor_ip: options.visitorIp || '',
    user_agent: navigator.userAgent || '',
    buyer_name: getBrowseBuyerName(),
    created_at: new Date().toISOString()
  };

  if (CONFIG.DEMO_MODE) {
    record.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
    var logs = getDemoBrowseLogs();
    logs.unshift(record);
    if (logs.length > 5000) logs.length = 5000;
    saveDemoBrowseLogs(logs);
    return Promise.resolve();
  }

  return supabaseClient.from('browse_logs').insert({
    event_type: record.event_type,
    page: record.page,
    product_id: record.product_id,
    product_name: record.product_name,
    product_sku: record.product_sku,
    session_id: record.session_id,
    visitor_ip: record.visitor_ip,
    user_agent: record.user_agent,
    buyer_name: record.buyer_name || ''
  }).then(function () {}).catch(function () {});
}

function logBrowsePageView() {
  fetchVisitorIp().then(function (ip) {
    logBrowseEvent({ eventType: 'page_view', visitorIp: ip });
  }).catch(function () {
    logBrowseEvent({ eventType: 'page_view' });
  });
}

function logBrowseProductEvent(eventType, product) {
  if (!product) return;
  fetchVisitorIp().then(function (ip) {
    logBrowseEvent({
      eventType: eventType,
      productId: product.id,
      productName: product.name || '',
      productSku: product.sku || '',
      visitorIp: ip
    });
  }).catch(function () {
    logBrowseEvent({
      eventType: eventType,
      productId: product.id,
      productName: product.name || '',
      productSku: product.sku || ''
    });
  });
}
