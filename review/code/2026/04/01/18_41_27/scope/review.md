### 발견사항

- **[INFO]** REST 엔드포인트와 WebSocket 핸들러 중복 구현
  - 위치: `executions.controller.ts:38-48`, `websocket.gateway.ts:156-178`
  - 상세: `POST /executions/:id/continue` REST 엔드포인트와 `execution.submit_form` WebSocket 핸들러가 동일한 `continueExecution()` 로직을 중복 제공. spec §9 API 목록에 해당 엔드포인트가 명시되어 있다면 의도된 것이나, 두 경로 모두 필요한지 확인 필요.
  - 제안: spec에 REST 엔드포인트가 명시되어 있지 않다면 WebSocket 경로만 유지

- **[INFO]** `addNodeResult` 동작 변경 (deduplication)
  - 위치: `execution-store.ts:79-93`
  - 상세: 기존에는 동일 `nodeId`가 들어오면 배열에 추가했으나, 이번 변경으로 덮어쓰기 방식으로 변경됨. 폴링 중복 방지 목적이지만, 기존 동작에 의존하던 다른 코드가 있을 경우 사이드 이펙트 가능성 있음.
  - 제안: 변경 이유(폴링 중복 방지)를 간단한 인라인 주석으로 명시 (이미 존재하나 테스트에서도 명확히 드러남)

- **[INFO]** `run-results-drawer.tsx` 대규모 UI 리팩토링
  - 위치: 파일 전체 (+442줄)
  - 상세: 탭 기반 UI → 채팅형 히스토리 UI로의 전면 재작성. spec `§10`이 동일하게 업데이트되었으므로 의도된 변경이나, 기능 추가(Form 블로킹) + 설계 변경(UI 패러다임)이 하나의 커밋에 혼재됨.
  - 제안: 범위 자체는 spec 변경과 일치하므로 허용 가능

- **[INFO]** 제거된 주석 (의미 있는 컨텍스트 포함)
  - 위치: `use-execution-events.ts` 폴링 관련 주석 2곳 제거
  - 상세: `"Note: 'cancelled' maps to 'failed' in the UI store..."` 등 의도를 설명하던 주석이 제거됨. 기능 변경으로 인해 구 주석이 부정확해진 것은 맞으나, 대체 설명 없이 제거만 됨.
  - 제안: 변경된 동작(cancelled 상태가 이제 별도 처리됨)에 대한 짧은 설명 추가 고려

- **[INFO]** `handleNodeCompleted` 분리로 인한 `handleNodeEvent` 부분 미활용
  - 위치: `use-execution-events.ts:123-158`
  - 상세: `handleNodeEvent` 팩토리 함수가 `"running"`, `"failed"`, `"skipped"` 세 케이스만 처리하도록 축소됨. `"completed"`만 별도 로직(`handleNodeCompleted`)으로 분리된 것은 기능상 필요하나, 팩토리 함수의 존재 의미가 약화됨. 향후 유지보수 혼선 가능.
  - 제안: 현 상태로 유지 가능하나, 팩토리 함수가 `"completed"` 제외 용도임을 주석으로 명시

---

### 요약

전체 변경사항은 **Form 노드 블로킹 + 채팅형 히스토리 UI**라는 명확한 기능 목표에 부합하며, spec 문서도 동일하게 갱신되어 의도된 범위 내에 있다. 백엔드의 `forwardRef` 순환 의존성 해결, 상태 관리 확장, WebSocket 이벤트 추가, UI 재설계까지 일관된 방향으로 구현되었다. 다만 REST 엔드포인트 중복, `addNodeResult` 동작 변경, UI 리팩토링과 기능 추가의 혼재가 단일 변경 세트에 포함된 점은 범위 관리 관점에서 주의 사항으로 기록할 만하다. Critical/High 수준의 범위 이탈은 없음.

### 위험도
**LOW**