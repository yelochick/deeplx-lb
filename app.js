import "./src/env.js";
import express from "express";
import axios from "axios";
import redis from "./src/redis.js";
import cache from "./src/cache.js";

const app = express();
const port = process.env.PORT || 1188;
const ok = {
  code: 1,
  msg: "OK",
};
const err = {
  code: 0,
  msg: "ERROR",
};

app.use(express.json());
app.use(express.static("static"));

const createUrlObj = (url, status) => {
  const obj = {};
  obj[url] = status;
  return obj;
};

app.post("/translate", async (req, res) => {
  const requestURI = req.path;
  const urls = [...(await cache.getUrls())];
  if (urls.length === 0) {
    res.status(500).send(err);
    return;
  }
  while (urls.length > 0) {
    const randomIndex = Math.floor(Math.random() * urls.length);
    const targetURL = urls[randomIndex];
    const fullURL = targetURL + requestURI;
    console.log(`request: ${fullURL}`);
    try {
      let r = await axios.post(fullURL, req.body, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 5000,
      });
      res.send(r.data);
      return;
    } catch (error) {
      console.log(`request failure: ${fullURL}`);
      urls.splice(randomIndex, 1);
    }
  }
  res.status(500).send(err);
});

app.get("/urls", async (req, res) => {
  const urlData = await cache.getUrlData();
  res.send(urlData);
});

app.post("/urls", async (req, res) => {
  let urls = req.body;
  urls = urls.filter((x) => x !== "" && x.startsWith("http") && !x.includes("yelochick")).map((x) => {
    x = x.replace(/\s+/g, '')
    if (x.endsWith("/")) {
      x = x.substring(0, x.length - 1);
    }
    if (x.endsWith("/translate")) {
      x = x.substring(0, x.length - 10);
    }
    return x;
  });
  if (urls && urls.length > 0) {
    urls = [...new Set(urls)];
    const headers = { "Content-Type": "application/json" };
    const payload = {
      text: "Hello, World!",
      source_lang: "EN",
      target_lang: "ZH",
    };
    const promises = urls.map((url) => {
      return new Promise((resolve) => {
        axios
          .post(`${url}/translate`, payload, { headers, timeout: 5000 })
          .then((res) => {
            if (res.data.data.includes("你好，世界")) {
              resolve(createUrlObj(url, "1"));
            } else {
              resolve(createUrlObj(url, "0"));
            }
          })
          .catch((error) => {
            resolve(createUrlObj(url, "0"));
          });
      });
    });
    const results = await Promise.all(promises);
    let append = Object.assign({}, ...results);
    await redis.hset("urls", append);
    cache.clearUrls();
  }
  res.send(ok);
});

app.post("/clear", async (req, res) => {
  const urlData = (await redis.hgetall("urls")) || {};
  if (JSON.stringify(urlData) !== "{}") {
    for (let url in urlData) {
      if (urlData[url] !== "1") {
        delete urlData[url];
      }
    }
    await redis.del("urls");
    await redis.hset("urls", urlData);
    cache.clearUrls();
  }
  res.send(ok);
});

app.listen(port, () => console.log(`Server ready on port ${port}.`));
