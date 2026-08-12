# 테스트(Testing) 리뷰 — `idempotency.interceptor` `statusCode` 범위 검증 + 경계값 테스트

## 발견사항

- **[INFO]** `hashOf` 헬퍼가 `r.set.mock.calls[0][1]` 를 사전 호출-여부 단언 없이 바로 인덱싱한다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1375-1378` (`body 가 undefined 든 null 이든 같은 hash` 테스트의 `hashOf`)
  - 상세: `storeEntry` 가 호출되지 않는 회귀(예: `intercept()` 가 캐시 적재 분기를 안 타는 버그)가 나면 `r.set.mock.calls[0]` 이 `undefined` 가 되어 `[1]` 접근 시 `TypeError: Cannot read properties of undefined` 로 죽는다. 실패 자체는 잡히지만 "왜" 실패했는지가 assertion 메시지가 아니라 스택트레이스로만 드러나 진단 비용이 커진다. 같은 파일의 다른 자리(예: `안쪽이 깨진 409 엔트리도 500 이 아니라 신규 처리`, 730행 근방)는 `expect(redis.set).toHaveBeenCalledTimes(1)` 을 먼저 단언한 뒤 `mock.calls[0][1]` 을 읽는 패턴을 쓴다 — 이번 신규 테스트만 그 사전 단언이 빠졌다.
  - 제안: `hashOf` 호출 전 또는 내부에 `expect(r.set).toHaveBeenCalledTimes(1)` 을 추가해 실패 시 명확한 assertion 메시지가 나오게 한다.

- **[INFO]** `makeContext` 의 `idempotencyKey` truthy 체크로 인해 "헤더가 실제로 빈 문자열로 설정된" 상태를 직접 구성할 수 없다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:130-132` (`headers: opts.idempotencyKey ? {...} : {}`)
  - 상세: `opts.idempotencyKey`가 `''` 이면 falsy 라 `req.headers` 자체가 `{}`(헤더 부재)로 만들어진다 — "헤더가 빈 문자열로 실제 전송된" 케이스와 "헤더가 아예 없는" 케이스가 헬퍼 수준에서 구분 불가능하다. `readKey` 는 두 입력 모두 `null` 을 반환하므로 현재 코드 경로상 관측 가능한 동작 차이는 없어 실질 갭은 아니지만, 프로덕션 코드가 겪었던 것과 같은 클래스(truthiness 가 두 다른 입력을 뭉갠다)의 테스트 인프라 제약이라 기록해 둔다. 새 `describe` 블록은 공백뿐인 키(`'   '`, `'\t\n '`)로 우회해 trim 후 빈 문자열 경로는 이미 커버한다.
  - 제안: 조치 불요(현재 동작상 무해). 향후 헤더 부재/빈 문자열을 별도로 구분해야 하는 로직이 추가되면 `makeContext` 를 `'idempotencyKey' in opts` 기반으로 바꿀 것.

## 검증 (직접 재현)

- `npx jest idempotency.interceptor.spec.ts` 재실행 — **56/56 통과**, RESOLUTION.md 의 "인터셉터 56/56" 주장과 일치.
- `MIN_HTTP_STATUS_CODE` 를 `100 → 50` 으로 뮤테이션(RESOLUTION.md 가 "이제 RED" 라 주장한 그 케이스)해 재실행 — **`엔트리의 statusCode 가 HTTP 코드가 아니면(하한 바로 아래(99))` 테스트가 즉시 실패**, 나머지 55개는 통과. 신규 `99` 인접-경계 케이스가 실제로 이 뮤턴트를 잡는다는 것을 독립적으로 재확인했다(원본 파일로 원복, `git diff` clean 확인 완료).
- `makeContext` 호출부 49건 전수 확인 — `body` 키를 생략한 호출은 0건. 즉 `opts.body ?? {}` → `'body' in opts ? opts.body : {}` 전환이 기존 테스트의 암묵적 `{}` 기본값에 의존한 회귀를 만들지 않는다(SUMMARY.md INFO #3 의 주장을 직접 grep+열람으로 재확인).

## 전체 평가

이번 diff 는 직전 라운드(`00_54_18`)의 testing WARNING 2건(하한 인접 경계 부재, 배열-헤더 테스트 근거 주석 오류)을 정확히 겨냥해 수정했고, 두 수정 모두 재실측 가능한 형태로 검증됐다 — 특히 하한 경계 수정은 리뷰어가 지적한 바로 그 뮤턴트(`>= 100 → >= 50`)를 이번 세션에서 독립적으로 재주입해 RED 로 확인했다. 신규 `describe` 블록(`readKey`/`hashBody` 경계값)은 키 길이 상한 양쪽, 공백/trim, 배열 vs 조인-문자열 헤더(실측된 실제 Node 동작 기반), body nullish 동등성, 키 순서 의존성, `statusCode` 범위 인접 경계까지 목적별로 정확히 하나씩 겨냥하는 구조라 가독성과 의도 전달이 좋다. 모든 신규 `it`/`it.each` 가 자체 `makeRedis()`/`makeCallHandler()` 를 새로 만들어 격리도 확보됐다. mock 설계(특히 배열 헤더를 `makeContext` 반환 객체에 직접 주입하는 부분)는 "타입이 허용하는 형태에 대한 방어"라는 성격을 주석으로 명확히 구분해 실제 도달 경로(조인 문자열)와 혼동을 남기지 않는다. 발견한 두 항목은 모두 INFO 수준 — 하나는 진단 편의(사전 단언 부재), 다른 하나는 이미 무해함이 확인된 헬퍼 제약이라 병합을 막을 사유가 아니다.

## 위험도
LOW
