# 요구사항(Requirement) Review — EIA idempotency 캐시 손상 방어 완성 + 3라운드 자체 리뷰 정정 누적분

## 대상

diff-base `origin/main` 대비 실질 변경은 4개 파일이고, 나머지 43개는 이 세션 동안 실행된
`/ai-review`(3회: `23_24_08`/`23_36_13`/`23_48_38`) + `/consistency-check`(2회: `23_36_14`/`23_48_39`)
산출물이 표준 저장 경로(`review/code/**`, `review/consistency/**`)에 커밋된 것이다.

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (핵심 변경)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- `CHANGELOG.md`
- `plan/in-progress/backend-lint-gate-broken-on-main.md`

프롬프트에는 파일 2·3(실제 프로덕션/테스트 diff)이 크기 제한으로 생략되어 있어, `Read` 로 두 파일의
현재(HEAD=`86de12278`) 전체 내용을 직접 열어 검증했다. 관련 spec 은
`spec/5-system/14-external-interaction-api.md` §R8, `spec/data-flow/15-external-interaction.md` §4/Rationale.

## 검증 방법

- `idempotency.interceptor.ts`/`.spec.ts` 전문을 직접 Read.
- `npx jest idempotency.interceptor.spec.ts` 재실행 → **41 passed, 41 total** (RESOLUTION.md 의
  "인터셉터 단위 41/41" 과 일치).
- `spec/5-system/14-external-interaction-api.md` §R8, `spec/data-flow/15-external-interaction.md`
  §4/Rationale 원문 대조.
- `git log`/`git show 86de12278` 로 이 diff 가 만든 마지막 커밋의 실제 변경분과 plan/CHANGELOG 서술을
  대조.
- `grep TODO|FIXME|HACK|XXX` → 0건.

## 발견사항

