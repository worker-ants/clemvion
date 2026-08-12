# 유지보수성(Maintainability) Review

## 검토 대상 요약

이번 diff 는 `IdempotencyInterceptor.intercept()` 의 RxJS 파이프라인(`from(this.redis.get(redisKey)).pipe(...)`)에
`catchError` 연산자 하나를 `switchMap` **앞**에 추가해, Redis `get()` 런타임 reject 를 캐시 미스로
강등하는 작은 국소적 버그 수정이다. 부속으로 클래스 docstring 보강, 테스트 3건 신설,
`CHANGELOG.md`/plan 문서 갱신이 딸려 있다.

`review/code/2026/08/12/14_27_02/*`, `review/code/2026/08/12/14_50_36/*` (24개 파일)는 직전 두 리뷰
세션(같은 fix 대상)의 산출물이 이번 커밋으로 저장소에 반영된 것 — 생성된 감사 기록(markdown/json
리포트)이지 사람이 손으로 유지보수하는 소스가 아니므로 가독성·네이밍·함수 길이·중첩·매직넘버·중복·
복잡도·일관성 관점의 정적 분석 대상에서 제외한다. 다만 이전 라운드 자체 산출물이라 **선행 라운드의
발견이 이번 라운드에도 유효한지**를 아래에서 실측으로 재확인했다.

**직전 두 라운드(`14_27_02`→`14_50_36`)가 지적한 항목의 현재 상태를 직접 파일을 열어 재확인**:
- `bodyHashOf` 헬퍼 중복(`14_27_02` WARNING #3) — `idempotency.interceptor.spec.ts:94-97` 모듈
  최상단 단일 정의로 통합돼 있고, `grep -n bodyHashOf`로 전수 확인한 결과 재선언은 없다. **해소 확인**.
- 테스트 파일 헤더 docstring 이 3번째 describe 를 언급하지 않던 문제(`14_27_02`/`14_50_36` INFO) —
  `idempotency.interceptor.spec.ts:15-17` 에 "세 번째 describe 는 **Redis 런타임 장애 fail-open**…"
  한 줄이 실제로 추가돼 있다. **해소 확인**.
- GET/SET 캐시 실패 로그 메시지 조립 중복(`idempotency.interceptor.ts:107-110` vs `:176-179`) — 여전히
  존재. 두 라운드 연속으로 "2곳뿐이라 보류"로 의도적 유예된 항목이며 새로 늘어난 것은 아니다. 아래
  INFO 로 유지.

## 발견사항

- **[INFO]** GET/SET 캐시 실패 로그 메시지 조립·`instanceof Error` 판별 로직이 두 자리에서 중복된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107-110`
    (신규 `catchError` — GET 실패), `:176-179` (기존 `cacheTapped()` 내 `.catch()` — SET 실패, 이번
    diff 로 직접 수정되진 않았으나 신규 코드가 같은 패턴을 한 번 더 만든다)
  - 상세: 두 자리 모두 `` `IdempotencyInterceptor cache ${OP} 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}` ``
    형태의 동일한 문자열 조립 로직을 갖는다(`OP` 만 `GET`/`SET`). 직전 두 라운드에서 이미 지적되고
    "2곳뿐이라 보류"로 의도적 유예됐다 — 이번 라운드에도 상태가 그대로이며 세 번째 실패 경로가
    생기기 전까지는 급하지 않다고 판단해 재차 INFO 로만 남긴다.
  - 제안: `private warnCacheFailure(op: 'GET' | 'SET', err: unknown): void` 로 추출하면 두 호출부가
    한 줄로 줄어든다. 낮은 우선순위, 조치 불요.

- **[INFO]** `catchError` 삽입부의 인라인 주석 블록이 8줄로 다소 길다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:99-106`
  - 상세: fail-open 취지·spec 근거·`switchMap` 앞에 둬야 하는 이유(뒤로 가면 `ConflictException`
    까지 삼켜 멱등성 검출이 죽음)를 한 블록에 담아 8줄이다. 다만 이 저장소는 로드베어링 위치
    결정에 대해 밀도 높은 docstring/인라인 주석으로 근거를 고정하는 것이 기존 관례(클래스
    docstring, `HttpResponseLike` 주석 등)이고, 바로 아래 캐너리 테스트(`idempotency.interceptor.spec.ts`
    의 "fail-open 이 409 충돌까지 삼키지 않는다")와 1:1 대응하는 실질 내용이라 무관한 주석 팽창은
    아니다.
  - 제안: 조치 불요. 스타일 판단 사항으로 기록만 남김.

