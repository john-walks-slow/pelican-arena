# 帖子预览（Discourse）

把 Pelican 页面贴进 Discourse 之后会长什么样，先在这里看一眼。

```bash
node scripts/forum-preview/index.js https://pelicanarena.dpdns.org/s/<id>
```

输出到 `.shots/forum-preview/<slug>/`：

- `report.md`：每个变体的判定（图片/iframe 是否被剥离、卡片有没有缩略图）
- `<variant>-desktop.png`、`<variant>-mobile.png`：帖子里的实际排版
- `<variant>.html`：cooking 之后的 HTML，方便对照

默认对比四种发法：

| 变体 | 内容 |
| --- | --- |
| `link` | 只贴链接，Discourse 走 Onebox 生成卡片（有 `og:image` 才带缩略图） |
| `card` | 现有的 `<picture>` + SVG 卡片 |
| `markdown` | `![标题](card.svg)` |
| `iframe` | 直接贴 `<iframe>`，是否保留取决于 `allowed_iframes` |

`--variants` 可只跑其中几个；`--video-url` 会额外生成一个 `<video autoplay muted loop>` 变体。

## 判定依据

- HTML 走的是 Discourse 自己的 sanitizer 规则（`frontend/pretty-text/addon/sanitizer.js` + `allow-lister.js` 的移植），不是「浏览器能不能渲染」的近似。
- iframe 白名单默认用 LinuxDO 当前清单（见 `sanitizer.js` 的 `DEFAULT_IFRAME_ALLOWLIST`），可以用 `--allow "https://a/|https://b/"` 覆盖。
- Onebox 卡片的结构按 discourse core `lib/onebox` 的实际输出拼装；Onebox 的 HTML 由服务端生成，不经过帖子 sanitizer，所以预览时也不洗它。

## 依赖

- Node 22+
- 一个 Chrome/Chromium（脚本会在常见路径中查找，也可以用 `CHROME_PATH` 指定）
- `xss`（devDependency）

## 什么时候它不够用

这是离线近似：Onebox 的线上输出还取决于论坛部署的 Discourse 版本。要确认真实效果，用已登录的账号在 LinuxDO 编辑器里贴一次（预览即可，不必发布）。
