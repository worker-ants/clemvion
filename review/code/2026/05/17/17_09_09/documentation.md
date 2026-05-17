# 문서화(Documentation) 리뷰 결과

## 발견사항

---

### SQL 마이그레이션 파일 (V055, V056)

- **[INFO]** V055/V056 SQL 파일 내 주석은 컬럼 목적, spec 참조, 실행 전략을 충실히 기술하고 있으며 `COMMENT ON COLUMN`도 작성되어 있음
  - 위치: `backend/migrations/V055__notification_dismissed_at_add.sql`, `backend/migrations/V056__notification_active_partial_index.sql`
  - 상세: spec 참조(`spec/data-flow/8-notifications.md §2.1, §4`, `spec/1-data-model.md §2.19`)가 명시되어 있고, 비-트랜잭션 이유와 실행 순서까지 인라인 주석으로 설명됨. 문서화 품질이 높음.
  - 제안: 특별한 조치 불필요. 양호.

- **[INFO]** V056 `.conf` 파일(`executeInTransaction=false`)에 해당 설정의 이유를 설명하는 주석이 없음
  - 위치: `backend/migrations/V056__notification_active_partial_index.conf`
  - 상세: `.conf` 파일 자체는 단 한 줄(`executeInTransaction=false`)만 포함. 이유는 인접한 `.sql` 파일에 설명되어 있어 별도 주석 생략이 이해될 수 있으나, `.conf` 파일을 단독으로 볼 때 의도를 알기 어려움.
  - 제안: `.conf` 파일 상단에 `# CREATE INDEX CONCURRENTLY 는 트랜잭션 block 안에서 실행 불가 — V056__.sql 참조` 한 줄 주석 추가를 권장.

---

### `workflow-errors.ts` 삭제

- **[WARNING]** `WorkflowNotFoundError` / `SubWorkflowTimeoutError` 타입 에러 클래스 삭제 후 인라인 `new Error(...)` 로 대체됨. 이 파일에 있던 JSDoc이 제거되면서 에러 분류 설계 근거가 코드베이스에서 사라짐
  - 위치: `backend/src/modules/execution-engine/workflow-errors.ts` (삭제)
  - 상세: 삭제된 파일의 JSDoc은 "타입 에러 도입 배경(W-17)", "메시지 포맷 보존 이유", "핸들러가 instanceof 로 분기해야 하는 이유"를 명시하고 있었음. 이 설계 근거가 어떤 문서에도 이전되지 않은 채 삭제됨. 현재 `execution-engine.service.ts`의 throw 사이트에는 이 맥락이 없음. 나중에 누군가 에러 분기를 추가하거나 핸들러(workflow.handler.ts)를 수정할 때 문자열 매칭 회귀 위험성을 인식하지 못할 수 있음.
  - 제안: `execution-engine.service.ts`의 Workflow not found throw 사이트들 중 최소 하나 또는 `executeSync` 메서드 JSDoc에, "핸들러(workflow.handler.ts)는 에러 메시지 문자열 매칭으로 분기하므로 이 메시지 형식(`Workflow not found: ${id}`)을 변경하지 말 것"이라는 인라인 주석을 추가할 것. 또는 spec 문서(`spec/5-system/4-execution-engine.md`)의 에러 정책 섹션에 이 결정을 기록할 것.

---

### `execution-engine.service.ts` — `buildConversationConfigFromOutput` JSDoc 단축

- **[WARNING]** `buildConversationConfigFromOutput` 함수의 JSDoc에서 D6 변경 관련 설명 블록이 삭제됨. 이 함수가 `output.result.*` 경로에서 `output.*` top-level 경로로 전환된 이유가 JSDoc에 더 이상 남아있지 않음
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` 라인 ~294–298 (diff 기준)
  - 상세: 삭제된 D6 주석 블록은 "multi-turn 의 message/messages/turnCount/maxTurns 가 `output.result.*` 로 통일됐다가 다시 top-level `output.*` 로 되돌아간" 이력과 이유를 기술. 현재 JSDoc은 "system messages are filtered out, source marker 보장"만 언급하고 output 구조 이유는 없음. 핸들러가 `output` 최상위에 필드를 놓아야 한다는 contract 를 새 기여자가 인식하지 못할 수 있음.
  - 제안: 현재 JSDoc에 `output` shape에 대한 한 줄 설명 추가: `* output` 인자는 핸들러가 직접 반환하는 최상위 shape 을 기대함 (`message`, `messages`, `turnCount`, `maxTurns` 가 top-level). `spec/4-nodes/3-ai/1-ai-agent.md §7` 참조.

---

### `buildConversationConfigFromOutput` describe 블록 주석 삭제

- **[WARNING]** 테스트 파일의 `describe('buildConversationConfigFromOutput')` 상단에 있던 D6 변환 설명 주석(4줄)이 제거됨. `it('ignores legacy top-level ...')` 회귀 방지 테스트도 함께 삭제됨
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.spec.ts` 라인 ~6126–6131 (diff 기준)
  - 상세: 삭제된 주석은 "D6 이전 top-level output.message/messages/turnCount/maxTurns 는 폐기됐고, partial.* 만 top-level 유지"라는 컨텍스트를 제공했음. 이와 함께 "D6 회귀 차단" 테스트 케이스도 제거됨. 이 변환이 다시 D6 이전 구조로 되돌아갔다면(현재 diff의 의도), 삭제는 맞지만 왜 롤백됐는지에 대한 설명이 코드 어디에도 없음.
  - 제안: `describe('buildConversationConfigFromOutput')` 블록 상단에 현재 contract를 설명하는 짧은 주석 추가: `// output 인자는 핸들러 반환값의 최상위 shape. message/messages/turnCount/maxTurns 가 top-level. partial.* 는 info-extractor 전용.`

