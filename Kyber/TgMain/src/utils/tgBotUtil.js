const { Api } = require("telegram");

function inlineButtons() {
  return new Api.ReplyInlineMarkup({
    rows: [
      new Api.KeyboardButtonRow({
        buttons: [
          new Api.KeyboardButtonUrl({
            text: "🌐 打开网站",
            url: "https://example.com",
          }),
          new Api.KeyboardButtonCallback({
            text: "⚡ 回调按钮",
            data: Buffer.from("my_callback"),
          }),
        ],
      }),
    ],
  });
}

module.exports = { inlineButtons };
