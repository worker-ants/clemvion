# 테스트(Testing) 리뷰 — `error-codes.ts` 엔진 레이어 상수화 (2026-08-31 21:12:31)

## 컨텍스트

이 변경은 엔진이 직접 쓰던 맨 문자열 에러 코드 4개(`EXECUTION_QUEUE_WAIT_TIMEOUT` ·
`WEBCHAT_IDLE_TIMEOUT` · `WORKER_HEARTBEAT_TIMEOUT` · `SERVER_INTERRUPTED`, 5지점)와
이미 enum 에 있으면서 상수를 안 거치던 `ai-turn-orchestrator` 의 `LLM_*` 4지점을 합쳐
총 9지점을 신설 `EngineErrorCode` / 기존 `ErrorCode` 상수 참조로 바꾸고, 재발 방지 가드
(`engine-error-code-anchor-guard.ts` + `.spec.ts` + fixture)를 추가한 것이다.
이번 라운드는 직전 라운드(`20_27_29`, Critical 0 · Warning 1 · INFO 8, RESOLUTION 기록됨)의
후속이며, 그 RESOLUTION 이 이미 반영/명시적 미조치로 처리한 항목(매직넘버 근거화, positive-path
검증 추가, `eslint-disable` CI 브레이커 수정, 기존 스펙의 리터럴 유지 결정 등)은 재지적하지
않고 실측으로 확인만 했다.

## 실측 확인 (가이드라인 §검증용 뮤테이션 규약 — 저장소 파일 뮤테이션은 하지 않음, read-only 실행만)

- `jest engine-error-code-anchor.spec.ts error-codes.spec.ts` → **2 suites / 29 tests 통과**
- `jest ai-turn-orchestrator.service.spec.ts execution-engine.service.spec.ts shutdown-state.service.spec.ts`
  → **3 suites / 557 tests 통과** (리터럴 → 상수 참조 치환 후에도 기존 회귀 테스트가 값 동일성
  때문에 그대로 유효함을 확인)
- `git status --short` → 리뷰 산출물 디렉터리 외 변경 없음(저장소 트리 뮤테이션 없음)

## 발견사항

- **[INFO]** 신설 `EngineErrorCode` 상수에 대한 전용 형식 검증 테스트가 없다
  - 위치: `codebase/backend/src/nodes/core/error-codes.spec.ts` (파일 전체 — `EngineErrorCode`
    를 다루는 `describe` 블록 부재), 대상 상수는 `codebase/backend/src/nodes/core/error-codes.ts:147`
    (`export const EngineErrorCode = {`)
  - 상세: 같은 파일의 기존 `ErrorCode` 는 `error-codes.spec.ts:8-14` 에서 "모든 key 가 자기
    자신과 같은 값을 가진다" + "UPPER_SNAKE_CASE 형식" 을 전수 단언한다. `EngineErrorCode` 는
    같은 패턴의 상수임에도 동등한 직접 단언이 없다. 현재는 `engine-error-code-anchor.spec.ts`
    의 `readDeclaredCodes` 하한(`>30`)과 `EXECUTION_QUEUE_WAIT_TIMEOUT` 포함 여부로만 간접
    커버된다 — 이는 "적어도 하나는 있다" 를 확인할 뿐 "key===value·형식이 맞다" 를 보장하지
    않는다. 신설 `EngineErrorCodeValue` 타입도 직접 단언 대상이 아니다.
  - 제안: `error-codes.spec.ts` 에 `ErrorCode` 블록과 대칭인
    `describe('EngineErrorCode', () => { it('maps every key to its own name', …) })` 를 추가.

