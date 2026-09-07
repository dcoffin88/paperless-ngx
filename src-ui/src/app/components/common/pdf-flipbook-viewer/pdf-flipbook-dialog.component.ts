import { Component, Input, inject } from '@angular/core'
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap'

import { PdfFlipbookViewerComponent } from './pdf-flipbook-viewer.component'

@Component({
  selector: 'pngx-pdf-flipbook-dialog',
  templateUrl: './pdf-flipbook-dialog.component.html',
  styleUrl: './pdf-flipbook-dialog.component.scss',
  imports: [PdfFlipbookViewerComponent],
})
export class PdfFlipbookDialogComponent {
  private readonly activeModal = inject(NgbActiveModal)

  @Input() src: string
  @Input() title: string

  close(): void {
    this.activeModal.dismiss()
  }
}
