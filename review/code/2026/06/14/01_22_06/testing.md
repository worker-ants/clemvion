# Testing Review

## 발견사항

### **[INFO]** 신규 테스트 추가 — §5.5 durationMs 갱신 검증

- 위치: `execution-engine.service.spec.ts` 추가 블록 (라인 5438+67)
- 상세: `§5.5 resume 시 meta.durationMs 를 nodeExec.startedAt 경과로 갱신` 테스트가 추가됐다. 변경 코드(`processFormResumeTurn` 내 §5.5 블록)의 핵심 행동 — `nodeExec.startedAt`으로부터의 경과 계산, 기존 `meta` 필드 보존, `setStructuredOutput` 호출 — 을 모두 직접 검증한다.
- 제안: 현재 추가된 테스트는 적절하다. 단, 아래 엣지 케이스들이 미커버다.

---

### **[WARNING]** `nodeExec.startedAt` 부재 경로 테스트 없음 (커버리지 갭)

- 위치: `execution-engine.service.ts:4084-4086`
- 상세: 구현 주석에 "nodeExec 부재 시(테스트 등) prevStructured.meta 보존" 이라고 명시되어 있다. 즉 `nodeExec?.startedAt` 이 falsy 인 경우 `resumeDurationMs = undefined` 가 되어 `prevMeta` 만으로 `resumedMeta` 가 구성된다. 이 분기를 검증하는 테스트가 없다.
  - 더불어 `nodeExec` 자체가 `undefined` 인 경우(`if (nodeExec)` 블록 미진입)도 커버되지 않는다.
- 제안:
  ```ts
  it('§5.5 nodeExec.startedAt 부재 시 prevStructured.meta 보존', async () => {
    // mockNodeExecutionRepo.findOne → startedAt 없는 row
    // expect: setStructuredOutput 의 meta.durationMs 가 undefined / meta 원본 보존
  });
  ```

---

### **[WARNING]** `resumeDurationMs === 0` 경계값 테스트 없음

- 위치: `execution-engine.service.ts:4085` (`Math.max(0, ...)`)
- 상세: `Math.max(0, ...)` 가드는 `resumeFinishedAt < nodeExec.startedAt` (시스템 시계 역행 등) 시 음수를 0으로 클램핑한다. 이 경계값이 `meta.durationMs = 0` 으로 올바르게 반영되는지, 그리고 `nodeExec.durationMs` 도 0으로 일관되게 설정되는지 테스트가 없다.
- 제안: `startedAt = new Date(Date.now() + 5000)` (미래 시각 시뮬레이션)으로 `durationMs = 0` 검증 케이스 추가.

---

### **[WARNING]** `prevStructured.meta` 가 없는 경우(waiting_for_input 에 meta 미설정) 테스트 없음

- 위치: `execution-engine.service.ts:4087-4090`
- 상세: `prevStructured?.meta` 가 `undefined`인 경우 — 즉 `prevMeta = undefined` — 에도 `resumeDurationMs` 가 있으면 `resumedMeta = { durationMs: ... }` 만 생성된다. 현재 테스트는 `meta: { durationMs: 0, interactionType: 'form' }` 가 이미 있는 happy-path 만 커버한다.
  - 누락 meta 에서 `interactionType` 이 없어도 구조가 깨지지 않는지 검증 필요.
- 제안: `structuredOutputCache` 에 `meta: undefined` (또는 meta 키 자체 없음)인 케이스 추가.

---

### **[INFO]** `nodeExec.durationMs` DB 반영 검증 부재

- 위치: `execution-engine.service.ts:4149-4152` + `execution-engine.service.spec.ts` 신규 테스트
- 상세: 신규 테스트는 `contextService.setStructuredOutput` (`meta.durationMs`) 만 검증하고, `nodeExec.durationMs` / `nodeExec.finishedAt` 의 DB save 경로를 검증하지 않는다. `mockNodeExecutionRepo.save` 호출 여부와 인자에서 `durationMs ≥ 4000` 을 확인하면 structured meta와 DB 값의 일관성을 함께 보증할 수 있다.
- 제안:
  ```ts
  const savedNe = mockNodeExecutionRepo.save.mock.calls.find(...);
  expect(savedNe?.[0]?.durationMs).toBeGreaterThanOrEqual(4000);
  ```

---

### **[INFO]** 테스트에서 `as unknown as { ... }` 형 캐스팅 남용으로 인한 리팩토링 취약성

- 위치: 신규 테스트 전체 (라인 36-52, 65-73)
- 상세: `svc.contextService`, `svc.conversationThreadService` 를 private 멤버 접근용 캐스팅으로 뚫어 쓴다. 기존 테스트에서도 동일 패턴이 반복된다. 파일 분량이 이미 5,400+ 라인으로 이 패턴이 테스트 유지비를 높이고 있다. 현재 변경 범위 내에서는 기존 관행을 따른 것으로 즉각 교체 대상은 아니지만, 서비스 리팩토링 시 public accessor 또는 별도 helper 클래스 추출을 검토할 것.
- 제안: 단기 조치 없음. 장기적으로 `processFormResumeTurn` 을 별도 클래스로 추출하면 단위 테스트 접근성이 개선된다.

---

### **[INFO]** `flushResumeDrive` 타이머(200ms) 미사용 — 직접 호출 방식으로 정확성 향상

- 위치: 신규 테스트 전체
- 상세: 신규 테스트는 `processFormResumeTurn` 을 direct await 으로 호출하며 `flushResumeDrive` 를 사용하지 않는다. 이는 올바른 선택 — 타이머 기반 assertion 은 CI 부하 변동에 취약하다. private 메서드를 직접 호출한 덕분에 결정론적 검증이 가능하다.

---

### **[INFO]** `jest.spyOn(svc.conversationThreadService, 'appendPresentationInteraction')` mock 패턴

- 위치: 신규 테스트 라인 75-76
- 상세: `ConversationThreadService` 는 `useClass: ConversationThreadService` 로 실제 구현이 주입된다 (주석: "Stateless service — use the real implementation"). 그럼에도 신규 테스트는 `appendPresentationInteraction` 을 spy mock 으로 차단한다. 이는 `processFormResumeTurn` 의 `appendPresentationInteraction` 사이드이펙트가 테스트 목적(durationMs 검증)과 무관하기 때문으로 타당하다. 단, thread 변이 검증이 필요한 케이스에서는 spy 없이 실제 구현을 쓰는 것이 올바르다(기존 버튼/폼 resume 테스트 패턴 참조).

---

## 요약

§5.5 `meta.durationMs` 갱신 로직은 테스트가 추가됐으며, happy-path(`startedAt` 5초 전, 기존 meta 보존 확인)는 잘 커버된다. 그러나 `nodeExec.startedAt` 부재 분기, `Math.max(0, ...)` 경계값(시계 역행), `prevStructured.meta` 자체 누락 케이스 — 세 개의 실행 경로가 테스트되지 않았다. 또한 `nodeExec.durationMs` DB 반영(structured meta 와의 일관성)이 검증되지 않아 §5.5 목표인 "structured meta ↔ DB durationMs 일관성"의 절반이 미검증 상태다. 기존 테스트 회귀 위험은 없으며, 전반적인 테스트 격리·가독성·mock 적절성은 양호하다.

## 위험도

LOW
