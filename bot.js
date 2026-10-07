const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const fs = require('fs');

const CONFIG = {
  TOKEN: '8668149255:AAHe4md2Meu4ZJK6u32RmKWQEVSIYqa7cak',
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
  KEY_PREFIX: 'TX',
  DATA_FILE: './data.json'
};

let DB = { orders: [], stats: { revenue: 0, orders: 0 } };

function loadDB(){
  try {
    if (fs.existsSync(CONFIG.DATA_FILE)){
      DB = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf8'));
      if (!DB.orders) DB.orders = [];
      if (!DB.stats) DB.stats = { revenue: 0, orders: 0 };
    }
  } catch(e){ console.log('Load DB error:', e.message); }
}
function saveDB(){
  try { fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(DB, null, 2)); } catch(e){}
}
loadDB();

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

// Tạo link QR VietQR
function genQRUrl(amount, description){
  const bankCode = 'MB'; // MBBank
  const acc = CONFIG.BANK.ACCOUNT;
  const name = encodeURIComponent(CONFIG.BANK.HOLDER);
  const info = encodeURIComponent(description);
  return 'https://img.vietqr.io/image/' + bankCode + '-' + acc + '-compact2.png?amount=' + amount + '&addInfo=' + info + '&accountName=' + name;
}

console.log('🤖 Đang khởi động bot...');
const bot = new TelegramBot(CONFIG.TOKEN, { polling: true });
console.log('✅ Bot sẵn sàng!');

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
    DB.orders.push({ code, user_id: userId, username, product_id: product.id, product_label: product.label, price: product.price, days: product.days, status: 'pending', key_generated: null, created_at: Date.now() });
    saveDB();

    const qrUrl = genQRUrl(product.price, code);
    const caption =
      `✅ <b>Đơn hàng đã tạo</b>\n\n` +
      `📦 Sản phẩm: <b>${product.label}</b>\n` +
      `💰 Số tiền: <b>${fmtMoney(product.price)}</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `<b>💳 THANH TOÁN:</b>\n` +
      `Ngân hàng: <b>${CONFIG.BANK.NAME}</b>\n` +
      `Số TK: <code>${CONFIG.BANK.ACCOUNT}</code>\n` +
      `Chủ TK: <b>${CONFIG.BANK.HOLDER}</b>\n` +
      `Số tiền: <b>${fmtMoney(product.price)}</b>\n` +
      `Nội dung CK: <code>${code}</code>\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📱 <b>Quét QR</b> bên trên để CK nhanh\n` +
      `⚠️ <b>CK ĐÚNG nội dung</b> để bot nhận diện`;

    bot.sendPhoto(chatId, qrUrl, {
      caption: caption,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [
        [{ text: '✅ Tôi đã chuyển khoản', callback_data: 'paid_' + code }],
        [{ text: '❌ Hủy đơn', callback_data: 'cancel_' + code }]
      ]}
    });
  }
  else if (data.startsWith('paid_')){
    const code = data.replace('paid_', '');
    const order = DB.orders.find(o => o.code === code);
    if (!order) return bot.sendMessage(chatId, '❌ Không tìm thấy đơn.');
    if (order.status === 'completed') return bot.sendMessage(chatId, '⚠️ Đã hoàn thành rồi.');
    order.status = 'waiting';
    order.paid_at = Date.now();
    saveDB();
    bot.sendMessage(chatId, `⏳ <b>Đã ghi nhận!</b>\n\nAdmin sẽ kiểm tra và gửi key trong <b>1-5 phút</b>.`, { parse_mode: 'HTML' });

    bot.sendMessage(CONFIG.ADMIN_CHAT_ID,
      `🔔 <b>ĐƠN HÀNG MỚI</b>\n\n📦 Sản phẩm: <b>${order.product_label}</b>\n💰 Số tiền: <b>${fmtMoney(order.price)}</b>\n🆔 Mã đơn: <code>${order.code}</code>\n👤 Khách: @${order.username}\n\nKiểm tra TK → nếu có tiền → bấm ✅ XÁC NHẬN`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '✅ XÁC NHẬN', callback_data: 'confirm_' + code }],
        [{ text: '❌ HỦY', callback_data: 'cancel_' + code }]
      ]}});
  }
  else if (data.startsWith('cancel_')){
    const code = data.replace('cancel_', '');
    const order = DB.orders.find(o => o.code === code);
    if (!order) return;
    order.status = 'cancelled';
    saveDB();
    if (String(userId) === String(CONFIG.ADMIN_CHAT_ID)){
      bot.sendMessage(order.user_id, `❌ <b>Đơn ${code} đã bị hủy.</b>`, { parse_mode: 'HTML' });
    }
    bot.sendMessage(chatId, '✅ Đã hủy đơn ' + code);
  }
  else if (data.startsWith('confirm_')){
    const code = data.replace('confirm_', '');
    const order = DB.orders.find(o => o.code === code);
    if (!order) return bot.sendMessage(chatId, '❌ Không tìm thấy đơn.');
    if (order.status === 'completed') return bot.sendMessage(chatId, '⚠️ Đã xác nhận rồi.');

    const key = generateKey(order.days);
    order.status = 'completed';
    order.key_generated = key;
    DB.stats.revenue += order.price;
    DB.stats.orders += 1;
    saveDB();

    bot.sendMessage(order.user_id,
      `🎉 <b>ĐƠN HÀNG HOÀN THÀNH</b>\n\n📦 Sản phẩm: <b>${order.product_label}</b>\n🔑 Key của bạn:\n<code>${key}</code>\n\n━━━━━━━━━━━━━━━━━━\n<b>Cách dùng:</b>\n1️⃣ Mở web: <b>https://tolmoimatto.netlify.app/</b>\n2️⃣ Nhập key vào ô kích hoạt\n3️⃣ Bấm KÍCH HOẠT\n\n⚠️ Đừng share key cho người khác.`,
      { parse_mode: 'HTML' });
    bot.sendMessage(chatId, `✅ Đã gửi key cho khách.`, { parse_mode: 'HTML' });
  }
  else if (data === 'support'){
    bot.sendMessage(chatId, `📞 <b>HỖ TRỢ</b>\n\nTelegram admin: @${CONFIG.ADMIN_USERNAME}`, { parse_mode: 'HTML' });
  }
  else if (data === 'myorders'){
    const orders = DB.orders.filter(o => o.user_id === userId).slice(-10).reverse();
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
  const pending = DB.orders.filter(o => o.status === 'pending' || o.status === 'waiting').length;
  const completed = DB.orders.filter(o => o.status === 'completed').length;
  bot.sendMessage(msg.chat.id, `📊 <b>THỐNG KÊ</b>\n\n💰 Doanh thu: <b>${fmtMoney(DB.stats.revenue)}</b>\n✅ Đơn xong: <b>${completed}</b>\n⏳ Đang chờ: <b>${pending}</b>`, { parse_mode: 'HTML' });
});

bot.onText(/\/pending/, (msg) => {
  if (String(msg.from.id) !== String(CONFIG.ADMIN_CHAT_ID)) return;
  const orders = DB.orders.filter(o => o.status === 'pending' || o.status === 'waiting').reverse().slice(0, 20);
  if (!orders.length) return bot.sendMessage(msg.chat.id, '✅ Không có đơn chờ.');
  orders.forEach(o => {
    bot.sendMessage(msg.chat.id, `📦 <b>${o.code}</b>\n${o.product_label} - ${fmtMoney(o.price)}\nKhách: @${o.username}`, {
      parse_mode: 'HTML', reply_markup: { inline_keyboard: [
        [{ text: '✅ Xác nhận', callback_data: 'confirm_' + o.code }, { text: '❌ Hủy', callback_data: 'cancel_' + o.code }]
      ]}
    });
  });
});
