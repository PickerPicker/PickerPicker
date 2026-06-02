"""src.schemas.word — Word 요청/응답 pydantic 스키마."""
from typing import Literal
from pydantic import BaseModel, Field, model_validator


class KeyMappingItem(BaseModel):
    key: Literal["a", "s", "d", "f", "j", "k", "l", ";"]
    syllable: str = Field(min_length=1, max_length=4)
    type: Literal["valid", "invalid"]


class WordCreateRequest(BaseModel):
    word: str = Field(min_length=1, max_length=20)
    difficulty_level: int = Field(ge=1, le=5)
    bpm: int = Field(ge=60, le=300)
    input_length: int = Field(ge=8, le=200)
    valid_syllables: list[str] = Field(min_length=1)
    invalid_syllables: list[str]
    input_syllables: list[str]
    key_mapping: list[KeyMappingItem] = Field(min_length=8, max_length=8)
    fixed_stage: int | None = Field(default=None, ge=1, le=15)

    @model_validator(mode="after")
    def check_consistency(self):
        if len(self.input_syllables) != self.input_length:
            raise ValueError("input_syllables 길이가 input_length와 불일치")
        keys = {km.key for km in self.key_mapping}
        if keys != {"a", "s", "d", "f", "j", "k", "l", ";"}:
            raise ValueError("key_mapping은 a/s/d/f/j/k/l/; 8개 키 모두 포함해야 함")
        all_syl = set(self.valid_syllables) | set(self.invalid_syllables)
        km_syl = {km.syllable for km in self.key_mapping}
        if all_syl != km_syl:
            raise ValueError("valid+invalid 음절과 key_mapping 음절 집합이 불일치")
        if not all(s in all_syl for s in self.input_syllables):
            raise ValueError("input_syllables에 정의되지 않은 음절 포함")
        return self


class WordUpdateRequest(WordCreateRequest):
    """Update = Create와 동일 검증."""
    pass


class WordResponse(BaseModel):
    id: int
    word: str
    difficulty_level: int
    bpm: int
    input_length: int
    valid_syllables: list[str]
    invalid_syllables: list[str]
    input_syllables: list[str]
    key_mapping: list[dict]
    fixed_stage: int | None
    is_active: bool

    model_config = {"from_attributes": True}
