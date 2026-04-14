## 발견사항

### WebSocket 이벤트 페이로드 파괴적 변경

- **[WARNING]** `execution.waiting_for_input` 이벤트에서 `turnTimeout` 필드 제거
  - 위치: `spec/5-system/6-websocket-protocol.md`, `use-execution-events.ts`
  - 상세: `convConfig` 페이로드에서 `turnTimeout` 필드가 제거됨. AI Agent/InformationExtractor의 multi-turn 대기 이벤트를 구독하던 외부/내부 클라이언트가 이 필드를 참조하고 있었다면 breaking change.
  - 제안: WebSocket 이벤트에 버전 네고시에이션이 없다면, deprecated 필드로 잠시 유지하거나 마이그레이션 가이드를 제공해야 함.

- **[WARNING]** `buttonConfig` 페이로드에서 `buttonTimeout`, `buttonTimeoutAction` 제거
  - 위치: `button.types.ts`, `carousel.handler.ts`, `chart.handler.ts`, `table.handler.ts`, `template.handler.ts`
  - 상세: `buttonConfig` 응답 객체에서 두 필드가 제거됨. 이 필드를 읽어 UI 카운트다운을 렌더링하던 클라이언트(프론트엔드 이외)가 있다면 동작 불일치 발생.
  - 제안: 프론트엔드와 백엔드가 동일 레포에서 동시 변경되어 일관성은 확보되었으나, 외부 WebSocket 클라이언트(예: 모바일 앱, 임베드된 뷰어 등)가 존재한다면 별도 공지 필요.

### 타입 계약 파괴적 변경

- **[WARNING]** `ButtonInteractionData.interactionType`에서 `'button_timeout'` 유니온 타입 제거
  - 위치: `button.types.ts:20`, `execution-engine.service.ts` `INTERACTION_STATUSES`
  - 상세: DB에 이미 저장된 `NodeExecution.interaction_data`에 `interactionType: 'button_timeout'`인 레코드가 존재할 수 있음. 엔진의 `INTERACTION_STATUSES` 화이트리스트에서 제거되어 런타임 처리 시 `'button_continue'`로 폴백되는데, 이는 **의미론적 데이터 왜곡**임 (취소된 실행이 "계속됨"으로 표시될 수 있음). 또한 이력 실행 화면에서 `timeout`으로 종료된 노드가 올바른 상태로 표시되지 않을 수 있음.
  - 제안: DB 마이그레이션 스크립트 또는 히스토리 데이터 조회 시 `button_timeout` → 명시적 표시 처리 필요. 최소한 주석으로 레거시 값 처리 의도를 명시해야 함.

### 검증 계약 변경 (하위 호환 방향)

- **[INFO]** `WorkflowHandler` 및 `MergeConfig` timeout 검증: `> 0` → `>= 0` (0 허용)
  - 위치: `workflow.handler.ts:36`, `logic-configs.tsx:532`
  - 상세: 기존에 validation error를 받던 `timeout: 0` 설정이 이제 유효해짐. 기존 유효 설정(`timeout > 0`)에는 영향 없음 → **backward compatible**. 에러 메시지도 `'timeout must be a positive number'` → `'timeout must be a non-negative number (0 = no timeout)'`으로 변경되어 사용성 개선.
  - 제안: 변경 없음. 적절한 처리.

### 노드 설정 필드 묵시적 무시

- **[INFO]** `buttonTimeout`, `buttonTimeoutAction`, `turnTimeout` 설정 필드가 이제 검증 없이 무시됨
  - 위치: `button.types.ts` `validateButtons()`, `ai-agent.handler.ts`, `information-extractor.handler.ts`
  - 상세: 기존에 이 필드들을 설정한 노드 설정이 DB에 저장되어 있다면, 이제 에러 없이 묵시적으로 무시됨. UI에서 설정 항목 자체가 제거되었으므로 신규 저장은 발생하지 않으나, 기존 저장된 config는 조용히 버려짐.
  - 제안: 실행 로직에는 영향이 없으므로 기능 리스크는 낮음. 하지만 사용자가 이전에 설정한 값이 사라졌음을 인지하지 못할 수 있으므로, 마이그레이션 안내 메시지 또는 기존 config 정리 스크립트가 있으면 더 명확함.

### 예약 포트 ID 목록 변경

- **[INFO]** AI Agent 조건의 예약 포트 ID에서 `timeout` 제거
  - 위치: `spec/4-nodes/3-ai-nodes.md`
  - 상세: 예약된 포트 ID 목록에서 `timeout`이 삭제됨. 기존에 조건 ID로 `timeout`을 사용할 수 없었으나, 이제는 사용 가능해짐. DB에 저장된 기존 워크플로우에서 `timeout`이라는 condition ID를 이미 쓰고 있었다면 (이전에는 불가능했으나) 혼란이 없음.
  - 제안: 단방향 완화이므로 호환성 문제 없음.

---

## 요약

이번 변경은 timeout 기반 자동 처리 기능 전체를 제거하고, 모든 사용자 인터랙션 대기를 "외부 cancel 전까지 무제한 대기"로 단순화하는 의도적 설계 결정이다. 프론트엔드·백엔드·스펙 모두 일관되게 수정되어 내부 API 계약의 일관성은 잘 유지되어 있다. 그러나 이미 DB에 저장된 `interactionType: 'button_timeout'` 히스토리 데이터가 `button_continue`로 폴백 처리되는 부분은 **데이터 의미론적 정합성 문제**를 일으킬 수 있으며, WebSocket 이벤트에서 `turnTimeout`·`buttonTimeout`·`buttonTimeoutAction` 필드가 제거된 것은 동일 레포 외부 클라이언트가 없다는 전제 하에서만 안전하다. 외부 WebSocket 구독자가 존재한다면 breaking change 고지가 필요하다.

## 위험도

**MEDIUM**