- **[INFO]** `ErrorCode` / `EngineErrorCode` 두 네임스페이스 간 키 중복을 막는 테스트가 없다
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts:8`(`ErrorCode`), `:147`(`EngineErrorCode`);
    가드 쪽 병합 지점은 `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:70`
    (`readDeclaredCodes` — 두 const 값을 하나의 `Set`으로 합침)
  - 상세: 문서(`error-codes.ts:119-125`, CHANGELOG)는 "파일은 하나, const 는 둘 — SoT 는
    유지" 를 설계 원칙으로 명시한다. 그런데 `readDeclaredCodes` 가 두 const 값을 단일 `Set` 으로
    합치기 때문에, 만약 향후 누군가 `ErrorCode` 와 `EngineErrorCode` 에 우연히 같은 키(또는 값)를
    추가해도 가드도 테스트도 그 충돌을 알려주지 않는다 — 조용히 "이미 앵커된 값" 취급된다.
    실제 발생 가능성은 낮지만, SoT 원칙을 명시적으로 강조한 설계인 만큼 그 불변식을 지키는
    테스트가 있으면 문서와 테스트가 서로를 보강한다.
  - 제안: `error-codes.spec.ts` 또는 `engine-error-code-anchor.spec.ts` 에
    `Object.keys(ErrorCode)`와 `Object.keys(EngineErrorCode)` 교집합이 빈 집합인지 단언하는
    테스트 1개 추가.

- **[INFO]** `collectBoundCodes` 형태 스캔이 의도적으로 다섯 형태로 한정돼 있고 그 경계가
  잘 문서화돼 있으나, 템플릿 리터럴/문자열 연결식은 그 다섯 형태 안에서도 우회 가능하다
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:174-183`
    (`record()` 함수 — `ts.isStringLiteral(literal)` 만 인정)
  - 상세: 예를 들어 `` const code = `SERVER_INTERRUPTED`; ``(no-substitution template literal)
    이나 `code: 'SERVER' + '_INTERRUPTED'` 는 형태 자체는 가드가 다루는 "변수 선언"/"객체 속성"
    범주 안에 있지만 리터럴 타입 검사(`isStringLiteral`)에 걸려 통과(위반으로 잡히지 않음)한다.
    파일 자체 docstring(`engine-error-code-anchor-guard.ts:137-152`)이 "다섯 형태가 이 가드의
    보장 전부" 라고 명시적으로 경계를 그어 두었으므로 설계상 의도된 축소이지 누락이 아니다 —
    다만 그 문서가 "바인딩 형태" 축만 다루고 "리터럴 표현식" 축은 언급하지 않아, 완전성을
    따진다면 부기할 만하다.
  - 제안: 우선순위 낮음. 실사용 코드베이스에 템플릿 리터럴로 에러 코드를 쓰는 관례가 없다면
    조치 불요 — docstring 에 "리터럴 표현식은 `StringLiteral` 만" 한 줄만 추가해도 충분.

## 확인된 강점 (참고용, 조치 불요)

- `engine-error-code-anchor-guard.ts`/`.spec.ts`/`-fixture.ts` 삼분할은 순수 로직·소비
  spec·불변 픽스처를 분리해 "가드가 성공하면 자기 테스트 대상이 사라진다" 는 자멸 문제를
  픽스처로 우회했다 — 설계 근거가 CHANGELOG·docstring 에 실측(뮤테이션 RED)과 함께 기록돼 있다.
  값 기반 판정(`!declared.has(code)`)에서 형태 기반 판정으로의 전환은 실제 회귀
  (`EngineErrorCode.SERVER_INTERRUPTED` → 리터럴로 되돌려도 GREEN)를 뮤테이션으로 잡은 뒤
  이뤄졌다 — 근거가 검증 가능한 형태로 남아 있다.
- `[positive path]` 테스트(`engine-error-code-anchor.spec.ts:104-125`)가 "위반 0건" 이 클린한
  저장소 때문인지 스캐너 무력화 때문인지 구분한다 — 프로젝트 메모리에 반복 지적된
  "vacuous test" 패턴을 이 라운드는 스스로 예방했다.
  `notAnError`/`FixtureHelper`(대조군) 등 fixture export 전부가 실제 단언
  (`not.toContain`)에 쓰이고 있어 죽은 fixture 가 없다.
  기존 프로덕션 스펙(`execution-engine.service.spec.ts` 등)이 리터럴 문자열 단언을 유지하기로
  한 결정(RESOLUTION INFO 4)은 재확인 결과 타당하다 — 상수 참조로 바꾸면 테스트가 구현과
  같은 상수를 보게 되어 리네임 회귀 검출력을 잃는다는 논리가 실제 코드 구조와 부합한다.

## 요약

프로덕션 변경 자체(리터럴 → 상수 참조 9지점)는 값이 그대로이므로 기존 회귀 테스트가
수정 없이 유효함을 실행으로 확인했다(557 tests 통과). 신설 가드(`engine-error-code-anchor-*`)는
이미 한 차례 리뷰·뮤테이션 검증을 거쳐 형태 기반 판정·positive-path 검증·픽스처 분리 등
테스트 설계 성숙도가 높다. 이번 라운드에서 새로 발견한 갭은 전부 INFO 급이다 — 신설
`EngineErrorCode` 상수 자체에 대한 `ErrorCode` 와 대칭인 직접 형식 테스트 부재, 두 네임스페이스
간 키 충돌 방지 테스트 부재, 가드가 다루는 다섯 형태 중 리터럴 표현식 축(템플릿 리터럴/연결식)의
문서화되지 않은 우회 가능성이다. 셋 다 현재 코드베이스 실사용 패턴에서 실제로 트리거되는
결함은 아니며, Critical/Warning 급으로 격상할 근거는 없다.

## 위험도

LOW
