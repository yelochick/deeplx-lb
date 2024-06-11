import "./src/env.js"
import express from "express"
import axios from "axios"
import redis from "./src/redis.js"

const app = express()
const port = process.env.PORT || 1188

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

let cacheApis = []

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
  const apiData = await redis.hgetall("urls")
  cacheApis = [...Object.keys(apiData).filter(key => apiData[key] === "1")]
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
      axios.post(`${api}/translate`, payload, { headers, timeout: 5000 })
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
  const apis = [...cacheApis]
  if (apis.length === 0) {
    error(res)
    return
  }
  let length = apis.length
  while (length > 0) {
    const randomIndex = Math.floor(Math.random() * length)
    const targetURL = apis[randomIndex]
    const fullURL = targetURL + requestURI
    console.log(`request: ${fullURL}, index: ${randomIndex}`)
    try {
      let r = await axios.post(fullURL, req.body, {
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      })
      res.send(r.data)
      return
    } catch (error) {
      console.log(`request failure: ${fullURL}, index: ${randomIndex}`)
      apis.splice(randomIndex, 1)
    }
    length--
  }
  error(res)
})

app.get("/api", async (req, res) => {
  const apiData = await redis.hgetall("urls")
  const result = []
  Object.keys(apiData).forEach(key => {
    result.push({
      url: key,
      status: apiData[key],
    })
  })
  result.sort((a, b) => {
    return a.url.localeCompare(b.url)
  })
  ok(res, result)
})

app.post("/api", async (req, res) => {
  let apis = req.body
  apis = apis.filter((api) => api !== "" && api.startsWith("http") && checkIgnoreKeywords(api)).map((x) => {
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
    await redis.hset("urls", checkedApiData)
    await initialize()
  }
  ok(res, {})
})

app.post("/clear", async (req, res) => {
  const apiData = (await redis.hgetall("urls")) || {}
  if (JSON.stringify(apiData) !== "{}") {
    const apis = Object.keys(apiData)
    const checkedApiData = await checkApi(apis)
    const filterApiData = {}
    Object.keys(checkedApiData).filter(key => checkedApiData[key] === "1").forEach(v => filterApiData[v] = "1")
    await redis.del("urls")
    await redis.hset("urls", filterApiData)
    cacheApis = [...Object.keys(filterApiData)]
  }
  ok(res, {})
})

app.post("/checkAuth", async (req, res) => {
  const password = process.env.PASSWORD
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
})

await initialize()

app.listen(port, async () => {
  console.log(`Server ready on port ${port}.`)
})
