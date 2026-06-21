# 유지보수성(Maintainability) 리뷰

> 대상: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts` (신규 테스트 3건 추가)
> 리뷰 세션: 2026/06/21 21_55_05

---

## 발견사항

### [INFO] 타입 캐스팅 패턴 반복 (기존 패턴 동형 유지)
- **위치**: 신규 추가 라인 70-73, 112-117 (`as unknown as { resolveScopeKey: jest.Mock; recall: jest.Mock }`, `as unknown as Ctor[0]`)
- **상세**: 신규 3개 케이스 모두 기존 파일 내 동일 캐스팅 패턴(`agentMem as unknown as { ... }`)을 그대로 답습한다. 이번 변경에서 패턴이 새로 추가되지는 않았으나 파일 전체로 봤을 때 동일 인라인 캐스팅이 6회 이상 분산된다. 직전 SUMMARY INFO #7에서 이미 식별된 항목으로, 이번 신규 케이스가 상황을 악화시키지는 않지만 해소도 하지 않는다.
- **제안**: 중장기적으로 파일 상단에 `type AgentMemMock = { resolveScopeKey: jest.Mock; recall: jest.Mock; scheduleExtraction: jest.Mock }` 타입 별칭을 선언하고 각 사용처에서 단일 캐스팅으로 교체. 이번 PR 범위 밖 — 비차단.

### [INFO] `threadFake([], [])` 호출 시 두 번째 인자 의미 불명확
- **위치**: 신규 라인 62, 118 (`threadFake([], [])`)
- **상세**: `threadFake`의 두 파라미터(`turns`, `fullTurns`)가 각각 `getThreadExcludingNode`와 `getThread` 반환값에 대응한다는 사실이 호출 시점에서 드러나지 않는다. 빈 배열 두 개를 나란히 넘기면 "왜 두 개?" 의 의도가 모호하다. 이 문제도 직전 SUMMARY INFO #8에서 파라미터명 불명확으로 이미 식별됐고, 신규 케이스가 동일 혼동을 반복한다.
- **제안**: JSDoc 1줄(`/** @param excludingNodeTurns @param fullThreadTurns */`) 추가 또는 파라미터명 리네임. 비차단.

### [INFO] `summaryModelConfigId` 케이스에서 로컬 `llm` 변수와 파일 상단 `llmFake()` 병존
- **위치**: 신규 라인 112-128
- **상세**: 이 케이스만 `resolveConfig`의 반환값을 실제로 제어해야 해서 별도 `llm` 변수를 인라인 선언한다. 다른 케이스는 `llmFake()`(파일 상단 팩토리)를 쓰는 구조와 미세한 비일관성이 있다. 그러나 이 케이스의 의도(특정 반환값 pin)가 명확하므로 패턴 분리 자체는 합리적이다. 현행 유지 허용.
- **제안**: 필요하다면 `llmFake({ resolveConfig: jest.fn().mockResolvedValue(...) })` 형태로 `llmFake`에 override 지원을 추가하면 팩토리 일관성이 높아진다. 비차단.

### [INFO] `as InjectArgs['target']` 반복 캐스팅 (신규 케이스 3건 모두)
- **위치**: 신규 라인 67, 98-100, 122-123
- **상세**: `{ conversationThread: { turns: [] } } as InjectArgs['target']` 형태가 신규 케이스 3건에 각각 삽입되어 있으며, 기존 케이스를 포함하면 파일 전체에 동일 표현이 7회 이상 등장한다. `baseInject` 픽스처 내 `target: undefined` 기본값 때문에 각 케이스가 개별 override해야 하는 구조다.
- **제안**: `baseInject`의 `target` 기본값을 `{ conversationThread: { turns: [] } } as InjectArgs['target']`로 설정하면 대부분 케이스의 명시적 override가 불필요해진다. 단, target 미주입 케이스(서비스 graceful 테스트)는 별도 처리 필요. 비차단.

---

## 요약

이번 변경은 테스트 커버리지 갭 3건을 해소하는 순수 test-only 추가로, 신규 도입된 유지보수성 문제는 없다. 발견된 INFO 4건은 모두 기존 파일에 이미 존재하던 패턴(인라인 타입 캐스팅 반복·파라미터명 불명확·`target` override 중복)을 신규 케이스가 동형으로 답습하는 수준이며, 직전 SUMMARY(21_43_55) INFO #7~#9로 이미 추적 중이다. 코드 가독성·의도 명확성은 한국어 it-string 설명과 인라인 주석 덕분에 양호하고, 중첩 깊이·순환 복잡도·매직 넘버 측면에서는 문제 없다.

---

## 위험도

NONE
