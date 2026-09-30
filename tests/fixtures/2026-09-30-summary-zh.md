---
layout: default
title: "Horizon Summary: 2026-09-30 (ZH)"
date: 2026-09-30
lang: zh
---

> 从 41 条内容中筛选出 12 条重要资讯。

---

**科技新闻**
1. [Web 与移动端对话式 AI 代理隐私分析](#item-tech-news-1) ⭐️ 8.0/10
2. [PostgreSQL 开发者谈 Linux 内核的助力与阻碍](#item-tech-news-2) ⭐️ 8.0/10
3. [OpenAI 开发者大会据称推出 dots 常驻智能体与 GPT-6.1 系列](#item-tech-news-3) ⭐️ 8.0/10
4. [Anthropic 评估智谱 GLM-5.3 网络攻击能力](#item-tech-news-4) ⭐️ 8.0/10
5. [OpenAI GPT-6.1 Sol：宣称接近 Astra 智能，价格仅五分之一](#item-tech-news-5) ⭐️ 7.0/10
6. [America.gov 被指用 Gemini 驱动政府服务助手](#item-tech-news-6) ⭐️ 7.0/10
7. [RustConf 2026：提案让 GPU 成为普通 Rust 编译目标](#item-tech-news-7) ⭐️ 7.0/10
8. [CNNIC：中国生成式 AI 用户破 7 亿，普及率超 50%](#item-tech-news-8) ⭐️ 7.0/10
9. [Cloudflare 推出面向 AI Agent 的 cf CLI 开放测试版](#item-tech-news-9) ⭐️ 7.0/10
10. [谷歌修复 Firebase Analytics 服务端故障致 iOS 应用启动崩溃](#item-tech-news-10) ⭐️ 7.0/10

**科技博客**
1. [LLM 为何“说谎”：幻觉机制与缓解](#item-tech-blog-1) ⭐️ 6.0/10

**财经新闻**
1. [三部门通知：10 月 1 日起首套住房商业贷款贴息年化 1 个百分点、最长 5 年](#item-finance-news-1) ⭐️ 8.0/10

---

## 科技新闻

<a id="item-tech-news-1"></a>

### [Web 与移动端对话式 AI 代理隐私分析](https://jorgegarciaherrero.com/wp-content/interactivos/20260916-Prompt-like-a-butterfly-sting-like-a-tracker-%28clean%29.pdf) ⭐️ 8.0/10

一篇针对 Web 与移动端对话式 AI 代理的技术隐私分析（PDF）于 2026 年 9 月 29 日发布到 Hacker News。当前提供的材料没有论文正文，无法核实其具体测量方法、样本范围或结论；条目说明只概括了该分析主题，并提到社区讨论凸显主要 AI 聊天服务的跟踪与数据处理风险。

hackernews · damaru2 · 9月29日 09:03 · [社区讨论](https://news.ycombinator.com/item?id=49890226)

**「背景」** 根据 IMDEA 机构库中的论文摘要，这项研究对九款主流对话式 AI 服务的网页版与移动版部署做了系统性隐私分析，结合静态与动态分析方法，考察其中第三方广告与追踪服务的存在及行为（tool-2-1）。此前 9 月 21 日的 Horizon 日报曾报道，一篇 Hacker News 博文声称 ChatGPT 通过广告技术采集器推断用户在其他网站上的活动；该说法当时仅出自单一博文、未获独立验证，评论者认为其机制本身属于标准广告技术，真正没有先例的是把它用在 AI 聊天产品上（tool-1-1）。

**「影响」** 对使用相关聊天服务的用户而言，评论中报告的风险是：会话 URL 中的 UUID 并不构成隐私边界，访问历史会话链接可能暴露完整对话，因此这类链接不应被视为可安全分享的匿名地址；至于关闭营销隐私开关等缓解措施是否有效，评论中并未给出验证结果。

**「社区讨论」** 讨论中，有用户报告 ChatGPT 网页版会在点击发送前把未完成的提示词周期性地发往 conversation/prepare 端点，并担心服务端可借此分析写作节奏和思路演变；也有用户将此类隐私问题与训练数据争议类比，主张使用本地或开源模型，并询问关闭营销隐私设置后这些风险是否仍存在。

<details><summary>参考链接</summary>
<ul>
<li><a href="https://www.buchodi.com/chatgpt-now-knows-what-you-do-on-other-websites-via-ad-collector/">2026-09-21 — 博文称 ChatGPT 借广告采集器获知用户站外活动</a></li>
<li><a href="https://dspace.networks.imdea.org/handle/20.500.12761/2073">Prompt like a Butterfly, Sting like a Tracker: A Privacy Analysis of ...</a></li>

</ul>
</details>

**标签**: `#privacy`, `#conversational AI`, `#web tracking`, `#mobile apps`, `#LLM agents`

---
