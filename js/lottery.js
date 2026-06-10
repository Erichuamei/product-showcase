// 内购抽奖 — 仅 Windows、每台设备一次、中奖率约 20%

var LOTTERY_WIN_RATE_TEXT = '5 次约中 1 次';
var LOTTERY_CONSOLATION_COUPON = '满5减0.5';
var currentLotteryDrawId = null;
var currentLotteryVisitorIp = '';
var currentLotterySessionId = '';
var lotteryPrizesSoldOut = false;
var lotteryUserAlreadyDrawn = false;
var lotteryWindowsBlocked = false;
var lotteryNotEnabled = false;

function getLotterySessionId() {
  if (typeof getBrowseSessionId === 'function') {
    return getBrowseSessionId();
  }
  return '';
}

function isWindowsDevice() {
  var ua = navigator.userAgent || '';
  var platform = navigator.platform || '';
  return /Windows/i.test(ua) || /Win/i.test(platform);
}

async function fetchLotteryVisitorIp() {
  if (typeof fetchVisitorIp === 'function') {
    return fetchVisitorIp();
  }
  return '';
}

function formatLotteryDate(iso) {
  if (!iso) return '-';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  var h = String(d.getHours()).padStart(2, '0');
  var min = String(d.getMinutes()).padStart(2, '0');
  return y + '-' + m + '-' + day + ' ' + h + ':' + min;
}

function getLotteryErrorMessage(err) {
  var msg = (err && err.message) ? err.message : String(err || '');
  if (msg.indexOf('windows_only') !== -1) return '抽奖仅限 Windows 电脑参与';
  if (msg.indexOf('already_drawn') !== -1) return '本设备已参与过抽奖，每人仅限 1 次';
  if (msg.indexOf('session_required') !== -1) return '无法识别本设备，请关闭隐私/无痕模式后重试';
  if (msg.indexOf('ip_required') !== -1) return '无法获取网络信息，请稍后重试';
  if (msg.indexOf('name_required') !== -1) return '请填写姓名';
  if (msg.indexOf('name_already_set') !== -1) return '姓名已登记';
  if (msg.indexOf('lottery_closed') !== -1) return '抽奖活动暂未开启';
  return '操作失败，请稍后重试';
}

