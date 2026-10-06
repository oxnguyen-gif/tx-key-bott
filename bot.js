const TelegramBot = require('node-telegram-bot-api');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const CONFIG = {
  // ⬇️ DÁN TOKEN CỦA BẠN VÀO ĐÂY (thay PASTE_TOKEN_MOI_VAO_DAY)
  TOKEN: '8668149255:AAFsMmMVtiSdkx89ACyLl9zO9B_n1CRdnI8',

  ADMIN_USERNAME: 'Saligan2',
  ADMIN_CHAT_ID: 733030731,
  BANK: {
    NAME: 'MBBank',
    ACCOUNT: '90891232009',
    HOLDER: 'NGUYEN VAN QUANG ANH'
  },
  PRODUCTS: [
    { id: 'day',     label: '📅 1 ngày',    days: 1,    price: 5799 },
    { id: 'week',    label: '📅 7 ngày',    days: 7,    price: 25799 },
    { id: 'month',   label: '📆 1 tháng',   days: 30,   price: 55799 },
    { id: 'quarter', label: '📆 3 tháng',   days: 90,   price: 155799 },
    { id: 'year',    label: '📅 1 năm',     days: 365,  price: 555799 },
    { id: 'forever', label: '👑 Vĩnh viễn', days: 0,    price: 999799 }
  ],
  KEY_SECRET: 'SKIDVN2026X',
  KEY_PREFIX: 'TX'
};

const db = new Database('./bot.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE, user_id INTEGER, username TEXT,
    product_id TEXT, product_label TEXT, price INTEGER, days INTEGER,
    status TEXT DEFAULT 'pending', key_generated TEXT,
    created_at INTEGER, paid_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY, total_revenue INTEGER DEFAULT 0, total_orders INTEGER DEFAULT 0
  );
  INSERT OR IGNORE INTO stats (id, total_revenue, total_orders) VALUES (1, 0, 0);
