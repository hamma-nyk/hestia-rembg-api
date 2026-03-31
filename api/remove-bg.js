const axios = require("axios");
const FormData = require("form-data");

const allKeys = process.env.REMOVE_BG_KEYS
  ? process.env.REMOVE_BG_KEYS.split(",")
  : [];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  // Mendukung dua input: URL atau Base64 (untuk upload)
  const { imageUrl, imageBase64 } = req.body;

  let availableKeys = [...allKeys];

  async function tryRequest(keysList) {
    if (keysList.length === 0) {
      throw new Error("SEMUA_KEY_LIMIT");
    }

    const randomIndex = Math.floor(Math.random() * keysList.length);
    const selectedKey = keysList[randomIndex];

    try {
      const formData = new FormData();
      formData.append("size", "auto");

      // LOGIKA PEMILIHAN SUMBER GAMBAR
      if (imageBase64) {
        // Jika upload file, convert base64 ke buffer
        const buffer = Buffer.from(imageBase64, "base64");
        formData.append("image_file", buffer, { filename: "upload.png" });
      } else if (imageUrl) {
        formData.append("image_url", imageUrl);
      } else {
        throw new Error("TIDAK_ADA_SUMBER_GAMBAR");
      }

      const response = await axios.post(
        "https://api.remove.bg/v1.0/removebg",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            "X-Api-Key": selectedKey,
          },
          responseType: "arraybuffer",
        },
      );

      return response.data;
    } catch (error) {
      if (
        error.response &&
        (error.response.status === 402 || error.response.status === 429)
      ) {
        const remainingKeys = keysList.filter(
          (_, index) => index !== randomIndex,
        );
        return await tryRequest(remainingKeys);
      }
      throw error;
    }
  }

  try {
    const imageData = await tryRequest(availableKeys);
    res.setHeader("Content-Type", "image/png");
    return res.send(imageData);
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}
