declare module 'flipbook-viewer' {
  export interface FlipbookPage {
    img: CanvasImageSource
    num: number
    width: number
    height: number
  }

  export interface FlipbookBook {
    pdf?: unknown
    numPages: () => number
    getPage: (
      num: number,
      callback: (error?: unknown, page?: FlipbookPage) => void
    ) => void
  }

  export interface FlipbookOptions {
    backgroundColor?: string
    boxBorder?: number
    height?: number
    margin?: number
    marginLeft?: number
    marginTop?: number
    singlepage?: boolean
    width?: number
  }

  export interface FlipbookViewer {
    page_count: number
    flip_back: () => void
    flip_forward: () => void
    on: (event: 'seen', callback: (page: number) => void) => void
    zoom: (level?: number) => void
  }

  export function init(
    book: FlipbookBook,
    elementOrId: Element | string,
    options: FlipbookOptions,
    callback: (error?: unknown, viewer?: FlipbookViewer) => void
  ): void
}
