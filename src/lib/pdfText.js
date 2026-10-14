/*
 * Pulls the text out of a resume PDF, in the browser. The whole text is saved and sent to Gemini as is.
 * pdf.js is large, so it's only downloaded when someone actually uploads a resume.
 */

// Fewer characters than this means the PDF is most likely a scanned image with no real text in it
const MIN_RESUME_CHARS = 200

export function isPdfFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

/** → the PDF's text, page by page. Throws a message that can be shown as is. */
export async function extractPdfText(file) {
  // The legacy build brings its own copies of newer JavaScript features (like Promise.try),
  // so uploading works on older phones and browsers too, not just the latest ones
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  // In pdf.js v6 the loading task (not the document) is what frees the worker afterwards
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() })
  let pdf
  try {
    pdf = await loadingTask.promise
  } catch {
    loadingTask.destroy()
    throw new Error('Couldn’t open this file as a PDF. Please upload a PDF file.')
  }

  try {
    const pageTexts = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const { items } = await page.getTextContent()
      // Each item is a run of text; hasEOL marks where a line ends
      pageTexts.push(items.map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : ' ')).join(''))
    }
    const text = pageTexts
      .join('\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (text.length < MIN_RESUME_CHARS) {
      throw new Error('This PDF has almost no text in it (it may be a scanned image). Export your resume as a text PDF and try again.')
    }
    return text
  } finally {
    loadingTask.destroy()
  }
}
