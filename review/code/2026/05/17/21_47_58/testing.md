# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** 신규 회귀 테스트의 설계 방향이 양호함 — 버그 재현 시나리오를 테스트 헤더에 상세히 기술하고, 검증 대상을 (a) messages 누적, (b) interactionType 마킹, (c) _resumeState strip 세 케이스로 명확히 분리함
  - 위치: `execution-engine.service.spec.ts` lines 46–129 (추가된 블록)
  - 상세: 각 assertion 이 독립적인 의미를 가지며, 테스트 이름이 버그 증상과 spec 참조를 모두 담고 있어 가독성이 높음
  - 제안: 유지

- **[WARNING]** `continueAiConversation` 호출 후 `await` 없이 `flushPromises()` 만으로 비동기 완료를 기다림 — 이 패턴이 기존 테스트에서도 사용 중이지만, race condition 이 발생할 경우 assertion 이 빈 save call 상태에서 실행될 가능성이 있음
  - 위치: `execution-engine.service.spec.ts` lines 86–87
  - 상세: `service.continueAiConversation(executionId, 'hi')` 의 반환값을 무시하고 `await flushPromises()` 만 호출. 실제 서비스 구현이 추가 비동기 체인을 가지는 경우 하나의 `setImmediate` 틱으로 충분하지 않을 수 있음. 기존 multi-turn 테스트와 동일 패턴을 채택한 것은 일관성 측면에서 합리적이지만, `flushPromises` 의 단일 `setImmediate` 특성상 깊은 Promise chain 에서 false-negative 위험이 잠재함
  - 제안: `for (let i = 0; i < 3; i++) await flushPromises()` 형태로 여러 틱을 비우거나, 테스트 헬퍼에 반복 flush 로직을 추가하는 것을 고려. 또는 기존 테스트들이 단일 flush 로 안정적으로 동작함을 확인했다면 현행 유지 가능 (INFO 수준 재분류 가능).

- **[WARNING]** `mockNodeExecutionRepo.save.mockClear()` 후 `node-agent` 의 `nodeId` 를 직접 문자열 리터럴로 필터링함 — 테스트가 픽스처 데이터 구조에 암묵적으로 결합되어 있음
  - 위치: `execution-engine.service.spec.ts` lines 94–96
  - 상세: `makeAiAgentHandler` 가 반환하는 노드의 ID 가 `'node-agent'` 임을 전제하는데, 이 값이 헬퍼 함수 내부 구현 세부사항이므로 헬퍼 변경 시 테스트가 무음으로 실패할 수 있음 (`savedAgentRows.length >= 1` assertion 이 0 건으로 빠져 실패하나, 오류 메시지가 직관적이지 않음)
  - 제안: `makeAiAgentHandler` 가 등록된 nodeId 를 상수로 export 하거나, 테스트 내에서 등록 시 사용한 nodeId 변수를 재사용하도록 리팩토링. 또는 assertion 을 `expect(savedAgentRows.length).toBeGreaterThanOrEqual(1)` 다음에 명확한 오류 메시지를 추가.

- **[INFO]** `_resumeState` strip 검증이 JSON 직렬화를 통한 문자열 검색으로 이루어짐 — 이 방식은 nested key 까지 탐지하므로 충분하나, 검증 대상 sentinel 값이 두 개뿐임
  - 위치: `execution-engine.service.spec.ts` lines 122–128
  - 상세: `INTERNAL_SYSTEM_PROMPT_SHOULD_NOT_PERSIST` 와 `cred-leak-canary` 두 sentinel 을 검사함. `_resumeState` 의 다른 필드(예: `totalInputTokens`, `model`, `turnDebugHistory`)가 어떤 형태로도 유출되지 않는지는 검증되지 않음. 현재 구현이 `delete persistedOutput._resumeState` 로 최상위 키만 제거하므로, 만약 구현이 deep clone + partial copy 방식으로 변경되면 sentinel 기반 검증만으로는 불충분
  - 제안: `expect(outputData).not.toHaveProperty('_resumeState')` 는 이미 있으므로, 추가로 `_resumeState` 내 임의 구조 키(예: `turnDebugHistory`)도 serialized 에 없음을 검증하거나, 현행 sentinel 방식이 충분하다면 INFO 수준으로 수용 가능.

- **[INFO]** `catalog-sync.spec.ts` 의 경로 수정(hop count +1)은 테스트 로직 변경 없이 경로 보정만 이루어진 버그픽스로, 기존 검증 항목 8가지 모두 유효하게 유지됨
  - 위치: `catalog-sync.spec.ts` lines 432–443 (diff)
  - 상세: `__dirname` 으로부터 repo root 까지의 hop count 가 `codebase/` 디렉토리 추가로 인해 6 → 7 이 된 것을 수정. 주석으로 커밋 참조(`33521233`)를 명시해 이후 유지보수 시 맥락을 제공
  - 제안: 이런 하드코딩 경로 대신 `require.resolve` 또는 monorepo root 를 탐색하는 헬퍼(예: `find-root`, `workspace root marker 기반`)를 사용하면 향후 디렉토리 재구성 시 동일 버그 재발을 방지할 수 있음. 현행 접근도 주석이 상세해 허용 가능.

