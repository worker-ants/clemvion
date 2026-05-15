### 발견사항

- **[CRITICAL]** `send-email.handler.ts` — 에러 코드 ternary가 항상 같은 값 반환
  - 위치: `send-email.handler.ts` catch 블록 `const code = ...` 부분
  - 상세: `err instanceof IntegrationError ? 'EMAIL_SEND_FAILED' : 'EMAIL_SEND_FAILED'` — 분기 양쪽이 동일한 값. `IntegrationError` 의 경우 원래 `err.code`(예: `INTEGRATION_NOT_CONNECTED`, `INTEGRATION_TYPE_MISMATCH`)를 보존해야 하는데 모두 `EMAIL_SEND_FAILED`로 덮어씌움. 모니터링/알림 시스템이 기존 코드 값으로 필터링 중이라면 무음 회귀 발생.
  - 제안: `const code = err instanceof IntegrationError ? err.code : 'EMAIL_SEND_FAILED'` 또는 CONVENTIONS §3.2 의도대로 IntegrationError 코드를 `output.error.code`에 직접 노출

- **[WARNING]** 컨테이너 `done` 포트 출력 shape 변경 — 배열 → 객체 (Breaking)
  - 위치: `execution-engine.service.spec.ts` diff (ForEach: `{ items, count }`, Loop: `{ iterations, count }`, Map: `{ mapped, count }`)
  - 상세: 이전에 `done` 포트로 raw 배열을 받던 다운스트림 노드들(`$node["X"].output[0]` 등 직접 인덱스 접근)은 이제 `$node["X"].output.items[0]`으로 경로를 변경해야 함. 마이그레이션 스크립트(`migrate-node-output-refs.ts`)가 존재하나, 이미 실행된 워크플로우의 저장된 expression 참조는 자동 변환 범위 밖일 수 있음.
  - 제안: 마이그레이션 스크립트의 커버리지 확인 및 실행 이력(run history)의 기존 output 참조 처리 방안 문서화 필요

- **[WARNING]** `$node["X"].output.extracted` → `$node["X"].output.result.extracted` 경로 변경
  - 위치: `information-extractor.schema.ts`, `node-output-schema-enrichers.ts`, 문서 파일들
  - 상세: Information Extractor를 참조하는 기존 워크플로우 expression이 즉시 깨짐. 프론트엔드 `output-shape.ts`에 레거시 fallback(`output.extracted`)이 추가되었으나 이는 UI 렌더링 용도이고, expression resolver에서의 런타임 평가 경로가 별도로 하위호환 처리되었는지 불명확.
  - 제안: `expression-resolver.service.ts` 레벨에서도 `output.result.extracted` → `output.extracted` 레거시 fallback 필요 여부 명시적으로 검증

- **[WARNING]** 에러 코드 rename — 외부 관찰 가능성 계약 파손
  - 위치: `database-query.handler.ts` (`QUERY_FAILED` → `DB_QUERY_FAILED`), `send-email.handler.ts` (`SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED`)
  - 상세: 에러 코드를 Grafana, Slack 알림, 외부 로그 파이프라인에서 문자열 매칭으로 구독 중인 경우 무음 중단. 이는 HTTP status code 변경과 동급의 외부 계약 파손.
  - 제안: 에러 코드 변경 이력을 CHANGELOG 또는 마이그레이션 가이드에 명시

- **[WARNING]** `handler-output.adapter.ts` — 레거시 `{ port, data }` port-selector envelope 제거
  - 위치: `adaptHandlerReturn` 함수에서 `isLegacyPortSelector` 브랜치 삭제
  - 상세: 아직 마이그레이션되지 않은 핸들러나 외부 플러그인이 `{ port: 'out', data: {...} }` 형식으로 반환하면 이제 `bare object` 브랜치로 fallthrough되어 `data`가 `output`이 아닌 raw object 자체가 `output`이 됨. 동작 오류를 유발하는 조용한 regression.
  - 제안: 제거 전 코드베이스 전체에서 `{ port, data }` 패턴 사용 핸들러 없음을 grep으로 확인 필요

- **[INFO]** `NodeHandlerOutput`에 `_resumeState` 추가 — 인터페이스 확장
  - 위치: `node-handler.interface.ts`
  - 상세: `_resumeState`는 engine-internal 필드로 적절히 문서화됨. expression resolver 및 UI autocomplete에서 노출 차단도 의도적으로 처리됨. Breaking 없음.

- **[INFO]** `workflow.handler.ts` — 예외 throw → `error` 포트 라우팅
  - 위치: `WorkflowHandler.execute` async/sync 브랜치
  - 상세: 이전에 throw하던 에러를 이제 `{ port: 'error', output.error }` 형식으로 반환. 이 핸들러의 호출자가 try/catch로 에러를 처리하던 경우 로직 변경 필요. 단, 새로운 `error` 포트가 `workflowNodePorts`에 추가되어 schema 수준에서는 일관성 있음.

---

### 요약

이 변경은 내부 노드 출력 계약(node output contract)을 `{ config, output: { result|error }, meta, port, status }` 단일 표준으로 통일하는 대규모 리팩토링으로, REST HTTP API 계약보다는 워크플로우 엔진의 내부 데이터 계약에 해당합니다. 하위 호환성 측면에서 가장 큰 위험은 세 가지입니다: ① `send-email` 핸들러의 에러 코드 ternary 버그(IntegrationError 코드 유실), ② 컨테이너 `done` 포트 출력이 배열에서 `{items/iterations/mapped, count}` 객체로 바뀌어 기존 expression이 파손되는 것, ③ 레거시 `{ port, data }` 어댑터 제거로 인한 잠재적 silent regression. 프론트엔드에 레거시 fallback이 다수 추가된 것은 긍정적이나, expression resolver 레벨의 런타임 평가 경로에도 동일한 fallback이 적용되는지 확인이 필요합니다.

### 위험도
**HIGH**