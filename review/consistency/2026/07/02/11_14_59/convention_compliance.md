# 정식 규약 준수 검토 결과

**대상**: `spec/5-system/4-execution-engine.md`
**검토 모드**: impl-done (diff-base: origin/main)
**구현 변경**: `execution-engine.service.ts` — `toRecord` 유틸 도입; 신규 `utils/to-record.ts` · `utils/to-record.spec.ts` 추가

---

## 발견사항

### 발견사항 1
- **[INFO]** `pending_plans:` 항목 하나가 `plan/in-progress/` 가 아닌 `plan/complete/` 에 위치
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter line 11
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §4 spec-pending-plan-existence.test.ts` 및 `§3.1 partial→implemented 전이 규칙`
  - 상세: `pending_plans:` 에 기재된 `plan/in-progress/spec-sync-execution-engine-gaps.md` 는 실제로 `plan/complete/spec-sync-execution-engine-gaps.md` 에 위치한다. `spec-pending-plan-existence.test.ts` 는 `in-progress` 경로와 `complete` 대체 경로를 양쪽 모두 허용하므로 빌드 차단은 발생하지 않는다. 또한 나머지 3개 항목(`execution-engine-residual-gaps.md`, `exec-intake-queue-impl.md`, `exec-park-durable-resume.md`)은 `plan/in-progress/` 에 실존하므로 "모두 complete 시 status 승격" 가드(`spec-status-lifecycle.test.ts` (c))도 트리거되지 않는다. `status: partial` 유지는 정당하다.
  - 제안: frontmatter 경로를 `plan/complete/spec-sync-execution-engine-gaps.md` 로 현행화하면 경로와 실제 파일 위치가 일치해 사람이 읽을 때 혼동을 줄일 수 있다. 단, 빌드 가드 통과에는 변경이 불필요하다.

---

이하 검토 항목은 모두 규약과 일치하여 추가 발견사항 없음.

**명명 규약**
- `id: execution-engine` — kebab-case ✓ (basename `4-execution-engine` 의 숫자 prefix 생략은 §2.1 "파일 basename 기반 권장" 기준 허용 패턴)
- 신규 파일 `utils/to-record.ts` / `utils/to-record.spec.ts` — kebab-case 파일명 ✓; `isRecord` / `toRecord` — camelCase 함수 식별자 ✓; 위치 `codebase/backend/src/modules/execution-engine/utils/` — 기존 `code:` glob `codebase/backend/src/modules/execution-engine/**` 에 자동 포함 ✓

**출력 포맷 규약**
- `NodeHandlerOutput.status` enum, `interaction.type` payload, `_resumeState` / `_resumeCheckpoint` / `_retryState` 제어 필드 명명이 `spec/conventions/node-output.md` 와 정합하게 참조됨 ✓
- 에러 코드(`EXECUTION_*`, `RESUME_*`, `RETRY_*`, `INVALID_EXECUTION_STATE`)가 `spec/conventions/error-codes.md` 를 SoT 로 명시하며 참조 ✓

**문서 구조 규약**
- `## Overview` (line 22) + 본문 §1–§11 + `## Rationale` (line 1238) — 3섹션 구성 완비 ✓
- 파일 경로 `spec/5-system/4-execution-engine.md` — 숫자 prefix `4-` 포함 ✓; `spec/<영역>/*.md` 패턴 준수 ✓
- frontmatter `status: partial` + `code:` ≥1 glob + `pending_plans:` ≥1 항목 — spec-impl-evidence §3 required 조합 준수 ✓

**API 문서 규약**
- 본 spec 문서는 API DTO / Swagger 데코레이터 정의 문서가 아니므로 `spec/conventions/swagger.md` 직접 적용 대상 외 ✓

**금지 항목**
- `spec/conventions/` 가 명시적으로 금지한 패턴(prefix 없는 audit action 표기, `_` 내부 필드 외부 노출, EXEC_* 이중 prefix 신설 등)을 답습하는 부분 없음 ✓

---

## 요약

`spec/5-system/4-execution-engine.md` 는 `spec/conventions/spec-impl-evidence.md` 의 frontmatter 의무(id/status/code/pending_plans), 문서 3섹션 구조, error-codes·node-output·execution-context·node-cancellation 규약 참조 방식 모두에서 정식 규약과 일치한다. 이번 구현 diff(`toRecord` 유틸 도입)는 기존 `code:` glob 범위 안에 포함되어 spec 변경 없이 적용되며, 규약상 spec-impl 정합에 영향을 주지 않는다. 유일한 발견사항은 `pending_plans:` 에 기재된 경로 하나가 이미 `plan/complete/` 로 이동했으나 경로 문자열이 갱신되지 않은 INFO 수준 사항이며, 빌드 가드(`spec-pending-plan-existence.test.ts`)는 두 위치를 모두 허용하므로 차단 위험은 없다.

## 위험도

LOW
