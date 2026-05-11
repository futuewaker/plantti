# PLANTTI · 植塑测试

> 一封从你本命植物寄来的信。
> 24 种植物,总有一种说的是你。

PLANTTI 是 [PETTI 宠格测试](https://petti.pages.dev) 的姐妹站,把"本命动物"的设定换成了"本命植物"——面向 18-24 岁女生,语境放在花店、阳台、飘窗、朋友圈,语调治愈+元气+萌系。纯静态单页 SPA,受 [SBTI](https://sbti.unun.dev) 启发。

## 核心机制

- **18 道问题**(6 维度 × 3 题),每题 3 个选项,场景化 + 量表 混搭
- **6 个维度**:视觉浓度 / 元气指数 / 梦幻指数 / 省心指数 / 季节限定 / 群植浓度
- **24 种预设植物**(国民 / 网红 / 精致 三桶各 8 种),**纯标签投票**算法:每个选项预设命中哪些植物,统计总命中数最高者胜出;平票走王牌题(trump)+ random fallback
- 输出:植物图片 + slogan + 性格标签 + 植物视角人格解读 + 雷达图 + 长截图分享

## 技术栈

- 原生 HTML + CSS + JavaScript,零依赖
- Google Fonts 加载像素风字体
- Mobile-first 响应式(max-width 480px 居中)
- 部署目标:**Cloudflare Pages**(也兼容 GitHub Pages / Vercel)

## 本地运行

```bash
python3 -m http.server 8765
# 访问 http://localhost:8765
```

## Cloudflare Pages 部署

```bash
npx wrangler pages deploy . --project-name plantti
# 上线后访问 plantti.pages.dev
```

## 文件结构

```
plantti/
├── index.html           # 结构
├── styles.css           # 样式
├── app.js               # 逻辑(6 维度标签投票)
├── data/
│   ├── questions.json   # 18 道题
│   └── types.json       # 24 种植物档案
├── images/              # 24 张植物图片 + qr-plantti-placeholder.png
└── wrangler.jsonc       # Cloudflare Pages 配置
```

## 修改内容

- **问题**:编辑 `data/questions.json`
- **植物档案**:编辑 `data/types.json`,可调整 `vector`、`slogan`、`tags`、`interpretation`
- **配色**:`styles.css` 顶部 `:root` CSS 变量
