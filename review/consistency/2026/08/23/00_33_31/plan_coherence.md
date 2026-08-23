STATUS=success plan_coherence review complete (impl-done, scope=spec/5-system/, diff-base=origin/main) — no CRITICAL/WARNING found

===REPORT_MARKDOWN_BELOW===

### 발견사항

없음 (CRITICAL/WARNING/INFO 대상 없음).

**검토 근거**:

- `origin/main...HEAD` 실 diff(`git diff origin/main...HEAD -- 'codebase/**' 'plan/**'`)를
  직접 대조했다. `spec/**` 변경은 0 — `plan/complete/execute-body-openapi.md` 의
  `spec_impact: none` 과 일치한다. 코드 변경은 `execute-workflow.dto.ts`(신설,
  `@ApiPropertyOptional` 만·class-validator 데코레이터 없음) + `workflows.controller.ts`
  에 `@ApiBody({ type: ExecuteWorkflowDto })` 1줄 + 캐너리/가드 테스트(`workflows-execute-body.spec.ts`)
  뿐이며, `@Body()` 파라미터의 인라인 타입은 무변경 — impl-prep 단계에서 계획한 그대로
  구현됐다.
- **미해결 결정과의 충돌 없음**: "`execute` 본문의 여분 top-level 키를 400 으로 거부할
  것인가"(검증 강화)는 이 PR 이 일방적으로 결정하지 않고 정본 트래커
  (`plan/in-progress/spec-sync-external-interaction-api-gaps.md:902`)에 **신규 미해결
  항목으로 명시 등재**했다. 실측 근거(1st-party 는 `{ input, parameterValues }` 만 보내
  호환, 유저 가이드 노출 공개 API)까지 함께 남겨 다음 판단자가 재실측 없이 이어받을 수
  있다.
- **선행 plan 미해소 없음**: 이 PR 이 전제하는 선행 조건들 — 형제 `re-run.dto.ts` 의 마커
  예약어 description 선례(#1195/`masked-marker-cosmetic-followups`), 마커 공유 패키지
  추출(#1190/#1191), `egress-masking.md` 정식 규약화(#1194) — 는 모두 `git log`
  (`bdcfdc514`~`4ba15859f`)상 이미 `origin/main` 에 머지돼 있고, 트래커 문면도 "닫았다"로
  갱신돼 실제 구현과 일치한다.
- **후속 항목 누락 없음** — 오히려 두 건이 이번 PR 자체 실측으로 신규 등재됐다(트래커
  적정 위치에 반영 완료, 별도 지적 불요):
  1. `execute` 여분 키 400 거부 여부(위 결정 이연 항목) — `plan/in-progress/
     spec-sync-external-interaction-api-gaps.md:902-908`.
  2. `re-run.dto.ts` 가 `additionalProperties: true` 다수 패턴 대신 `type: Object` 축약형을
     쓰는 비대칭(신규 `execute-workflow.dto.ts` 는 다수 패턴을 따름) —
     `plan/in-progress/spec-sync-external-interaction-api-gaps.md:917-923`.
  두 항목 모두 중복 등재나 위치 오류 없이 정본 트래커 한 곳에만 존재함을 grep 으로 확인
  (`forbidNonWhitelisted`·`type: Object 축약형` 키워드 전수 검색, 다른 in-progress plan
  파일에는 등장하지 않음).
- `plan/complete/execute-body-openapi.md` 가 "마커 시리즈 이월 항목 중 마지막 남은 1건"
  이라 서술한 것도 실측과 부합한다 — "마커 재제출 거부 PR 의 이월 항목" 절(같은 파일
  L758~) 안에서 이 PR 이전 유일하게 열려 있던 원 carry-over 항목이 이 `execute` DTO 건
  이었고(`findMaskedResubmissions` 단위 테스트 항목은 별도 세션에서 이미 "유예 유지, 근거
  교체"로 판정 종결됨), 이 PR 이 그 마지막 항목을 닫았다.
- `execution-engine-residual-gaps.md:37`·`spec-sync-websocket-protocol-gaps.md:32` 가
  `POST /workflows/:id/execute` 를 인용하지만 둘 다 "REST 시작 전용" 아키텍처 확정 근거로만
  쓰고 본문/DTO 형태와는 무관 — 이번 변경으로 무효화되는 서술 없음.
- code review(`review/code/2026/08/23/00_24_55/SUMMARY.md`) INFO#3 이 "본문 검증 부재는
  신규 이슈 아님, 트래커에 이미 등재됨"이라 명시해 plan 트래커와의 정합을 교차 확인한다.

### 요약

`execute-body-openapi` 작업은 `spec/5-system/` 스코프 안에서 미해결 결정(본문 여분 키
검증 강화 여부)을 우회하지 않고 정본 트래커로 명시 이연했고, 그 선행 조건 셋(re-run DTO
선례·마커 공유 패키지·egress-masking 규약화)은 모두 이미 해소돼 있다. 구현 후 diff 도
plan 이 선언한 "계약 무변경·OpenAPI 문서만 추가" 원칙과 정확히 일치했으며, 부수 실측으로
드러난 두 신규 항목(여분 키 검증·`re-run.dto.ts` 축약형 비대칭) 모두 정본 트래커 한 곳에
정확히 등재됐다. 다른 in-progress plan 의 후속 항목을 무효화하거나 누락시키는 지점도
발견되지 않았다. Plan 정합성 관점에서 병합해도 좋은 상태다.

### 위험도

NONE
