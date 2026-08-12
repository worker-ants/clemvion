# 유지보수성(Maintainability) 코드 리뷰

## 검토 대상 요약

핵심 변경은 `IdempotencyInterceptor.intercept()` 의 RxJS 파이프라인에 `catchError` 연산자
하나를 `from(this.redis.get(redisKey)).pipe(...)` 직후·`switchMap` 앞에 추가해, Redis 조회
런타임 실패를 캐시 미스로 강등시키는 작은 diff다. 부속으로 클래스 docstring 보강, 테스트 3건
신설, `CHANGELOG.md`/plan 문서 갱신이 딸려 있다. `review/code/2026/08/12/14_27_02/*` 는 직전
리뷰 세션(같은 fix 대상)의 산출물이 이번 커밋으로 저장소에 반영된 것으로, 생성된 감사
기록(markdown/json 리포트)이지 사람이 손으로 유지보수하는 소스가 아니라 이번 관점(가독성·
네이밍·함수 길이·중첩·매직넘버·중복·복잡도·일관성)의 대상에서 제외했다 — 별도 발견사항 없음.

직전 라운드(`14_27_02`)의 maintainability 리뷰가 낸 WARNING #3(`bodyHashOf` 중복)이 실제로
고쳐졌는지 직접 파일을 열어 재확인했다: `idempotency.interceptor.spec.ts:89-93` 에 모듈
최상단 단일 정의로 통합돼 있고, 기존 `describe` 블록이었던 `:167` 구역의 로컬 복제본은
제거됐다 — 재발 없음, 별도 조치 불필요.

## 발견사항

- **[INFO]** GET/SET 캐시 실패 로그 메시지 조립 로직이 두 자리에서 중복된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:107-112`
    (신규 `catchError` — GET 실패) 및 `:174-180` (기존 `cacheTapped()` 내 `.catch()` — SET 실패,
    이 diff 로 직접 수정되진 않았으나 신규 코드가 같은 패턴을 한 번 더 만든다)
  - 상세: 두 자리 모두 `` `IdempotencyInterceptor cache ${OP} 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}` `` 형태의 동일한 문자열 조립·`instanceof Error` 판별
    로직을 갖는다(`OP` 만 `GET`/`SET` 로 다름). 로그 포맷이나 에러 메시지 추출 로직을 바꿀 때
    두 자리를 모두 찾아 고쳐야 한다. 직전 라운드(`review/code/2026/08/12/14_27_02/maintainability.md`
    INFO 2, `RESOLUTION.md` INFO 6)에서 이미 지적됐고 "2곳뿐이라 보류"로 의도적으로 유예된
    항목이다 — 재확인 결과 지금도 유예 상태 그대로이며 새로 늘어난 것은 아니다.
  - 제안: 낮은 우선순위. `private warnCacheFailure(op: 'GET' | 'SET', err: unknown): void` 로
    추출하면 두 호출부가 한 줄로 줄어든다. 지금은 2회·각 3~4줄 수준이라 급하지 않지만, 향후
    세 번째 실패 경로(예: `del`)가 추가되면 재검토 권장.

- **[INFO]** 테스트 파일 최상단 헤더 docstring 이 신규 세 번째 `describe` 블록을 여전히
  나열하지 않는다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-14`
    (특히 11행: "아래 두 번째 describe 는 **캐시 히트 경로와 응답 형태 방어**…"), 신규 블록은
    `:350`(`describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)', () => {`)
  - 상세: 헤더는 "두 번째 describe" 까지만 안내하고 이번 diff 가 추가한 세 번째 블록은
    언급이 없다. 블록 자체의 지역 docstring(`:339-348`)이 상세해 실질적 이해 손실은 크지
    않지만, "파일 전체를 훑는" 목적의 헤더로서는 최신 상태가 아니다. 직전 라운드
    (`documentation.md`/`maintainability.md` 둘 다 INFO 로 지적)와 동일 발견인데,
    `RESOLUTION.md` 는 "헤더는 갱신함"이라 적었으나 실제로 열어보면 이 파일(`.spec.ts`)의
    헤더는 갱신되지 않은 채다 — `RESOLUTION.md` 의 그 문구는 `idempotency.interceptor.ts`
    클래스 docstring(51-73행, "세 경로 모두" 보강) 쪽을 가리킨 것으로 보인다. 결함이라
    부르기엔 사소하지만, 처분 기록과 실제 코드 상태가 정확히 일치하지 않는 지점이라 남겨둔다.
  - 제안: 헤더에 "세 번째 describe 는 Redis 런타임 장애 fail-open(조회 reject) 을 검증" 한 줄
    추가하면 완전해진다. 필수는 아님.

## 확인했지만 문제 없음

- `catchError` 콜백(`interceptor.ts:107-112`) 자체는 3줄 이내로 짧고, 위치 근거를 설명하는
  인라인 주석(8줄, `:99-106`)은 이 저장소가 로드베어링 위치 결정에 대해 이미 쓰는 밀도 높은
  docstring 관례(예: `HttpResponseLike` 설명, 클래스 docstring)와 일관된다 — 새로 유입된
  스타일 이탈 아님.
- `intercept()` 의 중첩 깊이·분기 수는 이 diff 로 변하지 않았다(연산자 하나가 파이프라인
  앞쪽에 추가됐을 뿐, `switchMap` 콜백 내부 구조는 그대로). 함수 길이·순환 복잡도 관점에서
  새로 유입된 문제 없음.
- 매직 넘버 없음 — `TTL_SEC`/`MAX_KEY_LENGTH` 는 기존 명명 상수 그대로.
- 신규 테스트 3건(`spec.ts:350` describe 블록)은 기존 `makeRedis`/`makeInterceptor` 헬퍼와
  네이밍·구조를 그대로 재사용해 파일 내 다른 블록과 스타일이 일관된다.
- `CHANGELOG.md`·`plan/in-progress/backend-lint-gate-broken-on-main.md` 변경은 각각
  `## Unreleased — <제목>` 관례와 plan 체크박스=실제 상태 관례를 그대로 따른다.

## 요약

이번 diff 는 RxJS 파이프라인에 `catchError` 연산자 하나를 정확한 위치에 삽입하는 국소적인
버그 수정으로, 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 측면에서 새로 유입된 문제가 없고
기존 코드베이스의 네이밍·주석 밀도 관례와도 일관된다. 직전 리뷰 라운드가 지적한 유일한
WARNING(`bodyHashOf` 테스트 헬퍼 중복)은 직접 파일을 열어 재확인한 결과 실제로 해소돼 있다.
남는 것은 두 건의 저우선순위 INFO 뿐이다 — (1) GET/SET 캐시 실패 로그 포맷 조립 로직의 소규모
중복(2곳, 의도적으로 유예된 항목), (2) 테스트 파일 헤더 docstring 이 신규 3번째 describe 블록을
나열하지 않음(직전 라운드에서 "갱신함"으로 처리 기록됐으나 실제 파일에는 반영되지 않은 채
남아 있음 — 처분 기록과 코드 상태 간의 사소한 불일치). 둘 다 기능적 위험이 없고 이번 PR
스코프(런타임 fail-open 버그 수정)를 넘어서지 않는 선택적 개선 사항이다.

## 위험도

LOW