`);

function keyHash(str){
  let h = 5381;
  for (let i = 0; i < str.length; i++){ h = ((h << 5) + h) + str.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36).toUpperCase().padStart(6, '0').slice(-4);
}
function randomStr(len){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; const arr = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
  return s;
}
function generateKey(days){
  const rand = randomStr(8);
  const sig = keyHash(CONFIG.KEY_PREFIX + '-' + days + '-' + rand + CONFIG.KEY_SECRET);
  return CONFIG.KEY_PREFIX + '-' + days + '-' + rand + '-' + sig;
}
function genOrderCode(){
  return 'TX' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random()*900+100);
}
function fmtMoney(n){ return n.toLocaleString('vi-VN') + 'đ'; }

const bot = new TelegramBot(CONFIG.TOKEN, { polling: true });
console.log('🤖 Bot đã khởi động');

bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || 'bạn';
  bot.sendMessage(msg.chat.id,
    `👋 Chào <b>${name}</b>!\n\n🎲 <b>SHOP KEY TOOL TX</b>\n\nBấm nút bên dưới để xem sản phẩm 👇`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
      [{ text: '🛒 Mua key', callback_data: 'buy' }],
      [{ text: '📞 Hỗ trợ', callback_data: 'support' }],
      [{ text: '📦 Đơn của tôi', callback_data: 'myorders' }]
    ]}});
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const userId = query.from.id;
  const username = query.from.username || query.from.first_name || 'user';
  try { await bot.answerCallbackQuery(query.id); } catch(e){}

  if (data === 'buy'){
    const buttons = CONFIG.PRODUCTS.map(p => [{ text: p.label + ' - ' + fmtMoney(p.price), callback_data: 'order_' + p.id }]);
    buttons.push([{ text: '⬅️ Quay lại', callback_data: 'back' }]);
    bot.sendMessage(chatId, '🛒 <b>Chọn loại key:</b>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons }});
  }
  else if (data.startsWith('order_')){
    const productId = data.replace('order_', '');
    const product = CONFIG.PRODUCTS.find(p => p.id === productId);
    if (!product) return;
    const code = genOrderCode();
    db.prepare(`INSERT INTO orders (code, user_id, username, product_id, product_label, price, days, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`)
      .run(code, userId, username, product.id, product.label, product.price, product.days, Date.now());

    bot.sendMessage(chatId,
      `✅ <b>Đơn hàng đã tạo</b>\n\n📦 Sản phẩm: <b>${product.label}</b>\n💰 Số tiền: <b>${fmtMoney(product.price)}</b>\n\n━━━━━━━━━━━━━━━━━━\n<b>💳 THANH TOÁN:</b>\nNgân hàng: <b>${CONFIG.BANK.NAME}</b>\nSố TK: <code>${CONFIG.BANK.ACCOUNT}</code>\nChủ TK: <b>${CONFIG.BANK.HOLDER}</b>\nSố tiền: <b>${fmtMoney(product.price)}</b>\nNội dung CK: <code>${code}</code>\n━━━━━━━━━━━━━━━━━━\n\n⚠️ <b>CK ĐÚNG nội dung</b> để bot nhận diện.\n\nSau khi CK → bấm nút bên dưới 👇`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '✅ Tôi đã chuyển khoản', callback_data: 'paid_' + code }],
        [{ text: '❌ Hủy đơn', callback_data: 'cancel_' + code }]
      ]}});
    bot.sendMessage(chatId, 'Mã đơn: <code>' + code + '</code> (bấm để copy)', { parse_mode: 'HTML' });
  }
  else if (data.startsWith('paid_')){
    const code = data.replace('paid_', '');
    const order = db.prepare('SELECT * FROM orders WHERE code = ?').get(code);
    if (!order) return bot.sendMessage(chatId, '❌ Không tìm thấy đơn.');
    if (order.status === 'completed') return bot.sendMessage(chatId, '⚠️ Đã hoàn thành rồi.');
    db.prepare('UPDATE orders SET status = ?, paid_at = ? WHERE code = ?').run('waiting', Date.now(), code);
    bot.sendMessage(chatId, `⏳ <b>Đã ghi nhận!</b>\n\nAdmin sẽ kiểm tra và gửi key trong <b>1-5 phút</b>.`, { parse_mode: 'HTML' });

    if (CONFIG.ADMIN_CHAT_ID){
      bot.sendMessage(CONFIG.ADMIN_CHAT_ID,
        `🔔 <b>ĐƠN HÀNG MỚI</b>\n\n📦 Sản phẩm: <b>${order.product_label}</b>\n💰 Số tiền: <b>${fmtMoney(order.price)}</b>\n🆔 Mã đơn: <code>${order.code}</code>\n👤 Khách: @${order.username} (ID: ${order.user_id})\n\nKiểm tra TK → nếu có tiền → bấm ✅ XÁC NHẬN`,
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          [{ text: '✅ XÁC NHẬN', callback_data: 'confirm_' + code }],
          [{ text: '❌ HỦY', callback_data: 'cancel_' + code }]
        ]}});
    }
  }
  else if (data.startsWith('cancel_')){
    const code = data.replace('cancel_', '');
    const order = db.prepare('SELECT * FROM orders WHERE code = ?').get(code);
    if (!order) return;
    db.prepare('UPDATE orders SET status = ? WHERE code = ?').run('cancelled', code);
    if (String(userId) === String(CONFIG.ADMIN_CHAT_ID)){
      bot.sendMessage(order.user_id, `❌ <b>Đơn ${code} đã bị hủy.</b>`, { parse_mode: 'HTML' });
      bot.sendMessage(chatId, '✅ Đã hủy đơn ' + code);
    } else {
      bot.sendMessage(chatId, '✅ Đã hủy đơn ' + code);
    }
  }
  else if (data.startsWith('confirm_')){
    const code = data.replace('confirm_', '');
    const order = db.prepare('SELECT * FROM orders WHERE code = ?').get(code);
    if (!order) return bot.sendMessage(chatId, '❌ Không tìm thấy đơn.');
    if (order.status === 'completed') return bot.sendMessage(chatId, '⚠️ Đã xác nhận rồi.');

    const key = generateKey(order.days);
    db.prepare('UPDATE orders SET status = ?, key_generated = ?, paid_at = ? WHERE code = ?').run('completed', key, Date.now(), code);
    db.prepare('UPDATE stats SET total_revenue = total_revenue + ?, total_orders = total_orders + 1 WHERE id = 1').run(order.price);

    bot.sendMessage(order.user_id,
      `🎉 <b>ĐƠN HÀNG HOÀN THÀNH</b>\n\n📦 Sản phẩm: <b>${order.product_label}</b>\n🔑 Key của bạn:\n<code>${key}</code>\n\n━━━━━━━━━━━━━━━━━━\n<b>Cách dùng:</b>\n1️⃣ Mở web: <b>https://tolmoimatto.netlify.app/</b>\n2️⃣ Nhập key vào ô kích hoạt\n3️⃣ Bấm KÍCH HOẠT → dùng tool\n\n⚠️ Đừng share key cho người khác.`,
      { parse_mode: 'HTML' });
    bot.sendMessage(chatId, `✅ Đã gửi key cho khách.`, { parse_mode: 'HTML' });
  }
  else if (data === 'support'){
    bot.sendMessage(chatId, `📞 <b>HỖ TRỢ</b>\n\nTelegram admin: @${CONFIG.ADMIN_USERNAME}\nThời gian: 8h - 23h hàng ngày`, { parse_mode: 'HTML' });
  }
  else if (data === 'myorders'){
    const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(userId);
    if (!orders.length) return bot.sendMessage(chatId, '📦 Bạn chưa có đơn hàng nào.');
    const text = '📦 <b>ĐƠN HÀNG CỦA BẠN</b>\n\n' + orders.map(o => {
      const status = o.status === 'completed' ? '✅ Hoàn thành' : o.status === 'waiting' ? '⏳ Chờ xác nhận' : o.status === 'cancelled' ? '❌ Đã hủy' : '⏸ Chờ CK';
      return `<b>${o.code}</b>\n${o.product_label} - ${fmtMoney(o.price)}\nTrạng thái: ${status}` + (o.key_generated ? `\n🔑 <code>${o.key_generated}</code>` : '');
    }).join('\n\n━━━━━━━━━━━━\n');
    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  }
  else if (data === 'back'){
    bot.sendMessage(chatId, '👉 Bấm /start để về menu chính.');
  }
});

