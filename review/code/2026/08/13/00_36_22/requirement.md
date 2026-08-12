# 요구사항(Requirement) 리뷰 — `00_36_22`

## 검증 방법

`origin/main..HEAD` 누적 diff(주요 실 변경 커밋: `22e68459d` fix, `eb752e0e6`/`e7ad5ca1f` docs,
`86de12278` fix, `dff218f17` chore/plan, `c51809a0b` test — 나머지는 리뷰 파이프라인 산출물)를
검토 대상으로 삼았다. 프롬프트에 담긴 diff 는 이전 4개 리뷰 라운드(`23_24_08`→`23_36_13`→
`23_48_38`→`00_20_20`)가 이미 CRITICAL 0으로 수렴시킨 뒤의 누적본이라, 각 라운드의 WARNING이
실제로 반영됐는지 소스 대조로 재확인하고 신규 결함 여부를 별도로 점검했다.

- `idempotency.interceptor.ts`/`.spec.ts` 전체 파일을 직접 Read.
- `git show c51809a0b`(마지막 실 코드 변경 커밋)와 `git show dff218f17`(spec 불일치 planner
  인계 커밋)를 직접 확인.
- `npx jest idempotency.interceptor.spec.ts` 재실행 → **41/41 PASS** (RESOLUTION 주장과 일치).
- `spec/data-flow/15-external-interaction.md`, `spec/5-system/14-external-interaction-api.md`
  §R8 을 grep/Read 로 line-level 대조.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 해당 체크박스·완료 노트·후속 항목을
  확인.
- 프로덕션/테스트 파일에 TODO/FIXME/HACK/XXX 잔존 여부 grep → 0건.

## 발견사항

- **[INFO] [SPEC-DRIFT]** `spec/data-flow/15-external-interaction.md` L308 "Redis … 전 경로
  fail-open (warn) — 가용성 우선" 이 실제 구현보다 넓다 — `IdempotencyInterceptor` 의 다섯
  fail-open 경로 중 "기동 시 미주입(생성자 `null`)" 은 warn 을 남기지 않는다(장애가 아니라
  설정 상태이기 때문 — 코드가 옳다).
  - 위치: `spec/data-flow/15-external-interaction.md:308`. 대조 대상 코드:
    `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:63-71`(다섯
    경로 표, 경로 1 의 `warn` 열이 `—`), 실제 `this.logger.warn(` 호출 5곳(`:117,144,239,322,330`)
    중 경로 1(생성자 null, `:106` `if (!rawKey || !this.redis) return next.handle();`)에 대응하는
    호출은 없음 — 코드·CHANGELOG·docstring 세 곳이 서로 일치하고, spec 본문 한 줄만 더 넓게
    서술한다.
  - 상세: 이건 코드 결함이 아니라 spec 서술이 코드가 정밀화되면서 드러난 기존 부정확이다. 이미
    같은 세션에서 발견·정확히 분류되어 `plan/in-progress/backend-lint-gate-broken-on-main.md:648-663`
    에 `[ ]` 미체크 항목으로 planner 인계 등재돼 있다(대상 spec 위치: `14-external-interaction-api.md`
    §R8 Rationale, `data-flow/15` §4 외부 의존 표 + §Rationale "Fail-open 정책의 일관 표기"). 새로
    발견한 사실이 아니라 기존 처리의 정확성을 재확인한 것.
  - 제안: 코드 변경 불필요 — 이미 계획대로 `project-planner` 턴에서 spec 본문 갱신 대기 중. 이
    reviewer 는 spec 을 직접 고치지 않는다.

