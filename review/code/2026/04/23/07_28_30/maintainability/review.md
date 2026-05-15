## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** `aiAgentConditionalPorts` — 2×2 분기 조합에서 약 포트 배열 중복

- **위치**: `resolve-dynamic-ports.ts` — `aiAgentConditionalPorts` 함수 전체
- **상세**: `condPorts.length === 0` × `isMultiTurn` 의 2×2 행렬을 4개 독립 분기로 표현하면서, multi-turn 약 포트 배열 `[user_ended, max_turns, error]` 와 single-turn 약 포트 배열 `[out, error]` 가 각각 두 곳에 그대로 복제된다. 포트 ID 또는 label 을 수정할 때 두 곳 모두 수정해야 하며 한 곳만 바뀔 위험이 있다.
  ```ts
  // 현재: "조건 없는 multi_turn" 과 "조건 있는 multi_turn" 두 곳에 동일 배열 반복
  const multiTurnWeakPorts: ResolvedPort[] = [
    { id: 'user_ended', ... },
    { id: 'max_turns', ... },
    { id: 'error', ... },
  ];
  // 처럼 상수로 추출하면 두 분기가 공유 가능
  ```
- **제안**: multi-turn 약 포트와 single-turn 약 포트를 각각 로컬 상수로 추출해 두 분기에서 spread 하거나, 각 분기를 `condPorts.length > 0 ? [...condPorts, ...weakPorts] : weakPorts` 형태로 통일.

---

**[WARNING]** `presentationButtonPorts` — 단일 함수에 4가지 수집 경로 + 2가지 폴백 혼재

- **위치**: `resolve-dynamic-ports.ts:169~240` — `presentationButtonPorts` 함수
- **상세**: 이 함수는 (1) static items 버튼, (2) dynamic itemButtons, (3) global buttons, (4) 포트 없을 때 link-type 폴백(`continue`), (5) 완전 빈 설정 폴백(static outputs) 까지 한 함수에서 처리한다. 약 65줄에 중첩 루프와 조건이 혼재해 cyclomatic complexity 가 높고, 새로운 carousel 버튼 소스 추가 시 어디에 삽입해야 할지 파악하기 어렵다.
- **제안**: 버튼 수집 로직을 `collectPortButtons(config, spec): ButtonEntry[]` 로 분리하고, 폴백 결정 로직을 별도 함수로 추출해 `presentationButtonPorts` 는 두 함수를 조합하는 역할만 담당하도록 분리.

---

**[INFO]** 메모리 파일 코드 스니펫이 실제 구현과 불일치 (staleness)

- **위치**: `memory/workflow-assistant-provider-quirks-and-review-always.md` §6 "대응 (서버 강제)" 코드 블록
- **상세**: 메모리 파일의 코드 예시는 `planProposedPendingApproval` 변수명을 사용하지만, RESOLUTION.md 에서 조치 완료한 내용에 따라 실제 코드는 `isPlanPendingApproval(planForTurn)` helper 로 리팩토링됐다. 메모리 스니펫이 갱신되지 않아 추후 이 섹션을 참조하면 현재 코드와 패턴이 다른 예시를 보게 된다.
- **제안**: 메모리 파일 §6 코드 스니펫을 `const planPending = isPlanPendingApproval(planForTurn);` 형태로 갱신.

---

**[INFO]** `buildReviewChecklist` 내 인라인 그룹핑 + 문자열 조립 로직

- **위치**: `review-workflow.ts` — `buildReviewChecklist` 함수의 `dangling` 처리 블록 (`byNode` Map, `summary` 생성)
- **상세**: dangling 항목을 노드 단위로 묶고 human-readable summary 를 만드는 로직이 메인 함수 내부에 ~15줄 인라인으로 있다. 이 함수는 이미 여섯 개 점검을 순차 실행하는 오케스트레이터 역할인데, 상세 포맷 로직까지 담으면 역할이 혼재된다.
- **제안**: `formatDanglingPortsSummary(entries: DanglingPortEntry[]): string` 헬퍼로 추출. `collectDanglingOutputPorts` 와 같은 파일 내 `// ============` 섹션에 배치하면 일관성 유지.

---

**[INFO]** `makeDefs()` 테스트 헬퍼 중복 — spec 두 파일에 독립적으로 존재

- **위치**: `review-workflow.spec.ts:makeDefs()` vs `workflow-assistant-stream.service.spec.ts` 내 익명 `listDefinitions` mock 반환값
- **상세**: 두 파일 모두 `carousel`, `template`, `manual_trigger` 정의를 독립적으로 구성한다. 완전히 동일하지 않고 `metadata` 필드 구성이 다소 다르지만, 실질적으로 같은 픽스처를 표현한다. 향후 `NodeDefinitionView` 인터페이스 변경 시 두 곳을 모두 수정해야 한다.
- **제안**: 공용 테스트 픽스처 파일(`test/fixtures/node-definitions.ts`) 로 추출해 두 spec 에서 import 하도록 통일. 단, 현재 scope 의 영향이 작으므로 즉시 필수는 아님.

---

**[INFO]** `resolveEffectiveOutputPorts` — frontend 미러 동기화 의무가 코드 외부 문서에만 존재

- **위치**: `resolve-dynamic-ports.ts` JSDoc 및 `memory/workflow-assistant-self-review-and-error-hints.md` 체크리스트
- **상세**: "frontend `resolveDynamicPorts` 와 동일 동작을 유지해야 한다"는 제약이 memory 문서와 JSDoc 에만 기록되어 있고, 코드 레벨 방어 장치(공유 타입, 공유 상수, 린트 룰 등)가 없다. frontend 파일 변경 시 backend 파일 변경을 잊어도 CI 가 잡지 못한다.
- **제안**: 두 파일이 지원하는 `DynamicPortsSpec.kind` 목록을 공유 상수(`SUPPORTED_DYNAMIC_PORT_KINDS`)로 frontend/backend 공통 위치에 두거나, 최소한 backend spec 파일 상단에 "이 파일의 테스트 수가 frontend spec 과 일치하는지 확인" 주석을 두어 리뷰어가 인지할 수 있게 함.

---

### 요약

이번 변경은 이전 리뷰의 주요 WARNING(조건 중복, 이중 가드 의도 불명확)을 `isPlanPendingApproval` 헬퍼 추출과 `hadSuccessfulEditThisRound` lazy 평가로 잘 해소했다. 신규 추가된 `resolve-dynamic-ports.ts` 는 전반적으로 읽기 쉽고 구조가 명확하나, `aiAgentConditionalPorts` 의 2×2 분기에서 약 포트 배열이 중복 복사되는 점과 `presentationButtonPorts` 의 함수 길이가 단일 책임에 어긋나는 점이 향후 수정 시 실수를 유발할 수 있다. 메모리 파일의 코드 스니펫이 리팩토링 후 실제 코드와 달라진 staleness 도 조기에 수정하지 않으면 혼란을 준다. 전체적으로 유지보수 위험은 낮다.

### 위험도

**LOW**