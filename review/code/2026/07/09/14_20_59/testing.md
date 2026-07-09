# 테스트(Testing) 리뷰 — Manual Trigger defaultValue 무시 버그 수정

## 발견사항

- **[WARNING]** 재진입 3개 호출부 중 2곳(`driveResumeAwaited`/`driveResumeFrame`)은 실제 배선(wiring)이 테스트로 잠기지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2103`(driveResumeAwaited), `:2435`(driveResumeFrame); 대응 신규 유닛 테스트 `execution-engine.service.spec.ts` `describe('reentryWorkflowInput ...')`(diff L68-88); e2e `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts` 세 번째 `it`
  - 상세: 신규 유닛 테스트는 `reentryWorkflowInput` **헬퍼 함수 자체**를 리플렉션 캐스팅으로 직접 호출해 격리 검증할 뿐, `driveResumeAwaited`/`driveResumeFrame`가 실제로 `input: this.reentryWorkflowInput(savedExecution)`를 `runNodeDispatchLoop`에 전달하는지는 어디서도 단언하지 않는다. e2e 회귀 테스트(`re-drive of a not-yet-completed trigger ...`)는 `execution.status='running'` + RUNNING 브랜치(§7.5 case B) 재구동, 즉 `driveStuckRedrive` 경로만 결정적으로 재현한다. 기존 `driveStuckRedrive` 유닛 테스트(`execution-engine.service.spec.ts:1774-1913`)도 `skipExecutedNodes`/`pointer`만 확인하고 `input`은 확인하지 않으며, `mkExec()`가 `inputData`를 세팅하지 않아 회귀 전/후를 구분하지 못한다. 결과적으로 "3개 호출부 모두 수정" 이라는 커밋 설명과 달리, `driveResumeAwaited`(WAITING 재개, case A)·`driveResumeFrame`(중첩 call-stack 재개)의 배선은 어떤 테스트로도 방어되지 않는다 — 향후 리팩터링에서 이 두 곳만 `input: {}`로 되돌아가도 어떤 테스트도 실패하지 않는다.
  - 제안: `driveStuckRedrive` 기존 describe 블록 패턴(runNodeDispatchLoop spy + `mkExec()`에 populated `inputData` 부여)을 `driveResumeAwaited`/`driveResumeFrame`에도 적용해 `loopSpy.mock.calls[0][0]`(또는 해당 인자)의 `input`이 `savedExecution.inputData`와 동일함을 단언하는 회귀 테스트를 추가할 것. 또는 e2e에서 WAITING re-drive(폼 대기 중 stalled) 시나리오를 하나 더 추가해 case A 경로도 결정적으로 커버.

- **[WARNING]** `retry-turn.service.ts`의 "의도적 예외"(`input: {}` 유지)를 잠그는 회귀 테스트 부재
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:564-568`(주석만 추가, 로직 무변경); `retry-turn.service.spec.ts`; `execution-engine.service.spec.ts` `describe('resumeGraphAfterRetry — downstream graph traversal (WARNING #10)')`(L14791~)
  - 상세: PR은 이 경로가 다른 3개 재진입 지점과 **의도적으로 다르게** 동작해야 한다고 주석으로 명시했지만(AI multi-turn retry는 `$input.*` 미해소가 spec 문서화된 동작), 이를 코드로 고정하는 assertion이 없다. `retry-turn.service.spec.ts`는 `runNodeDispatchLoop`을 mock해 호출 여부만 확인하고 call args(특히 `input`)는 검사하지 않는다. `execution-engine.service.spec.ts`의 `resumeGraphAfterRetry` 통합 테스트(실제 driver 경유)도 downstream handler가 호출됐는지만 확인할 뿐 그 handler가 받은 `input`/`$input` 표현식 값은 검사하지 않는다. 이 상태에서 누군가 "일관성을 위해" retry 경로도 `reentryWorkflowInput`을 쓰도록 "수정"해도 어떤 테스트도 실패하지 않아, 이번 PR이 명시적으로 배제한 동작이 조용히 뒤집힐 수 있다.
  - 제안: `retry-turn.service.spec.ts`의 mock `runNodeDispatchLoop`에 대해 `toHaveBeenCalledWith(expect.objectContaining({ input: {} }))` 같은 assertion을 하나 추가하거나, `execution-engine.service.spec.ts` 통합 테스트에서 downstream handler의 `execute` mock이 받은 `input`(또는 `$input` 표현식 해석 결과)이 트리거 파라미터를 반영하지 않음(빈 값)을 단언해 "의도적 예외"를 실행 가능한 회귀 가드로 전환할 것.

