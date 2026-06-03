# RESOLUTION — 15_14_55

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| C1        | spec | 24f09697    | 6-websocket-protocol §4.4 cancelled 행 nodeName→nodeLabel + drift note |
| C2        | 코드 | 24f09697    | error 봉투 { code: 'AbortError', message } — WS payload + DB 통일 |
| W1        | 코드 | 24f09697    | V069 migration DROP CONSTRAINT IF EXISTS + DOWN 롤백 주석 |
| W2        | 테스트 | 24f09697  | throwIfAborted() 사전 체크 → CANCELLED 단위 테스트 추가 |
| W3        | 테스트 | 24f09697  | retry+AbortError → 재시도 없이 CANCELLED 즉시 종결 테스트 추가 |
| W4        | 테스트 | 24f09697  | IE multi-turn 초기 경로 abortSignal→llmService.chat 전파 테스트 |
| W7        | spec | 24f09697    | node-cancellation §2.1 IE resume 경로 signal 미전파 note 추가 |
| W10       | 코드 | 24f09697    | isAbortError() 모듈 레벨 헬퍼 추출 — 두 호출 지점 통일 + DOMException realm 방어 |
| W11       | spec | 24f09697    | node-cancellation §5.2 ##Rationale → Rationale 헤딩 마커 수정 |
| W12       | docs | 24f09697    | run-results KO/EN + error-handling KO/EN — cancelled 상태 문서화 |

### 추가 수정 사항 (W10 연계)

`isAbortError()` 의 `instanceof Error` 단일 검사는 Jest VM sandbox 에서
`AbortSignal.throwIfAborted()` 가 던지는 `DOMException` 이 다른 realm 의 `Error` 를
extends 해 `false` 를 반환하는 엣지 케이스가 있었음. Duck-type fallback(`name === 'AbortError'`)
추가로 W2 테스트 통과 및 프로덕션 안전성 동시 확보.

## TEST 결과

- lint  : 통과
- unit  : 통과 (5586 passed, 3 skipped/pre-existing catalog-sync failures 제외)
  - execution-engine.service.spec.ts: 251/251 통과 (W2/W3 신규 포함)
  - information-extractor.handler.spec.ts: 31/31 통과 (W4 신규 포함)
  - 3 pre-existing failures: cafe24 catalog-sync (본 PR 범위 밖, base commit 에서도 동일 실패)
- e2e   : **통과 (143 passed, 70s)** — `make e2e-test` 로 실 docker 인프라(postgres/redis/minio) + V069 migration 적용까지 검증. (정정 2026-06-03: 직전 "docker daemon 미가동" 기록은 오류였음 — docker 는 가용했고, 리뷰 해소 후 실제 e2e 를 돌려 통과 확인. 로그: `_test_logs/e2e-20260603-161116.log`)

## 보류·후속 항목

- W5 (out-of-scope): `finally` 블록의 `deleteContext` race — 별도 이슈 추적
- W6 (out-of-scope): ShutdownStateService + AbortError 상호작용 — 별도 이슈 추적
- W8 (out-of-scope): `cancel-others-on-fail` WS 이벤트 순서 보장 — 별도 이슈 추적
- W9 (out-of-scope): 사용자 Stop 버튼 → execution-level AbortController 미구현 — 별도 이슈 추적
- INFO 항목 전체: RESOLUTION 추적 대상 아님 (정보성)
