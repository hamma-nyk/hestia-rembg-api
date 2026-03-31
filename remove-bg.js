const axios = require('axios');
const FormData = require('form-data');

// 1. Ambil semua key dan ubah jadi Array
const allKeys = process.env.REMOVE_BG_KEYS ? process.env.REMOVE_BG_KEYS.split(',') : [];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { imageUrl } = req.body;
  
  // Buat copy daftar key agar kita bisa melacak mana yang sudah dicoba
  let availableKeys = [...allKeys];

  // Fungsi internal untuk mencoba request secara rekursif
  async function tryRequest(keysList) {
    if (keysList.length === 0) {
      throw new Error("SEMUA_KEY_LIMIT: Semua API Key sudah mencapai batas atau gagal.");
    }

    // 2. Pilih index secara random
    const randomIndex = Math.floor(Math.random() * keysList.length);
    const selectedKey = keysList[randomIndex];

    try {
      console.log(`Mencoba dengan key: ${selectedKey.substring(0, 5)}...`);
      
      const formData = new FormData();
      formData.append('size', 'auto');
      formData.append('image_url', imageUrl);

      const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
        headers: {
          ...formData.getHeaders(),
          'X-Api-Key': selectedKey,
        },
        responseType: 'arraybuffer',
        timeout: 10000 // 10 detik timeout agar tidak menggantung
      });

      return response.data;

    } catch (error) {
      // 3. Cek apakah error karena limit (402 Payment Required atau 429 Too Many Requests)
      if (error.response && (error.response.status === 402 || error.response.status === 429)) {
        console.warn(`Key ${selectedKey.substring(0, 5)} limit. Mencoba key lain...`);
        
        // Hapus key yang gagal dari daftar dan coba lagi (rekursif)
        const remainingKeys = keysList.filter((_, index) => index !== randomIndex);
        return await tryRequest(remainingKeys);
      }
      
      // Jika error lain (misal: URL gambar salah), langsung lempar error saja
      throw error;
    }
  }

  try {
    const imageData = await tryRequest(availableKeys);
    res.setHeader('Content-Type', 'image/png');
    return res.send(imageData);
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ 
      status: 'error', 
      message: err.message.includes("SEMUA_KEY_LIMIT") 
        ? "Maaf, semua akses limit telah tercapai. Coba lagi besok." 
        : "Terjadi kesalahan pada sistem." 
    });
  }
}