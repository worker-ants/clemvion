### 발견사항

- **[WARNING]** `pending_install` 상태의 노드 실행 실패 코드 — `INTEGRATION_NOT_CONNECTED` vs `INTEGRATION_INCOMPLETE` 표기 불일치
  - target 위치: `spec/2-navigation/4-integration.md` §4.6 (line 380, 신규 배너 스펙 서술) 및 이를 그대로 옮긴 신규 코드 주석 `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/activity-disconnected-banner.tsx:156-160` — "직결 노드는 `INTEGRATION_NOT_CONNECTED` 로 즉시 실패한다"
  - 충돌 대상: 같은 문서 `spec/2-navigation/4-integration.md` §6 상태 전이 (line 726) — "`pending_install` 은 노드·AI Agent 에서 사용할 수 없다 (`INTEGRATION_INCOMPLETE` — §4.2)"
  - 상세: 같은 문서 안에서 `pending_install` Integration 을 노드가 참조했을 때의 실패 코드가 두 곳에서 다르게 서술된다. 실제 코드 검증 결과 §4.6 (및 신규 배너 주석) 쪽이 정확하다 — `IntegrationHandlerBase.resolveIntegration()` (`codebase/backend/src/nodes/integration/_base/integration-handler-base.ts:71-78`) 은 `status !== 'connected'` 이면 상태 무관하게 `INTEGRATION_NOT_CONNECTED` 를 throw하며, HTTP/DB/Email 뿐 아니라 cafe24·makeshop 핸들러도 동일 `resolveIntegration` 을 거친다 (`cafe24.handler.ts:224`, `makeshop.handler.ts:211`). `INTEGRATION_INCOMPLETE` 는 별개 실패 모드 — credentials JSONB 의 필수 필드 누락 시에만 각 핸들러가 개별적으로 throw (`spec/4-nodes/4-integration/0-common.md §4.2`: "`INTEGRATION_NOT_CONNECTED` | Integration 상태가 `connected`가 아님(`expired`, `error`)" 도 `pending_install` 을 명시적으로 누락해 같은 혼선을 공유). §6 line 726 의 "§4.2" 참조도 문서 내부 §4.2("Overview 탭")로 오귀속될 수 있는 bare reference라 실제로는 `4-nodes/4-integration/0-common.md#42` 를 의도한 것으로 보이나, 그 문서조차 `pending_install` 을 `INTEGRATION_NOT_CONNECTED` 범위에서 괄호로 배제하고 있어 세 지점(§4.6 신규/코드, §6, 4-nodes §4.2) 이 서로 어긋난다.
  - 제안: `spec/2-navigation/4-integration.md §6` line 726 의 "`INTEGRATION_INCOMPLETE`" 를 "`INTEGRATION_NOT_CONNECTED`" 로 정정하고, `spec/4-nodes/4-integration/0-common.md §4.2` 표의 `INTEGRATION_NOT_CONNECTED` 설명에서 괄호 안 상태 목록에 `pending_install` 을 추가해 실제 `resolveIntegration` 동작과 일치시킨다. planner 세션에서 두 문서를 함께 갱신 권장 (코드 변경 불요 — 문서만 stale).

### 요약

이번 PR (`spec/2-navigation/4-integration.md §4.6` 이미 명시한 "연결 안 됨" 배너의 구현)은 데이터 모델·API 계약·RBAC·UI 톤 패턴 관점에서 다른 spec 영역과 대체로 정합적이다. `Integration.status` enum(`connected`/`expired`/`error`/`pending_install`, `spec/1-data-model.md §2.10`)과 `IntegrationDto["status"]` 타입이 정확히 일치하고, `0-overview.md §3.4` Inline Alert 패턴(톤 매핑·X버튼 미노출·"현재 사용처" 표에 §4.6 사전 등재)과도 신규 컴포넌트가 문자 그대로 부합하며, RBAC(§8)·API 신규 surface 없음 확인됨. 다만 코드 주석이 §4.6 의 서술을 그대로 인용하면서 §6 상태 전이 절의 오래된 `INTEGRATION_INCOMPLETE` 서술과의 기존 문서 내부 불일치가 코드베이스에도 전파됐다 — 기능적 위험은 없으나(실제 런타임 코드는 §4.6 쪽이 맞음) 문서 정정이 필요하다.

### 위험도
LOW
