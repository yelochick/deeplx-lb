import "./src/env.js"
import express from "express"
import axios from "axios"
import redis from "./src/redis.js"

const app = express()
const port = process.env.PORT || 1188
const maxApiReqFailureTimes = process.env.MAX_API_REQ_FAILURE_TIMES || 3

app.use(express.json())
app.use(express.static("static"))
app.all("/*", async (req, res, next) => {
  const authorization = req.header("Authorization") || req.query.password
  if (checkAuth(authorization)) {
    next()
  } else {
    forbidden(res)
  }
})

const key_prefix = process.env.PREFIX_KEY
let url_key = "urls"
if (key_prefix) {
  url_key = key_prefix + ":" + url_key
}

let cacheApis = []
let apiReqFailureTimes = {}

function ok(res, data) {
  res.send({
    code: 200,
    msg: "ok",
    data: data,
  })
}

function error(res) {
  res.status(500).send({
    code: 500,
    msg: "error",
  })
}

function forbidden(res) {
  res.status(403).send({
    code: 403,
    msg: "forbidden",
  })
}

function checkAuth(authorization) {
  const password = process.env.PASSWORD
  if (!password || password === "") {
    return true
  }
  return password === authorization
}

function createApiObj(url, status) {
  const obj = {}
  obj[url] = status
  return obj
}

function checkIgnoreKeywords(url) {
  const ignoreKeywords = process.env.IGNORE_KEYWORDS
  if (!ignoreKeywords || ignoreKeywords === "") {
    return true
  }
  const keywords = ignoreKeywords.split(",")
  for (let keyword of keywords) {
    if (url.includes(keyword)) {
      return false
    }
  }
  return true
}

async function initialize() {
  const apiData = await redis.hgetall(url_key)
  if (apiData) {
    cacheApis = [...Object.keys(apiData).filter(key => apiData[key] === "1")]
    apiReqFailureTimes = {}
  }
}

async function filterApis() {
  let apis = cacheApis.filter(url => getApiReqFailureTimes(url) < maxApiReqFailureTimes)
  if (apis.length === 0) {
    // 重新初始化资源
    await initialize()
    apis = cacheApis.length === 0 ? [] : [...cacheApis]
  }
  return apis
}

function checkApiReturn(r, checkValue) {
  if (!('data' in r) || !('data' in r.data)) {
    return false
  }
  console.log(`response: ${JSON.stringify(r.data)}`)
  const { data } = r.data
  return checkValue ? data.includes(checkValue) : data.length > 0
}

function addApiReqFailureTimes(url) {
  let times = apiReqFailureTimes[url]
  if (!times) {
    times = 0
  }
  times++;
  apiReqFailureTimes[url] = times
}

function getApiReqFailureTimes(url) {
  let times = apiReqFailureTimes[url]
  if (times) {
    return times
  } else {
    apiReqFailureTimes[url] = 0
    return 0
  }
}

async function checkApi(apis) {
  apis = [...new Set(apis)]
  const headers = { "Content-Type": "application/json" }
  const payload = {
    text: "Hello, World!",
    source_lang: "EN",
    target_lang: "ZH",
  }
  const promises = apis.map((api) => {
    return new Promise((resolve) => {
      axios.post(`${api}/translate`, payload, { headers, timeout: 2000 })
        .then((res) => {
          resolve(createApiObj(api, res.data.data.includes("你好，世界") ? "1" : "0"))
        })
        .catch((error) => {
          resolve(createApiObj(api, "0"))
        })
    })
  })
  const results = await Promise.all(promises)
  return Object.assign({}, ...results)
}

app.post("/translate", async (req, res) => {
  const requestURI = req.path
  const apis = await filterApis()
  if (apis.length === 0) {
    error(res)
    return
  }
  let length = apis.length
  while (length > 0) {
    const randomIndex = Math.floor(Math.random() * length)
    const targetURL = apis[randomIndex]
    const fullURL = targetURL + requestURI
    console.log(`request: ${fullURL}, index: ${randomIndex} ,req: ${JSON.stringify(req.body)}`)
    try {
      let r = await axios.post(fullURL, req.body, {
        headers: { "Content-Type": "application/json" },
        timeout: 5000
      })
      // 验证结果
      if (!checkApiReturn(r)) {
        throw new Error("api check error")
      }
      res.send(r.data)
      return
    } catch (error) {
      let reqFailureTimes = getApiReqFailureTimes(targetURL)
      console.log(`request failure: ${fullURL}, index: ${randomIndex}, requestFailureTimes: ${reqFailureTimes}`)
      if (reqFailureTimes > maxApiReqFailureTimes) {
        apis.splice(randomIndex, 1)
      } else {
        addApiReqFailureTimes(targetURL)
      }
    }
    length--
  }
  error(res)
})

app.get("/api", async (req, res) => {
  try {
    const apiData = await redis.hgetall(url_key) || {}
    const result = []
    Object.keys(apiData).forEach(key => {
      // 如果url在失效列表中且数值大于等于 maxApiReqFailureTimes 则为失效
      let reqFailureTimes = getApiReqFailureTimes(key)
      let status = reqFailureTimes >= maxApiReqFailureTimes ? "0" : apiData[key]
      result.push({
        url: key,
        status: status,
      })
    })
    result.sort((a, b) => {
      return a.url.localeCompare(b.url)
    })
    ok(res, result)
  } catch (e) {
    console.log(e)
    error(res)
  }
})

app.post("/api", async (req, res) => {
  try {
    let apis = req.body
    apis = apis.filter((api) =>
      api !== "" &&
      api.startsWith("http") &&
      !api.includes("api.deeplx.org") &&
      checkIgnoreKeywords(api)).map((x) => {
      x = x.replace(/\s+/g, '')
      if (x.endsWith("/")) {
        x = x.substring(0, x.length - 1)
      }
      if (x.endsWith("/translate")) {
        x = x.substring(0, x.length - 10)
      }
      return x
    })
    if (apis && apis.length > 0) {
      const checkedApiData = await checkApi(apis)
      await redis.hset(url_key, checkedApiData)
      await initialize()
    }
    ok(res, {})
  } catch (e) {
    console.log(e)
    error(res)
  }
})

app.post("/clear", async (req, res) => {
  try {
    const apiData = (await redis.hgetall(url_key)) || {}
    if (JSON.stringify(apiData) !== "{}") {
      const apis = Object.keys(apiData)
      const checkedApiData = await checkApi(apis)
      const filterApiData = {}
      Object.keys(checkedApiData).filter(key => checkedApiData[key] === "1").forEach(v => filterApiData[v] = "1")
      await redis.del(url_key)
      await redis.hset(url_key, filterApiData)
      cacheApis = [...Object.keys(filterApiData)]
    }
    ok(res, {})
  } catch (e) {
    console.log(e)
    error(res)
  }
})

app.post("/checkAuth", async (req, res) => {
  const password = process.env.PASSWORD
  try {
    if (!password || password === "") {
      ok(res, { anonymous: true })
      return
    }
    const authorization = req.header("Authorization")
    if (password !== authorization) {
      forbidden(res)
    } else {
      ok(res, { anonymous: false })
    }
  } catch (e) {
    console.log(e)
    error(res)
  }
})

await initialize()

app.listen(port, async () => {
  console.log(`Server ready on port ${port}.`)
})
