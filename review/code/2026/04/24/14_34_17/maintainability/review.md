## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** `STALL_MAX_ATTEMPTS` 상수 중복 — 백엔드와 프론트 동기화 위험
- 위치: `frontend/src/lib/stores/assistant-store.ts:67` (`const STALL_MAX_ATTEMPTS = 2`)
- 상세: `MAX_STALL_ROUNDS`(백엔드)와 동일한 값을 프론트에서 별도 상수로 복제. 주석으로 "백엔드에서 변경되면 같이 업데이트"라고 명시했지만, 이는 수동 동기화에 의존하는 구조로 값이 달라졌을 때 버그가 조용히 발생함. `auto_resume` 이벤트의 `max` 필드로 이미 서버가 최대값을 내려보내고 있으므로, rehydrate 경로에서도 상수 대신 `autoResumeAttempt`와 `max`를 페어링해 저장하거나, SSE의 `max`를 세션 상태에 캐싱하는 방향이 더 견고함.
- 제안: `hydrateMessage`에서 `max: STALL_MAX_ATTEMPTS` 대신 `max: msg.autoResumeAttempt ?? 1`처럼 서버 데이터 기반으로 처리하거나, spec에 "rehydrate 시 max는 SSE payload 기준"임을 명시.

---

**[WARNING]** `resumeMeta` 파라미터 3-중복 — 동일한 literal object가 3곳에 반복
- 위치: `workflow-assistant-stream.service.ts:386~408`, `780~800`, `1045~1065` (error 경로 2개 + 정상 종료 1개)
- 상세: `consecutiveStallRounds > 0 ? { autoResumed: true, ... } : { autoResumed: false, ... }` 패턴이 3군데에서 그대로 복붙됨. 필드 이름 변경이나 로직 수정 시 3곳을 동시에 찾아야 함.
- 제안: 헬퍼 함수로 추출.
```ts
function makeResumeMeta(stallRounds: number) {
  return stallRounds > 0
    ? { autoResumed: true, autoResumeReason: 'stall_pending_steps' as const, autoResumeAttempt: stallRounds }
    : { autoResumed: false, autoResumeReason: null, autoResumeAttempt: null };
}
```

---

**[WARNING]** 테스트의 `persistCalls` 타입 캐스팅 블록 중복
- 위치: `workflow-assistant-stream.service.spec.ts` — 3개의 테스트 케이스에 동일한 필터+캐스팅 블록 반복
- 상세: `mocks.sessionService.appendMessage.mock.calls.map(...).filter(payload => role === 'assistant') as Array<{...}>` 패턴이 테스트 3개에서 각각 다른 타입 annotation으로 반복됨. 타입이 미묘하게 달라 실제 검증 범위가 케이스마다 다를 수 있음.
- 제안: 테스트 파일 상단에 공용 헬퍼 추출.
```ts
function getAssistantPersistCalls(mocks: typeof mocks) {
  return mocks.sessionService.appendMessage.mock.calls
    .map((c) => c[1])
    .filter((p): p is { role: string } & Record<string, unknown> =>
      (p as { role?: string }).role === 'assistant',
    );
}
```

---

**[INFO]** `autoResume` 타입이 `reason: 'stall_pending_steps'` 리터럴로 고정되어 있어 향후 사유 추가 시 여러 파일 동시 수정 필요
- 위치: `assistant-store.ts:54`, `assistant.ts:175`, `workflow-assistant-stream.service.ts:145`
- 상세: `reason: 'stall_pending_steps'` 리터럴이 백엔드 union 타입, 프론트 API 타입, 스토어 타입에 각각 분산. 새 복구 경로 추가 시 3개 파일을 동시에 수정해야 하며, 어느 하나를 누락해도 타입 에러가 발생하지 않을 수 있음 (특히 `string | null`로 수신하는 API 레이어).
- 제안: 현재 구조가 의도적(확장 가능성 예고)이라면 메모리 문서에 "reason 추가 시 수정 파일 목록" 항목으로 고정. 규모가 커지면 shared type package 검토.

---

**[INFO]** `applyAutoResumeEvent`의 `set` 파라미터 타입이 zustand 내부 타입을 직접 노출
- 위치: `assistant-store.ts:442`
- 상세: `set: (updater: (s: AssistantState) => Partial<AssistantState>) => void`를 테스트 편의를 위해 별도 export함. Zustand 버전 변경 시 시그니처가 달라질 수 있고, 스토어 외부에서 `set`을 파라미터로 받는 패턴은 스토어 캡슐화를 약화시킴.
- 제안: 현재는 테스트가 `useAssistantStore.setState`를 직접 넘기는 방식이라 실용적으로 허용 가능한 수준. 단, 함수 시그니처 변경 시 테스트도 영향받음을 유지보수 체크리스트에 명시 권장.

---

**[INFO]** `hydrateMessage`의 조건부 spread 패턴 — 가독성 미세 저하
- 위치: `assistant-store.ts:161` (`...(autoResume ? { autoResume } : {})`)
- 상세: optional field를 조건부 spread로 처리하는 패턴은 TypeScript에서 관용적이지만, `autoResume: autoResume ?? undefined`로 직접 할당하는 방식이 더 읽기 쉬움.
- 제안: `autoResume: autoResume ?? undefined`로 단순화.

---

**[INFO]** `local-${crypto.randomUUID().slice(0, 8)}` prefix 생성 패턴 — 코드베이스 내 반복
- 위치: `assistant-store.ts:453` (applyAutoResumeEvent), `sendMessage` 내 user/assistant 메시지 생성부
- 상세: 동일한 임시 ID 생성 패턴이 여러 곳에서 반복됨. 별도 이슈는 아니나 `generateLocalId()`로 추출하면 prefix 변경 시 한 곳만 수정하면 됨.

---

### 요약

이번 변경은 stall 자동 복구 UX를 위한 의도가 명확하고, 스펙·메모리·테스트·구현이 정합성 있게 같이 변경된 것이 인상적이다. 특히 `planPersisted` 플래그 도입으로 plan 중복 저장을 방지하는 로직과, `applyAutoResumeEvent`를 독립 함수로 분리해 테스트 가능성을 확보한 점이 긍정적이다. 다만 `STALL_MAX_ATTEMPTS` 상수 중복(백엔드 `MAX_STALL_ROUNDS`와 수동 동기화), 동일한 `resumeMeta` literal object가 서비스 코드 3곳에 반복되는 구조, 테스트의 `persistCalls` 필터 블록 3중복이 향후 `MAX_STALL_ROUNDS` 조정 시 일관성 오류의 온상이 될 수 있다. `reason` 리터럴 타입의 멀티 파일 분산도 새 복구 경로 추가 시 누락 위험을 내포한다. 이 중 서비스 코드의 `resumeMeta` 중복은 간단한 헬퍼 추출로 즉시 해소 가능하다.

### 위험도

**LOW**