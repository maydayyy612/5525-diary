/**
 * 5525-DIARY 演出记录数据
 * ------------------------------------------
 * 每一条记录就是一张"票根"。想要新增一场演出，
 * 直接在下面的数组里复制一份 { ... } 对象，改好内容即可，
 * 不需要动 HTML 或 CSS。
 *
 * 字段说明：
 *  date     必填，格式 "YYYY-MM-DD"，用于排序
 *  artist   必填，演出者 / 乐队名
 *  venue    必填，场地名称
 *  city     必填，城市
 *  price    选填，票价（数字，单位元），不填则不显示价格标签
 *  rating   选填，评分 1-5（用打孔圆点表示），不填默认 0
 *  photo    选填，票根照片路径，例如 "photos/2024-11-23.jpg"
 *           把照片放进 photos 文件夹，这里填相对路径即可；不填就不显示图片
 *  setlist  选填，曲目 / 设置单，字符串数组
 *  notes    选填，观后感想
 */

const performances = [
  {
    date: "2024-11-23",
    artist: "落日飞车 Sunset Rollercoaster",
    venue: "Modernsky Lab",
    city: "北京",
    price: 380,
    rating: 5,
    photo: "",
    setlist: ["Vanilla Villa", "My Jinji", "White Sugar", "Days I Wanna See U Again"],
    notes: "全场大合唱到最后一首，出来的时候耳朵还在嗡嗡响。值得再看十次。"
  },
  {
    date: "2024-08-02",
    artist: "五条人",
    venue: "MAO Livehouse",
    city: "上海",
    price: 320,
    rating: 4,
    photo: "",
    setlist: ["县城记", "阿珍爱上了阿强", "踩架崩楼"],
    notes: "台下比台上还热闹，仁科一句方言逗笑全场。"
  },
  {
    date: "2023-05-14",
    artist: "万能青年旅店",
    venue: "疆进酒livehouse",
    city: "北京",
    price: 450,
    rating: 5,
    photo: "",
    setlist: ["杀死那个石家庄人", "十万嬉皮", "秦皇岛"],
    notes: "第一次现场听到《杀死那个石家庄人》前奏，整个人起鸡皮疙瘩。"
  }
];