async function loadLotterySettings() {
  try {
    if (CONFIG.DEMO_MODE) {
      var demoSettings = getDemoLotterySettings();
      lotteryNotEnabled = !demoSettings.enabled;
      return demoSettings;
    }
    var result = await supabaseClient
      .from('lottery_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (result.error) throw result.error;
    lotteryNotEnabled = !(result.data && result.data.enabled);
    return result.data || { enabled: false };
  } catch (e) {
    lotteryNotEnabled = true;
    return { enabled: false };
  }
}

function updateLotteryDrawButton() {
  var drawBtn = document.getElementById('lottery-draw-btn');
  if (!drawBtn) return;

  if (lotteryWindowsBlocked) {
    drawBtn.disabled = true;
    drawBtn.textContent = '仅限 Windows 参与';
    drawBtn.classList.remove('btn-lottery--soldout');
    return;
  }

  if (lotteryNotEnabled) {
    drawBtn.disabled = true;
    drawBtn.textContent = '抽奖未开启';
    drawBtn.classList.add('btn-lottery--soldout');
    return;
  }

  if (lotteryUserAlreadyDrawn) {
    drawBtn.disabled = true;
    if (drawBtn.textContent !== '抽奖中…') {
      drawBtn.textContent = '您已抽过奖';
    }
    drawBtn.classList.remove('btn-lottery--soldout');
    return;
  }

  if (lotteryPrizesSoldOut) {
    drawBtn.disabled = true;
    drawBtn.textContent = '奖品已抽完';
    drawBtn.classList.add('btn-lottery--soldout');
    return;
  }

  drawBtn.disabled = false;
  drawBtn.textContent = '立即抽奖';
  drawBtn.classList.remove('btn-lottery--soldout');
}

async function loadLotteryPrizeStock() {
  var el = document.getElementById('lottery-prize-stock');
  if (!el) return;

  try {
    var prizes;
    if (CONFIG.DEMO_MODE) {
      prizes = getDemoLotteryPrizes();
    } else {
      var result = await supabaseClient
        .from('lottery_prizes')
        .select('*')
        .order('sort_order', { ascending: true });
      if (result.error) throw result.error;
      prizes = result.data || [];
    }

    if (!prizes.length) {
      el.innerHTML = '<span class="lottery-stock-empty">暂无奖品配置</span>';
      lotteryPrizesSoldOut = true;
      updateLotteryDrawButton();
      return;
    }

    var totalRemaining = 0;
    el.innerHTML = prizes.map(function (p) {
      totalRemaining += Number(p.remaining_quota) || 0;
      var soldOut = (p.remaining_quota || 0) <= 0;
      return '<span class="lottery-prize-chip' + (soldOut ? ' lottery-prize-chip--soldout' : '') + '">' +
        p.label + '：' + escapeLotteryHtml(p.description) +
        '（剩余 ' + (p.remaining_quota || 0) + '/' + (p.total_quota || 0) + '）' +
      '</span>';
    }).join('');

    lotteryPrizesSoldOut = totalRemaining <= 0;
    updateLotteryDrawButton();
  } catch (e) {
    el.innerHTML = '<span class="lottery-stock-empty">奖品信息加载失败</span>';
  }
}

async function loadLotteryWinnersPublic() {
  var list = document.getElementById('lottery-winners-list');
  var empty = document.getElementById('lottery-winners-empty');
  if (!list) return;

  try {
    var rows;
    if (CONFIG.DEMO_MODE) {
      rows = getDemoLotteryDraws().filter(function (d) {
        return d.won && d.winner_name;
      });
    } else {
      var result = await supabaseClient
        .from('lottery_draws')
        .select('winner_name,prize_label,prize_description,created_at')
        .eq('won', true)
        .neq('winner_name', '')
        .order('created_at', { ascending: false })
        .limit(50);
      if (result.error) throw result.error;
      rows = result.data || [];
    }

    if (!rows.length) {
      list.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');
    list.innerHTML = rows.map(function (row) {
      var prizeText = (row.prize_label || '') + ' · ' + (row.prize_description || '');
      return '<div class="lottery-winner-item">' +
        '<span class="lottery-winner-name">' + escapeLotteryHtml(row.winner_name) + '</span>' +
        '<span class="lottery-winner-prize">' + escapeLotteryHtml(prizeText) + '</span>' +
        '<span class="lottery-winner-time">' + formatLotteryDate(row.created_at) + '</span>' +
      '</div>';
    }).join('');
  } catch (e) {
    list.innerHTML = '';
    if (empty) {
      empty.textContent = '中奖名单加载失败';
      empty.classList.remove('hidden');
    }
  }
}

async function checkLotteryAlreadyDrawn(sessionId) {
  if (!sessionId) return null;
  try {
    if (CONFIG.DEMO_MODE) {
      return getDemoLotteryDraws().find(function (d) { return d.session_id === sessionId; }) || null;
    }
    var result = await supabaseClient
      .from('lottery_draws')
      .select('id,won,prize_label,prize_description,consolation_coupon,winner_name')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  } catch (e) {
    return null;
  }
}

function applyExistingLotteryDraw(existing, statusMsg) {
  if (!existing) return;
  lotteryUserAlreadyDrawn = true;
  updateLotteryDrawButton();
  if (statusMsg) {
    if (existing.won) {
      statusMsg.textContent = '您已中奖：' + (existing.prize_label || '') + ' ' + (existing.prize_description || '');
    } else if (existing.consolation_coupon) {
      statusMsg.textContent = '您已获得安慰券：' + existing.consolation_coupon + (existing.winner_name ? '' : '，请登记姓名');
    } else {
      statusMsg.textContent = '感谢您的参与，本设备已使用过抽奖机会';
    }
  }
  if (existing.won && !existing.winner_name) {
    currentLotteryDrawId = existing.id;
    openLotteryWinModal(existing.prize_label, existing.prize_description);
  } else if (!existing.won && existing.consolation_coupon && !existing.winner_name) {
    currentLotteryDrawId = existing.id;
    openLotteryLoseModal(existing.consolation_coupon);
  }
}

async function initLotterySection() {
  if (!document.getElementById('lottery-section')) return;

  var drawBtn = document.getElementById('lottery-draw-btn');
  var statusMsg = document.getElementById('lottery-status-msg');

  await loadLotterySettings();

  if (lotteryNotEnabled) {
    updateLotteryDrawButton();
    if (statusMsg) statusMsg.textContent = '抽奖活动暂未开启，请稍后再试';
    return;
  }

  if (!isWindowsDevice()) {
    lotteryWindowsBlocked = true;
    updateLotteryDrawButton();
    if (statusMsg) statusMsg.textContent = '请使用 Windows 电脑打开本页面参与抽奖';
    await Promise.all([loadLotteryPrizeStock(), loadLotteryWinnersPublic()]);
    return;
  }

  currentLotterySessionId = getLotterySessionId();
  var existing = await checkLotteryAlreadyDrawn(currentLotterySessionId);
  applyExistingLotteryDraw(existing, statusMsg);

  await Promise.all([loadLotteryPrizeStock(), loadLotteryWinnersPublic()]);

  if (lotteryPrizesSoldOut && !lotteryUserAlreadyDrawn && statusMsg) {
    statusMsg.textContent = '奖品已全部分完，抽奖已结束';
  }

  fetchLotteryVisitorIp().then(function (ip) {
    currentLotteryVisitorIp = ip || '';
  });
}

async function performLotteryDraw() {
  var drawBtn = document.getElementById('lottery-draw-btn');
  var statusMsg = document.getElementById('lottery-status-msg');

  if (!isWindowsDevice()) {
    alert('抽奖仅限 Windows 电脑参与');
    return;
  }

  if (!currentLotterySessionId) {
    currentLotterySessionId = getLotterySessionId();
  }
  if (!currentLotterySessionId || currentLotterySessionId === 'unknown') {
    alert('无法识别本设备，请关闭隐私/无痕模式后重试');
    return;
  }

  if (!currentLotteryVisitorIp) {
    currentLotteryVisitorIp = await fetchLotteryVisitorIp();
  }

  var existing = await checkLotteryAlreadyDrawn(currentLotterySessionId);
  if (existing) {
    alert('本设备已参与过抽奖，每人仅限 1 次');
    return;
  }

  if (lotteryNotEnabled || lotteryPrizesSoldOut) {
    updateLotteryDrawButton();
    return;
  }

  if (drawBtn) {
    drawBtn.disabled = true;
    drawBtn.textContent = '抽奖中…';
  }

  try {
    var result;
    if (CONFIG.DEMO_MODE) {
      try {
        result = { data: demoPerformLotteryDraw(currentLotteryVisitorIp, navigator.userAgent, currentLotterySessionId), error: null };
      } catch (demoErr) {
        result = { data: null, error: demoErr };
      }
    } else {
      result = await supabaseClient.rpc('perform_lottery_draw', {
        p_visitor_ip: currentLotteryVisitorIp,
        p_user_agent: navigator.userAgent || '',
        p_session_id: currentLotterySessionId
      });
    }

    if (result.error) {
      throw result.error;
    }

    var draw = result.data;
    if (typeof draw === 'string') {
      try { draw = JSON.parse(draw); } catch (e) { /* keep */ }
    }

    lotteryUserAlreadyDrawn = true;
    updateLotteryDrawButton();

    await loadLotteryPrizeStock();

    if (draw && draw.won) {
      currentLotteryDrawId = draw.id;
      if (statusMsg) {
        statusMsg.textContent = '恭喜中奖！请填写姓名完成登记';
      }
      openLotteryWinModal(draw.prize_label, draw.prize_description);
    } else {
      currentLotteryDrawId = draw.id;
      var coupon = draw.consolation_coupon || LOTTERY_CONSOLATION_COUPON;
      if (statusMsg) statusMsg.textContent = '送您一张 ' + coupon + ' 优惠券，请登记姓名';
      openLotteryLoseModal(coupon);
    }
  } catch (err) {
    updateLotteryDrawButton();
    alert(getLotteryErrorMessage(err));
  }
}

function openLotteryWinModal(prizeLabel, prizeDescription) {
  var modal = document.getElementById('lottery-win-modal');
  var prizeEl = document.getElementById('lottery-win-prize-text');
  var nameInput = document.getElementById('lottery-winner-name');
  var errEl = document.getElementById('lottery-winner-error');
  if (prizeEl) {
    prizeEl.textContent = (prizeLabel || '') + '：' + (prizeDescription || '');
  }
  if (nameInput) {
    var saved = typeof getSavedBuyerName === 'function' ? getSavedBuyerName() : '';
    nameInput.value = saved || '';
  }
  if (errEl) errEl.textContent = '';
  if (modal) modal.classList.remove('hidden');
}

function closeLotteryWinModal() {
  var modal = document.getElementById('lottery-win-modal');
  if (modal) modal.classList.add('hidden');
}

function openLotteryLoseModal(coupon) {
  var modal = document.getElementById('lottery-lose-modal');
  var couponEl = document.getElementById('lottery-consolation-text');
  var nameInput = document.getElementById('lottery-lose-name');
  var errEl = document.getElementById('lottery-lose-error');
  if (couponEl) couponEl.textContent = coupon || LOTTERY_CONSOLATION_COUPON;
  if (nameInput) {
    var saved = typeof getSavedBuyerName === 'function' ? getSavedBuyerName() : '';
    nameInput.value = saved || '';
  }
  if (errEl) errEl.textContent = '';
  if (modal) modal.classList.remove('hidden');
}

function closeLotteryLoseModal() {
  var modal = document.getElementById('lottery-lose-modal');
  if (modal) modal.classList.add('hidden');
}

async function submitLotteryLoseRegistration() {
  var nameInput = document.getElementById('lottery-lose-name');
  var errEl = document.getElementById('lottery-lose-error');
  var submitBtn = document.getElementById('lottery-lose-submit-btn');
  var winnerName = nameInput ? nameInput.value.trim() : '';

  if (!winnerName) {
    if (errEl) errEl.textContent = '请填写姓名';
    return;
  }
  if (!currentLotteryDrawId || !currentLotterySessionId) {
    if (errEl) errEl.textContent = '抽奖记录无效，请刷新页面';
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中…';
  }

  try {
    var result;
    if (CONFIG.DEMO_MODE) {
      try {
        result = { data: demoSubmitLotteryWinnerName(currentLotteryDrawId, currentLotterySessionId, winnerName), error: null };
      } catch (demoErr) {
        result = { data: null, error: demoErr };
      }
    } else {
      result = await supabaseClient.rpc('submit_lottery_winner_name', {
        p_draw_id: currentLotteryDrawId,
        p_session_id: currentLotterySessionId,
        p_winner_name: winnerName
      });
    }

    if (result.error) throw result.error;

    if (typeof saveBuyerName === 'function') {
      saveBuyerName(winnerName);
    }

    closeLotteryLoseModal();
    await loadLotteryWinnersPublic();

    var statusMsg = document.getElementById('lottery-status-msg');
    if (statusMsg) statusMsg.textContent = '优惠券登记成功！请到 19 楼找王一凡领取';

    alert('优惠券已登记，请到 19 楼找王一凡领取');
  } catch (err) {
    if (errEl) errEl.textContent = getLotteryErrorMessage(err);
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = '确认登记优惠券';
  }
}

async function submitLotteryWinnerName() {
  var nameInput = document.getElementById('lottery-winner-name');
  var errEl = document.getElementById('lottery-winner-error');
  var submitBtn = document.getElementById('lottery-winner-submit-btn');
  var winnerName = nameInput ? nameInput.value.trim() : '';

  if (!winnerName) {
    if (errEl) errEl.textContent = '请填写姓名';
    return;
  }
  if (!currentLotteryDrawId || !currentLotterySessionId) {
    if (errEl) errEl.textContent = '抽奖记录无效，请刷新页面';
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中…';
  }

  try {
    var result;
    if (CONFIG.DEMO_MODE) {
      try {
        result = { data: demoSubmitLotteryWinnerName(currentLotteryDrawId, currentLotterySessionId, winnerName), error: null };
      } catch (demoErr) {
        result = { data: null, error: demoErr };
      }
    } else {
      result = await supabaseClient.rpc('submit_lottery_winner_name', {
        p_draw_id: currentLotteryDrawId,
        p_session_id: currentLotterySessionId,
        p_winner_name: winnerName
      });
    }

    if (result.error) throw result.error;

    if (typeof saveBuyerName === 'function') {
      saveBuyerName(winnerName);
    }

    closeLotteryWinModal();
    await loadLotteryWinnersPublic();

    var statusMsg = document.getElementById('lottery-status-msg');
    if (statusMsg) statusMsg.textContent = '登记成功！请到 19 楼找王一凡领取奖品';

    alert('恭喜！姓名已登记，请到 19 楼找王一凡领取奖品');
  } catch (err) {
    if (errEl) errEl.textContent = getLotteryErrorMessage(err);
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = '确认登记';
  }
}

// ---------- DEMO 模式 ----------

function getDemoLotterySettings() {
  try {
    var stored = localStorage.getItem('demo_lottery_settings');
    if (stored) return JSON.parse(stored);
  } catch (e) { /* ignore */ }
  return { enabled: true };
}

function saveDemoLotterySettings(settings) {
  localStorage.setItem('demo_lottery_settings', JSON.stringify(settings));
}

function getDemoLotteryPrizes() {
  try {
    var stored = localStorage.getItem('demo_lottery_prizes');
    if (stored) return JSON.parse(stored);
  } catch (e) { /* ignore */ }
  return [
    { tier: 'special', label: '特等奖', description: '猫咪置物架', total_quota: 1, remaining_quota: 1, sort_order: 1 },
    { tier: 'first', label: '一等奖', description: '满20减5', total_quota: 3, remaining_quota: 3, sort_order: 2 },
    { tier: 'second', label: '二等奖', description: '满15减2', total_quota: 6, remaining_quota: 6, sort_order: 3 },
    { tier: 'third', label: '三等奖', description: '满10减1', total_quota: 10, remaining_quota: 10, sort_order: 4 }
  ];
}

function saveDemoLotteryPrizes(prizes) {
  localStorage.setItem('demo_lottery_prizes', JSON.stringify(prizes));
}

function getDemoLotteryDraws() {
  try {
    return JSON.parse(localStorage.getItem('demo_lottery_draws') || '[]');
  } catch (e) {
    return [];
  }
}

function saveDemoLotteryDraws(draws) {
  localStorage.setItem('demo_lottery_draws', JSON.stringify(draws));
}

function escapeLotteryHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function demoPerformLotteryDraw(ip, ua, sessionId) {
  if (!getDemoLotterySettings().enabled) {
    throw { message: 'lottery_closed' };
  }
  if (!/Windows/i.test(ua || '')) {
    throw { message: 'windows_only' };
  }
  var draws = getDemoLotteryDraws();
  if (!sessionId || sessionId === 'unknown') {
    throw { message: 'session_required' };
  }
  if (draws.some(function (d) { return d.session_id === sessionId; })) {
    throw { message: 'already_drawn' };
  }

  var prizes = getDemoLotteryPrizes();
  var totalRemaining = prizes.reduce(function (sum, p) { return sum + (p.remaining_quota || 0); }, 0);
  var won = totalRemaining > 0 && Math.random() < 0.2;
  var draw = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
    visitor_ip: ip,
    user_agent: ua || '',
    session_id: sessionId || '',
    won: false,
    prize_tier: null,
    prize_label: null,
    prize_description: null,
    consolation_coupon: '',
    winner_name: '',
    created_at: new Date().toISOString()
  };

  if (won) {
    var pick = Math.floor(Math.random() * totalRemaining);
    var offset = 0;
    for (var i = 0; i < prizes.length; i++) {
      var p = prizes[i];
      if (p.remaining_quota <= 0) continue;
      if (pick < offset + p.remaining_quota) {
        p.remaining_quota--;
        draw.won = true;
        draw.prize_tier = p.tier;
        draw.prize_label = p.label;
        draw.prize_description = p.description;
        break;
      }
      offset += p.remaining_quota;
    }
    saveDemoLotteryPrizes(prizes);
  } else {
    draw.consolation_coupon = LOTTERY_CONSOLATION_COUPON;
  }

  draws.push(draw);
  saveDemoLotteryDraws(draws);
  return draw;
}

document.addEventListener('DOMContentLoaded', function () {
  if (!document.getElementById('lottery-section')) return;
  var startLottery = function () { initLotterySection(); };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(startLottery, { timeout: 1500 });
  } else {
    setTimeout(startLottery, 200);
  }
});

function demoSubmitLotteryWinnerName(drawId, sessionId, name) {
  var draws = getDemoLotteryDraws();
  var idx = draws.findIndex(function (d) { return d.id === drawId && d.session_id === sessionId; });
  if (idx < 0) throw { message: 'draw_not_found' };
  if (!draws[idx].won && !draws[idx].consolation_coupon) throw { message: 'not_winner' };
  if (draws[idx].winner_name) throw { message: 'name_already_set' };
  draws[idx].winner_name = name.trim();
  saveDemoLotteryDraws(draws);
  return draws[idx];
}
