import redis from "./redis.js";

let apis = [];

const getApiData = async () => {
  const apiData = await redis.hgetall("urls");
  const result = [];
  for (let api in apiData) {
    result.push({
      url: api,
      status: apiData[api],
    });
  }
  result.sort((a, b) => {
    return a.url.localeCompare(b.url);
  });
  return result;
};

const getApi = () => {
  return apis;
};

const initialize = async () => {
  apis = [];
  const urlData = await redis.hgetall("urls");
  console.log(`load urls: ${JSON.stringify(urlData)}`);
  for (let url in urlData) {
    if (urlData[url] === "1") {
      apis.push(url);
    }
  }
}

export default { getApiData, getApi, initialize };
