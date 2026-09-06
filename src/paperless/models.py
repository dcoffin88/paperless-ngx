from django.core.validators import FileExtensionValidator
from django.core.validators import MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

DEFAULT_SINGLETON_INSTANCE_ID = 1


class AbstractSingletonModel(models.Model):
    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        """
        Always save as the first and only model
        """
        self.pk = DEFAULT_SINGLETON_INSTANCE_ID
        super().save(*args, **kwargs)


class OutputTypeChoices(models.TextChoices):
    """
    Matches to --output-type
    """

    PDF = ("pdf", _("pdf"))
    PDF_A = ("pdfa", _("pdfa"))
    PDF_A1 = ("pdfa-1", _("pdfa-1"))
    PDF_A2 = ("pdfa-2", _("pdfa-2"))
    PDF_A3 = ("pdfa-3", _("pdfa-3"))


class ModeChoices(models.TextChoices):
    """
    Matches to --skip-text, --redo-ocr, --force-ocr
    and our own custom setting
    """

    AUTO = ("auto", _("auto"))
    FORCE = ("force", _("force"))
    REDO = ("redo", _("redo"))
    OFF = ("off", _("off"))


class ArchiveFileGenerationChoices(models.TextChoices):
    """
    Settings to control creation of an archive PDF file
    """

    AUTO = ("auto", _("auto"))
    ALWAYS = ("always", _("always"))
    NEVER = ("never", _("never"))


class CleanChoices(models.TextChoices):
    """
    Matches to --clean, --clean-final
    """

    CLEAN = ("clean", _("clean"))
    FINAL = ("clean-final", _("clean-final"))
    NONE = ("none", _("none"))


class ColorConvertChoices(models.TextChoices):
    """
    Refer to the Ghostscript documentation for valid options
    """

    UNCHANGED = ("LeaveColorUnchanged", _("LeaveColorUnchanged"))
    RGB = ("RGB", _("RGB"))
    INDEPENDENT = ("UseDeviceIndependentColor", _("UseDeviceIndependentColor"))
    GRAY = ("Gray", _("Gray"))
    CMYK = ("CMYK", _("CMYK"))


class ApplicationConfiguration(AbstractSingletonModel):
    """
    Settings which are common across more than 1 parser
    """

    output_type = models.CharField(
        verbose_name=_("Sets the output PDF type"),
        null=True,
        blank=True,
        max_length=8,
        choices=OutputTypeChoices.choices,
    )

    """
    Settings for the Tesseract based OCR parser
    """

    pages = models.PositiveSmallIntegerField(
        verbose_name=_("Do OCR from page 1 to this value"),
        null=True,
        validators=[MinValueValidator(1)],
    )

    language = models.CharField(
        verbose_name=_("Do OCR using these languages"),
        null=True,
        blank=True,
        max_length=32,
    )

    mode = models.CharField(
        verbose_name=_("Sets the OCR mode"),
        null=True,
        blank=True,
        max_length=16,
        choices=ModeChoices.choices,
    )

    archive_file_generation = models.CharField(
        verbose_name=_("Controls archive file generation"),
        null=True,
        blank=True,
        max_length=8,
        choices=ArchiveFileGenerationChoices.choices,
    )

    image_dpi = models.PositiveSmallIntegerField(
        verbose_name=_("Sets image DPI fallback value"),
        null=True,
        validators=[MinValueValidator(1)],
    )

    # Can't call it clean, that's a model method
    unpaper_clean = models.CharField(
        verbose_name=_("Controls the unpaper cleaning"),
        null=True,
        blank=True,
        max_length=16,
        choices=CleanChoices.choices,
    )

    deskew = models.BooleanField(verbose_name=_("Enables deskew"), null=True)

    rotate_pages = models.BooleanField(
        verbose_name=_("Enables page rotation"),
        null=True,
    )

    rotate_pages_threshold = models.FloatField(
        verbose_name=_("Sets the threshold for rotation of pages"),
        null=True,
        validators=[MinValueValidator(0.0)],
    )

    max_image_pixels = models.FloatField(
        verbose_name=_("Sets the maximum image size for decompression"),
        null=True,
        validators=[MinValueValidator(0.0)],
    )

    color_conversion_strategy = models.CharField(
        verbose_name=_("Sets the Ghostscript color conversion strategy"),
        blank=True,
        null=True,
        max_length=32,
        choices=ColorConvertChoices.choices,
    )

    user_args = models.JSONField(
        verbose_name=_("Adds additional user arguments for OCRMyPDF"),
        null=True,
    )

    """
    Settings for the Paperless application
    """

    app_title = models.CharField(
        verbose_name=_("Application title"),
        null=True,
        blank=True,
        max_length=48,
    )

    app_logo = models.FileField(
        verbose_name=_("Application logo"),
        null=True,
        blank=True,
        validators=[
            FileExtensionValidator(allowed_extensions=["jpg", "png", "gif", "svg"]),
        ],
        upload_to="logo/",
    )

    class Meta:
        verbose_name = _("paperless application settings")
        permissions = [
            ("view_global_statistics", "Can view global object counts"),
            ("view_system_monitoring", "Can view system status information"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return "ApplicationConfiguration"
