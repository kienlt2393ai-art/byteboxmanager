export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).end();

  const { message } = req.body || {};
  if (!message?.text) return res.status(200).end();

  const chatId = message.chat.id;
  const text   = message.text.trim();
  const token  = process.env.TELEGRAM_BOT_TOKEN;

  const sendMsg = async (msg) => {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
    });
  };

  // Fetch data from Supabase
  const sb = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  try {
    const [prodsRes, logsRes] = await Promise.all([
      fetch(`${sb}/rest/v1/products?select=*&order=id`, { headers }),
      fetch(`${sb}/rest/v1/shift_logs?select=*&order=created_at.desc&limit=10`, { headers }),
    ]);
    const products = await prodsRes.json();
    const logs     = await logsRes.json();

    const vnd = n => (n||0).toLocaleString("vi-VN") + "đ";
    const today = new Date().toLocaleDateString("vi-VN");

    if (text === "/tonkho" || text === "/tồn kho") {
      const low  = products.filter(p => p.stock <= p.threshold);
      const lines = products.map(p =>
        `${p.stock===0?"🔴":p.stock<=p.threshold?"⚠️":"✅"} ${p.name}: ${p.stock} ${p.unit} (ngưỡng ${p.threshold})`
      ).join("\n");
      await sendMsg(`📦 <b>Tồn kho hiện tại</b>\n${today}\n\n${lines}\n\n${low.length>0?"⚠️ Cần nhập: "+low.map(p=>p.name).join(", "):"✅ Ổn định"}`);

    } else if (text === "/doanhthu" || text === "/doanh thu") {
      const todayLogs = logs.filter(l => l.date === today);
      if (todayLogs.length === 0) {
        await sendMsg(`📊 Hôm nay (${today}) chưa có ca nào được kiểm kê.`);
      } else {
        const lines = todayLogs.map(l => {
          const r = l.revenue || {};
          const total = (r.cash||0)+(r.tingee||0)+(r.netbarbox||0)+(r.goodsRevenue||0);
          return `Ca ${l.shift_type} (${l.employee}): ${vnd(total)}\n  • TM: ${vnd(r.cash)} | Tingee: ${vnd(r.tingee)} | NB: ${vnd(r.netbarbox)}`;
        }).join("\n\n");
        const grandTotal = todayLogs.reduce((s,l)=>s+(l.revenue?(( l.revenue.cash||0)+(l.revenue.tingee||0)+(l.revenue.netbarbox||0)+(l.revenue.goodsRevenue||0)):0),0);
        await sendMsg(`📊 <b>Doanh thu ${today}</b>\n\n${lines}\n\n💰 Tổng: ${vnd(grandTotal)}`);
      }

    } else if (text === "/ca" || text === "/ca gần nhất") {
      const l = logs[0];
      if (!l) { await sendMsg("Chưa có ca nào."); return res.status(200).end(); }
      const r = l.revenue || {};
      const total = (r.cash||0)+(r.tingee||0)+(r.netbarbox||0)+(r.goodsRevenue||0);
      await sendMsg(`📋 <b>Ca gần nhất</b>\n${l.date} - Ca ${l.shift_type}\n👤 ${l.employee}\n💰 Tổng: ${vnd(total)}\n• TM: ${vnd(r.cash)} | Tingee: ${vnd(r.tingee)} | NB: ${vnd(r.netbarbox)}`);

    } else {
      await sendMsg(`Xin chào! Các lệnh:\n/doanhthu — Doanh thu hôm nay\n/tonkho — Tồn kho hiện tại\n/ca — Ca gần nhất`);
    }
  } catch (err) {
    await sendMsg("❌ Lỗi: " + err.message);
  }

  return res.status(200).end();
}
