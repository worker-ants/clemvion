# 테스트(Testing) 리뷰

## 검증 방법

프롬프트의 diff 만으로는 신규 테스트의 유효성(vacuous 여부)을 판단할 수 없어, 실제 워크트리에서
직접 재현했다.

1. `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts` 와
   `codebase/backend/src/nodes/data/code/code.handler.ts` 의 `cause: err` 를 각각 제거하는
   뮤테이션을 적용 → 신규 테스트 2건 모두 **RED** 확인 (기존 131건은 그대로 GREEN, `-t "cause"`
   필터로 격리 확인). 뮤테이션 직후 `cp`(정확히는 원본 백업 복원)로 원복하고 `git status`/`git diff`
   로 깨끗함을 재확인했다 — plan 문서(`plan/in-progress/deps-peer-gating-and-eslint10.md`)가 주장한
   "신규 2건 RED · 기존 131건 GREEN" 실측을 독립적으로 재현·검증.
2. `code.handler.spec.ts` 의 신규 케이스가 `toBeDefined()` 대신 `toBeInstanceOf(Error)` 를 쓰지
   않은 이유("isolated-vm 이 자기 realm 에서 만든 SyntaxError 라 호스트 Error 를 상속하지 않는다")를
   검증하기 위해, 해당 단언을 일시적으로 `toBeInstanceOf(Error)` 로 바꿔 실행 →
   `Expected constructor: Error / Received constructor: SyntaxError` 로 **실제로 실패**함을
   확인했다(코드 주석의 실측 문구와 정확히 일치). 이후 `git checkout --` 으로 원복.
   (참고: `node -e`로 `isolated-vm` 을 직접 호출하면 `instanceof Error === true` 가 나와 처음엔
   주석이 틀린 줄 알았으나, ts-jest 테스트 realm 안에서 실행하면 주석이 옳았다 — realm 경계가
   실행 컨텍스트에 의존한다는 점까지 확인.)
3. `eslint-unicorn-peer.spec.ts`(30/30), `production-build-devdep.spec.ts`(20/20) 등
   `package.json`/`pnpm-lock.yaml` 변경에 영향받을 수 있는 가드 테스트를 재실행해 회귀 없음을 확인.
   `@eslint/eslintrc` 참조가 `codebase/**` 전체에 0건임도 재확인(`grep`).
4. 두 spec 파일 전체 실행(133 tests, 2 suites) — 전부 PASS.

## 발견사항

- **[INFO]** `code.handler.spec.ts` 신규 케이스가 직전 케이스와 동일한 fixture(`'this is ( not
  valid js'`)를 재사용해 실행 경로가 겹친다.
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts:202` (`it('원본 컴파일 예외를
    \`cause\` 로 보존한다 (cause 제거 시 RED)', ...)`)
  - 상세: 바로 위 `'should throw at execute() if syntax-invalid code reaches the handler'`(라인
    190~196)와 같은 입력을 쓴다. 다만 이는 의도적이다 — 주석이 "바로 위 케이스는 `.message` 만
    보므로 `cause` 를 떼도 GREEN 이다 — 이 케이스가 그 축이다" 라고 명시하고, 실제로 뮤테이션
    검증에서 확인했듯 기존 케이스는 `cause` 제거 후에도 GREEN 을 유지하고 신규 케이스만 RED 가
    된다. 즉 "같은 입력, 다른 축(axis)"을 의도적으로 분리한 설계이며 결함이 아니다.
  - 제안: 없음 (현행 유지 권장). 다만 향후 유사 패턴을 늘릴 때는 "왜 fixture 를 공유해도 되는가"
    주석 관례를 계속 지킬 것.

- **[INFO]** 두 신규 테스트의 `cause` 단언 강도가 다르다 (`expression-resolver`:
  `toBeInstanceOf(Error)`, `code.handler`: `toBeDefined()` + `typeof message === 'string'`) — 이
  차이가 실측(realm 경계)에 근거함을 위 "검증 방법" ②에서 독립 재현했다. 리뷰 결함이 아니라 긍정
  기록: 이런 비대칭을 임의로 통일했다면 `code.handler` 쪽이 상시 RED 가 됐을 것이다.

