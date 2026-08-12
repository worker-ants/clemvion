# Requirement Review — `23_48_38`

## 리뷰 범위

핵심 코드 변경은 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
+ 그 spec 파일이다(캐시 엔트리 **안쪽** `responseJson` 손상 시 500 마스킹 대신 fail-open 신규
처리). `CHANGELOG.md`·`plan/in-progress/backend-lint-gate-broken-on-main.md` 는 그 변경을 서술하는
문서, `review/code/2026/08/12/{23_24_08,23_36_13}/**` 는 직전 두 라운드 리뷰의 산출물(이미 커밋됨,
과거 시점 기록)이다. 실제 소스(`idempotency.interceptor.ts`, `idempotency.interceptor.spec.ts`)는
`Read` 로 전문을 직접 열어 확인했고, `git log`/`git show`로 3개 관련 커밋(`22e68459d`
fix → `eb752e0e6` W1~W3 조치 → `e7ad5ca1f` 인용 stale 조치)의 diff 를 대조했다.

## 발견사항

- **[INFO]** `23_24_08` RESOLUTION 의 INFO #9(scope 리뷰어 지적 — "바깥 엔트리 warn 추가가 PR
  표제보다 넓다") 처분이 "**수용** — 지적대로 plan 항목 제목을 '손상 처리 전체' 로 넓게 적는 편이
  낫다" 라고 적었으나, 실제 plan 체크박스 제목은 후속 커밋(`eb752e0e6`, `e7ad5ca1f`)에서도 여전히
  좁은 원제("캐시 엔트리 내부 `responseJson` 손상은 무방비")로 남아 있다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:610` (체크박스 제목),
    비교 대상: `review/code/2026/08/12/23_24_08/RESOLUTION.md` INFO 표 9번 행
  - 상세: "수용" 이 "반영"(#11/#12/#14 처럼 실제로 텍스트를 바꿈)과 구분되는 처분이라면 의도적일
    수 있으나, 문장 자체가 "지적대로 넓게 적는 편이 낫다" 는 실행 의도를 담고 있어 미이행처럼
    읽힌다. 기능 결함은 아니고, 코드 정확성에도 영향 없음(체크박스는 `[x]` 로 정확히 완료 표시돼
    있고 본문 완료 기록도 실제 구현과 line-level 로 일치함).
  - 제안: 실제 방치 의도라면 다음에 plan 항목을 다시 만질 때 처리해도 무방. 다만 "수용" 표기를
    "반영 예정(later)" 처럼 실행 여부가 명확한 표현으로 구분해 두면 향후 "plan 서술 ≠ 실제 상태"
    혼선을 줄일 수 있다.

## 항목별 점검 결과 (요약)

1. **기능 완전성** — 목표(안쪽 `responseJson` 손상 시 500 대신 fail-open)를 완전히 구현. 파싱을
   `switchMap` 콜백 한 곳으로 끌어올려(`idempotency.interceptor.ts:181-186`) 종전 두 재현 분기의
   맨몸 `JSON.parse` 중복도 함께 제거됐다(4라운드 유예 항목 해소, plan 완료 기록과 일치).
2. **엣지 케이스** — 바깥 JSON 손상(`:157-162`)·안쪽 payload 손상(`:181-186`) 모두 커버. `cached`
   가 `null`/`undefined` 인 경우(`!cachedJson`)는 `processFresh()` 로 조기 분기(`:155`), 기존
   회귀(캐시 미스)와 동일 동작 유지. `statusCode`/`status` 미정의 응답은 이번 diff 범위 밖 기존
   가드(`HttpResponseLike` optional) 그대로 보존.
3. **TODO/FIXME** — 없음.
4. **의도와 구현 간 괴리** — 없음. `discardCorruptEntry` 라는 이름이 "손상 엔트리를 버리고
   신규 처리로 강등, warn 을 남긴다" 라는 실제 동작과 정확히 일치(`:206-228`). JSDoc 이 두
   호출부의 **종전** 동작 차이(엔트리=조용한 강등, payload=방어 부재→500)를 분리 서술해 정확.
5. **에러 시나리오** — `JSON.parse` 실패(엔트리/payload 둘 다) → `discardCorruptEntry` →
   `processFresh()` 로 수렴, `Logger.warn` 필수 방출. 정상 흐름 외 모든 파싱 실패 경로가 응답을
   죽이지 않는다는 목표(spec "전 경로 fail-open")와 부합.
6. **데이터 유효성** — `cached.bodyHash !== bodyHash` 판정이 **payload 파싱보다 먼저** 온다
   (`:167-174` vs `:181-186`) — 이것이 이번 diff 의 핵심 계약이다. 순서를 반대로 하면 손상된
   엔트리에서 `409 IDEMPOTENCY_KEY_CONFLICT` 가 조용히 사라지는데, 이를 고정하는 회귀 테스트
   (`idempotency.interceptor.spec.ts:603-634` "안쪽이 깨졌어도 body 가 다르면 여전히 409")가
   실제로 순서를 검증한다 — `handleSpy`(downstream 미실행) + `redis.set` 미호출까지 단언해
   `ConflictException` 이 신규 처리로 새 진 게 아니라 진짜 409 로 끝났음을 증명한다.
7. **비즈니스 로직** — `isErrorStatusCacheable`(409/410 닫힌 목록)·`400 VALIDATION_ERROR` 캐시
   제외 등 R8 규칙은 이번 diff 로 변경되지 않고 그대로 보존(`:333-335`). 새로 추가된 "손상 시
   무시하고 신규 처리" 규칙은 spec 이 명시한 "전 경로 fail-open(warn) — 가용성 우선"
   (`spec/data-flow/15-external-interaction.md:308`) 원칙의 자연스러운 확장.
8. **반환값** — `switchMap` 콜백의 모든 분기가 `Observable`(`processFresh()`/`of(cachedPayload)`)
   반환 또는 명시적 `throw`(`ConflictException`/`HttpException`)로 종료 — 값 없이 falling through
   하는 경로 없음. `discardCorruptEntry<T>` 의 반환 타입이 두 호출부(둘 다
   `Observable<unknown>`)와 일치하며 `tsc --noEmit` 확인 결과 이 파일·spec 파일에 타입 오류 없음
   (다른 무관 파일들의 기존 오류만 존재, 이번 diff 와 무관).
9. **spec fidelity** — 관련 spec: `spec/5-system/14-external-interaction-api.md`(R8 본문,
   `:1053-1068`) + `spec/data-flow/15-external-interaction.md`(§2.2 표, `:258`, `:308`
   "전 경로 fail-open (warn)"). 코드의 `isErrorStatusCacheable`(409/410만)·캐시 키 스코프
   (`<executionId>:<route>:<key>`, `:133`)·`400` 제외 등 기존 규칙은 spec 과 line-level 로
   일치. 이번 diff 가 신설한 "엔트리/payload 손상 시 fail-open+warn" 은 spec 이 개별 항목으로
   명시하진 않지만 §2.2 의 포괄 원칙("전 경로 fail-open (warn) — 가용성 우선")의 범위 안이라
   모순이 아니다 — spec 침묵 영역의 합리적 확장으로 판단(INFO, SPEC-DRIFT 아님: 되돌릴 이유가
   없는 강화이며 spec 문구를 갱신해야 할 만큼 spec 이 이 세부(캐시 엔트리 파싱 손상)를 별도로
   규정하고 있지도 않다). CHANGELOG·클래스 JSDoc(5-경로 표)·plan 완료 기록·테스트 4건(경로별
   1개씩 + 순서 캐너리)이 서로 line-level 로 정합.

## 요약

핵심 diff(`idempotency.interceptor.ts`/`.spec.ts`)는 "캐시 엔트리 안쪽 `responseJson` 손상이
500 으로 마스킹된다" 는 선재 결함을 완전하고 정확하게 해소한다 — 파싱 통합으로 중복 제거,
`bodyHash` 판정이 payload 파싱보다 먼저라는 순서 계약을 코드·주석·회귀 테스트(뮤테이션까지)로
일관되게 고정했고, 두 손상 경로 모두 이제 warn 을 남겨 이 클래스의 fail-open 다섯 경로 원칙과
합치한다. Spec(`EIA §R8`, `data-flow §2.2`)과 코드의 기존 규칙(닫힌 목록 409/410, 캐시 키 스코프,
400 제외)은 그대로 보존됐고 이번 신설 동작도 spec 의 포괄 원칙과 모순되지 않는다.
CHANGELOG·plan·직전 두 리뷰 라운드의 WARNING 조치(형제 테스트 동형화, docstring 5-경로 표,
문구 인용 제거)도 실제 소스와 대조했을 때 모두 정확히 반영돼 있다. 유일한 흠은 plan 의 한 INFO
처분("수용 — 제목을 넓게 적는 편이 낫다")이 실행되지 않은 채 남아 있다는 점인데, 기능·spec
정합성에는 영향이 없는 문서 완결성 수준의 잔여 항목이다.

## 위험도
LOW