- **[INFO]** `intercept()` 의 `switchMap` 콜백이 현재 7개 분기(캐시 미스·엔트리 문법 손상·엔트리
  형태 불일치·bodyHash 불일치·payload 손상·에러 재현·성공 재현)를 처리 — 두 차례(`23_24_08`,
  `23_36_13`) "6번째 분기 추가 시 재검토" 로 유예된 트리거가 실제로 발동했다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:149-217`
    (`intercept()` 의 `switchMap((cachedJson) => {...})`).
  - 상세: 기능 결함은 아니다(각 분기 모두 조기 반환으로 1단계 중첩만 유지, 테스트 41/41 GREEN).
    `plan/in-progress/backend-lint-gate-broken-on-main.md:664-671` 에 별도 `[ ]` 항목으로 이미
    등재돼 있고, 이번 PR 에서 착수하지 않는 근거(순수 구조 변경이라 리뷰 라운드 추가 소모, 남은
    발견이 문서/테스트 층위라 수렴 중)도 함께 기록돼 있다.
  - 제안: 조치 불요 — 다음에 이 콜백을 만질 때 착수하기로 이미 계획됨.

- **[INFO]** 기능 완전성 검증 완료 — 아래 항목 모두 코드·테스트·spec 이 line-level 로 일치함을
  확인했다(새 결함 없음, 기록 목적).
  - `IdempotencyEntry` 형태 가드(`isIdempotencyEntry`, `:370-378`)가 `null`/원시값/배열/필드
    누락/필드 타입 불일치를 전부 배제하며, 각 절이 뮤테이션으로 하중이 실측된 상태(fixture 8종,
    `spec.ts:562-624`).
  - `bodyHash` 판정(`:182`)이 payload 파싱(`:196-201`)보다 먼저라는 순서 계약이 코드·주석·
    전용 캐너리 테스트(`spec.ts:687-718`)로 삼중 고정.
  - 에러 재현 분기(409/410, `:208-213`)와 성공 재현 분기(`:214-216`)가 손상된 payload 에 대해
    동일한 `discardCorruptEntry` 방어를 받는다는 것이 `spec.ts:720-768` 에서 warn·재적재 값까지
    동형으로 단언됨(직전 라운드 WARNING #1 조치 결과가 실제 반영돼 있음을 재확인).
  - `isErrorStatusCacheable(statusCode)`(`:348-350`)가 `409`·`410` 만 반환 — [Spec EIA §R8]
    (`spec/5-system/14-external-interaction-api.md:1055`) "성공 2xx/409/410 은 캐시, 5xx·400
    은 캐시 안 함" 과 일치. 304·404 미캐시가 회귀 테스트(`spec.ts:484-513`)로 고정.
  - 캐시 키 스코프 `${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}`(`:133`)가 [Spec EIA
    §R8 Rationale "캐시 키 스코프"](`spec/5-system/14-external-interaction-api.md:1061`)의
    `interaction:idempotency:<executionId>:<route>:<key>` 형식과 정확히 일치.
  - `discardCorruptEntry`(제네릭 `<T>`, `:234-243`)가 두 호출부(엔트리/payload)에서 동일한
    "무시하고 신규 처리 + warn" 동작을 보장 — 반환값은 항상 `processFresh()` 의 결과이므로 모든
    경로에서 `Observable<unknown>` 반환 계약이 깨지지 않음.

## 요약

`IdempotencyInterceptor` 의 캐시 엔트리 안쪽 `responseJson` 손상 방어(500 마스킹 → fail-open)
는 기능적으로 완결돼 있다 — 문법 손상(`try/catch`)뿐 아니라 문법은 유효하나 형태가 아닌 값
(`null`·원시값·배열·필드 누락/타입 불일치)까지 `isIdempotencyEntry()` 로 막고, `bodyHash` 판정을
payload 파싱보다 앞에 둬 캐시 손상을 이용한 409 충돌 검출 우회를 차단하며, 성공/에러 두 재현
채널 모두 같은 방어를 받는다는 것이 값 단위 단언까지 갖춘 41개 단위 테스트로 고정돼 있다(재실행
확인 41/41 PASS). CHANGELOG·클래스 docstring·`discardCorruptEntry` JSDoc·plan 완료 노트가 서로
모순 없이 "다섯 경로 중 넷이 warn" 을 일관되게 서술하며, [Spec EIA §R8]의 캐시 대상 닫힌 목록·
캐시 키 스코프 규칙과 line-level 로 일치한다. TODO/FIXME/HACK/XXX 잔존 없음. 유일한 spec 불일치
(`data-flow/15` L308 이 fail-open warn 범위를 실제보다 넓게 서술)는 코드가 아니라 spec 쪽 결함
(SPEC-DRIFT)이며, 이미 같은 세션에서 정확히 식별돼 planner 인계 항목으로 plan 에 등재돼 있어
새로운 조치가 필요하지 않다. 구조적 유예 항목(`switchMap` 7분기)도 트리거 발동을 스스로 감지해
plan 항목으로 전환해 뒀다. 이번 요구사항 리뷰 관점에서 신규 CRITICAL/WARNING 은 없다.

## 위험도

NONE
