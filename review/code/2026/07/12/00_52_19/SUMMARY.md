# Code Review 통합 보고서

## 전체 위험도
**NONE** — `emitEvent(event: string)` → `event: KbEventType` 로 좁히고 `as` unsafe cast 를 제거한 순수 컴파일타임 타입 강화(런타임 로직·payload·channel 명명·spec 서술 전부 무변경). 7개 reviewer 전원이 CRITICAL/WARNING 없이 INFO 만 보고, 위험도 NONE 으로 수렴.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 순수 컴파일타임 강화로 방어심층화 개선. union 밖 이벤트명(과거 PR #891 드리프트 사례인 `document:graph_error` 류)이 향후 실수로 emit 되는 것을 build 단계에서 원천 차단. 인증/인가·`sanitizePayloadForWs` redaction·channel 명명 등 기존 보안 통제는 diff 전후 동일 | `embedding.service.ts`/`graph-extraction.service.ts` `emitEvent()` | 조치 불필요 |
| 2 | requirement | 변경은 런타임 동작·이벤트 payload·상태 전이 어느 것도 바꾸지 않는 순수 narrowing. `tsc --noEmit` 재현으로 3파일 타입 에러 0건 확인, spec 4개 문서(websocket-protocol §4.4, embedding-pipeline, graph-rag, data-flow/6-knowledge-base)와 union 11종 서술 일치 | `embedding.service.ts`/`graph-extraction.service.ts`/`websocket.service.ts` | 조치 불필요 |
| 3 | requirement | plan 체크리스트 `/ai-review`, `/consistency-check --impl-done` 항목 미체크 — 본 리뷰가 그 단계에 해당하므로 정상 진행 중 상태 | `plan/in-progress/kb-websocket-emit-compile-guard.md` | 리뷰 결과 반영 후 체크박스 갱신 |
| 4 | scope | `websocket.service.ts` JSDoc 4줄 추가는 plan 문서에 "선택 항목"으로 사전 명시된 항목이라 scope creep 아님. `git diff --stat origin/main...HEAD` 로 실제 changeset(4 files, 72+/14-)이 리뷰 payload 와 정확히 일치함을 확인 | `websocket.service.ts` `KbEventType` JSDoc 블록 | 조치 불필요 |
| 5 | side_effect | `private emitEvent` 는 클래스 내부 전용이라 시그니처 좁힘의 파급 범위가 완전히 국한됨. 모든 호출부가 이미 union 호환 리터럴만 사용 확인(embedding 5곳/graph 6곳). 공개 API(`emitKbEvent`, `KbEventType` export)·전역 상태·환경 변수·네트워크 호출 모두 무영향 | `embedding.service.ts:397-410`, `graph-extraction.service.ts:926-938` | 조치 불필요 |
| 6 | maintainability | 두 서비스에 거의 동일한 `emitEvent` 헬퍼(try/catch + emitKbEvent 호출)가 중복 존재하나 이번 diff 가 신규 도입한 중복이 아니고 규모(2곳·3~4줄)도 추출을 강제할 수준 아님 | `embedding.service.ts:397-410`, `graph-extraction.service.ts:926-938` | 현시점 조치 불필요, 향후 emit 로직 증가 시 공용 헬퍼화 고려 |
| 7 | testing | 컴파일타임 가드("union 밖 이벤트명 build 에러 차단")가 실제로 작동함을 증명하는 명시적 타입 레벨 테스트(`@ts-expect-error` 픽스처 등) 부재. `npx jest embedding.service.spec.ts graph-extraction.service.spec.ts` 직접 실행으로 24개 테스트 전부 통과 확인, backend jest 는 `isolatedModules` 미설정(기본 타입체크 켜짐)이라 매 실행마다 실제 타입체크됨을 실측 | `embedding.service.ts:397-410`, `graph-extraction.service.ts:926-938` | 낮은 우선순위 — 필요 시 `@ts-expect-error` 컴파일 전용 스니펫 추가 가능, 강제 아님 |
| 8 | testing | 테스트 mock(`mockWs.emitKbEvent = jest.fn()`)의 타입이 여전히 느슨해 KbEventType 위반 문자열도 컴파일 에러 없이 통과 가능. 다만 production 호출 경로가 이미 컴파일타임에 막혀 있어 실질 리스크 낮음 | `embedding.service.spec.ts:104-107`, `graph-extraction.service.spec.ts:45-48` | 조치 불필요 — 프로젝트 관례와 일관 |
| 9 | documentation | private `emitEvent` 함수 자체엔 JSDoc 없음(호출부 인라인 주석만) — 단, 같은 파일 다른 private 헬퍼(`capErrorMessage`, `safeSlice`)도 동일 스타일이라 기존 관례와 정합 | `embedding.service.ts:397-410`, `graph-extraction.service.ts:926-938` | 조치 불필요 |
| 10 | documentation | CHANGELOG·spec 본문 미갱신은 순수 behavior-preserving 변경 관례(PR #920 선례) 및 plan 의 명시적 "범위 밖" 판단과 부합, 누락 아님. `websocket.service.ts` 의 `KbEventType` JSDoc 갱신 문구는 실제 diff 와 정확히 부합 | `CHANGELOG.md`, `spec/5-system/6-websocket-protocol.md:722`, `websocket.service.ts:1306-1308` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 방어심층화 개선. 기존 보안 통제(redaction·인증) 전부 유지, 새 공격 표면 없음 |
| requirement | NONE | 순수 narrowing, spec 4개 문서와 일치, `tsc --noEmit` 재현 |
| scope | NONE | 4개 파일 changeset 이 plan 목표와 1:1 대응, scope creep 없음 |
| side_effect | NONE | private 메서드 국한, 런타임/공개 API/전역상태 무영향 |
| maintainability | NONE | 기존부터 있던 경미한 헬퍼 중복(diff 무관), 추출 강제 불필요 |
| testing | NONE | 24개 기존 테스트 재실행 통과 확인, 타입 레벨 실증 테스트만 낮은 우선순위 제안 |
| documentation | NONE | 인라인 주석·JSDoc·plan 문서 품질 양호, CHANGELOG/spec 미갱신은 관례 부합 |

## 발견 없는 에이전트

없음 — 7개 에이전트 모두 INFO 수준 참고사항을 하나 이상 보고했으나 실질적 결함(CRITICAL/WARNING)은 전원 0건.

## 권장 조치사항
1. (선택, 낮은 우선순위) `testing` reviewer 제안대로 `@ts-expect-error` 기반 타입 레벨 회귀 테스트를 추가해 "union 밖 이벤트명이 build 에러로 차단됨"을 자동 검증하고 싶다면 고려 — 강제 아님, 현재 코드 리뷰로도 회귀 포착 가능.
2. `plan/in-progress/kb-websocket-emit-compile-guard.md` 의 `/ai-review` 체크리스트 항목을 본 리뷰 결과(Critical/Warning 0) 반영해 체크.
3. 그 외 즉시 조치 필요한 항목 없음 — 순수 컴파일타임 타입 강화로 병합 가능한 상태.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(diff 범위 내 성능 영향 요소 없음으로 추정) |
  | architecture | router 판단(구조/아키텍처 변경 없음으로 추정) |
  | dependency | router 판단(의존성 변경 없음으로 추정) |
  | database | router 판단(DB 접근 로직 변경 없음으로 추정) |
  | concurrency | router 판단(동시성 관련 로직 변경 없음으로 추정) |
  | api_contract | router 판단(외부 API 계약 변경 없음으로 추정) |
  | user_guide_sync | router 판단(사용자 가이드 대상 변경 없음으로 추정) |
