---
title: EIA getStatus() 2단계 컬럼 projection — conversation_thread 조건부 fetch
worktree: optimize-getstatus-projection-78853c
started: 2026-07-10
owner: developer
status: in-progress
spec_area: spec/5-system/14-external-interaction-api.md
---

## 배경 / 문제

`InteractionService.getStatus()` (`codebase/backend/src/modules/external-interaction/interaction.service.ts`) 가
`findOne({ where: { id } })` 로 **projection 없이 Execution row 전체**를 조회한다.

PR #874(EIA §R17 재조정)로 `Execution.conversation_thread` jsonb 가 `context.conversationThread` 로 노출되면서,
이 컬럼이 row 에 실려 있다. 규모 상한은 conversation-thread 규약상 **최대 500 turn × turn 당 4000자 ≒ 2MB**.

**핵심 비대칭**: 응답 동봉은 `waiting_for_input` 한정이지만 **DB fetch 자체는 상태 무관**이다.
`running` / `pending` / `completed` / `failed` 상태의 폴링성 `GET /api/external/executions/:id` 마다
쓰이지 않을 2MB jsonb 를 DB→앱으로 실어 나른다(TOAST de-TOAST + 역직렬화 + GC).

같은 파일 내 다른 3개 호출부(`interact` refresh:154, `refreshToken`:207, `loadAndAssertAlive`:357)는
이미 `select: ['id','status']` 로 얇게 조회 중 — `getStatus()` 만 누락된 **일관성 갭**이기도 하다.

## 범위

- `getStatus()` 를 2단계 조회로 전환:
  1. 얇은 base projection (`id`,`status`,`workflowId`,`startedAt`,`finishedAt`,`outputData`)
  2. `status === waiting_for_input` 일 때만 `conversationThread` 재조회 (대기 NodeExecution 조회와 병렬)
- **wire 형식 무변경** — 순수 내부 조회 최적화. spec §5.3 / §R17 응답 계약 그대로.

## 결정 메모

- **`outputData` 는 base projection 에 포함**(2단계로 미루지 않음). `completed`/`failed` 에선 `result`/`error` 로
  **항상 필요**하므로 미루면 왕복만 늘고 절감 0. 비-terminal 상태에선 대체로 `null` 이라 fetch 비용이 미미.
  절감 대상은 상한 2MB 인 `conversation_thread` 하나로 좁힌다.
- **2단계 fetch 는 `Promise.all` 로 NodeExecution 조회와 병렬** — 왕복 추가에 따른 latency 증가 상쇄.
- **race**: 1단계와 2단계 사이 status 가 바뀌어도 응답은 스냅샷이라 무해. row 삭제 시 `undefined` →
  기존 "durable thread 없음" 경로와 동일하게 키 생략(graceful). 기존 NodeExecution 조회도 같은 race 를 이미 가짐.

## 체크리스트

- [x] 0. worktree 확인
- [x] 1. 스펙 분석 (EIA §5.3 / §R17)
- [x] 2. 모호성 해소 — 없음 (wire 무변경 내부 최적화)
- [x] 3. `/consistency-check --impl-prep spec/5-system/14-external-interaction-api.md` — **BLOCK: NO** (Critical 0, 5 checker 전원 OK). 산출: `review/consistency/2026/07/10/22_25_21/SUMMARY.md`
- [x] 4. DOCUMENTATION — `PROJECT.md §변경 유형 → 갱신 위치 매핑` 해당 행 **없음**(wire·DTO·엔드포인트·에러코드 무변경 → swagger/i18n/user-guide 의무 없음). `getStatus()` JSDoc 에 2단계 조회 명시. W3 인용 정정.
- [x] 5. 테스트 선작성 — projection/2단계/W1 마스킹/W2 updatedAt/재조회 null 5건. red 확인(3 fail).
- [x] 6. 구현 — 2단계 조회 + `Promise.all` 병렬
- [x] 7. 테스트 보강 — 대상 spec 41/41 green
- [ ] 8. TEST WORKFLOW — lint / unit / build / e2e
- [ ] 9. REVIEW WORKFLOW — `/ai-review` + `/consistency-check --impl-done`

## impl-prep Warning (구현 중 처리 의무)

- **W1 `redactThreadForPublic` 재배선** — R17 "표면 제약(보안)" 은 REST·SSE 가 공유 helper 로 egress 마스킹하는 것을
  런타임 강제 불변식으로 규정. `conversationThread` 소스 객체를 별도 partial entity 로 바꾸면서 마스킹 호출이 빠지면
  secret egress 회귀(Critical 급). → 마스킹 단언 테스트로 고정.
- **W2 `select` 는 camelCase 엔티티 프로퍼티명** — `@Column({name:'workflow_id'})` 매핑 탓에 snake_case 오기 함정.
  `startedAt`/`finishedAt` 누락 시 `updatedAt` 이 `new Date()` fallback 으로 침묵 회귀(기존 테스트는 `typeof==='string'`
  만 단언해 미포착). → `updatedAt` 실값 단언 테스트 추가.
- **W3 `spec-sync-external-interaction-api-gaps.md` line 17 의 `interaction.service.ts:247-296` 인용 stale 화** →
  본 PR 안에서 정정.

## 검증 관심사

- `execution-park-resume` e2e — 상태전이(park→waiting→resume) 경로가 `getStatus` 표면에 의존.
- `getStatus` 가 반환하는 `updatedAt` 은 `finishedAt ?? startedAt` — 두 컬럼 projection 누락 시 `new Date()`
  fallback 으로 **침묵 회귀**(테스트가 `typeof === 'string'` 만 단언해 못 잡음). projection 목록에 반드시 포함.
