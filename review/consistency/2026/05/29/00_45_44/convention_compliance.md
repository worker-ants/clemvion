# 정식 규약 준수 검토 — convention_compliance

**검토 대상**: `plan/in-progress/spec-draft-ai-error-output-fields.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-29

---

## 발견사항

### [WARNING] Plan frontmatter 에 비표준 `status: draft` 필드 사용
- **target 위치**: frontmatter 5번째 줄 (`status: draft`)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — Plan frontmatter 스키마는 `worktree` / `started` / `owner` 3필드만 정의. `status` 는 plan frontmatter 의 공식 필드가 아님
- **상세**: `plan-lifecycle.md §4` 의 frontmatter 스키마에는 `status` 키가 존재하지 않는다. `status` 는 `spec/conventions/spec-impl-evidence.md §2.1` 의 spec 문서 frontmatter 필드이며, plan 문서에서 쓰이는 필드가 아니다. plan 상태는 폴더 위치(`in-progress/` vs `complete/`)와 체크박스 완료 여부로 표현한다. 또한 `draft` 값은 spec-impl-evidence 의 `status` enum (`backlog` / `spec-only` / `partial` / `implemented` / `archived`) 에도 속하지 않는다.
- **제안**: frontmatter 에서 `status: draft` 줄 제거. 현재 진행 상태는 `in-progress/` 폴더 위치로 표현되므로 추가 필드 불필요. 또는 이 필드가 의미 있다면 `plan-lifecycle.md §4` 에 `status` 필드를 공식 추가하는 규약 갱신이 선행되어야 한다.

---

### [WARNING] 체크리스트(checkbox) 없이 산문(prose) 형태로만 작업 항목 기술
- **target 위치**: `## C-1`, `## C-2`, `## W-1` 섹션 전체
- **위반 규약**: `.claude/docs/plan-lifecycle.md §2` — "미체크 체크박스(`[ ]`)" 가 in-progress 판별 기준이자 완료 추적 단위. `§5 이동 commit 자가 점검` 에도 "모든 체크박스가 `[x]` 인가" 가 이동 조건
- **상세**: 원본 backlog(`spec-update-ai-error-output-fields.md`) 는 `- [ ]` 형식의 체크박스를 사용해 작업 항목을 추적한다. 반면 본 spec-draft plan 은 C-1, C-2, W-1 을 모두 prose(헤더+문장) 형식으로만 기술하고 있어, plan-lifecycle 이 요구하는 checkbox 기반 완료 추적이 불가능하다. `plan/complete/` 이동 시 "모든 체크박스 `[x]`" 자가 점검 항목이 통과 불가 상태가 된다.
- **제안**: 각 변경 항목(`C-1 text-classifier`, `C-1 information-extractor`, `C-2`)을 `- [ ]` 체크박스로 변환. W-1 deferred 항목은 후속 backlog 등록 여부를 `- [ ]` 로 명시하거나, "본 PR 에서 제외" 를 `- [x]` (결정 완료) 로 표기.

---

### [INFO] 문서 구조 — Overview 섹션 권장 패턴 미적용
- **target 위치**: 문서 전체 구조
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — 진입 문서의 `## Overview` / 3섹션 권장 (Overview / 본문 / Rationale). SKILL.md 의 Spec 문서 3섹션 권장
- **상세**: `## Rationale` 섹션은 존재(양호). 그러나 `## Overview` 또는 작업 목적을 1-2 문장으로 요약하는 진입 섹션이 없다. 문서 첫 단락(원본 backlog 링크 + 근거 세션 2줄)이 Overview 역할을 하고 있으나 정식 `## Overview` 헤더 아래에 놓여 있지 않다. Plan 문서에 Overview 섹션을 강제하는 규약은 없으므로 INFO 등급으로 분류. spec 문서와 plan 문서의 구분상 plan 에 3섹션 구조가 필수인 것은 아니므로 수정보다 참고 사항으로 남긴다.
- **제안**: 현행 유지 가능. 원한다면 첫 단락을 `## 개요` 또는 `## 배경` 헤더 아래로 이동해 가독성 향상 가능.

---

