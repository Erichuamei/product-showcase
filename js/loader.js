// 按顺序加载 Supabase CDN（正式模式）及业务脚本，避免 document.write 触发浏览器警告
(function () {
  var appScript = (document.currentScript && document.currentScript.getAttribute('data-app')) || 'app.js';
  var version = (typeof CONFIG !== 'undefined' && CONFIG.ASSET_VERSION) ? CONFIG.ASSET_VERSION : '';

  function withVersion(src) {
    return version ? src + '?v=' + encodeURIComponent(version) : src;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = function () {
        reject(new Error('脚本加载失败: ' + src));
      };
      document.head.appendChild(el);
    });
  }

  var chain = CONFIG.DEMO_MODE
    ? Promise.resolve()
    : loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');

  chain
    .then(function () {
      return loadScript(withVersion('js/supabase.js'));
    })
    .then(function () {
      return loadScript(withVersion('js/' + appScript));
    })
    .catch(function (err) {
      console.error(err);
      alert('页面脚本加载失败，请检查网络后刷新重试');
    });
})();
