### 발견사항

---

**[WARNING] 프론트엔드-백엔드 로직 이중 유지의 구조적 부채**
- 위치: `tools/resolve-dynamic-ports.ts` 전체 + JSDoc "Backend mirror of frontend..."
- 상세: 6종 `DynamicPortsSpec` 분기 로직이 frontend 사본과 독립 파일로 공존한다. 현재는 spec 미러링으로 드리프트를 방어하지만, 새 `kind` 추가 시 두 파일을 동시에 수정해야 하는 의무가 암묵적이다. 이 의무가 코드 경계(linter 규칙, 공유 패키지)가 아닌 문서(memory 파일)에만 명시되어 있어, 미래 기여자가 한 쪽만 수정하는 드리프트가 발생할 수 있다.
- 제안: 단기: `resolve-dynamic-ports.ts` 상단에 `// SYNC-CHECK: must match frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 주석 + CI 단계 파일 해시 비교. 장기: 공유 패키지(`@workspace/node-ports`) 추출로 단일 출처 확보.

---

**[WARNING] `streamMessage`의 단일 책임 원칙 위반 심화 (기존 + 신규)**
- 위치: `workflow-assistant-stream.service.ts` — `streamMessage` 전체
- 상세: 이번 변경으로 루프 후처리 섹션에 `isPlanPendingApproval` 가드가 추가되며 책임 목록이 늘었다. 현재 이 메서드는 ①세션 로딩, ②메시지 조립, ③tool 디스패치 4종, ④finish guard, ⑤review guard, ⑥loop 제어, ⑦plan-only guard, ⑧퍼시스턴스를 단일 메서드에서 처리한다. 가드가 서비스 메서드 내부에 인라인으로 누적되면서, 각 가드의 발동 조건과 상호 의존 순서를 파악하기 위해 메서드 전체를 읽어야 하는 인지 부하가 증가한다.
- 제안: 루프 반복 종료 조건 계산을 `computeLoopContinuation({ planPending, finishResolved, hadSuccessfulEdit, finishReason, pendingResultsCount }): { shouldContinue: boolean; normalizedFinishReason: string }` 으로 분리. 테스트도 이 함수만 단위 테스트하면 되어 `streamMessage` 통합 테스트 부담 감소.

---

**[INFO] `buildReviewChecklist`의 입력 인터페이스 확장 방식 — 인터페이스 분리 원칙**
- 위치: `review-workflow.ts` — `BuildReviewChecklistInput.nodeDefs`
- 상세: `DANGLING_OUTPUT_PORTS` 체크 하나를 위해 `BuildReviewChecklistInput`에 `nodeDefs: NodeDefinitionView[]`가 추가됐다. 현재 6개 체크 중 5개는 `nodeDefs`를 사용하지 않는다. 이 패턴이 반복되면(예: 다음 체크를 위해 또 다른 의존성 추가) 입력 인터페이스가 점진적으로 비대해진다.
- 제안: 당장 리팩토링은 불필요하나, 향후 체크가 추가될 때 입력을 체크 단위로 분리하거나(`BaseCheckInput & DanglingPortsCheckInput`) DI로 체크 구현체를 주입하는 방향 고려.

---

**[INFO] `isPlanPendingApproval` 헬퍼의 모듈 위치 — 응집도**
- 위치: `workflow-assistant-stream.service.ts` 말미 — `function isPlanPendingApproval(...)`
- 상세: `AssistantPlanRecord` 의 비즈니스 규칙("승인 여부 판정")이 서비스 파일의 모듈 스코프 함수로 존재한다. 이 판정 로직은 엔티티 레벨 지식인데 서비스 파일에 위치해 있어, 같은 판정이 필요한 다른 서비스가 생길 경우 재사용이 어렵다.
- 제안: `entities/workflow-assistant-message.entity.ts` 또는 `plan.utils.ts` 에 배치하거나, `AssistantPlanRecord` 에 `isPendingApproval(): boolean` 메서드를 추가.

---

**[INFO] 레이어 경계 — 프롬프트 내용이 런타임 로직에 강결합**
- 위치: `system-prompt.ts` — Ex2 예제의 `btn_korean`, `btn_western`, `btn_chinese`, `btn_other` 슬러그
- 상세: 시스템 프롬프트 내 예제가 특정 사용 시나리오의 하드코딩 슬러그를 포함한다. 프롬프트 교육 레이어와 비즈니스 데이터가 혼재하는 구조로, 예제 슬러그가 실제 노드 스키마 규칙과 따로 진화할 위험이 있다. 다만 이는 LLM 프롬프트의 특성상 완전한 분리가 어렵고, 현재 변경의 목적(구체적 예시로 LLM 교육)과 상충한다.
- 제안: 수용 가능한 트레이드오프. 단, 예제 슬러그 변경 시 자동 검증이 없으므로 `system-prompt.spec.ts` 의 Ex2 테스트가 이 역할을 대신하고 있음을 명시.

---

**[INFO] `collectDanglingOutputPorts` 의 조기 반환과 일관성**
- 위치: `review-workflow.ts:collectDanglingOutputPorts` — `if (dangling.length >= MAX_DANGLING_PORTS) return dangling;`
- 상세: 상한 도달 시 조기 반환하는 패턴은 `collectOrphans`와 동일하여 일관성이 있다. 단, 조기 반환 시 어떤 노드가 먼저 처리되는지는 `snapshot.nodes` 배열 순서에 의존하므로, 동일 상태에서 노드 순서가 달라지면 `data` 배열 내용이 달라진다.
- 제안: 이슈 없음. `MAX_DANGLING_PORTS=20` 상한이 실용적으로 충분하고, 동작은 결정론적(노드 순서 기준 선착순).

---

### 요약

이번 변경은 두 가지 독립된 기능(DANGLING_OUTPUT_PORTS 검사 + plan-only 턴 핑퐁 루프 차단)이 하나의 PR에 묶인 구조다. 개별 변경은 모두 목적에 맞게 최소 침습적으로 구현되었고, `isPlanPendingApproval` 헬퍼 추출로 조건 중복이 해소된 점은 명확한 개선이다. 아키텍처 관점의 주요 부채는 두 가지다: (1) `resolve-dynamic-ports.ts` 이중 유지 구조 — 현재는 spec 미러링으로 관리되지만, 공유 패키지 없이는 중장기적으로 드리프트 위험이 존재한다; (2) `streamMessage`의 가드 누적 — 메서드 책임이 계속 확장되는 방향이며, `computeLoopContinuation` 분리로 이 추세를 일찍 차단하는 것이 바람직하다. 기능 정확성과 테스트 커버리지는 양호하며, 발견된 이슈는 모두 유지보수성 범주의 LOW 위험이다.

### 위험도
**LOW**