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
  if (urls && urls.length > 0) {
    return urls;
  }
  const urlData = await redis.hgetall("urls");
  console.log(`reload urls: ${JSON.stringify(urlData)}`);
  for (let url in urlData) {
    if (urlData[url] === "1") {
      urls.push(url);
    }
  }
  return urls;
};

const clearUrls = () => {
  urls = [];
};

export default { getUrlData, getUrls, clearUrls };
