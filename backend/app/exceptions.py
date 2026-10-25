"""Custom domain exceptions for the Syllabus Tracker."""


class SyllabusTrackerError(Exception):
    """Base exception for all domain errors."""
    pass


class SyllabusNotFoundError(SyllabusTrackerError):
    """Raised when a requested syllabus does not exist."""
    def __init__(self, syllabus_id: str):
        self.syllabus_id = syllabus_id
        super().__init__(f"Syllabus with ID '{syllabus_id}' was not found.")


class InvalidLeafError(SyllabusTrackerError):
    """Raised when a leaf ID does not exist or refers to a parent node."""
    def __init__(self, leaf_id: str, message: str = ""):
        self.leaf_id = leaf_id
        msg = message or f"ID '{leaf_id}' is not a valid leaf subtopic in this syllabus."
        super().__init__(msg)


class InvalidNodeError(SyllabusTrackerError):
    """Raised when a branch node ID does not exist in the syllabus."""
    def __init__(self, node_id: str, message: str = ""):
        self.node_id = node_id
        msg = message or f"Node '{node_id}' does not exist in this syllabus."
        super().__init__(msg)


class FileValidationError(SyllabusTrackerError):
    """Raised when an uploaded file violates format, extension, or size limits."""
    pass


class DocumentParserError(SyllabusTrackerError):
    """Raised when parsing or document conversion fails."""
    pass


class ExtractionError(SyllabusTrackerError):
    """Raised when structured LLM extraction or grounding fails."""
    pass


class HierarchyValidationError(SyllabusTrackerError):
    """Raised when the extracted curriculum violates hierarchy rules or grounding invariants."""
    pass
