## 유지보수성 코드 리뷰

### 발견사항

---

- **[WARNING]** `isDynamicPorts` / `dynamicPorts` 이중 필드 확인
  - 위치: `system-prompt.ts` — `d.metadata.isDynamicPorts || d.metadata.dynamicPorts`
  - 상세: NodeDefinitionView 메타데이터에 동일한 의미의 필드명이 두 가지(`isDynamicPorts`, `dynamicPorts`)로 분기되어 있다. 이 OR 체크 자체가 데이터 모델 불일치의 징후이며, 이후 세 번째 필드명 변형이 추가될 때 누락될 위험이 있다.
  - 제안: 타입 정의에서 단일 정규 필드(`isDynamicPorts`)로 통일하고, `dynamicPorts`는 deprecated 처리 후 마이그레이션한다.

---

- **[WARNING]** `evaluateFinishGuard` 반환 타입 인라인 리터럴
  - 위치: `workflow-assistant-stream.service.ts` — `evaluateFinishGuard` 메서드 반환 타입
  - 상세: 6개 필드를 가진 복잡한 인라인 객체 타입이 메서드 시그니처에 직접 기술되어 있다. `findLatestPlanInHistory` 등과 조합해 이 타입이 다른 곳에서 참조되어야 할 경우 중복 정의가 생긴다.
  - 제안: 파일 상단에 `type FinishGuardError = { ok: false; error: 'PLAN_NOT_COMPLETE'; pendingSteps: ...; openQuestions: string[]; message: string }` 로 추출하고, 반환 타입을 `FinishGuardError | null`로 선언한다.

---

- **[INFO]** 메서드 시그니처 내 인라인 `import()` 타입
  - 위치: `workflow-assistant-stream.service.ts` — `evaluateFinishGuard`, `findLatestPlanInHistory` 파라미터
  - 상세: `history: import('./entities/...').WorkflowAssistantMessage[]` 형태의 인라인 동적 임포트가 메서드 시그니처 안에 반복된다. 파일 하단의 `toChatMessages` 함수도 동일 패턴을 사용하므로 기존 관행과 일치하지만, 각 선언마다 경로 문자열이 반복되어 리팩토링 시 누락이 생길 수 있다.
  - 제안: 파일 상단 임포트 블록에 `import type { WorkflowAssistantMessage } from './entities/workflow-assistant-message.entity';`를 추가하고 세 곳을 동시에 정리한다.

---

- **[INFO]** `system-prompt.spec.ts` 내 부정확한 정규식 분기
  - 위치: `system-prompt.spec.ts` — `expect(prompt.toLowerCase()).toMatch(/do ?not call .*finish|must not .*finish|without .*finish/)`
  - 상세: 세 번째 분기 `without .*finish`는 실제 프롬프트 텍스트("do NOT call `finish` until…")와 의미적으로 매핑되지 않는다. 현재는 우연히 통과할 수 있으나, 프롬프트 문구 변경 시 테스트가 잘못된 이유로 통과·실패할 수 있다.
  - 제안: 실제 프롬프트에서 쓰는 어구를 직접 추출하거나(`do not call.*finish`), 더 구체적인 `finish.*gating|gating.*finish` 형태로 좁힌다.

---

- **[INFO]** 테스트 내 마법 문자열 상수 산재
  - 위치: `workflow-assistant-stream.service.spec.ts` — `'sess-1'`, `'ws-1'`, `'u-1'`, `'gpt-4o'` 등
  - 상세: 동일한 리터럴이 여러 `it` 블록에 걸쳐 반복된다. 현재는 영향 범위가 크지 않으나, 세션/워크스페이스 ID 형식 변경 시 산발적인 수정이 필요해진다.
  - 제안: 파일 상단 `describe` 바깥에 `const TEST_IDS = { session: 'sess-1', workspace: 'ws-1', user: 'u-1', model: 'gpt-4o' }` 상수 객체를 정의해 단일 변경 지점을 만든다.

---

### 요약

이번 변경의 핵심인 `evaluateFinishGuard` 로직과 `finishBlockCount` 안전 장치는 명확한 주석과 단일 책임으로 잘 분리되어 있으며, `PlanCard`의 인라인 답변 UI 역시 상태 관리가 컴포넌트 내부로 적절히 캡슐화되어 있다. 전반적인 가독성과 의도 전달은 양호하다. 다만 `isDynamicPorts`/`dynamicPorts` 이중 필드 확인이 데이터 모델 불일치 가능성을 노출하고 있으며, `evaluateFinishGuard`의 복잡한 반환 타입이 인라인으로 남아 있어 재사용성이 떨어진다. 나머지 사항은 기존 코드 관행과의 일관성 문제나 테스트 견고성 수준의 소규모 개선 여지다.

### 위험도

**LOW**