## 확인했지만 문제 없음

- `catchError` 콜백 자체(`idempotency.interceptor.ts:107-112`)는 3~5줄로 짧고, `intercept()` 의
  중첩 깊이·분기 수는 이 diff 로 변하지 않았다 — 연산자 하나가 파이프라인 앞쪽에 추가됐을 뿐,
  `switchMap` 콜백 내부 구조(if/try-catch)는 그대로다. 함수 길이·순환 복잡도 관점에서 새로 유입된
  문제 없음.
- 매직 넘버 없음 — `TTL_SEC`(`:21`)·`MAX_KEY_LENGTH`(`:22`) 는 기존 명명 상수 그대로, 신규 코드가
  하드코딩한 리터럴 숫자는 없다.
- `bodyHashOf` 는 모듈 최상단 단일 정의(`idempotency.interceptor.spec.ts:94-97`)로 통합돼 있고,
  같은 파일의 `makeRedis`/`makeRedisConn`/`makeContext`/`makeCallHandler`/`makeInterceptor` 와 같은
  공유 헬퍼 패턴을 따른다 — 파일 내 일관성 양호. 신규 3번째 `describe` 블록(`:352`~)도 이 헬퍼들을
  그대로 재사용해 네이밍·구조가 기존 두 블록과 일관적이다.
- `CHANGELOG.md`·`plan/in-progress/backend-lint-gate-broken-on-main.md` 변경은 각각 저장소의
  `## Unreleased — <제목>` 관례와 "plan 체크박스=실제 상태" 관례를 그대로 따른다. plan 문서의
  "처리 완료" 서술은 spec 인용·무수정 프로브·뮤테이션 실측 수치를 근거로 남겨 투명하다.
- `review/code/2026/08/12/14_27_02/RESOLUTION.md`, `14_50_36/RESOLUTION.md` 는 자신의 이전 서술
  오류("헤더는 갱신함" 거짓 기록)를 삭제하지 않고 정정으로 남긴 뒤 근거(왜 지우지 않는지)까지
  적었다 — 문서 신뢰성 관점에서 바람직한 패턴.

## 요약

핵심 프로덕션 변경은 RxJS 파이프라인에 `catchError` 연산자 하나를 정확한 위치(`switchMap` 앞)에
삽입하는 국소적 fix로, 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 측면에서 새로 유입된 문제가
없고 기존 코드베이스의 네이밍·주석 밀도 관례와 일관된다. 직전 두 라운드가 지적한 `bodyHashOf`
중복(WARNING)과 테스트 헤더 docstring 누락(INFO)은 이번 라운드 기준으로 직접 파일을 열어
재확인한 결과 실제로 해소돼 있다. 남는 것은 GET/SET 캐시 실패 로그 조립 로직의 소규모 중복
(2곳, 두 라운드 연속으로 의도적 유예) 하나뿐이며, 기능적 위험 없이 이번 PR 스코프(런타임
fail-open 버그 수정)를 넘어서지 않는 선택적 개선 사항이다. 리뷰 산출물 디렉터리(`review/code/**`)
24개 신규 파일은 생성된 감사 기록이라 이번 관점의 정적 분석 대상이 아니다.

## 위험도

LOW
