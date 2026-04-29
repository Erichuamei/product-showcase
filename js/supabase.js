// Supabase 客户端初始化
// DEMO_MODE 时使用 localStorage 模拟，正式部署时使用真实 Supabase

let supabaseClient;

if (CONFIG.DEMO_MODE) {
  // ============================================================
  // 本地模拟模式 — 用 localStorage 模拟 Supabase API
  // ============================================================

  // 从 localStorage 读取商品数据
  function _getProducts() {
    try {
      return JSON.parse(localStorage.getItem('demo_products') || '[]');
    } catch (e) {
      return [];
    }
  }

  // 保存商品数据到 localStorage
  function _saveProducts(products) {
    localStorage.setItem('demo_products', JSON.stringify(products));
  }

  // 从 localStorage 读取图片数据（base64）
  function _getImages() {
    try {
      return JSON.parse(localStorage.getItem('demo_images') || '{}');
    } catch (e) {
      return {};
    }
  }

  function _saveImages(images) {
    localStorage.setItem('demo_images', JSON.stringify(images));
  }

  // 模拟 Supabase 查询构建器
  function createQueryBuilder(table) {
    var _filters = [];
    var _orderCol = null;
    var _orderAsc = true;
    var _selectCols = '*';

    var builder = {
      select: function (cols) { _selectCols = cols; return builder; },
      eq: function (col, val) { _filters.push({ col: col, val: val }); return builder; },
      order: function (col, opts) { _orderCol = col; _orderAsc = opts ? opts.ascending : true; return builder; },

      // 终结方法 — 执行查询并返回 Promise
      then: function (resolve, reject) {
        var data = _getProducts();

        // 应用筛选
        _filters.forEach(function (f) {
          data = data.filter(function (item) { return item[f.col] === f.val; });
        });

        // 应用排序
        if (_orderCol) {
          data.sort(function (a, b) {
            if (_orderAsc) return a[_orderCol] > b[_orderCol] ? 1 : -1;
            return a[_orderCol] < b[_orderCol] ? 1 : -1;
          });
        }

        resolve({ data: data, error: null });
      },

      // insert
      insert: function (record) {
        return new Promise(function (resolve) {
          var products = _getProducts();
          record.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
          record.created_at = new Date().toISOString();
          record.updated_at = new Date().toISOString();
          products.push(record);
          _saveProducts(products);
          resolve({ data: record, error: null });
        });
      },

      // update — 返回新的 builder 用于 .eq()
      update: function (updates) {
        var updateFilters = [];
        return {
          eq: function (col, val) {
            updateFilters.push({ col: col, val: val });
            return new Promise(function (resolve) {
              var products = _getProducts();
              products = products.map(function (p) {
                var match = updateFilters.every(function (f) { return p[f.col] === f.val; });
                if (match) {
                  Object.keys(updates).forEach(function (k) { p[k] = updates[k]; });
                }
                return p;
              });
              _saveProducts(products);
              resolve({ data: null, error: null });
            });
          }
        };
      },

      // delete — 返回新的 builder 用于 .eq()
      delete: function () {
        var deleteFilters = [];
        return {
          eq: function (col, val) {
            deleteFilters.push({ col: col, val: val });
            return new Promise(function (resolve) {
              var products = _getProducts();
              products = products.filter(function (p) {
                return !deleteFilters.every(function (f) { return p[f.col] === f.val; });
              });
              _saveProducts(products);
              resolve({ data: null, error: null });
            });
          }
        };
      }
    };

    return builder;
  }

  // 模拟 Storage API
  var mockStorage = {
    from: function (bucket) {
      return {
        upload: function (filename, blob) {
          return new Promise(function (resolve) {
            // 将图片转为 base64 存储
            var reader = new FileReader();
            reader.onload = function (e) {
              var images = _getImages();
              images[filename] = e.target.result;
              _saveImages(images);
              resolve({ data: { path: filename }, error: null });
            };
            reader.onerror = function () {
              resolve({ data: null, error: { message: '上传失败' } });
            };
            reader.readAsDataURL(blob);
          });
        },
        remove: function (paths) {
          return new Promise(function (resolve) {
            var images = _getImages();
            paths.forEach(function (p) { delete images[p]; });
            _saveImages(images);
            resolve({ data: null, error: null });
          });
        },
        getPublicUrl: function (path) {
          return { data: { publicUrl: '' } };
        }
      };
    }
  };

  // 模拟 RPC 调用
  function mockRpc(fnName, params) {
    if (fnName === 'purchase_product') {
      return new Promise(function (resolve) {
        var products = _getProducts();
        var productId = params.p_product_id;
        var qty = params.p_quantity;
        var buyerName = params.p_buyer_name;

        // 查找商品
        var productIndex = -1;
        for (var i = 0; i < products.length; i++) {
          if (products[i].id === productId) {
            productIndex = i;
            break;
          }
        }

        if (productIndex === -1) {
          resolve({ data: null, error: { message: 'Product not found' } });
          return;
        }

        var product = products[productIndex];

        // 检查库存
        if (product.quantity < qty) {
          resolve({ data: null, error: { message: 'insufficient_stock' } });
          return;
        }

        // 扣减库存
        products[productIndex].quantity = product.quantity - qty;
        products[productIndex].updated_at = new Date().toISOString();
        _saveProducts(products);

        // 创建订单记录
        var order = {
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2),
          product_id: productId,
          product_name: product.name,
          buyer_name: buyerName,
          buyer_ip: params.p_buyer_ip || '',
          quantity: qty,
          created_at: new Date().toISOString()
        };

        // 保存订单到 localStorage
        var orders = [];
        try {
          orders = JSON.parse(localStorage.getItem('demo_orders') || '[]');
        } catch (e) {
          orders = [];
        }
        orders.push(order);
        localStorage.setItem('demo_orders', JSON.stringify(orders));

        resolve({ data: order, error: null });
      });
    }

    return Promise.resolve({ data: null, error: { message: 'Unknown RPC function: ' + fnName } });
  }

  // 组装模拟客户端
  supabaseClient = {
    from: function (table) { return createQueryBuilder(table); },
    storage: mockStorage,
    rpc: mockRpc
  };

  console.log('🎯 本地测试模式已启用 — 数据存储在浏览器 localStorage 中');

} else {
  // ============================================================
  // 正式模式 — 使用真实 Supabase
  // ============================================================
  supabaseClient = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
  );
}
