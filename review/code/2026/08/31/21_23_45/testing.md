# 테스트(Testing) 리뷰 — error-codes-layer-split (5라운드, `21_12_31` RESOLUTION 이후 재검토)

## 리뷰 범위 요약

프로덕션/테스트 코드 변경분(파일 1~9)은 4라운드(`21_12_31`) testing 리뷰가 지적한 INFO 2건에
대한 fix(`e6f2b5c8c`)만 추가됐다. 그 외 파일(10~21)은 이전 라운드들의 review 산출물·plan 이동
아카이브로, 테스트 관점 평가 대상이 아니다.

1. **기계적 리팩터** (변경 없음, 1~4라운드에서 이미 검증 완료): 엔진 모듈 9지점 맨 문자열 →
   `ErrorCode`/`EngineErrorCode` 상수 참조.
2. **신규 정적 가드 3파일** (변경 없음): `engine-error-code-anchor-{guard.ts,fixture.ts,.spec.ts}`.
3. **이번 라운드 신규분**: `error-codes.spec.ts` 에 `describe('EngineErrorCode enum', …)` 블록
   추가 — (a) `key === value` + UPPER_SNAKE 형식 검사, (b) `ErrorCode` 와 키 교집합이 빈 집합인지
   검사, (c) 위 두 단언이 빈 객체에서 공허해지지 않도록 `length > 0` 검사.

## 검증 (직접 실행, read-only — 저장소 뮤테이션 없음)

```
npx jest src/repo-guards/__tests__/engine-error-code-anchor.spec.ts src/nodes/core/error-codes.spec.ts
  → 2 suites / 32 tests 통과
```

`git status --short` 확인 결과 리뷰 산출물 디렉터리 외 변경 없음(저장소 트리 뮤테이션 없음).

추가로, 가드 spec 의 `expect(declared.size).toBeGreaterThan(30)` 문턱값이 근거 주석대로
"`ErrorCode` 36 + `EngineErrorCode` 4 = 40" 인지 AST 로 직접 재파싱해 재확인했다(scratch
node 스크립트, 저장소 비변경) — 실제로 `ErrorCode` 36 개 · `EngineErrorCode` 4 개, 합 40 으로
주석과 정확히 일치한다. 이 하한이 매직넘버가 아니라 실측에서 파생됐다는 이전 라운드
(`20_27_29` RESOLUTION INFO 1)의 주장을 독립적으로 재검증한 것이다.

## 발견사항

- **[INFO]** 4라운드에서 지적된 두 갭이 정확히 해소됐음을 코드로 확인
  - 위치: `codebase/backend/src/nodes/core/error-codes.spec.ts:46-66` (`describe('EngineErrorCode enum', …)`)
  - 상세: (1) `ErrorCode` 와 대칭인 `key===value`+UPPER_SNAKE 형식 검사, (2) 두 네임스페이스 키
    교집합이 빈 집합인지 검사, (3) 공허 방지용 `length > 0` 검사 — 세 단언이 서로를 보강하는
    구조다. `(1)`과 `(2)` 는 둘 다 `EngineErrorCode` 가 빈 객체여도 for-of/filter 가 빈 배열을
    내어 **각자 vacuous 하게 통과**할 수 있는데, `(3)` 이 그 공유된 사각을 정확히 겨냥해 막는다
    — 설계가 맞다. 4라운드 RESOLUTION 이 문서화한 뮤테이션(겹치는 키 추가 → RED)도 테스트
    로직(`Object.keys(EngineErrorCode).filter((k) => k in ErrorCode)`)을 읽어 보면 정확히
    그 케이스에서 non-empty 배열을 반환하도록 짜여 있어 재현 가능성이 높다(직접 재실행은
    생략 — 4라운드가 이미 RED/원복 GREEN 을 기록했고 이번 라운드는 그 로직이 diff 로 불변임을
    `git show e6f2b5c8c --stat` 로 확인).
  - 새 결함 아님 — 확인 기록.

