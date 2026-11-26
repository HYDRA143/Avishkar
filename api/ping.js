function cors(res){ res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS'); res.setHeader('Access-Control-Allow-Headers','x-api-key, Content-Type'); }
export default async function handler(req,res){ cors(res); if(req.method==='OPTIONS') return res.status(200).end(); return res.status(200).json({ok:true, msg:'ping works'}); }
