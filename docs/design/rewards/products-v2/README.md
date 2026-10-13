# 激励商品与配图第二版

2026-10-13。用户要求：个性装扮清空并提示后续添加，生活奖励保留奶茶/咖啡、新增零食、移除衣服/图书；网络寻找小刘鸭相关配图，不复用现有背景。

## 已选择素材

| 展示项 | 内容 | 网络来源 |
| --- | --- | --- |
| 奶茶 | 戴帽小鸭喝珍珠奶茶 | [Pinterest原图条目](https://au.pinterest.com/pin/cute-duck-drinking-bubble-tea-by-chinese-illustrator--309411436905456361/) |
| 咖啡 | 蓝衬衣小鸭手持外带杯，作为咖啡配图 | [配图网头像条目](https://www.keaitupian.cn/touxiang/42286_3.html) |
| 零食 | 小鸭抱饼干 | [头像控原图条目](https://touxiangkong.com/touxiang/71669.html) |

原图已逐张查看，三个原文件均为方形，完整缩小至500×500，无裁切/抠图/重绘/改色；运行时WebP与缩小后的RGB逐像素一致。未采用网上其他鸭子IP、AI图片或现有背景及其裁切。配图是展示用插画，不代表真实品牌联名、包装或指定口味。

素材归原权利人，Duckyo / 小刘鸭；转载页与图片URL、原尺寸、哈希均记录于[SOURCES.json](./SOURCES.json)，不声称官方合作或独立核验再分发许可。未选的电脑/咖啡纵图作为候选参考存档，不发布到运行时。

## 接入和验证

三图位于web/rewards/duckyo，reward-assets.js为可信素材表，构建复制并纳入精确PWA缓存。页面不直接热链第三方图片，不执行金币扣款或库存变化。商品详情与商品卡图片对应、图片失败有文字回退；卡面透明度与不透明弹窗保持。

104项测试、构建、六项基础通信通过；320/390/1280px无横向溢出，三图加载，详情焦点/禁用兑换正确，个性装扮无商品并保留分类动画和滚动范围。

实际界面：[手机](./previews/mobile.png)、[电脑](./previews/desktop.png)、[咖啡详情](./previews/coffee-dialog.png)、[个性装扮](./previews/personalization.png)。价格、规格和领取方式后续确定；正式发布记录见REWARDS.md和ROADMAP.md。