## 관점별 평가

1. **테스트 존재 여부**: 이번 diff 의 실질 변경은 (a) 이전 커밋에서 이미 붙은 `cause: err` 두 곳에
   대한 락인 테스트 추가, (b) 죽은 `@eslint/eslintrc` devDependency 제거, (c) lockfile/plan 갱신
   — 전부 테스트 필요 표면을 스스로 채웠거나(테스트가 곧 변경분) 애초에 코드 경로가 없는 변경(의존성
   제거)이다. 커버리지 공백 없음.
2. **커버리지 갭**: 없음. `secret-resolver.service.spec.ts` 의 대칭 케이스(`cause` **비**보존을
   단언하는 회귀 테스트, `err.cause` `toBeUndefined()`)가 이미 존재함을 확인했다 — 이번 두 케이스와
   합쳐 "message 가 원문을 이미 담고 있으면 cause 안전 / 아니면 cause 금지" 계약의 앙 끝을 테스트가
   덮는다.
3. **엣지 케이스**: vacuity 방지 단언(`expect(thrown).toBeInstanceOf(Error)` 를 catch 이후 먼저
   확인)이 양쪽에 다 있어 "아무것도 안 던지면 뒤 단언이 전부 통과" 하는 흔한 함정을 스스로 방어했다.
4. **Mock 적절성**: 이번 두 케이스는 mock 을 쓰지 않고 실제 `service.resolveConfig` /
   `handler.execute`(실제 `isolated-vm` 격리 실행)를 그대로 태운다 — cause 보존이라는 실제 런타임
   동작을 검증하는 테스트이므로 적절한 선택이다(모킹했다면 검증 대상 자체가 사라진다).
5. **테스트 격리**: 두 테스트 모두 로컬 `let thrown: unknown` 만 쓰고 `beforeEach` 로 재생성되는
   `service`/`handler`/`context` 외 공유 가변 상태가 없다. 독립 실행 가능.
6. **가독성**: 테스트명이 한국어로 의도("cause 제거 시 RED")를 명시하고, 판별 기준 주석이 왜 이
   조합(부착 대상/제외 대상)이 안전한지 근거를 test 코드 바로 위에 남겨 다음 사람이 재추론할 필요가
   없다.
7. **회귀 테스트**: 기존 133개 중 131개(신규 제외)는 이번 변경으로 영향받지 않고 그대로 PASS.
   `package.json`/`lockfile` 변경에 민감할 수 있는 두 가드 스펙(`eslint-unicorn-peer.spec.ts`,
   `production-build-devdep.spec.ts`)도 재실행해 회귀 없음을 직접 확인했다.
8. **테스트 용이성**: 두 서비스/핸들러 모두 생성자 주입(`ConfigService` mock, 순수 `new
   CodeHandler()`)이라 별도 리팩터 없이 바로 단위 테스트 가능한 구조. 개선 여지 없음.

## 요약

이번 diff 는 이전 라운드 리뷰가 남긴 INFO("cause 부착 근거가 주석뿐이라 런타임 보장이 없다")를
정확히 테스트로 전환한 후속 커밋이다. 신규 두 케이스 모두 vacuity 방지 단언을 갖췄고, 서로 다른
`cause` 단언 강도(realm 경계 차이)가 근거 없는 통일이 아니라 실측에 기반했음을 뮤테이션 실험과
직접 재현으로 두 축 모두 독립 검증했다 — cause 제거 시 신규 케이스만 RED, 기존 케이스는 GREEN
유지, `toBeInstanceOf(Error)` 로 바꾸면 `code.handler` 쪽만 실제로 실패. 함께 포함된
`@eslint/eslintrc` devDependency 제거는 사용처 0건이 확인됐고 관련 가드 테스트(`eslint-unicorn
-peer`, `production-build-devdep`)도 재실행하여 회귀가 없음을 확인했다. 테스트 관점에서 결함
없음 — 발견사항은 전부 INFO(설계 의도 확인/긍정 기록)이다.

## 위험도

NONE
