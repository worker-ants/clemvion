# 정식 규약 준수 검토 결과

검토 대상: `spec/2-navigation/6-config.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-16

---

## 발견사항

### [CRITICAL] R-1 에서 미구현(Planned) 에러 코드 `LLM_MODEL_NOT_FOUND` 를 기정사실로 서술

- **target 위치**: `spec/2-navigation/6-config.md` §Rationale R-1 (line 293)
  - 본문: "잘못된 모델 ID ... 가 저장되면 실제 호출 시점에 `LLM_MODEL_NOT_FOUND` 로 실패한다."
- **위반 규약**: `spec/conventions/error-codes.md §1 — 의미 기반 명명 원칙 + 적용 범위`
  - error-codes.md 의 §5 Rename 이력은 `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING`, `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 로 `LLM_*` prefix 가 `MODEL_CONFIG_*` 로 통일됐음을 명시한다.
  - `LLM_MODEL_NOT_FOUND` 는 활성 에러 코드 카탈로그(`spec/5-system/3-error-handling.md`)에 등재되지 않은 코드다.
  - `spec/5-system/7-llm-client.md §5` 는 `LLM_MODEL_NOT_FOUND` 를 "**미구현(Planned)**" 세분화 에러 코드로 명시하며, 현재는 `LLM_CONNECTION_ERROR` 로 수렴됨을 기술한다.
- **상세**: target 문서 R-1 이 `LLM_MODEL_NOT_FOUND` 를 현재 실제로 발행되는 코드처럼 서술하고 있으나, 이 코드는 (1) 활성 카탈로그에 없고, (2) llm-client spec 에서 명시적으로 Planned 미구현으로 분류된다. 더불어 `LLM_*` prefix 체계는 PR4b 에서 `MODEL_CONFIG_*` 로 통일됐으므로 신규 코드가 구 prefix 를 따르는 것도 error-codes.md 명명 원칙과 어긋난다. 사용자가 이 spec 을 보고 구현하면 존재하지 않는 에러 코드를 에러 처리에 사용할 수 있다.
- **제안**: R-1 의 해당 문장을 다음 중 하나로 수정한다.
  - 현행 동작 기준: "`LLM_MODEL_NOT_FOUND` 로 실패한다" → "LLM 호출 레이어에서 에러로 실패한다 (현재 `LLM_CONNECTION_ERROR` 수렴; 세분화 코드 `LLM_MODEL_NOT_FOUND` 는 Planned — `spec/5-system/7-llm-client.md §5`)"
  - 또는 단순화: "런타임 LLM 호출 에러로 실패한다"

---

### [INFO] §3. API 섹션 제목의 번호 체계 비일관

- **target 위치**: `spec/2-navigation/6-config.md` line 254 — `## 3. API`
- **위반 규약**: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
  - 본 문서는 H2 레벨 섹션을 "Part A:", "Part B:", "3. API", "Rationale" 로 혼용한다. "Part A/B" 는 알파벳 레이블, "3. API" 는 숫자 레이블로 일관되지 않다.
- **상세**: Overview → Part A → Part B → 3. API → Rationale 구성에서 "3. API" 만 숫자 prefix 를 사용한다. CLAUDE.md 의 3섹션 권장(Overview / 본문 / Rationale) 범주에서 본문 내 하위 섹션 명명은 자유이나, 동일 계층 섹션의 스타일 혼용은 문서 내 일관성 문제다.
- **제안**: `## 3. API` → `## API` 로 숫자 prefix 제거 (또는 Part A/B 도 `## 1. Part A` 등으로 통일). 경미한 스타일 이슈라 규약 갱신은 불필요.

---

## 요약

`spec/2-navigation/6-config.md` 는 frontmatter 스키마(`id: config`, `status: partial`, `pending_plans`, `code:`) 를 `spec/conventions/spec-impl-evidence.md` 규약대로 정확히 준수하고 있다. 감사 액션 `auth_config.reveal` 은 `spec/conventions/audit-actions.md §3` 의 `auth_config | 현재형(§2.2) | reveal` 등재와 일치한다. `FORBIDDEN` / `MODEL_CONFIG_INVALID` 에러 코드 참조도 활성 카탈로그(`3-error-handling.md`) 와 일치한다. 단, Rationale R-1 에서 미구현(Planned) 에러 코드 `LLM_MODEL_NOT_FOUND` 를 현재 발행되는 코드처럼 서술하는 것은 `spec/conventions/error-codes.md` 의 적용 범위(프로젝트 전체 에러 코드 문자열)와 `spec/5-system/7-llm-client.md` 의 Planned 분류에 위배되며, 독자가 존재하지 않는 코드를 구현에 사용할 위험이 있다. API 섹션 제목의 번호 스타일 비일관은 사소한 형식 문제다.

---

## 위험도

MEDIUM
