import {
  AfterViewInit,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core'
import type {
  FlipbookBook,
  FlipbookPage,
  FlipbookViewer,
} from 'flipbook-viewer'
import * as flipbookViewer from 'flipbook-viewer'
import { NgxBootstrapIconsModule } from 'ngx-bootstrap-icons'
import {
  getDocument,
  GlobalWorkerOptions,
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs'

@Component({
  selector: 'pngx-pdf-flipbook-viewer',
  templateUrl: './pdf-flipbook-viewer.component.html',
  styleUrl: './pdf-flipbook-viewer.component.scss',
  imports: [NgxBootstrapIconsModule],
})
export class PdfFlipbookViewerComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  private readonly document = inject<Document>(DOCUMENT)

  @Input() src!: string
  @Input() sourceRevision = 0
  @Input() password?: string

  @ViewChild('container', { static: true })
  private readonly container!: ElementRef<HTMLDivElement>

  readonly loading = signal(false)
  readonly error = signal(false)
  readonly ready = signal(false)
  readonly loadingMessage = signal($localize`Loading...`)

  private initialized = false
  private loadingTask?: PDFDocumentLoadingTask
  private pdf?: PDFDocumentProxy
  private viewer?: FlipbookViewer
  private resizeObserver?: ResizeObserver
  private renderGeneration = 0
  private pageCache = new Map<number, FlipbookPage>()
  private pointerStartX?: number
  private resizeTimer?: number

  ngAfterViewInit(): void {
    this.initialized = true
    this.resizeObserver = new ResizeObserver(() => this.scheduleReload())
    this.resizeObserver.observe(this.container.nativeElement)
    this.load()
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      this.initialized &&
      (changes['src'] || changes['sourceRevision'] || changes['password'])
    ) {
      this.load()
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect()
    if (this.resizeTimer) window.clearTimeout(this.resizeTimer)
    this.destroy()
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault()
      this.nextPage()
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault()
      this.previousPage()
    }
  }

  onPointerDown(event: PointerEvent): void {
    this.pointerStartX = event.clientX
  }

  onPointerUp(event: PointerEvent): void {
    if (this.pointerStartX === undefined) return
    const delta = event.clientX - this.pointerStartX
    this.pointerStartX = undefined
    if (Math.abs(delta) < 50) return
    delta < 0 ? this.nextPage() : this.previousPage()
  }

  nextPage(): void {
    this.viewer?.flip_forward()
  }

  previousPage(): void {
    this.viewer?.flip_back()
  }

  zoomIn(): void {
    this.viewer?.zoom(2)
  }

  zoomOut(): void {
    this.viewer?.zoom(0)
  }

  toggleFullscreen(): void {
    if (this.document.fullscreenElement) {
      this.document.exitFullscreen()
      return
    }
    this.container.nativeElement.parentElement?.requestFullscreen()
  }

  download(): void {
    const link = this.document.createElement('a')
    link.href = this.src
    link.download = ''
    link.target = '_blank'
    this.document.body.appendChild(link)
    link.click()
    link.remove()
  }

  print(): void {
    const frame = this.document.createElement('iframe')
    frame.style.position = 'fixed'
    frame.style.right = '0'
    frame.style.bottom = '0'
    frame.style.width = '0'
    frame.style.height = '0'
    frame.style.border = '0'
    frame.onload = () => {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    }
    frame.src = this.src
    this.document.body.appendChild(frame)
  }

  private async load(): Promise<void> {
    if (!this.initialized || !this.src) return

    const generation = ++this.renderGeneration
    this.loading.set(true)
    this.loadingMessage.set($localize`Loading...`)
    this.error.set(false)
    this.ready.set(false)
    this.destroy()

    try {
      GlobalWorkerOptions.workerSrc = new URL(
        'assets/js/pdf.worker.min.mjs',
        this.documentBaseUri()
      ).toString()
      this.loadingTask = getDocument({
        url: this.src,
        password: this.password,
        withCredentials: true,
        wasmUrl: new URL('assets/wasm/', this.documentBaseUri()).toString(),
        iccUrl: new URL('assets/iccs/', this.documentBaseUri()).toString(),
      })
      this.pdf = await this.loadingTask.promise
      if (generation !== this.renderGeneration) return
      if (this.shouldPreloadPageCache()) {
        await this.preloadPages(this.pdf, generation)
        if (generation !== this.renderGeneration) return
      }
      this.renderFlipbook(generation)
    } catch (err) {
      if (generation !== this.renderGeneration) return
      this.error.set(true)
      this.loading.set(false)
    }
  }

  private renderFlipbook(generation: number): void {
    if (!this.pdf) return

    this.container.nativeElement.replaceChildren()
    const book = this.createBookProvider(this.pdf)
    const rect = this.container.nativeElement.getBoundingClientRect()
    const singlepage = rect.width < 768

    flipbookViewer.init(
      book,
      this.container.nativeElement,
      {
        backgroundColor: '#2f2d2f',
        boxBorder: 0,
        height: Math.max(Math.floor(rect.height), 320),
        margin: 6,
        singlepage,
        width: Math.max(Math.floor(rect.width), 320),
      },
      (err, viewer) => {
        if (generation !== this.renderGeneration) return
        if (err || !viewer) {
          this.error.set(true)
          this.loading.set(false)
          return
        }
        this.viewer = viewer
        this.ready.set(true)
        this.loading.set(false)
        this.container.nativeElement.parentElement?.focus()
      }
    )
  }

  private createBookProvider(pdf: PDFDocumentProxy): FlipbookBook {
    return {
      pdf,
      numPages: () => pdf.numPages,
      getPage: (num, callback) => this.getPage(pdf, num, callback),
    }
  }

  private getPage(
    pdf: PDFDocumentProxy,
    num: number,
    callback: (error?: unknown, page?: FlipbookPage) => void
  ): void {
    if (num < 1 || num > pdf.numPages) {
      callback()
      return
    }
    const cached = this.pageCache.get(num)
    if (cached) {
      callback(null, cached)
      return
    }

    this.renderPage(pdf, num)
      .then((flipbookPage) => {
        this.pageCache.set(num, flipbookPage)
        callback(null, flipbookPage)
      })
      .catch((err) => callback(err))
  }

  private async preloadPages(
    pdf: PDFDocumentProxy,
    generation: number
  ): Promise<void> {
    for (let num = 1; num <= pdf.numPages; num++) {
      if (generation !== this.renderGeneration) return
      this.loadingMessage.set(
        $localize`Loading page ${num} of ${pdf.numPages}...`
      )
      if (!this.pageCache.has(num)) {
        this.pageCache.set(num, await this.renderPage(pdf, num))
      }
    }
    this.loadingMessage.set($localize`Loading...`)
  }

  private shouldPreloadPageCache(): boolean {
    return this.container.nativeElement.getBoundingClientRect().width >= 768
  }

  private renderPage(
    pdf: PDFDocumentProxy,
    num: number
  ): Promise<FlipbookPage> {
    return pdf
      .getPage(num)
      .then((page) => {
        const scale = 1.5
        const viewport = page.getViewport({ scale })
        const outputScale = window.devicePixelRatio || 1
        const canvas = this.document.createElement('canvas')
        canvas.width = Math.floor(viewport.width * outputScale)
        canvas.height = Math.floor(viewport.height * outputScale)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null
        return page
          .render({
            canvas,
            canvasContext: canvas.getContext('2d'),
            transform,
            viewport,
          })
          .promise.then(
            () =>
              new Promise<FlipbookPage>((resolve) => {
                const img = new Image()
                img.src = canvas.toDataURL()
                img.addEventListener('load', () => {
                  resolve({
                    img,
                    num,
                    width: img.width,
                    height: img.height,
                  })
                })
              })
          )
      })
  }

  private scheduleReload(): void {
    if (!this.initialized || !this.pdf) return
    if (this.resizeTimer) window.clearTimeout(this.resizeTimer)
    this.resizeTimer = window.setTimeout(() => {
      const generation = ++this.renderGeneration
      this.ready.set(false)
      this.renderFlipbook(generation)
    }, 250)
  }

  private destroy(): void {
    this.viewer = undefined
    this.loadingTask?.destroy()
    this.loadingTask = undefined
    this.pdf?.cleanup()
    this.pdf = undefined
    this.pageCache.clear()
    this.container?.nativeElement.replaceChildren()
  }

  private documentBaseUri(): string {
    return (this.document as Document & { baseURI: string }).baseURI
  }
}