bot.onText(/\/stats/, (msg) => {
  if (String(msg.from.id) !== String(CONFIG.ADMIN_CHAT_ID)) return bot.sendMessage(msg.chat.id, '❌ Không phải admin.');
  const s = db.prepare('SELECT * FROM stats WHERE id = 1').get();
  const pending = db.prepare("SELECT COUNT(*) n FROM orders WHERE status IN ('pending','waiting')").get().n;
  const completed = db.prepare("SELECT COUNT(*) n FROM orders WHERE status = 'completed'").get().n;
  bot.sendMessage(msg.chat.id, `📊 <b>THỐNG KÊ</b>\n\n💰 Doanh thu: <b>${fmtMoney(s.total_revenue)}</b>\n✅ Đơn xong: <b>${completed}</b>\n⏳ Đang chờ: <b>${pending}</b>`, { parse_mode: 'HTML' });
});

bot.onText(/\/pending/, (msg) => {
  if (String(msg.from.id) !== String(CONFIG.ADMIN_CHAT_ID)) return;
  const orders = db.prepare("SELECT * FROM orders WHERE status IN ('pending','waiting') ORDER BY created_at DESC LIMIT 20").all();
  if (!orders.length) return bot.sendMessage(msg.chat.id, '✅ Không có đơn chờ.');
  orders.forEach(o => {
    bot.sendMessage(msg.chat.id, `📦 <b>${o.code}</b>\n${o.product_label} - ${fmtMoney(o.price)}\nKhách: @${o.username}`, {
      parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '✅ Xác nhận', callback_data: 'confirm_' + o.code }, { text: '❌ Hủy', callback_data: 'cancel_' + o.code }]
      ]}
    });
  });
});

console.log('✅ Bot sẵn sàng');