---

### 테스트 mock surface 동기화 주석

- **[INFO]** dismiss/dismissAll mock 추가에 대한 인라인 주석이 짧지만 spec 참조를 포함하고 있어 이해 가능
  - 위치: `backend/src/modules/alerts/alerts-evaluator.service.spec.ts` 라인 ~185–187, `backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts` 라인 ~68–71
  - 상세: `// dismiss 도입 (spec/data-flow/8-notifications.md §4) — surface 동기화.` 형태로 기재. 충분함.
  - 제안: 특별한 조치 불필요. 양호.

---

### `integration-action-required-notifier.service.ts` 타입 캐스팅 변경

- **[INFO]** channel 타입 캐스팅에 `'email'` 유니온 추가. 기존 JSDoc 내용과 불일치는 없으나 왜 `email` 이 추가됐는지 설명이 없음
  - 위치: `backend/src/modules/integrations/integration-action-required-notifier.service.ts` 라인 ~78–83
  - 상세: `'both' | 'in_app'` 캐스팅에 `'email'` 을 추가한 이유(예: 타입 정의 확장, 다운스트림 서비스 변경 반영)가 코드에 기술되어 있지 않음. 실제로 `wantsEmail ? 'both' : 'in_app'` 로직은 변경되지 않아 `'email'` 유니온 멤버는 런타임에 실제로 생성되지 않음. 타입 보폭과 실제 로직이 일치하지 않아 혼란 가능성이 있음.
  - 제안: 캐스팅 옆에 짧은 주석으로 이유를 설명할 것: `// 타입 정의가 'email' 도 허용하도록 확장됨 — 실제 로직은 'both' | 'in_app' 만 생성.`

---

### `integration-oauth.service.cafe24.spec.ts` — 대형 테스트 블록 삭제

- **[WARNING]** `cafe24 token exchange parses expires_at ISO string into tokenExpiresAt`와 `falls back to 2h default when neither expires_in nor expires_at present` 두 개의 회귀 방지 테스트와 그 JSDoc이 삭제됨
  - 위치: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` 라인 ~1615–1703 (diff 기준)
  - 상세: 삭제된 테스트들은 Cafe24 토큰 만료 처리(`expires_at` ISO 파싱, 2h fallback) 의 회귀를 방지하는 목적으로 작성됐으며, 상세한 JSDoc 주석("2026-05-17 회귀 보호")을 포함하고 있었음. 이 테스트들이 삭제된 이유(구현 변경, 다른 테스트로 커버 등)가 diff에 기술되지 않아 문서화 공백이 발생함.
  - 제안: 해당 기능이 여전히 구현 코드에 존재한다면 테스트 삭제 이유를 근처 남아있는 테스트의 주석 또는 PR 설명에 명시할 것. "해당 로직이 다른 파일의 테스트로 이전됐다"거나 "로직 자체가 제거됐다"는 컨텍스트가 없으면 향후 회귀를 감지하기 어려움.

---

### README 및 CHANGELOG

- **[INFO]** 이번 변경에는 새로운 환경변수, API 엔드포인트, 또는 사용자 대상 기능이 추가되지 않음. `dismissed_at` 컬럼 추가는 내부 구현이며 README 업데이트는 현재 단계에서 불필요함
  - 위치: 해당 없음
  - 상세: spec 문서(`spec/data-flow/8-notifications.md`, `spec/1-data-model.md`)에 이미 반영 예정으로 추정됨.
  - 제안: spec 문서 업데이트 완료 여부 확인 권장 (이번 리뷰 범위 외).

---

## 요약

전반적으로 SQL 마이그레이션 파일과 mock surface 변경의 인라인 문서화는 양호한 수준이다. 주요 문서화 공백은 두 가지다. 첫째, `workflow-errors.ts` 삭제로 인해 에러 분류 설계 근거(W-17 맥락, 문자열 포맷 보존 이유)가 코드베이스에서 완전히 소멸됐다. 이 맥락은 `execution-engine.service.ts`의 throw 사이트나 spec에 최소한의 형태로 이전돼야 한다. 둘째, D6→롤백 관련 `buildConversationConfigFromOutput` 계약 변경에 대한 설명이 구현 파일과 테스트 파일 양쪽에서 제거됐는데, 현재 output shape 계약을 새 기여자가 독립적으로 이해하기 어렵다. `integration-oauth.service.cafe24.spec.ts`에서 삭제된 대형 회귀 방지 테스트 블록에 대한 삭제 이유도 기록되지 않아 잠재적인 문서화 공백이 있다.

## 위험도

MEDIUM
