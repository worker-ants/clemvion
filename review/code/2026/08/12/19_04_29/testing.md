# 테스트(Testing) Review

## 배경

이 변경(`IdempotencyInterceptor` 의 Spec EIA §R8 캐시 대상 정합화)은 이미 6라운드
(`16_29_45` → `16_53_26` → `17_07_45` → `18_07_36` → `18_37_45` → `18_52_47`)의 코드
리뷰를 거쳤다. 이번 라운드(`19_04_29`)를 촉발한 직접 diff 는 `18_52_47` WARNING #1
("전부 warn 단언" 이라는 모듈 docstring 문구가 과장이었다 — 실제 7건 중 4건)을 조치한
docstring 정정 커밋(`6298d6fdb`)뿐이며, 코드(`idempotency.interceptor.ts`)·테스트 로직
자체의 변경은 없다.

## 독립 검증 (무수정 프로브)

- `idempotency.interceptor.spec.ts` 직접 실행: **25/25 GREEN**
  (`jest src/modules/external-interaction/idempotency.interceptor.spec.ts`).
- **docstring 의 "7건 중 4건" 주장을 실측**: `Redis 런타임 장애 fail-open` describe 블록의
  `it(` 7개 중 `warnSpy = jest.spyOn(Logger.prototype, 'warn')` 선언 4개
  (`:560`, `:640`, `:694`, `:727`), 그중 `expect(warnSpy)` 단언도 정확히 4개
  (`:577`, `:657`, `:716`, `:743`) — 주장이 코드와 일치함을 확인했다. 이전 라운드에서
  "전부" 로 과장했던 결함이 이번 정정으로 실제 상태와 맞다.
- **`isErrorStatusCacheable` 뮤테이션을 다시 실측**(무수정 원본에서 시작, 커밋하지 않은
  scratch 로 복원): `return statusCode === 409 || statusCode === 410;` →
  `return statusCode >= 400;` 로 치환 → **3 RED**(`400`·`404`·`5xx` 테스트, `403 → 404`
  케이스명 기준). 판정 함수가 실제로 도는 경로 위에서 방어가 살아 있음을 재확인했다
  (rxjs `catchError` → `HttpException.getStatus()` → 판정 → `storeEntry` 경로, dead code
  아님). 변경 후 원본으로 정확히 복원(`git status --short` 로 clean 확인).
- `external-interaction.e2e-spec.ts` 의 `it('ID. ...')` 제목 전수(`A`~`J`, `G-2`, `I-2`,
  `IDEM-1`~`3`) 중복 없음 재확인, `it.only`/`it.skip`/`xit`/`fit` 등 비활성화 마커 전무.

## 발견사항

