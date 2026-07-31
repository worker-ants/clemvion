# API Contract Review — retry-turn.service.{ts,spec.ts} (2026-07-30 12_56_04)

## 스코프 확인

프롬프트가 제공한 2 파일의 전체 컨텍스트를 `git log origin/main..HEAD`로 실제 diff 범위와
대조했다. 브랜치는 origin/main 대비 8 커밋 앞서 있고, `retry-turn.service.ts` /
`retry-turn.service.spec.ts` 를 건드린 커밋은 4개:

- `b351731f0` (원자 claim 최초 도입) — `review/code/2026/07/28/20_32_57/api_contract.md` 에서
  이미 NONE 판정.
- `414550a1d` (claim 삽입 위치 결함 2건 수정) — `review/code/2026/07/30/11_41_20/api_contract.md`
  에서 이미 NONE 판정.
- `7a05c6ec8` — `git show --stat` 확인 결과 **JSDoc/주석만 변경**(42 lines, 30(+)/12(-)),
  코드 로직 변경 없음. 직전 라운드(11_41_20) SUMMARY#2/#3/#6/#9 정정 반영.
- `886ca9395` — `git show --stat` 확인 결과 **테스트 파일만 변경**(63 lines, 62(+)/1(-)),
  프로덕션 코드 변경 없음. 직전 라운드 SUMMARY#4/#6 회귀 테스트 2건 추가.

즉 이번 라운드의 실질 신규 diff는 뒤 2개 커밋(`7a05c6ec8`, `886ca9395`)뿐이며, 둘 다
주석·테스트 전용이라 실행 코드(런타임 동작)에 아무 영향이 없다. `websocket.gateway.ts`
(REST/WS 진입점, 인증/인가 계층)와 `continuation-execution.processor.ts`(worker 진입점)는
이번 diff 범위 밖(각각 07/28·07/30 이전 라운드에서 이미 리뷰됨).

## 점검 관점별 확인

1. **하위 호환성** — `retryLastTurn(executionId, nodeExecutionId): Promise<{ spawnedNodeExecutionId }>` /
   `applyRetryLastTurn(executionId, spawnedNodeExecutionId): Promise<void>` 시그니처·반환 타입 불변.
   `NODE_STARTED` WS emit 의 `input` payload 에서 `_retryState` 가 빠지는 동작 자체는 이전 커밋
   (`414550a1d`)에서 이미 도입된 것이고 이번 두 커밋은 그 사실을 JSDoc 에 명시 + 회귀 테스트로
   고정했을 뿐 — 신규 동작 변경 아님. `spec/5-system/6-websocket-protocol.md` §4.2 어디에도
   `NODE_STARTED.input._retryState` 가 문서화된 필드로 나오지 않아(grep 확인), 제거는 계약 위반이
   아니라 "internal 필드 비노출" 정합화.
2. **버전 관리** — 해당 없음. 공개 API 버전 개념이 적용되는 대상이 아닌 internal worker 로직이고,
   이번 2 커밋은 주석/테스트뿐.
3. **응답 형식** — 변경 없음. `retryLastTurn` 반환 스키마·`applyRetryLastTurn` 의 WS push 이벤트
   구조 모두 이번 diff 에서 손대지 않음.
4. **에러 응답** — 변경 없음. `RetryLastTurnError`/`InvalidExecutionStateError` 코드·메시지
   불변. JSDoc 정정(`7a05c6ec8`)은 기존 서술의 자기모순(백스톱 커버리지 문단)·stale 참조
   (`runAiConversationLoop` → `processAiResumeTurn`)를 바로잡을 뿐 에러 표면에 영향 없음.
5. **요청 검증** — 변경 없음. 두 커밋 모두 `retryLastTurn` 의 입력 검증 순서/로직을 건드리지
   않음.
6. **URL/경로 설계** — 해당 없음. REST 컨트롤러·라우트, WS 커맨드명(`execution.retry_last_turn`)
   모두 이번 diff 밖.
7. **페이지네이션** — 해당 없음. 목록 API 코드 없음.
8. **인증/인가** — 해당 없음. 인증/소유권 검증을 담당하는 `websocket.gateway.ts` 는 이번
   4 커밋(그리고 특히 이번 라운드의 신규 2 커밋) 어디에도 포함되지 않음.

## 발견사항

없음 — 이번 라운드에서 실제로 추가된 코드(`7a05c6ec8`, `886ca9395`)는 JSDoc 정정과 단위
테스트 추가뿐이며, API 요청/응답 스키마, 에러 코드, URL 설계, 페이지네이션, 인증/인가,
버전 관리 어느 축에도 관측 가능한 변경이 없다.

## 요약

이번 리뷰 라운드가 다루는 실질 diff(`7a05c6ec8` JSDoc 정정 3건, `886ca9395` 회귀 테스트 2건)는
직전 라운드(`review/code/2026/07/30/11_41_20`)가 이미 API 계약 관점에서 NONE 판정한 원자 claim
로직(`b351731f0`/`414550a1d`)에 대한 후속 정리 작업이다. 코드 로직은 전혀 바뀌지 않았고, 변경은
(1) JSDoc 안의 자기모순·stale 참조·의도 설명 보강, (2) 이미 존재하던 두 방어 분기(claim 성공
후 in-memory `_retryState` 부재 / `NODE_STARTED` emit 의 `_retryState` 비노출)에 대한 회귀
테스트 추가로 국한된다. `retryLastTurn`/`applyRetryLastTurn` 의 시그니처·응답 스키마·에러 코드·
WS 이벤트 payload 구조·인증/인가 경로 중 API 계약과 직결되는 어떤 요소도 이번 diff 로 바뀌지
않았으므로 API 계약 관점에서는 리뷰 대상 변경이 없다고 판단한다.

## 위험도

NONE
