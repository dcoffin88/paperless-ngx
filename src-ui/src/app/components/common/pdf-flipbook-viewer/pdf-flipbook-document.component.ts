import { Component, inject } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { DocumentService } from 'src/app/services/rest/document.service'
import { PdfFlipbookViewerComponent } from './pdf-flipbook-viewer.component'

@Component({
  selector: 'pngx-pdf-flipbook-document',
  templateUrl: './pdf-flipbook-document.component.html',
  styleUrl: './pdf-flipbook-document.component.scss',
  imports: [PdfFlipbookViewerComponent],
})
export class PdfFlipbookDocumentComponent {
  private readonly route = inject(ActivatedRoute)
  private readonly documentService = inject(DocumentService)

  readonly previewUrl = this.documentService.getPreviewUrl(
    Number(this.route.snapshot.paramMap.get('id'))
  )
}