- **[WARNING]** plan 체크리스트의 "완료" 서술이 이 라운드 최대 실질 결함(형태 불일치 캐시 → `TypeError`
  500)의 수정 사실을 담지 않는다 — 항목이 실제보다 좁게 완료된 것처럼 읽힌다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` — 체크박스 항목("캐시 엔트리 손상
    처리 전체가 불완전하다") 아래 `> **완료 (2026-08-12, eia-idem-responsejson-guard)**` 로 시작하는
    단락(현재 파일 기준 대략 622~634행). 이 항목 안에 `isIdempotencyEntry`/`null` 우회 관련 서술이
    전혀 없음(`grep -n "isIdempotencyEntry\|형태 불일치" plan/in-progress/backend-lint-gate-broken-on-main.md`
    결과 0건 매치).
  - 상세: 커밋 `86de12278`(`fix(eia): JSON.parse('null') 은 던지지 않는다 — 없애려던 500 이 좁은
    틈으로 살아 있었다`)는 이 세션 안에서 발견된 가장 실질적인 결함을 고쳤다 — `JSON.parse` 는
    문법 오류에만 던지므로 캐시 엔트리가 정확히 문자열 `"null"` 이면 `try/catch` 를 통과한 뒤
    `cached.bodyHash` 접근에서 `TypeError` 가 발생해 `GlobalExceptionFilter` 가 그대로 **500** 으로
    마스킹한다 — 이 PR 이 표방한 "캐시 손상이 요청 실패가 되지 않게 한다" 는 주장이 정확히 그 서브
    케이스에서 거짓이었다(무수정 프로브로 실측, 커밋 메시지에 기록). `isIdempotencyEntry()` 타입
    가드를 신설해 문법이 아니라 형태를 검사하도록 고쳤고, `it.each` 8-fixture + 조건-단위 뮤테이션
    실측까지 완료됐다(코드 `idempotency.interceptor.ts:352-378`, 테스트
    `idempotency.interceptor.spec.ts:552-605`로 직접 확인). 그런데 같은 커밋이 plan 파일에 만든 유일한
    변경은 체크박스 **제목**을 넓힌 것뿐이고("캐시 엔트리 내부 responseJson 손상은 무방비" →
    "캐시 엔트리 손상 처리 전체가 불완전하다"), 그 아래 "완료" 서술 본문은 그보다 이전 커밋
    (`22e68459d`)이 쓴 그대로 남아 있다 — "한 번만 파싱" · "두 자리 모두 warn" · "파싱 순서 계약" ·
    "뮤턴트 선검증 실패 경위" 네 가지만 언급하고, 이번 라운드가 실제로 닫은 다섯 번째 사실
    (문법-유효/형태-불일치 엔트리 방어)은 어디에도 없다. `CLAUDE.md`/메모리 규약("plan 체크박스 =
    실제 상태", "plan 서술은 철회로 거짓이 될 수 있다")의 취지는 체크된 항목의 완료 서술이 실제
    최종 상태를 정확히 반영해야 한다는 것인데, 지금 이 항목만 읽는 사람은 "null 같은 비-객체
    엔트리도 안전한지" 를 알 수 없다.
  - 제안: 같은 항목의 "완료" 단락에 한 문단 추가 — "후속(2026-08-13,
    `isIdempotencyEntry` 타입 가드): `JSON.parse` 는 문법 오류만 잡아 `'null'`·`'42'`·`'[]'` 같은
    문법-유효/형태-불일치 값은 통과했다. 특히 `'null'` 은 필드 접근에서 `TypeError`→500 으로 이
    항목이 없애려던 바로 그 실패 형태를 재현했다. 형태 가드를 추가해 닫았다." 코드/테스트 자체는
    수정 불요 — 순수 plan 기록 갭.

- **[INFO / SPEC-DRIFT 후보, 이미 추적 중]** `spec/data-flow/15-external-interaction.md` §4 "Redis …
  전 경로 fail-open (warn)" 및 Rationale "Fail-open 정책의 일관 표기" 의 "모두 … warn" 표현이,
  이번 diff 가 코드 docstring 에 정밀화한 "5경로 중 4개만 warn(생성자 시점 미주입 제외)" 보다 한
  단계 거칠다.
  - 위치: `spec/data-flow/15-external-interaction.md:308`(표), `:331-339`(Rationale) vs
    `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:62-71`(docstring 표)
  - 상세: 코드가 옳다 — 생성자 시점 Redis 미주입(`this.redis === null`)은 "장애" 가 아니라
    "설정 상태" 이고, 실제로 `logger.warn` 호출 5곳(`:117,144,224(x2),307,315`) 중 어디에도
    생성자-null 분기(`intercept()` 초입 `if (!rawKey || !this.redis) return next.handle();`)가
    해당하지 않음을 직접 확인했다. spec 문서의 "모두 … warn" 문구는 이 세분화 이전에 쓰인 더
    거친 표현으로, 코드가 spec 이 요구하는 "fail-open + warn" 원칙을 어긴 것이 아니라 오히려 더
    정확히 충족시키는 방향의 세분화다 — 즉 코드가 맞고 spec 표현이 낡았다(이 문서 자체가 규정한
    "unavailable" 카테고리와 코드가 구분한 "미주입=config" 카테고리가 서로 달라 문면상으로만
    어긋난다). 이 프로젝트의 `consistency-check`(`review/consistency/2026/08/12/23_48_39/rationale_continuity.md`)
    가 이미 동일 지점을 INFO 로 정확히 짚었고, `plan/in-progress/backend-lint-gate-broken-on-main.md:635-641`
    에 "developer 권한 밖 → planner 인계" 로 올바르게 등재돼 있다 — 추가 조치 불요, 이미 정상
    프로세스를 타고 있다.
  - 제안: 코드 유지 + spec 반영. `spec/data-flow/15-external-interaction.md` §4 표 각주 또는
    하단 Rationale "Fail-open 정책의 일관 표기" 문단에 "구성 미주입(기동 시 `null`)은 장애가 아니라
    설정 상태이므로 warn 대상에서 제외" 한 줄 추가 — planner 턴에서 처리(이미 plan 에 등재됨, 본
    reviewer 는 spec 직접 수정 안 함).

- **[INFO]** spec §R8 핵심 3계약(닫힌 캐시 목록 `2xx/409/410`, `<executionId>:<route>:<key>` 캐시
  키 스코프, "전역 키 fallback 금지") 이 이번 diff 로 변경되지 않았고 코드와 정확히 일치.
  - 위치: `idempotency.interceptor.ts:348-350`(`isErrorStatusCacheable`, `409 || 410` 명시 열거 —
    `spec/5-system/14-external-interaction-api.md:1059` "단일 비교로 축약 금지" 요구와 일치),
    `:133`(`${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}` — §R8:1061 스코프 요구와 일치),
    `:112-121`(`executionId` 부재 시 캐시 skip, 전역 fallback 없음 — §R8:1068 과 일치).
  - 상세: 이번 diff 는 이 세 계약의 판정 로직 자체를 건드리지 않고, 그 뒤에 있던 별개의 갭
    (엔트리/payload JSON 파싱 미방어)만 닫았다. 판정 순서 변경(`bodyHash` 판정을 `responseJson`
    파싱보다 먼저 두는 것)도 §R8 계약을 어기지 않고 오히려 "손상된 캐시로 409 충돌 탐지가
    무력화되는 것" 을 막아 계약을 더 강하게 지킨다 — 순서를 뒤집는 회귀 테스트
    (`idempotency.interceptor.spec.ts:668-699`)로 캐너리 고정됨을 확인.

- **[INFO]** `CHANGELOG.md` 의 "다섯 경로 중 넷 warn" 서술이 코드 docstring 표와 정확히 일치 —
  자체 모순 없음(이전 라운드 `23_48_38` documentation WARNING #1 이 지적했던 자기모순이 실제로
  정정됨을 직접 대조 확인).
  - 위치: `CHANGELOG.md:21-24` vs `idempotency.interceptor.ts:63-71`.

- **[INFO]** 신규 `isIdempotencyEntry()` 형태 가드의 각 절이 조건-단위로 하중을 받는지 뮤테이션
  기록(RESOLUTION.md/커밋 메시지)과 코드/테스트 실물을 대조해 확인 — `Array.isArray`/`typeof`
  절이 제거된 것도 실제 코드에 반영돼 있고(`idempotency.interceptor.ts:370-378`, 세 필드 타입
  검사만 남음), `it.each` fixture 8개 중 뒤 3개(`:558-569`)가 "정확히 한 필드만 타입 불일치"로
  설계돼 매트릭스의 각 항을 실제로 가르는 것을 확인했다.

- **[INFO]** 모든 코드 경로에서 반환값 누락 없음 — `switchMap` 콜백의 6개 분기(캐시 미스·엔트리
  손상·bodyHash 불일치(throw)·payload 손상·에러 상태 재현(throw)·성공 재현)가 전부 값을 반환하거나
  명시적으로 throw. TODO/FIXME/HACK/XXX 주석 없음(grep 확인).

## 요약

핵심 프로덕션 변경(`idempotency.interceptor.ts`)은 spec EIA §R8 의 세 계약(닫힌 캐시 목록·캐시
키 스코프·전역 fallback 금지)을 건드리지 않은 채, 그 뒤에 남아 있던 실 결함 — 캐시 엔트리 안쪽
`responseJson` 손상 시 500 마스킹, 그리고 이 세션 자체 리뷰가 추가로 찾아낸 "문법은 유효하지만
형태가 아닌" 엔트리(`'null'` 등)의 동형 결함 — 을 모두 닫았다. 41/41 테스트가 통과하고, 뮤테이션
검증(조건-단위 하중 확인, 순서 반전 캐너리)까지 실측 기록이 남아 있으며, `bodyHash` 판정이 payload
파싱보다 먼저라는 순서 계약이 코드·테스트·CHANGELOG·plan 네 곳에서 일관된다. Critical 급 결함은
없다. 유일한 실질 지적은 plan 체크리스트의 "완료" 서술이 이번 세션의 가장 실질적인 수정(형태 가드)을
누락해, 그 항목만 읽으면 실제로 닫힌 범위보다 좁게 보인다는 문서 정합성 WARNING 이다(코드/테스트
자체는 수정 불요). 별도로 `spec/data-flow/15-external-interaction.md` 의 fail-open 서술 granularity
격차는 코드가 맞고 spec 표현이 낡은 SPEC-DRIFT 후보이나, 이미 이 프로젝트의 consistency-check 가
발견해 plan 에 planner 인계로 정상 등재돼 있어 추가 조치가 필요하지 않다.

## 위험도

LOW