- **[INFO]** `cacheTapped` 의 성공 채널 상한 경계값 `300` 자체는 미행사(`304` 만 행사) —
  기존 라운드(`18_52_47` 포함)에서 이미 유예된 항목, 이번 diff 는 관련 코드 무변경
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
    (`cacheTapped` 내부 `if (statusCode < 200 || statusCode >= 300) return;`),
    `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
    (`3xx 는 캐시하지 않는다` 테스트, `statusCode: 304`)
  - 상세: `>= 300` 의 정확한 경계(정확히 `300`)를 넣는 케이스가 없다. `17_07_45` RESOLUTION
    이 "이 API 는 3xx 를 내지 않아 실질 영향 0" 으로 이미 유예했고 이번 diff 는 이 영역을
    건드리지 않았다 — 재지적이 아니라 재확인.
  - 제안: 조치 불필요.

- **[INFO]** 캐시 엔트리 **내부** `responseJson` 문자열 손상(엔트리 바깥은 방어되지만 안쪽
  필드는 무방비)은 여전히 테스트·방어 둘 다 없음 — 단 `plan/in-progress/backend-lint-gate-broken-on-main.md`
  에 이미 정확히 기록·유예된 선재 항목이라 이번 라운드가 새로 여는 갭이 아님
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
    (`intercept()` 의 `JSON.parse(cached.responseJson)` 두 자리 — 재현 성공 채널·재현 예외
    채널 각각)
  - 상세: 엔트리 전체(`cachedJson`)가 깨지면 `try/catch` 로 신규 처리 폴백하는 테스트
    (`손상된 캐시 JSON → 무시하고 신규 처리 + 정상 적재`)가 있지만, 파싱된 엔트리의
    `responseJson` 필드 자체가 깨진 경우는 무방비(`GlobalExceptionFilter` 가 500 으로
    마스킹) — fail-closed 방향이라 우선순위는 낮되 여전히 미테스트.
  - 제안: 추가 조치 불필요 — plan 백로그에 이미 정확히 기록되어 있고, 이번 PR 스코프(§R8
    캐시 대상 정합화) 밖의 선재 갭이라는 처분이 타당하다.

- **[INFO]** 이번 diff(docstring 정정)는 순수 주석 변경이라 테스트 스위트 변경이 없고,
  그 사실이 정확히 검증됨 — "적재·직렬화가 조용히 실패할 수 있는 4건" 이라는 새 문구가
  실제 warn 단언 개수와 정확히 일치한다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-26`
  - 제안: 없음 — 확인용 기록.

## 회귀·격리·용이성 총평

- **회귀**: 6라운드에 걸쳐 "고친 자리 옆 자매 자리 누락"(dead code · 자매 상태코드 ·
  가드 우회 · e2e 자매 · warn 패턴) 이 반복 발견·조치돼 왔고, 이번 라운드는 그 마지막
  문서 정정까지 실측으로 확인했다. 기존 W-4 provider 경로·캐시 히트·fail-open 3개
  describe 블록 모두 무변경으로 유효하다.
- **격리**: 단위 테스트는 매 `it` 가 `makeRedis()`/`makeInterceptor()` 로 독립 인스턴스를
  생성해 공유 상태가 없다. e2e 3건(`IDEM-1`~`3`)도 매번 `randomUUID()` 로 독립
  trigger/execution/Idempotency-Key 를 만들어 서로·다른 describe 블록과 격리된다 —
  공유 `beforeAll` 은 DB/Redis 커넥션뿐.
- **Mock 적절성**: 이 라운드 시리즈의 핵심 교훈이 `makeThrowingHandler`(error 채널 mock)
  도입으로 코드에 반영돼 있다 — 409/410 을 실제로 던지는 경로로 행사해, 초기 라운드의
  "성공 채널에 statusCode 만 프리셋" 이라는 vacuous 패턴이 재발하지 않도록 헬퍼 이름과
  주석으로 못박아 뒀다.
- **테스트 용이성**: `isErrorStatusCacheable` 을 named 함수로 추출해 판정 로직을 독립적으로
  뮤테이션 검증 가능한 표면으로 만든 것이 이번 시리즈의 실질적 구조 개선이다.

## 요약

이번 라운드(`19_04_29`)의 실질 diff 는 이전 WARNING(모듈 docstring 의 "전부" 과장)을
정정한 주석 한 곳뿐이며, 그 정정 문구("7건 중 4건")가 실제 코드와 정확히 일치함을 직접
세어 확인했다. 핵심 판정 함수(`isErrorStatusCacheable`)에 대한 무수정 뮤테이션 재실측도
여전히 유효해(3 RED), 6라운드에 걸쳐 구축된 방어가 이번 변경으로 훼손되지 않았다. 남은
갭 2건(3xx 경계값 `300` 미행사, 캐시 엔트리 내부 `responseJson` 손상 무방비)은 모두 이번
리뷰가 새로 찾은 것이 아니라 이전 라운드에서 이미 인지·유예되었고 plan 백로그에 정확히
기록된 선재·저위험 항목이다. 신규 CRITICAL/WARNING 은 없다.

## 위험도

NONE
