# 정식 규약 준수 검토 결과

**검토 대상**: `spec/5-system/14-external-interaction-api.md`
**검토 모드**: `--impl-done`, scope=`spec/5-system/14-external-interaction-api.md`, diff-base=`origin/main`
**구현 diff**: `codebase/backend/test/execution-park-resume.e2e-spec.ts` (LLM config 생성 경로를 DB 직접 insert → 정식 `POST /api/llm-configs` API 호출로 교체)

---

## 발견사항

### [INFO] spec 문서 본문 변경 없음 — diff 는 테스트 파일만 변경
- target 위치: prompt_file 의 `## 구현 변경 사항` diff
- 위반 규약: 없음 (해당 없음)
- 상세: diff 는 `codebase/backend/test/execution-park-resume.e2e-spec.ts` 만 변경한다. `spec/5-system/14-external-interaction-api.md` 자체에는 변경이 없다. 이 검토는 현재 spec 문서가 `spec/conventions/` 를 따르는지 점검하는 standing 검토이므로, spec 문서 전체를 대상으로 분석한다.

---

### [INFO] Swagger §5-1 응답 DTO 위치 규약 — spec 에서 `dto/` 구조 언급 시 `responses/` 서브폴더 미명시
- target 위치: `§10 구현 파일 구조` — `dto/interact.dto.ts`, `dto/cancel.dto.ts`, `dto/responses.dto.ts`
- 위반 규약: `spec/conventions/swagger.md §5-1` — 응답 DTO 는 `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts` 위치 의무
- 상세: spec §10 의 파일 목록에서 `dto/responses.dto.ts` 가 단일 파일로 나열된다. swagger.md §5-1 은 응답 DTO 를 `dto/responses/` 하위 디렉토리에 `*-response.dto.ts` 명명으로 배치하도록 정의한다. 단일 `responses.dto.ts` 파일과의 명명 패턴 불일치가 있다.
- 제안: spec §10 의 dto 목록을 `dto/responses/interact-response.dto.ts`, `dto/responses/stream-response.dto.ts` 등 `responses/` 서브폴더 규약에 맞춰 표기하거나, 구현 코드가 실제로 단일 파일이라면 swagger.md §5-1 의 명명 규약과의 drift 를 주석으로 명시. (spec 문서 수정보다는 실구현 파일이 `responses/` 패턴을 따르는지 확인 우선.)

---

### [INFO] Swagger §2-1 — `interaction-token` scheme 의 컨트롤러 데코레이터 규약은 spec §10.1 에서 올바르게 반영됨
- target 위치: `§10.1 Swagger / API 문서`
- 위반 규약: 없음 (준수)
- 상세: spec §10.1 은 `@ApiBearerAuth('interaction-token')` 을 명시하고 `main.ts` 에 신규 scheme 등록을 지시한다. `spec/conventions/swagger.md §2-1` 은 `interaction-token` scheme 이 External Interaction API 전용으로 등록되고 해당 컨트롤러는 `@ApiBearerAuth('interaction-token')` 을 사용한다고 명시한다. 양측이 일치한다.

---

### [INFO] 에러 코드 표기 — `STATE_MISMATCH` 신조어 설명 누락
- target 위치: `§5.1` 에러 응답 표 — `STATE_MISMATCH` 코드
- 위반 규약: `spec/conventions/error-codes.md §1` — 에러 코드는 의미 기반 명명, 클라이언트가 의미로 분기하도록 정의가 spec 본문에 드러나야 함
- 상세: `STATE_MISMATCH` 는 WS 의 `INVALID_EXECUTION_STATE` 와 동일 의미를 EIA 표면에서 다르게 표기한다고 §5.1 에 설명되어 있다. error-codes.md §2 ("에러 코드 rename 은 breaking change") 기준으로 `INVALID_EXECUTION_STATE` 를 그대로 재사용하지 않고 `STATE_MISMATCH` 를 신설한 결정의 근거가 spec 본문에 없다. Rationale 에 표기 분리 근거가 있으면 완전하나 현재 없음.
- 제안: `## Rationale` 에 "EIA 표면의 에러 코드 명명 — WS `INVALID_EXECUTION_STATE` 와 분리한 이유" 항목을 추가하거나, §5.1 의 해당 행 설명에 한 줄 근거 추가. error-codes.md §3 historical-artifact 등재 대상은 아니나, 신규 코드 신설 결정으로서 §1 의 "의미 기반 명명" 정합성 확인 권장.

---

### [WARNING] `pending_plans` 목록에 `fix-webchat-sse-field-map.md` 포함 — 본 diff 와 관계 확인 필요
- target 위치: frontmatter `pending_plans:` — `plan/in-progress/fix-webchat-sse-field-map.md`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 의 `pending_plans:` 는 미구현 surface 를 책임지는 plan 경로여야 하며, 모든 `pending_plans` 가 `complete/` 로 이동하면 `status: implemented` 로 승격 의무
- 상세: `fix-webchat-sse-field-map.md` 가 `plan/in-progress/` 에 존재하므로 spec-pending-plan-existence 가드는 통과한다. 단, 본 diff (`exec-park-b2a-followup`) 가 EIA 의 일부 구현 완료를 나타낸다면, `spec-sync-external-interaction-api-gaps.md` 와 `fix-webchat-sse-field-map.md` 의 완료 여부가 spec status 갱신 시점과 정합해야 한다. 현재 둘 다 `in-progress/` 에 있으므로 `status: partial` 은 적절하다.
- 제안: diff 가 `fix-webchat-sse-field-map.md` 를 완료(complete 이동)시키는 commit 을 포함하는지 확인. 만약 본 PR 로 해당 plan 이 완료됐다면 `pending_plans` 에서 제거하고 complete 에 이동해야 하며, 양쪽 plan 이 모두 완료되면 `status: implemented` 로 승격 필요 (spec-impl-evidence §3.1 전이 규칙).

---

### [INFO] 문서 구조 규약 — Overview / 본문 / Rationale 3섹션 준수
- target 위치: 전체 문서 구조
- 위반 규약: CLAUDE.md — Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)
- 상세: 문서는 `## Overview (제품 정의)` / 본문(§3–§12) / `## Rationale` 로 3섹션이 완비되어 있다. 준수.

---

### [INFO] Frontmatter 스키마 — spec-impl-evidence 요구 필드 준수
- target 위치: 문서 frontmatter (lines 1–16)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1`
- 상세: `id: external-interaction-api`, `status: partial`, `pending_plans:` 2개 모두 `plan/in-progress/` 실존, `code:` 글로브 목록 비어있지 않음. 모든 의무 필드 충족.

---

## 요약

`spec/5-system/14-external-interaction-api.md` 는 본 PR diff 와 무관하게 정식 규약을 전체적으로 잘 준수하고 있다. Frontmatter (`id`/`status: partial`/`pending_plans:` 실존/`code:`)는 `spec-impl-evidence.md §2` 요건을 충족하고, 문서 3섹션 구조(Overview/본문/Rationale)도 완비되어 있다. `swagger.md §2-1` 의 `interaction-token` scheme 규약도 §10.1 에서 올바르게 반영됐다. 식별된 항목은 모두 INFO 수준이며, WARNING 1건은 `pending_plans` 의 완료 타이밍 정합을 권고하는 선제적 지적이다 — 현재 상태는 spec-pending-plan-existence 가드를 통과한다. CRITICAL 위반 없음.

## 위험도

LOW