- **[INFO]** 프론트/백엔드 파라미터 이름 정규식 중복에 대한 drift 방지 테스트 없음
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:14`(`PARAM_NAME_RE`) vs `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:77`
  - 상세: 두 정규식이 현재는 문자 그대로 동일(`/^[A-Za-z_][A-Za-z0-9_]*$/`)하지만 각자 하드코딩돼 있다. `RESOLUTION.md`(W4)에서 이미 "저위험 drift, 백로그"로 수용된 사안이라 이번 PR 범위의 결함은 아니지만, 현재 이 동등성을 검증하는 테스트가 전혀 없어 백엔드 정규식이 바뀌어도 프론트 inline 검증은 조용히 divergence가 생긴다. 테스트 관점에서는 두 파일을 import해 정규식 소스 문자열이 같음을 단언하는 아주 얕은 가드 테스트만으로도 향후 drift를 잡을 수 있다.
  - 제안: 백로그 항목 진행 시 "정규식 소스 동일성" 단언 테스트를 함께 추가 권장 (필수는 아님).

- **[INFO]** `trigger-configs.test.tsx` 중복 이름 테스트가 정확한 개수 대신 `> 0`만 확인
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/trigger-configs.test.tsx:99-114`("flags duplicate parameter names")
  - 상세: `getAllByText(/Parameter name is duplicated/i).length).toBeGreaterThan(0)`는 두 슬롯 모두에 에러가 표시돼야 하는 실제 구현 의도(`nameCounts` 기반, 양쪽 다 카운트 2로 표시)를 정확히 표현하지 못한다. `toBe(2)`로 강화하면 "한쪽만 표시" 같은 회귀도 잡을 수 있어 가독성·의도 표현이 개선된다.
  - 제안: `expect(...).toBe(2)`로 정밀화.

## 강점 (참고)

- `load-trigger-parameter-schema.ts`는 기존에 유닛 테스트가 전혀 없던 상태였는데, 이번 PR에서 `load-trigger-parameter-schema.spec.ts`(신규)로 조회 방식(`type` vs `category`), 스키마 부재/malformed/well-formed, `resolveTriggerParameters`와의 연계까지 폭넓게 커버해 실질적인 커버리지 갭을 닫았다.
- `workflows.service.spec.ts`의 `saveCanvas`/`restoreVersion` 신규 테스트는 `mockRepository`/`mockWorkflowVersionsService`를 매 테스트 독립적으로 구성하고, `restoreVersion` 케이스는 `saveCanvas`를 spy가 아닌 실제 구현으로 관통시켜(`skipParamSchemaValidation=true`) 회귀를 end-to-end에 가깝게 검증한다 — mock 남용 없이 실제 동작에 근접.
- `manual-trigger-default-param.e2e-spec.ts`는 `_test/simulate-execution-run-redelivery` 훅으로 "트리거 실행 전 크래시"를 타이밍에 의존하지 않고 결정적으로 합성해, 실제 근본 원인(durable input 소실)을 저수준 DB 상태 조작으로 정확히 재현한다. 4개 `it`가 각자 독립적으로 워크플로우를 생성(`setupGraph()`)해 테스트 간 격리도 양호.
- 신규 i18n 키(`errorNameRequired`/`errorNameInvalid`/`errorNameDuplicate`)는 en/ko 동시 추가됐고, 기존 키-패리티 테스트(`codebase/frontend/src/lib/i18n/__tests__/i18n.test.ts` 등)가 이미 일반적으로 커버하므로 별도 테스트 불필요.
- `trigger-configs.test.tsx`는 실제 `useLocaleStore`/`useT`를 그대로 사용해(모킹 없이) 렌더된 실 문자열을 검증 — mock 괴리 리스크가 낮다.

## 요약

핵심 회귀(저장 시 malformed 파라미터 400 차단, `type` 기반 트리거 조회, 프론트 inline 검증)에 대해서는 유닛/통합/e2e 전 계층에 걸쳐 견고하고 격리도 잘 된 테스트가 추가됐고, 특히 이전에 커버리지가 전무했던 `load-trigger-parameter-schema.ts`에 신규 유닛 테스트 파일을 만든 점, e2e에서 크래시를 타이밍 비의존적으로 결정적 합성한 점은 테스트 설계 품질이 높다. 다만 이번 PR이 스스로 "진짜 핵심"이라 명명한 재진입 input 수정은 3개 호출부 중 1곳(driveStuckRedrive)만 e2e로 실측되고, 나머지 2곳(driveResumeAwaited/driveResumeFrame)은 추출된 헬퍼 함수의 격리 유닛 테스트로만 간접 방어될 뿐 실제 배선을 잠그는 테스트가 없다. 또한 retry-turn.service.ts의 "의도적 예외"도 코드 주석으로만 남아 있고 실행 가능한 회귀 가드가 없어, 향후 리팩터링이 이 두 가지 설계 결정을 조용히 뒤집어도 CI가 잡아내지 못하는 상태다.

## 위험도

MEDIUM
