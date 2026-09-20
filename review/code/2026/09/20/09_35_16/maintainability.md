# 유지보수성(Maintainability) 리뷰

## 검토 범위

코드 변경은 SSRF 가드 소비자 4곳(+동반 1곳)의 `catch` 를 `instanceof SsrfBlockedError` 로 "판정"과 "가드 자체의 고장"을 가르는 순수 리팩토링이다.

- `codebase/backend/src/modules/integrations/database-connection-tester.ts` / `.spec.ts`
- `codebase/backend/src/modules/integrations/http-connection-tester.ts` / `.spec.ts`
- `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` / `.spec.ts`
- `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` / `.spec.ts`(신설)
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` / `.spec.ts`

`plan/in-progress/ssrf-catch-instanceof.md` 와 `review/consistency/2026/09/20/09_06_34/**` 는 plan·리뷰 산출물이라 유지보수성 관점(가독성/네이밍/함수길이/중첩/매직넘버/중복/복잡도/일관성)의 대상이 아니므로 아래 발견사항에서 제외했다(코드 파일만 평가).

## 발견사항

- **[INFO]** 판정/비판정 분기 로직(`if (!(err instanceof SsrfBlockedError))` 및 그 설명 주석)이 프로덕션 코드 4곳에 유사한 형태로 반복된다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:146`, `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:362`, `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:270`, `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:36`(역방향 형태: `if (err instanceof SsrfBlockedError) return …`)
  - 상세: 네 곳 모두 "판정은 `SsrfBlockedError` 하나뿐이다 — 그 밖의 오류는 가드의 고장이지 차단이 아니다"라는 동일한 근거를 담은 주석 블록을 각자 다시 쓰고 있다. `instanceof` 검사 자체는 한 줄이라 추출 이득이 크지 않지만, 이 근거 문장이 네 곳에 흩어져 있으면 가드의 계약이 다시 바뀔 때(예: 새로운 비판정 예외 클래스 추가) 네 곳을 전부 찾아 갱신해야 하고, 하나라도 누락되면 그 지점만 다시 "무엇이든 차단"으로 조용히 퇴행한다. 다만 이 분리는 `plan/in-progress/ssrf-catch-instanceof.md` "비대상" 절에서 "공용 가드를 `http-request/` 밖으로 옮기는 것 — 트래커의 별 항목(spec `code:` 동반 변경이라 planner 필요)"으로 이미 명시적으로 스코프 아웃되어 있어, 이번 변경 자체의 결함이라기보다는 추적 중인 후속 항목이다.
  - 제안: 지금 당장 조치는 불필요. 후속 트래커 항목 진행 시 네 곳의 판정 로직(및 근거 주석)을 `http-safety.ts` 옆 작은 헬퍼(예: `classifyGuardFailure(err)` 류)로 모아 단일 지점화하는 것을 고려.

- **[INFO]** `database-connection-tester.ts` 함수 JSDoc 계약이 새 분기(가드 자체 고장)를 명시적으로 나열하지 않는다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:129-131`(JSDoc의 결과 코드 나열) vs 구현 `codebase/backend/src/modules/integrations/database-connection-tester.ts:146-152`
  - 상세: `testDatabaseConnection` 의 JSDoc 은 결과를 "SSRF 차단 → `DB_HOST_BLOCKED`" / "인증 거부 → `DB_AUTH_FAILED`" / "그 밖(네트워크·타임아웃·TLS·없는 database 등) → `DB_CONNECT_FAILED`" 세 갈래로 서술한다. 새로 추가된 "가드가 판정 아닌 오류를 던진 경우"도 결과적으로 `DB_CONNECT_FAILED` 로 떨어지지만, 이 경로는 연결을 아예 시도하지 않고 가드 실행 중 실패한 것이라 "그 밖(네트워크·타임아웃·TLS…)" 예시들과 성격이 다르다. 인라인 코드 주석(144-145행)은 이를 설명하지만, 함수 계약을 한눈에 보는 JSDoc 에는 반영되어 있지 않아 다음에 이 함수를 호출/수정하는 사람이 "이 코드가 왜 `DB_CONNECT_FAILED` 로 오는지"를 소스 본문까지 내려가야 알 수 있다.
  - 제안: JSDoc 세 번째 항목을 "그 밖(네트워크·타임아웃·TLS·없는 database·SSRF 가드 자체의 고장 등)" 정도로 한 구절만 보강하면 계약과 구현이 다시 일치한다.

## 긍정적으로 확인된 점 (참고)

- `http-request.handler.ts` 의 새 분기는 기존 `resolveIntegration` 실패 처리와 동일한 `buildPreflightErrorOutput(err, …)` 헬퍼를 재사용한다(`err instanceof IntegrationError ? err.code : 'INTEGRATION_CALL_FAILED'` 기본값이 이미 그 헬퍼 안에 있음, `http-request.handler.ts:611-637` 참조) — 새 코드를 추가하면서도 기존 관용구를 그대로 따라가 중복을 최소화했다.
- 네 파일 모두 함수 길이·중첩 깊이가 과도해지지 않았다(추가된 분기는 각 3~15줄, 중첩은 기존 `try/catch` 위에 `if` 한 단계만 얹음).
- 에러 코드는 전부 기존 상수/리터럴 관용구(`CONNECTION_TEST_CODES.*`, `ErrorCode.*`, 파일 내 기존 `IntegrationError('…')` 리터럴 스타일)를 그대로 따라 새 매직 문자열을 도입하지 않았다.
- 각 분기마다 대응하는 단위테스트(및 신설 `http-redirect.spec.ts`)가 추가되어 있고, 테스트명·mock 패턴(`jest.requireActual` 로 `SsrfBlockedError` 실물을 보존)이 5개 스펙 파일에서 일관적이다.

## 뮤테이션/재현 검증

가설 확인을 위한 코드 수정은 하지 않았다(저장소는 read-only 로만 조회). `git status --short` 로 별도 오염이 없음을 확인할 필요는 없었음 — 파일 쓰기를 시도하지 않았다.

## 요약

변경 범위가 좁고(4개 소비자 + 동반 1곳의 catch 분류), 각 파일이 이미 갖고 있던 에러 처리 관용구·상수·테스트 패턴을 그대로 따라가고 있어 가독성·네이밍·함수 길이·중첩·매직넘버 어느 측면에서도 새로운 결함을 만들지 않았다. 유일하게 눈에 띄는 것은 "판정 vs 비판정" 분류 로직과 그 근거 주석이 4개 파일에 유사하게 반복된다는 점인데, 이는 plan 문서에서 이미 별도 트래커 항목으로 스코프 아웃한 의도된 트레이드오프이며 즉각적인 위험은 아니다. `database-connection-tester.ts` 의 JSDoc 이 새 분기를 명시적으로 나열하지 않는 점도 사소한 문서 완전성 갭이다. 둘 다 INFO 수준으로, 이번 변경을 막을 이유는 없다.

## 위험도

LOW
