# RESOLUTION — DB 노드 in-flight cancel

초기 구현이 Round1 에서 CRITICAL 2건을 받아 재설계, Round2 에서 구조적 CRITICAL 전부 해소 확인 + 잔여 WARNING 2건 추가 fix.

## FIX (Round1 CRITICAL/WARNING)
- **C1 (pool 데드락)**: 취소를 캐시 pool 이 아닌 **일회성 연결**로 발행 — `cancelPgBackend`(`new PgClient`)·`cancelMysqlQuery`(`createConnection`), 각 `connect(Timeout)=2s`. 공유 pool 슬롯 불요 → 포화 데드락 제거.
- **C2 (cross-kill)**: `onAbort` 가 `cancelPromise` 저장, `finally` 가 `release()` **전에 await** → 취소가 우리 연결 보유 중 완료, 재사용 연결 오살 창 닫힘.
- **W3 (connect-race)**: `connect()`/`getConnection()` 직후 `if (aborted) { release(); throw AbortError }` — no-op 취소 후 완주 제거.
- **W4 (광의 재분류)**: execute() catch 를 `err.name==='AbortError'` 로 좁힘(무관 실패 오분류 방지).
- **W5 (§4→§2.1)**: 7곳 citation 정정.

## FIX (Round2 잔여 WARNING)
- **W1 (취소-쿼리 timeout 부재 → release 무한 block)**: `settleWithin(cancelQuery, 2s)` — 취소 쿼리가 hang 해도 상한 내 settle, finally 의 `end()` 가 일회성 연결 닫아 서버측 pending 정리. `release()` block 제거.
- **W2 (inner catch 광의 재분류)**: exec catch 를 `aborted && isPgQueryCanceled(57014)` / `aborted && isMysqlQueryInterrupted(1317)` 로 좁힘 — 우리 취소로 인한 driver 에러만 cancelled, 무관 실패는 원래 에러 보존. 신규 테스트 `abort 중 비-57014 실패 → error 포트` 로 lock.

## 문서/추적
- node-cancellation.md `code:` 에 `database-query.handler.ts` 추가(reviewer INFO).
- 취소 실패 `logger.debug` 로그 추가(INFO).
- SMTP(§2) = 의도적 best-effort won't-do(부분/중복 전송 리스크), spec 정직화.

## 미조치(수용)
- 대량 동시 abort 시 일회성 취소 연결 스파이크(best-effort, DB max_connections 낮은 환경 한정 INFO) — 문서화만.
- PID/threadId 재사용 이론적 레이스(SQL-함수 취소 방식 고유 한계, `await-before-release` 로 실질 위험 낮음).

## 재검증
lint·build·unit(database-query 77 + 모듈 91)·e2e(243)·doc guards(253파일). Round2 fresh review LOW·구조적 CRITICAL 0. BLOCK: NO.
