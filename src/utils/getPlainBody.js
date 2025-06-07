const { QuillDeltaToHtmlConverter } = require('quill-delta-to-html');
const { htmlToText } = require('html-to-text');

function extractPlainTextFromQuill(delta, wordLimit = 30) {
  try {
    const converter = new QuillDeltaToHtmlConverter(delta?.ops || [], {});
    const html = converter.convert();
    const fullText = htmlToText(html, {
      wordwrap: false,
      selectors: [{ selector: 'a', options: { ignoreHref: true } }],
    });

    // Cắt số lượng từ mong muốn
    const words = fullText.trim().split(/\s+/).slice(0, wordLimit);
    const preview = words.join(' ');

    // Nếu còn nội dung, thêm dấu "..."
    return fullText.split(/\s+/).length > wordLimit ? preview + '...' : preview;
  } catch (err) {
    console.error('Error extracting plain text from quill body:', err);
    return '';
  }
}

module.exports = { extractPlainTextFromQuill };


// const delta = {
//   "ops": [
//     {
//       "insert": "Hello, this is a auto reply message.Thank you for contact\n"
//     },
//     {
//       "insert": "Bold text",
//       "attributes": {
//         "bold": true
//       }
//     },
//     {
//       "insert": "\n"
//     }
//   ]
// }

// console.log(extractPlainTextFromQuill(delta))
