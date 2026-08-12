# 요구사항(Requirement) Review — EIA idempotency fail-open fix

## 검토 대상
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- `plan/in-progress/backend-lint-gate-broken-on-main.md` (체크박스 완료 반영)

## 요약 결론 먼저
의도(spec 이 명시한 "Redis 전 경로 fail-open — 가용성 우선"을 `get()` 런타임 reject 경로까지 확장)와
구현이 정확히 일치한다. `catchError` 삽입 위치(`switchMap` **앞**)는 `ConflictException`(409)을
삼키지 않기 위한 핵심 설계 결정이고, 이를 고정하는 캐너리 테스트("catchError 위치 캐너리")를
직접 뮤테이션해 검증했다 — 실제로 `catchError` 를 `switchMap` **뒤**로 옮기면 정확히 plan 이 주장한
**4건 RED**(신규 3건 + 기존 409 테스트 1건)가 재현된다. 되돌린 뒤 `--no-cache` 로 재확인하면
14/14 GREEN. 코드·spec·plan 문서·테스트 네 축이 서로 정합한다.

## 발견사항

- **[INFO]** spec 인용 정확성 확인 — `spec/data-flow/15-external-interaction.md:308` (`Redis | 내부 |
  blacklist · idempotency · seq · BullMQ. 전 경로 fail-open (warn) — 가용성 우선`)와 `:333`
  (`토큰 blacklist·idempotency·jti 추적·notification enqueue 모두 Redis/DB 미가용 시 fail-open`)을
  직접 열어 대조. 코드 docstring(`idempotency.interceptor.ts:62-65`)과 spec.ts 테스트 블록 주석
  (`idempotency.interceptor.spec.ts:341-342`)의 인용이 원문과 정확히 일치한다. line-level spec
  fidelity 위반 없음.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:61-65`

- **[INFO]** `catchError` 삽입 위치의 정확성을 직접 재현 검증. `from(this.redis.get(redisKey)).pipe(catchError(...), switchMap(...))`
  순서가 유지되어야 하는 이유(뒤로 가면 `switchMap` 내부에서 던지는 `ConflictException` 까지
  downstream 으로 전파되어 `catchError` 가 삼킴)를 실제로 파일을 뮤테이션(`catchError` 블록을
  `switchMap(...)` 뒤로 이동) 후 `--no-cache` 로 재실행해 확인 — 정확히 4건 RED
  (`같은 key + 다른 body → 409 IDEMPOTENCY_KEY_CONFLICT`, 신규 3건: `get() 이 reject 해도 요청은
  통과한다`·`get() 이 reject 하면 캐시 미스로 취급`·`catchError 위치 캐너리`). 되돌린 뒤 재확인:
  14/14 GREEN, `git status`/`git diff` 클린. `plan/in-progress/backend-lint-gate-broken-on-main.md:520-523`
  의 "뮤테이션 실측: 뒤로 옮기면 4건 RED" 주장과 정확히 일치 — plan 문서가 과장 없이 사실을
  기록했음을 독립 재현으로 확인.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:91-134` (intercept()), `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:393-416` (캐너리 테스트)
  - 참고: 검증 도중 공유 worktree 에서 병렬로 도는 다른 리뷰 세션(동일 `review/code/.../14_27_02/` 디렉터리에 `concurrency.md`·`security.md`·`testing.md` 등이 동시 생성 중이었음)이 같은 파일을 일시적으로 동일한 뮤테이션 상태로 만든 순간을 관측했으나, 재확인 시점엔 `git status` 클린 + HEAD 와 일치 + 14/14 GREEN 으로 복원돼 있었다. 코드 결함이 아니라 다른 세션의 검증 활동이 남긴 순간적 레이스이므로 이 리뷰는 액션 아이템으로 잡지 않는다(과거 기록: `feedback_reviewer_mutates_shared_worktree.md`와 동일 클래스).