- **[INFO]** 신설 `EngineErrorCodeValue` 타입이 아직 어떤 소비처에서도 쓰이지 않는다
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts:173-174` (`export type EngineErrorCodeValue = …`)
  - 상세: 형제 타입 `ErrorCodeValue`(`error-codes.ts:113`)는 `code.handler.ts`·
    `workflow.handler.ts` 등에서 함수 파라미터/필드 타입으로 실제로 쓰이며, 그 사용처가
    "코드값이 enum 밖으로 새면 `tsc` 가 죽는다"는 타입 앵커 역할을 실제로 수행한다. 반면
    `EngineErrorCodeValue` 는 `grep` 결과 선언부 자기 자신 외에 소비처가 없다 — `markWebChatIdleTimeout`
    등 4개 대입 지점은 전부 `const code = EngineErrorCode.WEBCHAT_IDLE_TIMEOUT` 형태로 리터럴
    타입이 자동 추론되므로 명시적 타입 애노테이션 없이도 동작은 정확하지만, 이 타입 자체가
    "실제 타입 안전성을 제공하는지"를 검증하는 테스트/사용처가 아직 없다. 오탈자 방지는
    이미 AST 가드가 커버하므로 기능적 갭은 아니지만, 이 export 는 현재 순수 미사용 export 다.
  - 제안: 조치 불필요 — 형제 상수와의 구조적 대칭을 위해 미리 둔 export 로 보인다(`ErrorCodeValue`
    패턴 계승). 향후 `EngineErrorCode` 값을 매개변수로 받는 함수가 생기면 그 타입을 쓰면 된다.
    지금 당장 쓰라고 강제할 근거는 없다.

## 8개 관점 요약

1. 테스트 존재 여부 — 이번 라운드 신규분(`EngineErrorCode enum` describe 블록)은 즉시 커버됨.
2. 커버리지 갭 — 1~4라운드에서 발견된 갭(positive-path 미검증, 형식 검사 비대칭, 키 충돌
   미검증) 모두 메워짐. 신규 갭 없음.
3. 엣지 케이스 — 빈 객체 vacuous-pass 방지(`length > 0`)까지 챙겨졌다.
4. Mock 적절성 — 여전히 mock 미사용, 실제 파일/AST 를 읽는 성격에 적절.
5. 테스트 격리 — 신규 `describe` 블록도 순수 함수(`Object.entries/keys`) 기반이라 상호 의존
   없이 독립 실행 가능.
6. 가독성 — 각 단언에 "왜 이 단언이 필요한가"(vacuous 방지 등) 주석이 붙어 의도가 명확.
7. 회귀 테스트 — 리다이렉트 대상 3서비스 spec(맨 문자열 단언 유지 결정)은 이번 라운드도
   무변경, 값 동일성으로 유효.
8. 테스트 용이성 — `EngineErrorCode`/`ErrorCode` 모두 순수 `as const` 객체라 별도 DI/mock 없이
   직접 단언 가능한 구조. 변경 없음.

## 요약

5라운드째 코드 리뷰이며, 이번 라운드의 유일한 신규분은 4라운드 testing INFO 2건(형식 검사
비대칭·키 충돌 미검증)에 대한 fix다. 코드를 직접 읽고 재실행(32/32 GREEN)해 그 fix 가 설계
의도대로 동작함을 확인했고, 가드 spec 의 `>30` 문턱값이 실제 개수(36+4=40)에서 파생됐다는
과거 주장도 독립 재파싱으로 재검증했다. 신규로 발견한 것은 `EngineErrorCodeValue` 타입이
아직 무소비 export 라는 INFO 1건뿐이며, 기능 결함이 아니라 향후 확장을 위한 선제적 대칭
구조로 판단해 조치를 요구하지 않는다. Critical/Warning 은 다섯 라운드 연속 0건이다.

## 위험도

NONE
