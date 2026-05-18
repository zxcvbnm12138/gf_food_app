const lovePoems = [
  { text: '执子之手，与子偕老。', source: '佚名《诗经·击鼓》' },
  { text: '死生契阔，与子成说。', source: '佚名《诗经·击鼓》' },
  { text: '窈窕淑女，君子好逑。', source: '佚名《诗经·关雎》' },
  { text: '青青子衿，悠悠我心。', source: '佚名《诗经·子衿》' },
  { text: '一日不见，如三月兮。', source: '佚名《诗经·子衿》' },
  { text: '愿得一心人，白头不相离。', source: '卓文君《白头吟》' },
  { text: '只愿君心似我心。', source: '李之仪《卜算子》' },
  { text: '日日思君不见君。', source: '李之仪《卜算子》' },
  { text: '思君如满月，夜夜减清辉。', source: '张九龄《赋得自君之出矣》' },
  { text: '入我相思门，知我相思苦。', source: '李白《三五七言》' },
  { text: '君为女萝草，妾作菟丝花。', source: '李白《古意》' },
  { text: '同心而离居，忧伤以终老。', source: '佚名《古诗十九首》' },
]

export function getDailyLovePoem(date = new Date()) {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  const index = (seed * 9301 + 49297) % lovePoems.length
  return lovePoems[index]
}
