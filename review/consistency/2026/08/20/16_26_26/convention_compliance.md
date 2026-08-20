# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 방법론 노트

프롬프트 번들이 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md`(diff 의 핵심 target),
`<git diff>` 코드 diff 본문, `spec/conventions/**` 대부분(20개 중 2개만 포함 — `node-cancellation.md`·
`secret-store.md`)을 절단했다. 판정 공백을 막기 위해 아래를 워크트리 절대경로로 직접 확인했다:
`git diff origin/main...HEAD -- spec/5-system/ codebase/`, 그리고 이번 diff 와 관련성이 높은
`spec/conventions/{swagger,frontend-layering,i18n-userguide,node-output,data-hydration-surfaces,
spec-impl-evidence,user-guide-evidence,error-codes}.md` 를 직접 Read. `spec/1-data-model.md` ·
`spec/4-nodes/1-logic/12-background.md` · `spec/3-workflow-editor/3-execution.md` 도 카브아웃 폐지가
미러됐는지 grep 으로 교차 확인했다(모두 갱신 확인 — 아래 §요약 참조).

## 검토 대상 diff 요약

`origin/main...HEAD` 에서 `spec/5-system/{14-external-interaction-api,13-replay-rerun,
6-websocket-protocol,12-webhook}.md` 4개 + backend/frontend 코드(마스킹 마커 감지·프리필/제출 차단
가드, DTO 주석 갱신, i18n 키 2쌍) — `Execution.inputData` egress 값-마스킹 카브아웃을 폐지하고
프런트 마커 가드(폼 프리필 스킵·Re-run 모달 제출 차단·에디터 히스토리 실행 차단)로 대체하는 변경.

## 발견사항

이번 diff 범위에서 CRITICAL/WARNING 급 정식 규약 위반을 발견하지 못했다. 점검한 항목과 근거는 다음과 같다.

- **명명 규약 — 준수**: 신규 파일 `codebase/frontend/src/lib/utils/masked-markers.ts` 는 kebab-case
  로 기존 컨벤션과 일치하며, `frontend-layering.md` §1 계층 규약대로 `src/lib/**`(하위 계층)에
  위치한다. 소비처 `rerun-modal.tsx`/`editor-toolbar.tsx`/`dynamic-form-ui.tsx` 는 모두
  `src/components/**`(상위 계층)에서 `@/lib/utils/masked-markers` 를 import 하는 허용 방향
  (상위→하위)만 사용한다(grep 으로 3곳 확인, 역방향 import 없음). `MASKED_MARKERS`/`isMaskedMarker`
  이름은 backend `sanitize-error-message.ts` 의 SoT 상수·함수명과 정확히 일치하도록 유지되며, backend
  주석도 이번 diff 에서 새 프런트 경로(`frontend/src/lib/utils/masked-markers.ts`)로 갱신되어 양방향
  미러가 어긋나지 않는다.
- **API 문서 규약(swagger.md) — 준수**: `execution-response.dto.ts` 의 `inputData`/`outputData`/`error`
  JSDoc 은 `swagger.md §3` 의 "보안·정책 캐비엇 예외"(2026-08-17 규약화, `execution-response.dto.ts`가
  그 예시로 명시된 문서)에 정확히 해당한다 — 응답 값이 DB 원문과 달라지는 필드는 길이 제한(10~40자)
  예외이며 요약 + SoT 링크(`EIA §R17`) 형태를 유지했다. 인용된 구현 식별자(`ExecutionsService
  .toResponseExecution`, `redactStoredDataForResponse`)는 실제 코드에 grep 으로 존재를 확인했다.
  DTO 구조(`@ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })`) 는
  변경되지 않았다.
- **출력 포맷 규약(node-output.md Principle 7) — 준수**: `14-external-interaction-api.md` 가 "config
  raw-echo 와도 충돌하지 않는다" 로 인용하는 `node-output.md` Principle 7 의 "egress 값-마스킹이
  echo 금지를 backstop 한다" 서술과 이번 diff 의 방향(가능한 한 넓게 마스킹 후 소비 쪽 가드로 왕복
  오염을 막는 전략)이 상충하지 않는다.
- **문서 구조 규약 — 준수**: 4개 target 문서 모두 기존 Overview/본문/Rationale 구조를 유지한 채
  본문 내부 편집만 이뤄졌고, 정책 결정(카브아웃 폐지)의 근거는 `14-external-interaction-api.md`
  의 `## Rationale` 절 안 `### R17` 서브섹션에 위치한다(라인 1163 Rationale 시작, R17 은 1392) —
  "결정의 배경·근거는 문서 끝 Rationale" 규칙을 지킨다.
- **spec-impl-evidence.md frontmatter 규약 — 준수**: `14-external-interaction-api.md` 의 `code:` 에
  신규 파일 3개(`masked-markers.ts`/`rerun-modal.tsx`/`editor-toolbar.tsx`)가 추가됐고 전부 실존을
  확인했다. `status: partial` + `pending_plans` 경로(`plan/in-progress/
  spec-sync-external-interaction-api-gaps.md`, `…-websocket-protocol-gaps.md`)도 실존한다.
  `13-replay-rerun.md`(`status: implemented`)의 `code:` 에도 `rerun-modal.tsx` 가 추가돼 ≥1 매치
  의무를 만족한다.
- **i18n-userguide.md Principle 1/2/6 — 준수**: 신규 dict 키 `editor.runWithInputMasked` ·
  `history.rerun.maskedInputBlocked` 가 `dict/ko/*.ts`·`dict/en/*.ts` 양쪽에 동시 추가돼 leaf key
  parity 를 유지한다. 한국어 문구는 해요체("남아 있어요", "주세요")로 통일돼 있고 금지어(엣지·작업
  흐름·아웃풋)도 없다. 갱신된 유저 가이드 MDX(`run-results.mdx`·`running-a-workflow.mdx` 및 `.en`)도
  내부 SoT(spec 경로·plan 경로·`R17` 같은 anchor id)를 노출하지 않고 현재 동작만 서술한다
  (Principle 6-B 준수). 두 mdx 는 `06-integrations-and-config/**`·`02-nodes/triggers.mdx` 가 아니므로
  `user-guide-evidence.md` 의 `<ImplAnchor>` GUI-flow 강제 대상도 아니다(스코프 밖, 위반 아님).
- **금지 항목 — 위반 없음**: `node-output.md` §"금지 — spread 패턴" 등 이번 diff 가 건드리는 코드
  경로에서 해당 패턴은 관찰되지 않았다. `MASKED_INPUT_DATA_REASON`(폐기된 구 카브아웃 근거 상수)에
  대한 잔존 참조를 코드·spec 전체에서 grep 했으나 0건 — 폐기가 깨끗하게 완결됐다.
- **cross-spec 미러 정합성(참고, 정식 규약 항목은 아니나 문서 구조 규약과 인접)**: 카브아웃 폐지가
  `spec/1-data-model.md`(Execution.input_data·NodeExecution.input_data 두 행) ·
  `spec/4-nodes/1-logic/12-background.md` · `spec/3-workflow-editor/3-execution.md` 에도 동일 날짜
  (2026-08-20)로 미러돼 있어, "6개 spec 파일이 SoT 로 인용" 한다고 스스로 밝힌 본문과 실제 갱신
  범위가 일치한다(그레핑상 stale 잔존 문구 없음).

## 요약

이번 diff(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 3소비처 도입)는
`spec/conventions/**` 의 명명·출력 포맷·문서 구조·API 문서(swagger)·frontend 레이어링 규약을 모두
준수한다. 신규 프런트 유틸의 위치·네이밍·import 방향, DTO JSDoc 의 보안 캐비엇 예외 적용, i18n
dict parity·톤·금지어, frontmatter `code:`/`status`/`pending_plans` 정합, Rationale 섹션 배치가
전부 기존 규약과 일치했고, 인용된 코드 식별자(함수명·상수명)도 실제 구현과 grep 대조로 일치를
확인했다. 정식 규약 위반으로 분류할 CRITICAL/WARNING 항목은 없다.

## 위험도
NONE
