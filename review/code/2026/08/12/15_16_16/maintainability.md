# 유지보수성(Maintainability) Review — `15_16_16`

## 검토 방법

프롬프트에 실린 diff 는 크기 제한으로 대부분 잘려 있고(`idempotency.interceptor.spec.ts` 전체
diff 생략, "전체 파일 컨텍스트" 섹션도 비어 있음), 프롬프트 본문의 90% 이상이 직전 3라운드
(`14_27_02`→`14_50_36`→`15_04_25`)의 리뷰 산출물(`review/code/2026/08/12/{14_27_02,14_50_36,15_04_25}/*`,
36개 파일)이 이번 diff 에 신규 파일로 통째로 포함된 것이다. 이는 사람이 손으로 유지보수하는
소스가 아니라 생성된 감사 기록이라 이번 관점(가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도·
일관성)의 정적 분석 대상에서 제외한다 — 직전 세 라운드의 maintainability 리뷰가 동일하게 판정한
근거와 같다.

프롬프트 대신 작업 트리를 직접 `Read` 하고 `git log`/`git show` 로 실제 변경 이력을 대조했다:

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — 마지막 수정은
  `f933f2cf6`(라운드 1 조치)이고 이번 diff(HEAD `7072a1ac0`)에서 **변경 없음**.
- `CHANGELOG.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md` — 마찬가지로 `f933f2cf6`
  이후 변경 없음.
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` — **이번
  라운드에서 유일하게 실제로 바뀐 프로덕션/테스트 파일**. `git show 7072a1ac0 -- .../idempotency.interceptor.spec.ts`
  로 diff 를 직접 확인했다: `describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)')` 블록의
  첫 `it`(`get() 이 reject 해도 요청은 통과한다 (fail-open)`)에 `warnSpy`(`jest.spyOn(Logger.prototype, 'warn')`)
  + `try/finally` + `cache GET 실패` 문자열 단언을 추가했다(직전 라운드 `15_04_25/RESOLUTION.md` INFO 6
  조치). 순수 테스트 보강이고 코드 동작 변경은 0.

## 발견사항

- **[INFO]** `warnSpy` 셋업/복원(`jest.spyOn(Logger.prototype, 'warn').mockImplementation()` +
  `try { … } finally { warnSpy.mockRestore(); }`) 보일러플레이트가 이제 파일 내 두 자리에서
  문자 그대로 동일하다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:360-382`
    (신규 — `get() 이 reject 해도 요청은 통과하고 warn 을 남긴다` 테스트), `:440-462`
    (기존 — `set() 이 reject 해도 응답 정상 + warn 로그` 테스트, 라운드 1 `f933f2cf6` 에서 이미 존재)
  - 상세: 두 `it` 모두 `warnSpy` 선언 → `try` 블록에서 `redis.{get,set}` 을 reject 시키고 인터셉터를
    실행 → 응답 단언 + `warnSpy` 로 `cache {GET,SET} 실패` 문자열 단언 → `finally` 에서
    `mockRestore()` 하는 동일한 5줄 구조를 반복한다(달라지는 것은 mock 대상 메서드와 문자열
    리터럴뿐). 이 저장소는 프로덕션 코드 쪽의 거의 동일한 중복(`idempotency.interceptor.ts` 의
    GET/SET 로그 조립 로직, `:107-110` vs `:176-179`)을 세 라운드 연속 "2곳뿐이라 보류"로 의도적
    유예해 왔는데, 같은 기준(정확히 2회, 각 5줄 내외, 세 번째 실패 경로가 생기기 전까지는
    추출 비용 대비 이득이 낮음)을 이 테스트 쪽 중복에도 그대로 적용할 수 있다. 다만 프로덕션
    로직 중복과 달리 이건 **의도적으로 대칭을 맞추기 위해** 이번 라운드가 새로 만든 것이고
    (커밋 메시지가 "SET 경로에만 넣었던 warn 단언을 GET 에도" 라고 명시), 두 테스트가 같은
    describe 블록 안에 나란히 있어 "왜 똑같이 생겼는가"를 읽는 사람이 바로 알 수 있다는 점에서
    프로덕션 코드 중복보다 위험이 낮다.
  - 제안: 조치 불요, 참고 기록만. 여유가 되면
    `withWarnSpy(async (warnSpy) => { … })` 류의 작은 테스트 헬퍼로 추출할 수 있으나, 정확히
    2회·저위험 반복이라 이번 PR 스코프에서 급한 항목은 아니다. 세 번째 fail-open 테스트가 같은
    패턴(warn 단언)을 필요로 하게 되면 그때 추출을 재검토.

## 확인했지만 문제 없음

- 신규 코드는 `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('cache GET 실패'))`
  하나를 기존 `expect(result)`/`expect(handleSpy)` 단언 뒤에 추가한 것뿐이다. 테스트 이름도
  `get() 이 reject 해도 요청은 통과한다 (fail-open)` → `...통과하고 warn 을 남긴다 (fail-open)` 로
  갱신되어, 테스트 이름이 실제로 무엇을 검증하는지와 정확히 일치한다(이름-단언 괴리 없음).
  파일 최상단 헤더 docstring(`:15-17`)이 이미 "세 번째 describe 는 … 적재 실패(`set()` reject) …"
  까지 포괄적으로 서술하고 있어, 이번 대칭화로 헤더를 추가로 갱신할 필요는 없었다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:355-383`
