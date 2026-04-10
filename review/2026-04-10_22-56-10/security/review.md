## 보안 코드 리뷰 결과

### 발견사항

---

**[WARNING] LLM 응답을 통한 간접 프롬프트 인젝션 (Prompt Injection)**
- 위치: `text-classifier.handler.ts` — `systemPrompt` 구성 및 `execute()` 메서드
- 상세: `inputField` 값이 사용자가 제어하는 데이터로부터 직접 LLM 메시지에 삽입됩니다. `config.inputField`가 워크플로우 표현식(`{{ $input.text }}`)으로 해석되어 실제 사용자 입력 문자열이 되는 경우, 해당 값이 user 메시지로 그대로 전달됩니다. 악의적인 사용자가 입력 내용에 `"Ignore previous instructions..."` 같은 프롬프트를 포함하면 분류기의 동작을 우회할 수 있습니다.
- 제안: 현재 구조상 완전 차단은 어렵지만, LLM 응답을 `enum` 목록으로 강제 제한하는 `jsonSchema`가 이미 적용되어 있어 피해 범위가 제한됩니다. 추가로 `inputField` 값의 최대 길이를 제한하고, system prompt와 user input의 역할 경계를 명확히 유지하는 것이 권장됩니다.

---

**[WARNING] 노드 실행 취소 판단에서 권한 검증 누락**
- 위치: `execution-engine.service.ts` — `continueExecution()`, `cancelWaitingExecution()`, `continueButtonClick()`, `continueAiConversation()`, `endAiConversation()`
- 상세: 이 메서드들은 `executionId`만으로 대기 중인 실행을 재개/취소합니다. 호출자가 해당 `executionId`의 소유자인지 검증하는 코드가 서비스 계층에 없습니다. WebSocket 게이트웨이나 컨트롤러 계층에서 검증이 이루어지고 있다면 문제 없지만, 서비스 자체는 신뢰 경계가 없습니다.
- 제안: 이 메서드 호출 시 요청자의 워크스페이스/사용자 ID를 추가 파라미터로 받고, `pendingContinuations`에 소유자 정보를 함께 저장하여 검증하거나, 해당 검증이 상위 레이어에서 반드시 이루어짐을 문서화하세요.

---

**[WARNING] `nodeOutputCache`를 통한 노드 간 데이터 격리 미흡**
- 위치: `execution-engine.service.ts` — `propagateReachability()` 및 `executeInline()`
- 상세: `context.nodeOutputCache`는 동일 실행 내 모든 노드가 공유하는 객체입니다. 인라인 서브워크플로우 실행 시 동일 `context`를 사용하므로, 서브워크플로우의 노드가 부모 워크플로우 노드의 출력 데이터에 키 이름 충돌로 접근하거나 덮어쓸 수 있습니다. 특히 `$node` 표현식이 부모-자식 경계를 넘어 해석될 수 있습니다.
- 제안: 서브워크플로우 실행 시 `nodeOutputCache`를 격리된 스코프로 래핑하거나, 서브워크플로우 전용 컨텍스트를 사용하는 것을 고려하세요.

---

**[INFO] `reachable` 세트의 Back-edge 재설정 범위 논리**
- 위치: `execution-engine.service.ts` — back-edge 처리 블록 (`reachable.delete` 반복문)
- 상세: Back-edge 활성화 시 `targetIndex`부터 `pointer`까지 `reachable`을 모두 삭제 후 target만 다시 추가합니다. 이 구간에 병렬 브랜치의 무관한 노드가 포함될 경우 해당 노드의 reachability도 제거됩니다. 이는 보안 취약점이라기보다 실행 정확성 문제이나, 예기치 않은 노드 비실행으로 이어질 수 있습니다.
- 제안: Back-edge 재설정 시 해당 순환 경로에 속한 노드만 선택적으로 제거하는 로직 검토가 필요합니다.

---

**[INFO] 테스트에서 `(service as any)['contextService']` 패턴 사용**
- 위치: `execution-engine.service.spec.ts` — Template 표현식 해석 테스트들
- 상세: 프라이빗 필드에 대한 `as any` 캐스팅은 내부 구현 변경 시 컴파일 오류 없이 테스트가 실패하게 만드는 취약한 패턴입니다. 보안 관점에서 직접적 영향은 없으나, 테스트 신뢰성 저하로 이어집니다.
- 제안: `ExecutionContextService`를 테스트 모듈의 Mock으로 명시적으로 주입하고 `jest.spyOn`을 그 위에 적용하세요.

---

**[INFO] LLM 응답 파싱 오류 시 빈 카테고리 반환**
- 위치: `text-classifier.handler.ts` — `catch` 블록 (텍스트 폴백 로직)
- 상세: JSON 파싱 실패 시 LLM의 원시 응답 텍스트를 순회하며 카테고리 이름 포함 여부를 `includes()`로 확인합니다. 짧은 카테고리 이름(예: `"A"`, `"IT"`)이 있을 경우 의도하지 않은 카테고리로 매칭될 수 있습니다. 악의적으로 구성된 입력이 폴백 로직을 통해 잘못된 분기를 활성화할 수 있습니다.
- 제안: 폴백 매칭 시 단어 경계(word boundary) 기반 정규식 매칭을 사용하거나, 폴백을 완전히 제거하고 `fallback` 포트로만 라우팅하는 것을 고려하세요.

---

### 요약

이번 변경은 `portRoutingSkipped` 세트 기반의 명시적 skip 방식을 `reachable` 세트 기반의 전파 방식으로 교체하는 리팩터링으로, 실행 결정성과 브랜치 격리를 개선하는 방향입니다. 보안 측면에서 치명적 취약점은 발견되지 않았으나, LLM 기반 노드인 `TextClassifierHandler`에서 프롬프트 인젝션 위험과 폴백 매칭의 모호성이 존재합니다. 실행 재개 메서드들의 호출자 인가 검증이 서비스 계층에 부재하며, 이는 상위 레이어의 보안에 의존하는 구조입니다. 인라인 서브워크플로우 실행 시 `nodeOutputCache` 공유로 인한 데이터 격리 문제도 주의가 필요합니다.

### 위험도

**MEDIUM**