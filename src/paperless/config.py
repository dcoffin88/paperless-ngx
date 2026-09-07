import dataclasses
import json

from django.conf import settings

from paperless.models import ApplicationConfiguration
from paperless.models import ArchiveFileGenerationChoices
from paperless.models import CleanChoices
from paperless.models import ColorConvertChoices
from paperless.models import ModeChoices
from paperless.models import OutputTypeChoices


@dataclasses.dataclass
class BaseConfig:
    """
    Almost all parsers care about the chosen PDF output format
    """

    @staticmethod
    def _get_config_instance() -> ApplicationConfiguration:
        app_config = ApplicationConfiguration.objects.all().first()
        # Workaround for a test where the migration hasn't run to create the single model
        if app_config is None:
            ApplicationConfiguration.objects.create()
            app_config = ApplicationConfiguration.objects.all().first()
        return app_config


@dataclasses.dataclass
class OutputTypeConfig(BaseConfig):
    """
    Almost all parsers care about the chosen PDF output format
    """

    output_type: OutputTypeChoices = dataclasses.field(init=False)

    def __post_init__(self) -> None:
        app_config = self._get_config_instance()

        self.output_type = app_config.output_type or OutputTypeChoices(
            settings.OCR_OUTPUT_TYPE,
        )


@dataclasses.dataclass
class OcrConfig(OutputTypeConfig):
    """
    Specific settings for the Tesseract based parser.  Options generally
    correspond almost directly to the OCRMyPDF options
    """

    pages: int | None = dataclasses.field(init=False)
    language: str = dataclasses.field(init=False)
    mode: ModeChoices = dataclasses.field(init=False)
    archive_file_generation: ArchiveFileGenerationChoices = dataclasses.field(
        init=False,
    )
    image_dpi: int | None = dataclasses.field(init=False)
    clean: CleanChoices = dataclasses.field(init=False)
    deskew: bool = dataclasses.field(init=False)
    rotate: bool = dataclasses.field(init=False)
    rotate_threshold: float = dataclasses.field(init=False)
    max_image_pixel: float | None = dataclasses.field(init=False)
    color_conversion_strategy: ColorConvertChoices = dataclasses.field(init=False)
    user_args: dict[str, str] | None = dataclasses.field(init=False)

    def __post_init__(self) -> None:
        super().__post_init__()

        app_config = self._get_config_instance()

        self.pages = app_config.pages or settings.OCR_PAGES
        self.language = app_config.language or settings.OCR_LANGUAGE
        self.mode = app_config.mode or ModeChoices(settings.OCR_MODE)
        self.archive_file_generation = (
            app_config.archive_file_generation
            or ArchiveFileGenerationChoices(settings.ARCHIVE_FILE_GENERATION)
        )
        self.image_dpi = app_config.image_dpi or settings.OCR_IMAGE_DPI
        self.clean = app_config.unpaper_clean or CleanChoices(settings.OCR_CLEAN)
        self.deskew = (
            app_config.deskew if app_config.deskew is not None else settings.OCR_DESKEW
        )
        self.rotate = (
            app_config.rotate_pages
            if app_config.rotate_pages is not None
            else settings.OCR_ROTATE_PAGES
        )
        self.rotate_threshold = (
            app_config.rotate_pages_threshold or settings.OCR_ROTATE_PAGES_THRESHOLD
        )
        self.max_image_pixel = (
            app_config.max_image_pixels or settings.OCR_MAX_IMAGE_PIXELS
        )
        self.color_conversion_strategy = (
            app_config.color_conversion_strategy
            or ColorConvertChoices(settings.OCR_COLOR_CONVERSION_STRATEGY)
        )

        user_args = None
        if app_config.user_args:
            user_args = app_config.user_args
        elif settings.OCR_USER_ARGS is not None:  # pragma: no cover
            try:
                user_args = json.loads(settings.OCR_USER_ARGS)
            except json.JSONDecodeError:
                user_args = {}
        self.user_args = user_args


@dataclasses.dataclass
class GeneralConfig(BaseConfig):
    """
    General application settings that require global scope
    """

    app_title: str = dataclasses.field(init=False)
    app_logo: str = dataclasses.field(init=False)

    def __post_init__(self) -> None:
        app_config = self._get_config_instance()

        self.app_title = app_config.app_title or None
        self.app_logo = app_config.app_logo.url if app_config.app_logo else None

