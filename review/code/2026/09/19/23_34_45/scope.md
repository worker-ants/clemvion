# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `integrations.service.ts` 의 `IntegrationTestResult.code` JSDoc 코멘트 갱신
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:82-84`
  - 상세: `/** Failure code (e.g. `MCP_*` · ...); absent on success. */` 를 `/** Failure code — the connection-test vocabulary ({@link IntegrationTestResultCode}); absent on success. */` 로 바꿨다. 필드 타입을 `string` → `IntegrationTestResultCode` 로 좁히는 본 작업의 직접 결과이므로 범위 밖 변경은 아니다 — 타입을 좁혔는데 주석이 옛 설명(`e.g. MCP_* · ...`)을 그대로 두면 오히려 어긋난다. 코멘트 변경 자체가 목적이 아니라 타입 변경에 종속된 필연적 갱신으로 판단.
  - 제안: 조치 불필요.

- **[INFO]** `database-driver-sockets.spec.ts` 에 소켓 정리 `try/finally` 및 방어적 옵셔널 체이닝(`?.destroy?.()`) 추가
  - 위치: `codebase/backend/src/modules/integrations/database-driver-sockets.spec.ts:19-27`, `:29-45`
  - 상세: diff 만 보면 "테스트 방어 코드 강화"로 보여 범위 이탈처럼 보일 수 있으나, `plan/in-progress/connection-test-codes-and-gaps.md` 의 실측 섹션이 이 갭을 명시적으로 선언한 대상이다 — "`database-driver-sockets.spec.ts` 의 mysql2 케이스는 unit 에서 루프백 연결을 실제로 시도한다 — 소켓 정리가 `try/finally` 가 아니다". 선언된 "테스트 빈칸 3건" 중 하나로 사전 승인된 스코프.
  - 제안: 조치 불필요.

- **[INFO]** `integrations.service.spec.ts` 의 `rotate` 404 분기 테스트 추가는 프로덕션 코드 변경을 동반하지 않음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (신규 `it`, "update 는 1행을 바꿨는데 다시 읽기 전에 지워졌으면 404")
  - 상세: 해당 파일의 diff 는 이 테스트 추가가 전부이고 `integrations.service.ts` 쪽 diff 에는 `rotate` 로직 변경이 없다 — 기존 동작을 고정하는 순수 테스트 추가로 확인됨(plan의 "테스트 빈칸" 항목 3과 일치). 프로덕션 코드를 건드리지 않고 커버리지만 메운 것이므로 범위 이탈 아님.
  - 제안: 조치 불필요.

## 스코프 대조 결과

`plan/in-progress/connection-test-codes-and-gaps.md` 의 "할 것"(①상수·union 신설 ②Cafe24·MakeShop ping 코드 타입 좁히기 ③테스트 빈칸 3건 고정)과 실제 diff 10개 코드 파일을 1:1 대조했다.

- `connection-test-codes.ts`(신규) — ① 그대로.
- `connection-test-codes.spec.ts`(신규) — ③ 타입 계약 테스트, wire 값 테스트.
- `database-connection-tester.ts` / `http-connection-tester.ts` / `integrations.service.ts` — 리터럴 문자열을 `CONNECTION_TEST_CODES.*` 상수 참조로 치환. **동작 변경 없음**(문자열 값이 동일 — diff 좌우 비교로 확인, 예: `'DB_HOST_BLOCKED'` → `CONNECTION_TEST_CODES.DB_HOST_BLOCKED` = `'DB_HOST_BLOCKED'`). 순수 리팩터, 선언된 범위 내.
- `database-connection-tester.spec.ts` — SSL 매핑 mysql 경로 테스트 추가(③ 항목 1).
- `database-driver-sockets.spec.ts` — try/finally 소켓 정리(③ 항목 2).
- `integrations.service.spec.ts` — rotate 404 테스트(③ 항목 3).
- `cafe24-api.client.ts` / `makeshop-api.client.ts` — `Cafe24PingCode` / `MakeshopPingCode` export 타입 신설, `code?: string` → `code?: <PingCode>` 로 좁힘(② 항목). 로직 변경 없음 — 함수 시그니처/리턴 타입 애노테이션만 변경.
- `plan/in-progress/connection-test-codes-and-gaps.md`(신규) — 이 작업의 plan 문서. `developer` 권한 내 통상 산출물.
- `review/consistency/2026/09/19/23_02_33/**`(8개 파일, 신규) — `--impl-prep` 의무 게이트가 생성한 companion 산출물(SUMMARY·checker 5개·meta.json·retry-state). CLAUDE.md 규약상 developer 의 정상 워크플로 부산물이며 코드 스코프와 무관한 별도 파일 트리에 격리돼 있다.

git diff 로 `ea27c21b3`(anchor 커밋) 대비 `codebase/` 변경 파일 10개를 재확인한 결과 프롬프트에 없는 숨은 코드 변경은 없다 — 프롬프트가 다룬 파일 집합과 실제 diff 파일 집합이 정확히 일치한다.

불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 뒤섞임·불필요한 주석/임포트 변경·의도하지 않은 설정 변경 — 모두 해당 없음. `commit 7403fc4a6`(lint 를 위한 `@ts-expect-error` 설명 길이 조정)도 스코프 내 파일(`connection-test-codes.spec.ts`)에 국한된 lint 준수 수정이다.

## 요약

10개 코드 파일 변경은 plan 문서가 사전에 선언한 "할 것" 3개 항목(상수·union 신설, Cafe24/MakeShop ping 코드 타입 좁히기, 테스트 빈칸 3건 고정)과 정확히 1:1 대응하며, 문자열 리터럴 값 자체는 변경 없이 상수 참조로만 치환한 순수 리팩터다. plan 문서와 `review/consistency/**` 산출물은 developer 워크플로의 정상 companion 산출물이다. 범위 이탈, 불필요한 리팩토링, 기능 확장, 무관한 파일 수정, 포맷팅 뒤섞임, 불필요한 주석/임포트 변경, 의도하지 않은 설정 변경 중 어느 것도 발견되지 않았다.

## 위험도

NONE
