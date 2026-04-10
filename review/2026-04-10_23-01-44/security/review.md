### 발견사항

---

**[WARNING] LLM 사용자 입력 직접 전달 — 프롬프트 인젝션**
- 위치: `text-classifier.handler.ts` — `execute()`, user 메시지 구성
- 상세: `config.inputField`가 표현식 해석 후 사용자 제어 데이터가 되어 LLM user 메시지로 그대로 전달됩니다. `jsonSchema`의 `enum` 제약이 응답 출력을 제한하지만, 입력 자체에 대한 길이 제한이나 새니타이징이 없습니다. 특히 카테고리 이름이 `instructions` 필드(`config.instructions`)에 포함되는 구조이므로, 악의적 입력이 system prompt를 조작하면 `enum` 제약을 우회할 가능성이 있습니다.
- 제안: `inputField` 최대 길이 제한(예: 10,000자)을 `validate()` 단계에서 강제하고, user/system 역할 경계를 유지하세요.

---

**[WARNING] 폴백 카테고리 매칭의 부분 문자열 취약점**
- 위치: `text-classifier.handler.ts` — `catch` 블록 (`result.content?.includes(c.name)`)
- 상세: JSON 파싱 실패 시 LLM 원시 응답에서 `includes()`로 카테고리 이름을 검색합니다. 카테고리 이름이 짧거나 일반적인 단어("IT", "A", "No")인 경우, 응답의 다른 부분(예: "Note", "Bitcoin")에서 의도치 않게 매칭됩니다. 악의적 입력이 의도적으로 JSON 파싱을 실패하게 유도하면서 원시 텍스트에 특정 카테고리 이름을 포함시켜 잘못된 분기를 활성화할 수 있습니다.
- 제안: 폴백 매칭에 단어 경계 정규식(`\b${name}\b`) 사용, 또는 폴백 로직 제거 후 무조건 `fallback` 포트로 라우팅하는 방식 채택.

---

**[WARNING] 실행 재개/취소 메서드의 서비스 계층 인가 검증 부재**
- 위치: `execution-engine.service.ts` — `continueExecution()`, `cancelWaitingExecution()`, `continueButtonClick()`, `continueAiConversation()`, `endAiConversation()`
- 상세: 이 메서드들은 `executionId`만으로 대기 중인 실행에 접근합니다. 서비스 계층에서 호출자가 해당 실행의 소유자인지 검증하는 코드가 없습니다. WebSocket 게이트웨이나 컨트롤러가 인증/인가를 처리한다면 현재는 안전하나, 계층 간 신뢰 경계가 명시되지 않아 미래에 메서드가 다른 경로로 호출될 경우 권한 상승 취약점이 될 수 있습니다.
- 제안: 서비스 메서드에 `userId` 또는 `workspaceId` 파라미터를 추가하고 `pendingContinuations`에 소유자 정보를 함께 저장하여 검증하거나, 상위 레이어의 책임을 주석으로 명시하세요.

---

**[WARNING] 인라인 서브워크플로우 실행 시 `nodeOutputCache` 격리 미흡**
- 위치: `execution-engine.service.ts` — `executeInline()`, `propagateReachability()`
- 상세: `context.nodeOutputCache`는 부모 실행과 인라인 서브워크플로우가 공유하는 단일 객체입니다. 서브워크플로우 노드가 부모 노드와 동일한 레이블/ID를 가진 경우, `$node` 표현식이 부모 실행의 출력 데이터에 접근하거나 덮어쓸 수 있습니다. 이는 워크플로우 설계자가 의도하지 않은 데이터 흐름을 만들며, 다중 테넌트 환경에서 워크스페이스 간 데이터 노출로 이어질 수 있습니다.
- 제안: `executeInline` 호출 시 `nodeOutputCache`를 부모 캐시를 프로토타입으로 가진 격리된 객체(`Object.create(parentCache)`)로 래핑하여 서브워크플로우 쓰기가 부모를 오염시키지 않도록 하세요.

---

**[INFO] `reachable` 범위 초기화의 논리적 접근 제어 영향**
- 위치: `execution-engine.service.ts` — back-edge 처리 블록
- 상세: `reachable.delete` 루프가 `targetIndex`~`pointer` 범위를 일괄 삭제합니다. 해당 범위에 루프 외부 경로를 통해 도달 가능한 노드(다중 incoming edge)가 있다면, 해당 노드의 reachability가 부당하게 제거될 수 있습니다. 실행 정확성 문제이지만, 보안 관점에서 특정 조건에서 접근 제어를 수행하는 노드(예: 권한 검사 노드)가 의도치 않게 건너뛰어지는 위험으로 이어질 수 있습니다.
- 제안: 루프 범위 초기화 시 해당 순환 경로에만 속한 노드를 선택적으로 제거하도록 개선하거나, 현재 한계를 주석으로 명시하세요.

---

**[INFO] LLM 응답의 민감 데이터 에러 노출**
- 위치: `text-classifier.handler.ts` — `catch` 블록
- 상세: `catch` 블록이 에러를 로깅하지 않고 무음으로 처리하여 폴백 로직으로 진행합니다. JSON 파싱 실패 원인이 기록되지 않아 진단이 어렵습니다. 단, 이 방식은 LLM 응답이 에러 메시지에 노출되지 않는다는 점에서는 안전합니다.
- 제안: 에러 로깅 시 LLM 원시 응답을 truncate하여 기록 (예: 첫 200자만)하여 진단 가능성과 데이터 최소화를 균형 있게 처리하세요.

---

### 요약

이번 변경에서 치명적인 취약점은 발견되지 않았습니다. 핵심 위험은 `TextClassifierHandler`의 두 가지 입력 처리 문제입니다: 사용자 제어 데이터가 길이 제한 없이 LLM에 전달되는 프롬프트 인젝션 가능성과, `includes()` 기반 폴백 매칭의 부분 문자열 오매칭 취약점입니다. 실행 재개 메서드들의 서비스 계층 인가 부재는 현재 아키텍처에서 상위 레이어에 의존하는 구조로 잠재적 위험을 내포하며, 인라인 서브워크플로우의 `nodeOutputCache` 공유는 데이터 격리 측면에서 개선이 필요합니다. `reachable` 기반 전환 자체는 기존 방식보다 실행 결정성을 높여 보안적으로 긍정적인 방향입니다.

### 위험도

**MEDIUM**