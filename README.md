## 公益站

https://deeplx.yelochick.com/

## Deeplx 负载均衡

通过 [Fofa](https://fofa.info/result?qbase64=Ym9keT0neyJjb2RlIjoyMDAsIm1lc3NhZ2UiOiJEZWVwTCBGcmVlIEFQSSwgRGV2ZWxvcGVkIGJ5IHNqbGxlbyBhbmQgbWlzc3VvLiBHbyB0byAvdHJhbnNsYXRlIHdpdGggUE9TVC4gaHR0cDovL2dpdGh1Yi5jb20vT3dPLU5ldHdvcmsvRGVlcExYIn0n) 搜索接口

每行一个，接口末尾带不带 /translate 都可以

支持沉浸式翻译

## Vercel 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyelochick%2Fdeeplx-lb)

### KV 数据库创建

#### 方式一：Vercel KV（推荐，因为方便，个人用足够）

![](https://raw.githubusercontent.com/yelochick/deeplx-lb/main/img/vercel1.png)

![](https://raw.githubusercontent.com/yelochick/deeplx-lb/main/img/vercel2.png)

#### 方式二：[Upstash](https://upstash.com/)（量大管饱）

![](https://raw.githubusercontent.com/yelochick/deeplx-lb/main/img/upstash1.png)

![](https://raw.githubusercontent.com/yelochick/deeplx-lb/main/img/upstash2.png)

![](https://raw.githubusercontent.com/yelochick/deeplx-lb/main/img/upstash3.png)

### 设置环境变量（Vercel KV 和 Upstash 二者选其一）

| 环境变量                   | 说明                                 |
| -------------------------- | ------------------------------------ |
| `KV_REST_API_URL`          | 默认使用                             |
| `KV_REST_API_TOKEN`        | 默认使用                             |
| `UPSTASH_REDIS_REST_URL`   |                                      |
| `UPSTASH_REDIS_REST_TOKEN` |                                      |
| `PASSWORD`                 | 密码验证，不设置时可匿名访问         |
| `IGNORE_KEYWORDS`          | 关键字过滤添加的接口，逗号(英文)分隔 |

### 密码验证

设置了密码验证后，`url`需要带上`password`参数

如：`http://127.0.0.1:1188/translate?password=[PASSWORD]`

## Docker 部署（自行修改环境变量，不然启动失败报错）

```shell
docker run -d -p "1188:1188" -e KV_REST_API_URL="" -e KV_REST_API_TOKEN="" -e PASSWORD="" -e IGNORE_KEYWORDS="" yelochick/deeplx-lb
```

或者

```shell
docker-compose up -d
```

## 沉浸式翻译

![](https://raw.githubusercontent.com/yelochick/deeplx-lb/main/img/immersivetranslate1.png)

![](https://raw.githubusercontent.com/yelochick/deeplx-lb/main/img/immersivetranslate2.png)

## 开发调试

#### 拉取依赖

`pnpm install`

#### 配置环境变量

根目录创建 `.env` 文件并填入环境变量

#### 启动

`pnpm start`