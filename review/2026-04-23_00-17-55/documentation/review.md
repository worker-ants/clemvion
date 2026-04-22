## 문서화 코드 리뷰

### 발견사항

---

**[CRITICAL]** `SCHEMA_LOOKUP_HARD_STOP` 상수 주석이 실제 동작과 불일치

- **위치**: `workflow-assistant-stream.service.ts`, 상수 선언부
- **상세**: 주석에는 `"3이면 첫 호출 + cache hit 2회까지 관용, 4번째부터 error 응답"`이라 적혀 있으나, 실제 코드(`cached.hits >= SCHEMA_LOOKUP_HARD_STOP`)와 테스트(`'returns cached result with warning on second call, hard-stops on the 3rd+'`)는 **3번째 호출에서 error**가 발생함을 보여준다. hits 흐름: 1차=1(정상), 2차=2(warning), 3차=3(≥3 → error). 주석이 말하는 "4번째"는 실제보다 한 번 더 허용하는 것으로 잘못 기술되어 있다.
- **제안**: 주석을 `"3이면 첫 호출 + cache hit 1회 경고, 3번째부터 error 응답"` 또는 HARD_STOP을 4로 변경해 주석과 정합성 맞추기

---

**[WARNING]** `ShadowResult` 인터페이스 JSDoc이 세 에러 케이스를 단일 블록에 혼합

- **위치**: `shadow-workflow.ts`, `ShadowResult` 인터페이스 (`knownTypes`~`hint` 필드)
- **상세**: `knownTypes`/`suggestedType`(UNKNOWN_NODE_TYPE), `repeatCount`/`hint`(LABEL_CONFLICT), `hint`(NODE_NOT_FOUND 캐스케이딩) 세 가지 다른 에러 컨텍스트에 대한 설명이 하나의 JSDoc 블록에 묶여 있어 `hint` 필드가 두 케이스(LABEL_CONFLICT, NODE_NOT_FOUND)에서 사용된다는 사실이 모호하다.
- **제안**: 각 필드 바로 위에 독립 JSDoc을 배치하거나, 최소한 `hint?: string` 필드에 "LABEL_CONFLICT 또는 NODE_NOT_FOUND 케이스 모두에서 사용됨"을 명시

---

**[WARNING]** `ReviewChecklistItem` 인터페이스 필드에 문서 없음

- **위치**: `review-workflow.ts`, `ReviewChecklistItem` 인터페이스
- **상세**: `ReviewChecklistCode`와 `buildReviewChecklist` 함수에는 상세한 JSDoc이 있으나, `ReviewChecklistItem`의 `code`, `blocking`, `details`, `data` 필드에는 개별 설명이 없다. `data`의 타입이 `unknown`이어서 각 `code`별로 어떤 구조가 들어오는지 소비자가 알 수 없다.
- **제안**: 각 필드 JSDoc 추가, 특히 `data`는 코드별 예시 타입 명시 (e.g. `ORPHAN_NODES` → `Array<{id, label, type}>`)

---

**[WARNING]** 주요 신규 동작에 대한 CHANGELOG/마이그레이션 노트 부재

- **위치**: 변경 전체 범위
- **상세**: 2-stage finish guard, `WORKFLOW_REVIEW_REQUIRED` 에러 코드, `REDUNDANT_SCHEMA_LOOKUP` 가드, `UNKNOWN_NODE_TYPE` enrichment는 LLM의 동작 계약을 직접 변경하는 기능이다. 소비자(프론트엔드, 다른 팀)가 새 에러 코드를 처리해야 할 수 있으며, CHANGELOG나 ADR 없이는 사후 추적이 어렵다.
- **제안**: CHANGELOG에 breaking-ish 변경 항목 추가; `WORKFLOW_REVIEW_REQUIRED`와 `REDUNDANT_SCHEMA_LOOKUP`이 새로운 에러 코드임을 명시

---

**[INFO]** 문서화되지 않은 내부 함수들 (`hasReachableAncestorContainer`, `checkRequestCoverage`, `collectUnmentionedPendingUserConfig`)

- **위치**: `review-workflow.ts`
- **상세**: 동일 파일의 다른 함수들(`collectOrphans`, `isRecoveredLater`)은 JSDoc이 있으나, 이 세 함수는 비어 있다. private이 아닌 module-scoped 함수이므로 테스트에서 직접 참조하지 않더라도 가독성 일관성이 깨진다.
- **제안**: 최소 단일 행 JSDoc 추가; `checkRequestCoverage`는 반환 구조(`{details, data}`)를 설명할 필요 있음

---

**[INFO]** 문서화 언어 혼용 (한국어/영어)

- **위치**: `shadow-workflow.ts`, `review-workflow.ts`, `workflow-assistant-stream.service.ts`
- **상세**: JSDoc 본문이 파일·함수별로 한국어와 영어를 혼용한다. LLM에게 전달되는 에러 메시지(영어)와 내부 주석(한국어)은 의도적으로 분리된 것으로 보이나, `ShadowResult` JSDoc처럼 같은 블록 내에서 두 언어가 섞이는 경우는 일관성 원칙을 명시하지 않으면 기여자가 혼란을 겪을 수 있다.
- **제안**: CONTRIBUTING 가이드 또는 CLAUDE.md에 "내부 주석: 한국어, LLM 노출 메시지: 영어" 원칙 명문화

---

### 요약

전체적으로 이번 변경의 문서화 수준은 **양호**하다. 공개 인터페이스(`ShadowResult`, `ReviewChecklistItem`, `BuildReviewChecklistInput`)와 핵심 알고리즘(`levenshtein`, `collectOrphans`, `buildReviewChecklist`)에 충실한 JSDoc이 있으며, 시스템 프롬프트 변경 자체가 LLM 행동 계약의 문서 역할을 겸하고 있어 의도가 명확하다. 그러나 `SCHEMA_LOOKUP_HARD_STOP` 상수 주석의 동작 기술 오류(3번째 call에서 error인데 4번째라고 기술)는 유지보수자가 임계값 조정 시 잘못된 가정을 할 수 있는 실질적 위험이 있고, 새 에러 코드(`WORKFLOW_REVIEW_REQUIRED`, `REDUNDANT_SCHEMA_LOOKUP`)가 소비자에게 breaking change에 준하는 영향을 줄 수 있음에도 CHANGELOG가 없는 점이 아쉽다.

### 위험도

**MEDIUM** — 상수 주석 오류는 향후 임계값 수정 시 버그를 유발할 수 있으며, 신규 에러 코드의 계약 변경 추적 부재는 팀 규모가 커질수록 유지보수 부채로 이어진다.