- **[INFO]** 캐시 미스 강등 테스트(`get() 이 reject 하면 캐시 미스로 취급해 새 응답을 적재한다`,
  `idempotency.interceptor.spec.ts:373-391`)가 `redis.set` 호출 시 저장되는 `bodyHash` 만
  단언하고 `statusCode`/`responseJson` 은 단언하지 않는다. 바로 아래 "손상된 캐시 JSON" 테스트
  (`254-284행`)는 세 필드를 모두 단언하는 것과 비교하면 커버리지가 살짝 얕다. 기능 결함은
  아니고(같은 `cacheTapped()` 경로를 타므로 다른 테스트가 이미 그 필드들을 검증) 완전성 관점의
  경미한 개선 여지.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:386-390`
  - 제안: 필요하면 `stored.statusCode`/`stored.responseJson` 단언 추가(선택 사항, 낮은 우선순위).

- **[INFO]** `bodyHashOf` 헬퍼가 세 describe 블록(`161-166`, `349-353` 등)에 동일하게 중복
  정의돼 있다. 기능에는 영향 없음(각 블록이 독립적으로 동작), 순수 스타일/DRY 관점의 경미한
  중복. 기존 파일도 이미 같은 패턴을 두 번 반복하고 있어 이번 PR 이 새로 만든 문제는 아니다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:350-353`

- **[INFO]** R8 캐시 제외 범위(`statusCode >= 400` 이 409·410 까지 떨구는 선재 결함,
  `EIA-RL-02` 부분 미준수)는 이번 diff 의 변경 대상이 아니다. `cacheTapped()` docstring
  (`idempotency.interceptor.ts:137-149`)과 `idempotency.interceptor.spec.ts:229-252`(409 캐너리)가
  이미 정직하게 문서화하고 있고, `plan/in-progress/backend-lint-gate-broken-on-main.md:527-544`
  가 별도 미해결 항목으로 추적 중이다(`spec/5-system/14-external-interaction-api.md` §R8 이 SoT).
  회귀·은폐 없음 — 스코프 밖 기지 결함을 캐너리로 고정만 하는 정상적인 처리.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:159-161`(`cacheTapped`)

## 점검 관점별 확인

1. **기능 완전성** — Redis `get()` 런타임 reject → fail-open(캐시 미스 강등) 이 3경로(생성자 null·
   조회 실패·적재 실패) 전부에 대해 구현·문서화·테스트됨. 완전.
2. **엣지 케이스** — `err instanceof Error ? err.message : String(err)` 로 non-Error throw 방어.
   `catchError` 가 `of(null)` 반환해 이후 `if (cachedJson)` 분기가 자연스럽게 미스로 처리.
3. **TODO/FIXME** — 신규 코드에 없음. 기존 선재 결함(R8 범위)은 TODO 가 아니라 근거 있는 docstring
   설명 + 캐너리 테스트로 처리(적절).
4. **의도-구현 괴리** — 클래스 docstring "Redis 미가용 시 fail-open" 주장이 이제 실제 코드
   전체 경로와 일치. 이전(선행 커밋)에는 생성자 null 체크만 지탱했던 괴리를 이 PR 이 해소.
5. **에러 시나리오** — `get()` reject 시 요청 통과 + downstream 정상 처리 + 새 응답 캐시 적재
   3가지가 모두 테스트로 고정됨.
6. **데이터 유효성** — 해당 없음(입력 검증 변경 없음).
7. **비즈니스 로직** — "멱등성은 부가 기능, Redis 장애로 API 자체가 죽으면 안 된다"는 spec 의
   가용성 우선 원칙이 정확히 반영됨.
8. **반환값** — `intercept()` 모든 분기가 `Observable<unknown>` 반환, 누락 없음.
9. **spec fidelity** — `spec/data-flow/15-external-interaction.md:308,333` 인용 정확. R8(`spec/5-system/14-external-interaction-api.md:1053`) 관련 기존 갭은 이번 diff 범위 밖으로 명확히 분리되어 있고 은폐 없음.

## 위험도
NONE
