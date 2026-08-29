# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** C2 캐너리(`cause` enumerable own key 화이트리스트)가 주석에서 주장하는 "4개 오류 종류 실측"과 달리, 실제 코드화된 단언은 그중 1종(syntax error)만 실행 경로로 exercise 한다 — `ReferenceError`/`TypeError`(및 `FunctionError`)는 회귀 가드가 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:173`~`200` (신규 `it('C2 캐너리 — …')`, config `{ url: '{{ $input. }}' }` → `ExpressionSyntaxError` 경로만 호출)
  - 상세: 신규 테스트 주석(게이트 173~176)은 "`evaluate()` 를 4개 오류 종류로 직접 호출 — `ExpressionSyntaxError`·`ExpressionReferenceError`·`ExpressionTypeError` 전부 `['name','code','position']`"이라고 근거를 적어 두었지만, 이 근거는 **테스트 코드 밖에서 한 번 수행한 수동 프로브**(plan 문서 기록)이지 스펙 파일 안의 반복 가능한 단언이 아니다. 실제로 이 spec 파일에서 `ExpressionReferenceError` 를 유발하는 케이스는 이미 존재한다(같은 파일 게이트 126~131, `'throws for undefined reference'`)지만 그 케이스는 `.toThrow(/Expression error in config\.url/)` 만 검사하고 `cause` 의 own-key 는 전혀 확인하지 않는다. `packages/expression-engine/src/__tests__/expression.spec.ts` 도 `ErrorCode`(`.code`) 값만 검사할 뿐 `Object.keys` 형태는 어디서도 잠그지 않는다(전수 grep 확인: `ReferenceError`/`TypeError`/`FunctionError` 케이스 3곳, 전부 `.code` 값만). 구조적으로는 `ExpressionError` 서브클래스들이 전부 동일 베이스 생성자(`name`/`code`/`position`)만 쓰므로 지금은 안전하지만, 누군가 `ReferenceError` 에만 진단 필드(예: 실패한 참조 경로 문자열)를 추가해도 **이 PR 이 새로 추가한 캐너리는 RED 를 내지 못한다** — syntax-error 경로만 통과하기 때문이다. C2 캐너리의 존재 목적 자체가 "미래의 민감 속성 유입을 잡는 것"이라, 문서가 주장하는 커버리지와 실제 코드화된 커버리지 사이의 이 격차는 그 목적을 부분적으로 무효화한다.
  - 제안: `it.each`로 SyntaxError(`'{{ $input. }}'`)· ReferenceError(`'{{ $input.nonExistent.deep }}'`)· TypeError(타입 불일치를 유발하는 표현식, 예: 함수 인자 타입 오류)를 모두 순회하며 `Object.keys(cause).sort()` 를 동일하게 단언하도록 확장하거나, 최소한 세 유형 각각에 대해 별도 canary 케이스를 추가할 것.

- **[INFO]** `secret-resolver.service.ts` 변경분은 주석(Rationale 보강)뿐이라 신규 테스트가 필요 없다 — 적절.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:95`~`99`
  - 상세: 코드 동작 변경이 없고 "서버 로그 방어는 C1 의 보조 근거일 뿐 판정축이 아니다"를 명확히 하는 순수 문서화 diff다. 별도 회귀 테스트 대상이 아니며, 기존 `resolve()` 복호화 실패 테스트(`err.cause === undefined` 단언)가 이 자리의 실제 계약(cause 비부착)을 이미 잠그고 있다.

- **[INFO]** 두 신규 C2 캐너리 모두 vacuity 방지 단언(`toBeInstanceOf(Error)`/`toBeDefined()`)을 먼저 두어, 예외가 던져지지 않을 경우 뒤따르는 단언이 조용히 통과하는 것을 막고 있다 — 좋은 패턴.
  - 위치: `expression-resolver.service.spec.ts:182`(`expect(thrown).toBeInstanceOf(Error)`), `code.handler.spec.ts:256`(`expect(thrown).toBeInstanceOf(Error)`)
  - 상세: 직접 뮤테이션으로 검증(아래 참고) — `ExpressionError` 서브클래스 생성자에 민감 속성(`debugContext`)을 주입했을 때 두 캐너리 중 대상 테스트가 정확히 예측대로 RED 를 냈다(`Object.keys` 비교에서 `debugContext` 가 추가로 검출).
  - 제안: 없음(확인용 기록).

- **[INFO]** `code.handler.spec.ts` C2 캐너리의 화이트리스트가 빈 배열(`[]`)인 것은 이 catch 블록이 처리하는 오류 원인이 `isolate.compileScript` 컴파일 예외 단 하나뿐이라는 구조와 일치한다(`code.handler.ts:451`) — expression-resolver 와 달리 다중 서브클래스 분기가 없어 위 WARNING 과 같은 갭이 발생하지 않는다.
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts:244`~`261`
  - 상세: 코드 경로 확인 결과 이 catch 는 오직 `compileScript` 실패 1종만 감싼다. 따라서 단일 케이스로 전체 분기를 대표한다는 주장이 성립한다.

