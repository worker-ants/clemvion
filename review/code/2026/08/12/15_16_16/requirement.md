# 요구사항(Requirement) Review — EIA idempotency fail-open fix (4라운드, `15_16_16`)

## 검증 방법 (직접 실행·직접 열람, 프롬프트 텍스트 재인용 아님)

이 diff 는 핵심 코드 변경(`idempotency.interceptor.ts`/`.spec.ts`/`CHANGELOG.md`/plan 체크박스)에
직전 3라운드(`14_27_02`→`14_50_36`→`15_04_25`)의 리뷰 산출물 40개 파일이 누적 포함된 것이다.
3라운드 모두 CRITICAL 0으로 수렴했고 마지막 라운드는 WARNING 도 "리뷰어 스스로 조치 불요로 판정"
하며 닫혔다(`review/code/2026/08/12/15_04_25/RESOLUTION.md` 수렴 판단 참조). 프롬프트 텍스트를
그대로 믿지 않고 작업 트리를 직접 열어 독립 재검증했다:

- `Read codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 전체 —
  `catchError` **107행** < `switchMap` **113행**. `git status --porcelain` 는 이 리뷰 세션
  디렉터리(`review/code/.../15_16_16/`)만 untracked, 그 외 clean.
- `Read codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 전체 —
  3번째 `describe`(Redis 런타임 장애 fail-open) 5개 테스트(통과+warn·캐시 미스 적재·409 캐너리·
  set() 실패+warn·비-Error reject) 모두 확인. GET/SET 양쪽 `warn` 단언이 대칭.
- `npx jest idempotency.interceptor.spec.ts --silent` 직접 실행 — **16/16 통과**(경고 로그 2건은
  fail-open 테스트가 의도적으로 유발한 것, 실패 아님).
- `spec/data-flow/15-external-interaction.md:308,333` 직접 열람 — "Redis … 전 경로 fail-open
  (warn) — 가용성 우선", "idempotency … 모두 Redis/DB 미가용 시 fail-open". 클래스 docstring
  (`idempotency.interceptor.ts:61-72`) 인용과 line-level 일치.