- `try/finally` 로 `warnSpy.mockRestore()` 를 보장하는 패턴은 바로 아래 SET 테스트(`:440-462`)에서
  이미 검증된 관례를 그대로 재사용한 것이라 파일 내 일관성이 좋다 — 새로운 스타일 이탈 없음.
- 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 — 이번 diff 는 기존 `it` 블록 하나의 본문을
  `try { … } finally { … }` 로 한 단계 더 감싼 것뿐이며, 그 중첩 깊이는 바로 옆 SET 테스트와
  동일하다. 새로 유입된 매직 넘버·비순환 복잡도 증가는 없다.
- `idempotency.interceptor.ts`(프로덕션 코드)는 이번 라운드에서 전혀 변경되지 않았다. 직전
  세 라운드(`14_27_02`→`14_50_36`→`15_04_25`)가 각각 독립적으로 파일을 열어 재확인한 결론
  (`catchError` 삽입 위치·docstring 범위·중첩/매직넘버/함수 길이 모두 문제 없음, `bodyHashOf`
  중복 해소 확인, 헤더 docstring 갱신 확인)이 그대로 유효하다 — 이번 라운드에서 다시 열어봐도
  달라진 것이 없다.

## 이전 라운드에서 유예된 항목 (재확인, 변경 없음)

- GET/SET 캐시 실패 로그 메시지 조립 중복(`idempotency.interceptor.ts:107-110` vs `:176-179`) —
  세 라운드 연속 "2곳뿐이라 보류"로 유예됐고 이번 라운드에도 프로덕션 코드가 그대로라 상태 불변.
- `catchError` 삽입부 인라인 주석 8줄(`:99-106`) — 로드베어링 위치 결정 근거를 캐너리 테스트와
  1:1 대응시키는 저장소 기존 관례와 일치한다는 판정이 세 라운드째 유지.

## 요약

이번 라운드(`15_16_16`)에서 실제로 바뀐 것은 `idempotency.interceptor.spec.ts` 의 GET fail-open
테스트 하나에 `warnSpy` 단언을 추가해 이미 존재하던 SET fail-open 테스트와 대칭을 맞춘 것뿐이며,
프로덕션 코드(`idempotency.interceptor.ts`)·`CHANGELOG.md`·plan 문서는 라운드 1(`f933f2cf6`)
이후 변경되지 않았다. 신규 변경은 기존에 이미 검증된 패턴(`try/finally` + `warnSpy`)을 그대로
재사용해 파일 내 일관성이 좋고, 함수 길이·중첩·매직넘버·복잡도 관점에서 새로 유입된 문제가
없다. 유일하게 짚을 점은 그 `warnSpy` 셋업/복원 보일러플레이트가 이제 파일 내 두 곳(GET·SET)에서
문자 그대로 중복된다는 것인데, 정확히 2회·저위험 반복이고 이 저장소가 이미 프로덕션 코드의
동일 규모 중복(로그 조립 로직)에 적용해 온 것과 같은 기준(2곳까지는 유예)을 적용할 수 있어
INFO 로만 기록한다. 3라운드에 걸쳐 이미 소진된 maintainability 관점의 실질적 발견은 이번
라운드에서 추가되지 않았다.

## 위험도

NONE