## 검증용 뮤테이션 (수행·원복 완료)

- 대상: `codebase/packages/expression-engine/src/errors.ts` — `ExpressionError` 생성자에 `(this as any).debugContext = message;` 1줄 주입.
- 절차: 원본을 scratch(`mktemp`류 세션 scratchpad)에 `cp` 로 백업 → 주입 → `packages/expression-engine`에서 `npx tsc` 재빌드(백엔드가 심볼릭 링크 + `dist/index.js` 를 통해 이 패키지를 참조하므로 빌드가 필요) → `expression-resolver.service.spec.ts` 의 `C2` 테스트만 재실행 → **RED 확인**(`Object.keys` 비교에서 `debugContext` 검출, plan 문서가 기록한 예측과 일치) → scratch 백업본을 `cp` 로 원복 → 재빌드 → `git status --short` 로 저장소 무변경 확인, C2 테스트 재실행으로 GREEN 회복 확인.
- 부가로 `resolveString` 이 실제로 도달하는 `position` 값을 1회성 프로브(신규 파일 생성 후 즉시 삭제, 커밋 없음)로 확인 — `{ url: '{{ $input. }}' }` 입력에서 `position=11`(정수), `code=EXPR_SYNTAX_ERROR` 로, 스펙의 `expect(shape.position === undefined || Number.isInteger(shape.position))` 단언이 **정수 분기**로 실제 exercise 됨을 확인(첫 disjunct 로 인한 vacuous pass 아님).
- 원복 후 `git status --short` = 리뷰 산출물 디렉터리(`review/code/2026/08/29/11_58_35/`)만 untracked, 저장소 소스 트리는 클린.

## 요약

이번 diff 는 eslint 10 `preserve-caught-error` 대응으로 붙인 `cause: err` 부착에 대해, 이전 리뷰 라운드가 "C1(메시지 보존)만 테스트로 잠그고 C2(민감 속성 비노출)는 주석에만 있다"고 지적한 갭을 실제 단언(canary)으로 승격한 것이다. 두 캐너리 모두 vacuity 방지 단언을 갖추고 있고, 화이트리스트 값(`['code','name','position']` / `[]`)이 실제 소스(`packages/expression-engine/src/errors.ts`, `code.handler.ts`)의 구조와 정확히 일치함을 직접 확인했으며, 민감 속성 주입 뮤테이션으로 캐너리가 실제로 RED 를 내는 것도 재현했다. 다만 expression-resolver 쪽 캐너리는 문서가 주장하는 "4개 오류 종류 검증"의 실제 코드화 범위가 syntax-error 1종에 그쳐, ReferenceError/TypeError 계열에 향후 민감 속성이 추가돼도 이 PR 의 회귀 가드가 잡지 못하는 좁은 갭이 남는다. secret-resolver.service.ts 변경은 주석뿐이라 테스트 영향이 없고, plan 문서(파일 4)는 코드가 아니므로 테스트 관점에서 별도 지적 사항이 없다. 전반적으로 테스트 품질·격리·가독성은 양호하고 발견된 유일한 갭은 커버리지 폭에 관한 것이라 심각도는 낮다.

## 위험도

LOW