- `spec/5-system/14-external-interaction-api.md:140,1053-1055` 직접 열람 — `EIA-RL-02`("Idempotency-Key
  동일 시 동일 응답 24h 재현"), R8("400 VALIDATION_ERROR 만 캐시 제외, 그 외 2xx/409/410 은 캐시").
  구현의 `cacheTapped()` 조건(`statusCode >= 400` 전체 제외, `:168`)은 이 R8 보다 넓어 409·410 을
  함께 떨구는 **선재 결함**이며, 이번 diff 의 변경 대상이 아니다 — docstring(`:144-156`)과 캐너리
  테스트(`spec.ts:234-257`)가 정직하게 문서화·고정하고 있다.
- `grep -n IDEMPOTENCY_KEY_CONFLICT spec/ codebase/...` — 에러 코드 `IDEMPOTENCY_KEY_CONFLICT`/409
  가 `spec/5-system/14-external-interaction-api.md:346`, `spec/5-system/3-error-handling.md:166`
  와 정확히 일치.
- `grep -n "TODO\|FIXME\|HACK\|XXX"` — 신규 코드에 없음.
- `CHANGELOG.md:1-18`, `plan/in-progress/backend-lint-gate-broken-on-main.md:498,524` 직접 열람 —
  서술이 실제 코드 상태·spec 인용과 정확히 일치, 체크박스도 실제 상태와 일치(`[x]` 완료 /
  `[ ]` 미착수 관측 백로그).

## 요약 결론

의도(spec 이 명시한 "Redis 전 경로 fail-open — 가용성 우선"을 `get()` 런타임 reject 경로까지
확장)와 구현이 line-level 로 정확히 일치한다. `catchError` 삽입 위치(`switchMap` **앞**)는
`ConflictException`(409) 을 삼키지 않기 위한 핵심 설계 결정이고, 전용 캐너리 테스트가 그 배치를
회귀 고정한다. 3라운드에 걸쳐 반복 재검증된 결과이며 이번 4라운드 독립 확인에서도 동일 결론이다.
새로 발견된 요구사항 결함은 없다.

## 점검 관점별 확인

1. **기능 완전성** — fail-open 이 요구하는 세 경로(기동 시 미주입·조회 실패·적재 실패) 모두
   구현·문서화·테스트됨. 완전.
2. **엣지 케이스** — non-Error reject(`String(err)` else 분기), 손상된 캐시 JSON, `status`/
   `statusCode` 없는 응답 객체, 빈/공백 키(`readKey`) 등 경계가 전부 테스트로 고정됨.
3. **TODO/FIXME** — 신규 코드에 없음. 선재 결함(R8 범위 초과)은 TODO 가 아니라 근거 있는 docstring
   + 캐너리 테스트로 처리(적절 — "TODO 대신 캐너리로 고정"은 이 저장소의 기존 관례와 일치).
4. **의도-구현 괴리** — 클래스 docstring "fail-open 은 세 경로 모두"라는 주장이 이제 구현·테스트
   양쪽과 정확히 대응한다. 3라운드 전 지적됐던 괴리(런타임 reject 미보호)가 해소됨.
5. **에러 시나리오** — `get()` reject → 통과+warn, 캐시 미스로 적재, 409 충돌 보존, `set()` reject
   → 통과+warn, 비-Error reject → 무손상. 5가지 모두 테스트 커버.
6. **데이터 유효성** — 이번 diff 의 변경 대상 아님(`readKey`/`hashBody` 는 미변경). 참고로
   `readKey` 의 길이 상한(200)·trim·타입 체크는 선재 코드로 여전히 유효.
7. **비즈니스 로직** — "멱등성은 부가 기능, Redis 장애로 API 자체가 죽으면 안 된다"는 spec 의
   가용성 우선 원칙이 정확히 반영됨. 그 대가(fail-open 구간 중복 억제 무력화)는 CHANGELOG·
   docstring·plan 백로그(`plan/in-progress/backend-lint-gate-broken-on-main.md:524`)에 이미
   명시·유예되어 있고, 직전 라운드에서 concurrency/side_effect reviewer 가 "코드로 되돌릴 필요
   없음"으로 판정 완료했다 — 이번 라운드에서 재확인해도 같은 결론(INFO, 조치 불요).
8. **반환값** — `intercept()` 모든 분기가 `Observable<unknown>` 반환. 누락 없음.
9. **spec fidelity** — `spec/data-flow/15-external-interaction.md:308,333`(fail-open 요구),
   `spec/5-system/14-external-interaction-api.md:140`(EIA-RL-02), `:1053-1055`(R8),
   `:346`/`spec/5-system/3-error-handling.md:166`(`IDEMPOTENCY_KEY_CONFLICT`/409) 전부 직접
   대조해 line-level 일치 확인. R8 대비 캐시 제외 범위 초과는 이번 diff 이전부터 있던 선재
   결함이고 diff 범위 밖으로 명확히 분리·문서화되어 은폐 없음.

## 발견사항

- **[INFO]** fail-open 트레이드오프(Redis 장애 지속 구간의 `Idempotency-Key` 중복 억제 무력화)는
  기능 결함이 아니라 spec 이 명시적으로 승인한 가용성 우선 정책이며, 3라운드에 걸쳐 문서화·
  plan 백로그·리뷰어 판정으로 이미 종결됐다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:67-72`
    (클래스 docstring), `plan/in-progress/backend-lint-gate-broken-on-main.md:524-530`
  - 제안: 조치 불요(3라운드 연속 동일 판정). 관측 지표(Redis GET 실패율 알람)는 plan 백로그가
    이미 추적 중.

- **[INFO]** R8 대비 캐시 제외 범위 초과(`statusCode >= 400` 이 409·410 까지 떨구는 선재 결함)는
  이번 diff 의 변경 대상이 아니고, 캐너리 테스트(`idempotency.interceptor.spec.ts:234-257`)로
  현재 동작이 정직하게 고정돼 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:168`
    (`cacheTapped()` 내 `if (statusCode >= 400) return;`)
  - 제안: 조치 불요(스코프 밖, `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속으로
    이미 추적 중).

- **[없음 — 확인 결과 문제 없음]** `catchError`/`switchMap` 순서 역전은 현재 커밋 상태에 존재하지
  않는다(직접 `Read`+`npx jest` 로 독립 재확인, 16/16 GREEN). 과거 라운드(`14_27_02`)의 documentation
  리뷰어가 보고했던 CRITICAL 은 공유 워크트리 뮤테이션 아티팩트였다는 판정과 이번 재확인 결과가
  일치한다.

## 위험도
NONE
