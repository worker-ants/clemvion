# Cross-Spec 일관성 검토 — `spec/2-navigation/` (--impl-prep)

검토 방식: 번들에 실린 3개 전문 파일(`1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md`)과
`0-overview.md`를 기준으로, 그 안에서 다른 영역(`spec/1-data-model.md` · `spec/5-system/*` ·
`spec/4-nodes/*` · `spec/data-flow/*` · `spec/conventions/*`)을 향해 만들어지는 구체적 주장(엔티티 필드,
API 코드, RBAC, cascade 순서 등)을 실제 대상 spec 파일에서 직접 `Read`로 대조했다 (번들에서 컨텍스트
예산으로 절단된 나머지 15개 navigation 파일 중 `4-integration.md`는 이번 plan(`connection-test-codes-and-gaps`)이
건드리는 `modules/integrations/**`와 직결되어 직접 열어 확인했고, 그 외 절단분은 이번 대조 대상에서 제외했다).

## 발견사항

- **[WARNING]** `4-integration.md` §5.3 HTTP 연결 테스트의 "결과:" 목록이 실제로 반환 가능한 코드 두 개를 누락
  - target 위치: `spec/2-navigation/4-integration.md` §5.3 (HTTP/REST), "결과:" 불릿 목록 및 §14.1 에러 코드 vocabulary 표
  - 충돌 대상: `spec/4-nodes/4-integration/1-http-request.md` §4/§9 (`INTEGRATION_INCOMPLETE` / `INTEGRATION_AUTH_UNSUPPORTED`), 실코드 `codebase/backend/src/nodes/integration/http-request/http-credentials.ts` (`resolveHttpCredentials`), `codebase/backend/src/modules/integrations/http-connection-tester.ts:91-93`
  - 상세: §5.3 본문은 "HTTP Request 노드와 **같은 방식으로 자격증명을 붙여**"라고 명시하며 `1-http-request.md §4`를 직접 인용하는데, 정작 그 공유 함수(`resolveHttpCredentials`)가 자격증명 필드 누락·미지원 `auth_type`일 때 내는 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED`는 §5.3의 "결과:" 목록(`HTTP_AUTH_FAILED`/`HTTP_SERVER_ERROR`/`HTTP_BLOCKED`/`HTTP_CONNECT_FAILED`/`success:true`)에 없다. §14.1 vocabulary 표에도 이 두 코드가 HTTP 연결 테스트의 `IntegrationTestResult.code`로 나갈 수 있다는 언급이 없다(반면 `DB_HOST_BLOCKED`/`HTTP_BLOCKED`/`EMAIL_HOST_BLOCKED` 행은 "노드는 … / 연결 테스트는 `result.code` 반환" 식으로 이중 소비처를 명시한다). 즉 4-integration.md가 스스로 인용한 다른 영역 문서(1-http-request.md)가 정의하는 실패 모드를, 자신의 연결 테스트 API 계약 목록에는 반영하지 않은 상태다.
  - 참고: 지금 착수하려는 plan(`connection-test-codes-and-gaps.md`)의 실측 표는 `git grep` 기반 코드 조사로 이 두 값을 이미 정확히 찾아 `ConnectionTestResultCode` union에 포함할 예정이라 **구현 결과 자체가 이 갭 때문에 틀릴 위험은 낮다**. 다만 spec만 보고 union을 검증하려는 다음 사람은 §5.3만 읽고 이 두 값을 놓칠 수 있다.
  - 제안: `4-integration.md` §5.3의 "결과:" 목록 끝에 "자격증명 필드 누락/미지원 `auth_type`이면 `resolveHttpCredentials`가 먼저 `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED`로 거부한다(1-http-request.md와 공유 경로)" 한 줄과, §14.1 표의 `INTEGRATION_INCOMPLETE`/그 인접 행에 "HTTP 연결 테스트에서도 `result.code`로 반환됨" 주석을 추가. 이번 plan 자체는 `spec_impact: none`이라 spec 수정 의무는 없지만, 이 WARNING은 developer가 아니라 별도 planner 턴(spec 정합 정비)으로 넘길 항목으로 기록해 둘 가치가 있다.

## 대조 후 이상 없음으로 확인된 항목 (참고용, 재검토 불요)

- `WebhookEndpointReservation`(트리거 목록 §2.3.1/§3) ↔ `spec/1-data-model.md §2.8.1` — 409 코드·필드·소유권 승계 규칙 완전 일치.
- Auth Config Admin+ 게이팅(트리거 목록 §2.3.1 "+ 새 인증 설정 만들기") ↔ `spec/5-system/1-auth.md §3.2` RBAC 매트릭스(Auth Config: Owner/Admin=CRUD, Editor/Viewer=R) ↔ `spec/2-navigation/6-config.md §A 권한` — 세 지점 모두 일치. `authConfigId` 바인딩 자체는 Trigger CRUD(Editor+)에 속하므로 AuthConfig 자원 권한과 상충하지 않음.
- Chat Channel `provider` enum(트리거 목록 §2.3.1/§R-12: telegram/slack/discord) ↔ `spec/4-nodes/7-trigger/providers/_overview.md §1` — 일치.
- `secret-store.md §1.1` 인용(트리거 목록 §2.3.1 botToken 마스킹 미적용 근거) — 실재 섹션 확인, AuthConfig `***<last4>` 예외 범위와 상충 없음.
- Schedule ↔ Trigger 동기화(3-schedule.md §3, 트리거 목록 §4.3) ↔ `spec/data-flow/10-triggers.md §1.4` — 이벤트별 방향·순서·BullMQ job 해제 시점 전부 일치.
- Folder cascade(워크플로우 목록 §3.1: 하위 폴더 cascade, 워크플로우는 SET NULL) ↔ `spec/1-data-model.md §2.5 Folder` + `Workflow.folder_id` FK 정의 — 일치.
- Cafe24/MakeShop 연결 테스트 코드(`CAFE24_AUTH_FAILED`/`CAFE24_TRANSPORT_FAILED`/`CAFE24_INSUFFICIENT_SCOPE`)가 노드 런타임 vocabulary(`4-cafe24.md §6`)와 일부 이름을 공유하는 것은 §5.8 Rationale이 "동일 패턴" 재사용으로 명시적으로 채택한 설계이며, DB/HTTP/Email이 채택한 "연결 테스트 전용 별개 namespace" 원칙과는 다른 축이지만 각자 자기 영역 안에서 스스로 문서화돼 있어 모순은 아님 — 위 WARNING과 별개로 CRITICAL 요소 없음.

## 요약

`spec/2-navigation/`의 트리거·워크플로우·스케줄 3개 문서는 데이터 모델·인증·data-flow 등 인접 영역과의 참조가 매우 촘촘하고 실제 대조 결과 전부 일치했다 — 최근 병합된 webhook endpoint 영구 예약 기능(§2.8.1)까지 포함해 CRITICAL급 모순은 발견되지 않았다. 유일한 발견은 이번 plan이 손댈 `modules/integrations`와 직결된 `4-integration.md` §5.3의 HTTP 연결 테스트 결과 코드 목록이, 자신이 인용하는 `1-http-request.md`의 공유 자격증명 해석 실패 코드 두 개를 누락한 API-계약 완결성 갭(WARNING)이며, 이는 이번 plan의 구현 정확성 자체를 위협하지 않는다(plan이 코드 실측으로 이미 정확히 찾아냈음) — 별도 spec 정비 턴에서 반영을 권고한다.

## 위험도

LOW