### [INFO] `## C-1`, `## C-2`, `## W-1` 섹션 헤더 수준 — 관행 일관성
- **target 위치**: `## C-1`, `## C-2`, `## W-1` (H2 사용)
- **위반 규약**: 직접 위반 규약 없음 — 명시적 금지 패턴 아님
- **상세**: `## 변경 대상`, `## Rationale` 가 H2 인데, 개별 변경 항목도 H2 로 동일 레벨에 배치되어 있다. `## 변경 대상` 의 하위 내용으로 읽히는 C-1/C-2 가 같은 레벨에 있어 문서 계층 구조가 다소 평탄하다. 다른 plan 문서들이 어떤 계층을 쓰는지 일관성 맥락에서 참고 정보.
- **제안**: `### C-1`, `### C-2`, `### W-1` 로 H3 사용 고려. 단, 현 표현 방식이 규약 위반은 아님.

---

### [INFO] W-1 deferred 항목의 후속 backlog 등록 경로 미명시
- **target 위치**: `## W-1 (deferred)` 섹션 마지막 문장
- **위반 규약**: `.claude/docs/plan-lifecycle.md §2` — "미해결 follow-up 항목이 하나라도 있으면 in-progress"
- **상세**: "후속 backlog 로 남긴다" 고 명시하나, 어느 backlog 파일에 등록할 것인지, 또는 신규 plan 파일을 생성할 것인지가 지정되어 있지 않다. plan-lifecycle 관점에서 W-1 이 후속 작업임을 추적하려면 구체적인 파일 경로나 생성 의무가 명확해야 한다. 규약 직접 위반은 아니지만 후속 누락 리스크가 있다.
- **제안**: "후속 backlog 로 남긴다" 뒤에 `plan/in-progress/spec-update-ai-error-output-fields.md` 기존 파일에 W-1 항목을 추가하거나, 신규 파일명을 지정해 명시적으로 추적 가능하게 한다.

---

## 내용 정합성 검토 (규약 준수 관점)

아래는 target plan 이 참조하는 규약(`node-output.md`)과의 내용 정합성이다.

**C-1 `retryable` 값 결정** (`text-classifier: true`, `information-extractor: false`):
`node-output.md §3.2.1` — "HTTP 429 / 5xx / network timeout 등 transient → `true`", "인증 실패 / schema fatal → `false`". text-classifier 예시가 `LLM_CALL_FAILED` (network timeout) 이므로 `retryable: true` 는 규약과 일치. information-extractor 예시가 `LLM_RESPONSE_INVALID` (JSON 파싱 실패, fundamental) 이므로 `retryable: false` 는 규약과 일치. 원본 backlog 의 `false` 메모와 다르게 교정한 근거가 `Rationale` 에 명확히 기술되어 있어 규약 준수 판단 가능.

**C-2 `"status": "ended"` 추가 위치** (`port` 다음 줄):
`node-output.md Principle 11` — JSON 예시 형식 `{ config, output, meta, port, status }`. `port` 다음에 `status` 위치는 규약 예시 순서와 일치.

**`retryAfterSec?` invariant** (`retryable === true` 일 때만 set):
`node-output.md §3.2.1` — "invariant: `retryable === true` 일 때만 set 가능". plan 의 필드 표 설명이 이 invariant 를 정확하게 인용하고 있음. 규약 일치.

**W-1 deferral (`config.schema` → `config.outputSchema`)** :
`node-output.md Principle 7` — config echo 는 원본 필드명 그대로. 원본 config 필드가 `outputSchema` 인데 `config.schema` 로 echo 되는 것은 Principle 7 위반. plan 이 이를 Warning 으로 분류하고 별도 추적하는 접근은 타당하다. 다만 deferred 처리 시 구체적인 후속 추적 경로가 필요함(상단 INFO 항목 참조).

---

## 요약

`plan/in-progress/spec-draft-ai-error-output-fields.md` 는 정식 규약(`node-output.md §3.2.1`, Principle 0, Principle 7)을 올바르게 인용하고 있으며, 각 변경 항목의 규약 근거와 값 결정 근거가 `Rationale` 섹션에 적절하게 기술되어 있다. 명명 규약·API 문서 규약·금지 항목 위반은 없다. 다만 두 가지 WARNING 이 발견된다. 첫째, frontmatter 의 `status: draft` 는 plan-lifecycle 이 정의하지 않는 비표준 필드이며 spec-impl-evidence 의 status enum 에도 속하지 않아 제거가 권장된다. 둘째, 작업 항목이 체크박스(`[ ]`) 없이 prose 형식으로만 기술되어 plan-lifecycle 의 완료 추적·이동 조건(`§5 자가 점검`)을 충족하기 어렵다. 두 WARNING 을 수정하면 spec 변경 착수에 차단 사유는 없다.

---

## 위험도

MEDIUM
