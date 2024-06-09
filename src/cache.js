import redis from "./redis.js";

let urls = [];

const getUrlData = async () => {
  const urlData = await redis.hgetall("urls");
  const result = [];
  for (let url in urlData) {
    result.push({
      url,
      status: urlData[url],
    });
  }
  result.sort((a, b) => {
    return a.url.localeCompare(b.url);
  });
  return result;
};

const getUrls = async () => {
  return urls;
};

const initUrls = async () => {
  urls = [];
  const urlData = await redis.hgetall("urls");
  console.log(`load urls: ${JSON.stringify(urlData)}`);
  for (let url in urlData) {
    if (urlData[url] === "1") {
      urls.push(url);
    }
  }
}

export default { getUrlData, getUrls, initUrls };
