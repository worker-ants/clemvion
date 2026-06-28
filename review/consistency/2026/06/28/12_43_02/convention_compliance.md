# 정식 규약 준수 검토 결과

검토 범위: `spec/5-system/` (diff-base: `origin/main`)
변경된 파일: `spec/5-system/12-webhook.md`, `spec/5-system/3-error-handling.md`
검토 일시: 2026-06-28

---

## 발견사항

### 1. [WARNING] `12-webhook.md §5.2` "구현" 불릿의 내부 분류 문자열 목록이 불완전

- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/spec/5-system/12-webhook.md` 314행 — "구현" 불릿
- **위반 규약**: `spec/conventions/error-codes.md §4` (내부 전용 분류 코드·정규화 패턴 문서화 일관성)
- **상세**: "구현" 불릿은 내부 분류 문자열을 `(missing_required/coerce_failed, [error-codes 규약 §4]...)` 로 나열하지만 `invalid_schema` 를 생략했다. 동일 문장 내 후반부는 "위 public field code 로 정규화한다" 고 쓰는데 세 번째 케이스(`invalid_schema` → `INVALID_SCHEMA`)가 목록에 빠져 독자가 매핑을 추론해야 한다.
  - `3-error-handling.md §1.7` 각주는 `missing_required/coerce_failed/invalid_schema` 세 가지 모두 명시.
  - `spec/4-nodes/7-trigger/1-manual-trigger.md` 181행도 세 가지 모두 열거.
  - 구현 코드(`trigger-parameter.types.ts` 13·24·40행)도 세 가지 모두 지원.
  - 결과적으로 `12-webhook.md §5.2` 의 불릿만 두 가지만 적시해 cross-reference 불일치를 만든다.
- **제안**: 불릿을 `(missing_required/coerce_failed/invalid_schema, [error-codes 규약 §4]...)` 로 수정해 나머지 문서·구현과 일치시킨다.

---

### 2. [WARNING] `12-webhook.md §5.2` JSON 예시에 `INVALID_SCHEMA` 케이스 미포함

- **target 위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/spec/5-system/12-webhook.md` 298–310행 — JSON 코드 블록
- **위반 규약**: `spec/conventions/node-output.md Principle 11` — "Case 별 예시 문서화 규칙" (출력 케이스별 분리 요구)
- **상세**: JSON 예시는 `MISSING_REQUIRED_FIELD` / `TYPE_COERCION_FAILED` 두 케이스만 보여주고, 동 섹션 내 텍스트(`error.details[]` 불릿)와 `3-error-handling.md §1.7` 각주가 공표하는 세 번째 케이스 `INVALID_SCHEMA` 는 예시에 없다. API 응답 포맷 규약(§5.3) 준수 여부를 독자가 직접 판단하기 어렵다.
- **제안**: JSON 예시에 `{ "field": "(root)", "code": "INVALID_SCHEMA", "message": "..." }` 항목을 추가하거나, 본문 불릿에 "위 두 케이스 외 스키마 위반 시 `INVALID_SCHEMA` 가 산출된다" 는 별도 설명을 보강한다. 케이스가 많다면 Principle 11 패턴대로 "Case: 스키마 위반" 분리 블록을 두는 것도 허용된다.

---

### 3. [INFO] `INVALID_SCHEMA` 가 `3-error-handling.md §1.7` 표 본행이 아닌 각주에만 등재

- **target 위치**: `/Volumes/project/private/clemvion/.claire/worktrees/competent-mirzakhani-34a96a/spec/5-system/3-error-handling.md` 132–140행
- **위반 규약**: `spec/conventions/error-codes.md §1` 의미 기반 명명 + 카탈로그 가시성 원칙 (표준 카탈로그는 테이블 행으로 등재하는 것이 관례)
- **상세**: `MISSING_REQUIRED_FIELD` / `TYPE_COERCION_FAILED` / `INVALID_SCHEMA` 는 `INVALID_WEBHOOK_PAYLOAD` 봉투의 `details[].code` 에 클라이언트로 노출되는 public field code 다. `§1.7` 테이블에는 최상위 코드(`INVALID_WEBHOOK_PAYLOAD` 등) 5종만 나열되어 있고, 세 field code 는 각주 문단에만 서술되어 있어 카탈로그 테이블 검색 시 누락될 수 있다. `error-codes.md §1` 이 적용 범위를 "API·통합·OAuth 등 인라인 문자열 리터럴 포함 전체" 로 명시하므로, `details[].code` 도 동일 공개 코드 계약에 해당한다.
- **제안**: 현황에서 크리티컬 위반은 아니다. `§1.7` 표 아래에 sub-table 또는 별도 note 로 field-level code 세 종을 명시적으로 등재하거나, 각주 문단에 "본 세 코드는 `UPPER_SNAKE_CASE` 공개 코드 계약을 따른다" 를 한 줄 추가해 규약 준수를 명시한다. 규약 자체를 갱신할 필요는 없다.

---

## 요약

변경된 두 파일(`12-webhook.md`, `3-error-handling.md`)의 핵심 변경 — webhook 파라미터 에러 상세를 "Planned"에서 "구현"으로 승격 — 은 `UPPER_SNAKE_CASE` 에러 코드 명명 규약(`error-codes.md §1`, `node-output.md §3.2`), API 에러 봉투 포맷(`2-api-convention.md §5.3`), 내부 분류 코드 패턴(`error-codes.md §4`) 관점에서 전반적으로 올바르게 기술되었다. 다만 `12-webhook.md §5.2` 의 "구현" 불릿이 내부 분류 문자열 목록에서 `invalid_schema` 를 누락해 같은 파일의 상위 문단, `3-error-handling.md §1.7` 각주, `manual-trigger.md §6` 과 불일치(WARNING)하며, JSON 예시도 `INVALID_SCHEMA` 케이스를 포함하지 않아 출력 케이스 문서화 규칙과 거리가 있다(WARNING). 두 개 WARNING 은 spec 내부 cross-reference 일관성 문제이며, 규약 자체 갱신은 불필요하고 target 문서 수정으로 해소 가능하다.

---

## 위험도

LOW