- **[WARNING]** `registry.test.ts` 의 `real docs frontmatter spec/code paths` 테스트가 `it.runIf(hasRealDocs)` 로 조건부 실행됨 — CI 환경에서 `content/docs` 가 없으면 이 테스트가 skip 되어 dangling 참조 검증이 무력화될 수 있음
  - 위치: `registry.test.ts` lines 1193–1220
  - 상세: 본 변경에서 도입된 로직은 아니지만, 경로 보정 변경으로 이 테스트가 활성화되거나 영향받을 수 있음. `hasRealDocs` 가 false 일 때 CI 가 이 테스트를 skip 해도 실패로 인지하지 않으므로, 실제로 spec 경로 참조 검증이 의도대로 수행되는지 CI 파이프라인에서 `content/docs` 존재 여부를 명시적으로 확인해야 함
  - 제안: CI job 에서 `content/docs` 디렉토리 존재를 사전 확인하는 step 을 추가하거나, skip 시 warn 로그를 출력하도록 테스트를 보완. 또는 skip 이 예상된 동작이라면 plan 에 이 제약을 명시.

- **[INFO]** `registry.test.ts` 의 경로 hop count 수정(5 → 6)도 `catalog-sync.spec.ts` 와 동일한 `codebase/` 래퍼 추가에 대한 대응으로, 주석으로 커밋 참조가 명시됨
  - 위치: `registry.test.ts` lines 953–956 (diff)
  - 상세: 두 파일 모두 동일한 근본 원인(`codebase/` 추가)으로 인한 path 버그를 수정했으나, 각 파일이 독립적으로 수정됨. 이 패턴이 다른 spec/code 경로 참조 테스트에도 있다면 추가 누락 가능성 있음
  - 제안: 전체 codebase 를 대상으로 `__dirname` 으로 repo root 를 탐색하는 유사 패턴을 검색해 동일 버그가 다른 테스트에도 존재하는지 점검.

- **[INFO]** `execution-engine.service.ts` 의 변경 내용(formatting + 핵심 persist 로직 추가)에 대응하는 새 테스트가 spec.ts 에 추가됨 — 테스트 존재 여부 관점에서 적절히 커버됨
  - 위치: `execution-engine.service.ts` lines 2131–2177 (diff), `execution-engine.service.spec.ts` lines 46–129
  - 상세: 구현 변경의 핵심 코드 경로(nodeExec truthy check → strip → save)가 신규 테스트로 커버됨. 단, `nodeExec` 가 falsy 인 경우(조건 `if (nodeExec)` 의 false branch)에 대한 테스트는 없음
  - 제안: `nodeExec === undefined` 인 상황(nodeExecution 레코드를 찾지 못한 경우)에서도 오류 없이 계속 진행되는지 검증하는 테스트 케이스 추가를 고려. 현행 구현이 silent skip 으로 처리하므로 이를 명시적으로 확인하면 회귀 방지에 기여.

- **[INFO]** plan 문서(`ai-agent-multiturn-waiting-persist.md`)에 테스트 케이스 A/B/C 가 명시되어 있고, 신규 테스트가 세 케이스를 하나의 `it` 블록 안에서 모두 검증함 — 테스트 격리 관점에서 각 케이스를 별도 `it` 으로 분리하면 실패 진단이 용이해짐
  - 위치: `execution-engine.service.spec.ts` lines 46–129
  - 상세: 케이스 A(messages 누적), B(_resumeState strip), C(interactionType)를 단일 `it` 에서 검증. 하나의 assertion 실패 시 이후 assertion 이 실행되지 않아 전체 실패 원인 파악에 추가 디버깅이 필요할 수 있음
  - 제안: 세 케이스를 별도 `it` 블록으로 분리하거나, `describe` 블록으로 그룹화 후 `beforeEach` 에서 공통 setup 수행을 고려. 다만 setup 비용이 높을 경우(전체 실행 엔진 Mock) 현행 단일 블록도 실용적 선택임.

---

## 요약

이번 변경의 핵심은 AI Agent multi-turn 후속 turn 에서 `NodeExecution.outputData` DB 영속이 누락되던 버그 수정이며, 신규 회귀 테스트가 버그 재현 시나리오, spec 참조, 그리고 보안 측면(_resumeState 유출 방지)을 함께 커버하는 구조로 작성되어 테스트 존재성 측면에서 양호하다. `catalog-sync.spec.ts` 와 `registry.test.ts` 의 경로 수정은 `codebase/` 디렉토리 래핑으로 인한 hop count 버그를 정정한 것으로, 기존 검증 항목은 그대로 유효하게 보존된다. 주요 개선 여지는 비동기 flush 의 race condition 잠재성, `nodeId` 하드코딩으로 인한 픽스처 결합, `nodeExec` falsy branch 미검증, 그리고 조건부 CI 테스트 skip 시 검증 공백 가능성이며, 이 중 CRITICAL 수준은 없다. 전반적으로 테스트 커버리지 갭이 제한적이고 테스트 의도가 명확하게 기술되어 있어 유지보수 용이성이 높다.

---

## 위험도

LOW
