# 테스트(Testing) Review

## 배경

이 변경(`idempotency.interceptor.ts` §R8 캐시 대상 정합화)은 이미 5라운드(`16_29_45` →
`16_53_26` → `17_07_45` → `18_07_36` → `18_37_45`)의 코드 리뷰를 거쳤고, 매 라운드
testing reviewer 가 "고친 자리 옆 자매 자리 누락"(CRITICAL 1건 + WARNING 4건) 을 짚어 왔다.
이번 라운드(`18_52_47`)의 직접 트리거는 `18_37_45` WARNING #1(`storeEntry` catch 의
`logger.warn` 을 지워도 25/25 GREEN — 신규 직렬화-실패 테스트 2건만 형제 fail-open 테스트의
warn-단언 관행을 안 따름)과 WARNING #2(처분표에 "plan 기록" 이라 쓰고 실제로 안 적음)를 조치한
커밋(`567c1919d`, `02e80d699`)이다.

## 독립 검증 (무수정 프로브)

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 를
  직접 실행: **25/25 GREEN** (`jest src/modules/external-interaction/idempotency.interceptor.spec.ts`).
- 이번 라운드 fix 가 주장한 뮤테이션을 재실측했다 — `storeEntry` 의 `catch (err) { … return; }`
  에서 `logger.warn(...)` 호출을 제거: **2 RED** (직렬화-불가 payload 를 error 채널/성공 채널
  양쪽으로 각각 행사하는 두 테스트, `idempotency.interceptor.spec.ts:680`·`:722` 부근).
  주장이 실제 코드 위에서 유효함을 확인했다.
- `codebase/backend/test/external-interaction.e2e-spec.ts` 는 `tsc --noEmit` 통과, `it('...')`
  제목의 테스트 ID(`A`~`J`, `IDEM-1`~`3`, `G-2`, `I-2`) 전수 중복 없음 확인(`18_07_36` WARNING
  #3 이 잡았던 `I-2` 중복이 재발하지 않았다).

## 발견사항

- **[INFO]** 캐시 엔트리 **내부** `responseJson` 손상은 여전히 테스트·방어 둘 다 없다 —
  단, 이번 라운드에서 정확히 plan 백로그에 기록됨을 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:137`,
    `:143` (`intercept()` 의 `JSON.parse(cached.responseJson)` 두 자리), plan 은
    `plan/in-progress/backend-lint-gate-broken-on-main.md:561-568`
  - 상세: `intercept()` 는 캐시 엔트리 **바깥** JSON(`cachedJson` 전체)이 깨지면 `try/catch`
    로 무시하고 신규 처리로 폴백하지만(테스트 `손상된 캐시 JSON → 무시하고 신규 처리 + 정상
    적재` 로 고정됨), 엔트리가 파싱된 뒤 그 **안쪽** 필드인 `responseJson` 문자열 자체가
    깨진 경우(예: Redis 값 일부 손상·수동 조작)는 무방비다 — `JSON.parse(cached.responseJson)`
    가 그대로 throw 하고 `GlobalExceptionFilter` 가 500 으로 마스킹한다. 이 파일의 다른 모든
    JSON 관련 지점(엔트리 전체 파싱, `storeEntry` 의 직렬화)은 이번 라운드까지 전부
    `try/catch` + warn 로그로 방어됐는데 이 한 자리만 비대칭이다. **다만 이것은 이번 리뷰가
    새로 발견한 게 아니라** `18_07_36` testing INFO 1 → `18_37_45` WARNING #2(처분 불이행
    지적) 를 거쳐 이번 라운드 직전 커밋(`567c1919d`)이 정확히 plan 에 기록을 완료한
    항목이다. fail-closed 방향(과소캐시가 아니라 예외 발생)이라 급하지 않다는 근거도
    타당하다 — 새로 열리는 위험 표면이 아니라 기존 fail-open 불변식과의 비대칭일 뿐이다.
  - 제안: 추가 조치 불필요 — 이미 plan 백로그에 정확히 기록되어 있고(`JSON.parse` 중복
    해소와 묶어 한 번에 닫는 방향까지 적혀 있음), 이번 PR 스코프(§R8 캐시 대상 정합화) 밖의
    선재 갭이라는 처분이 타당하다. 후속 세션이 이 항목에 착수할 때 두 자리(에러 재현/정상
    재현 분기)를 모두 테스트에 반영해야 한다는 점만 재확인해 둔다.

- **[INFO]** `cacheTapped` 의 성공 채널 캐시 판정 상한 경계값 `300` 자체는 미테스트(`304` 만
  행사) — 기존 라운드에서 이미 유예되어 있고 이번 라운드도 관련 코드 변경 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:177`
    (`if (statusCode < 200 || statusCode >= 300) return;`),
    `idempotency.interceptor.spec.ts:426-439` (`3xx 는 캐시하지 않는다` 테스트, `statusCode: 304`)
  - 상세: `>= 300` 의 정확한 경계(`300` 자체)를 행사하는 케이스는 없다. `17_07_45` RESOLUTION
    INFO #8 이 이미 "이 API 는 3xx 를 내지 않아 실질 영향 0" 으로 유예했고, 이번 diff 는 이
    영역을 건드리지 않았다 — 재지적이 아니라 재확인 목적의 기록.
  - 제안: 조치 불필요.

- **[INFO]** e2e `IDEM-1`/`IDEM-2`/`IDEM-3` 는 매 테스트가 `randomUUID()` 로 독립적인
  trigger/execution/Idempotency-Key 를 생성해 서로·다른 describe 블록과 격리되어 있다 —
  공유 `beforeAll` 은 `db`/`redis` 커넥션뿐이고 데이터 상태는 공유하지 않는다. 판별력도
  "상태코드만 비교" 에서 "Redis 엔트리 직접 조회" 로 이미 교정되어(뮤턴트 무효화 프로브가
  주석에 남아 있음, `external-interaction.e2e-spec.ts:418-424`) 별도 지적 사항 없음.
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:371-550`
  - 제안: 없음 — 확인용 기록.

## 요약

5라운드에 걸쳐 "고친 자리 옆 자매 자리를 놓친다" 는 같은 결함 클래스가 반복 발견·조치됐고,
이번 라운드를 촉발한 직전 WARNING(신규 직렬화-실패 테스트 2건의 warn-단언 누락) 은 코드를
직접 실행해 재현·해소를 확인했다(뮤테이션 무단언 상태로 되돌리면 2 RED). 단위 25/25, e2e
`tsc` 통과, 테스트 ID 중복 없음까지 독립적으로 재검증했다. 남은 유일한 갭(캐시 엔트리 내부
`responseJson` 손상 무방비)은 이번 리뷰가 새로 찾은 게 아니라 이미 plan 백로그에 정확히
기록·유예되어 있는 선재·저위험(fail-closed) 항목이며, 이번 diff 의 스코프(§R8 캐시 대상
정합화) 밖이라는 처분도 타당하다. 신규 CRITICAL/WARNING 은 없다.

## 위험도

NONE
