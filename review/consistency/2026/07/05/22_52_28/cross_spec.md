### 발견사항

없음.

target(`spec/4-nodes/4-integration/1-http-request.md` §6/§8.3, `2-database-query.md` Rationale 갱신, `spec/2-navigation/4-integration.md` §10.4 각주 갱신)은 PR #814 범위 — HTTP Request 의 SSRF 차단(`HTTP_BLOCKED`) `output.error.message` 를 host/IP 미노출 일반화 문구(`Request blocked by SSRF policy.`)로 통일하고, redirect 대상/한도초과 SSRF 도 동일 코드로 라우팅하는 변경이다. 다음을 교차 검증했다.

- **데이터 모델**: `spec/1-data-model.md` §2.10.1 `IntegrationUsageLog.error` 는 `{code, message}` 자유 형식 요약으로만 정의되어 있어 "일반화된 메시지를 저장" 결정과 모순 없음. Integration 엔티티(§2.10)·`status_reason` 어휘에도 영향 없음.
- **API 계약**: `spec/5-system/2-api-convention.md` 변경분은 이번 diff 에 포함된 별개의 앵커 오타 수정(`datitems`→`dataitems`, #809 잔재)이며 본 PR 의 SSRF 주제와 무관 — 새로운 API 계약 변경 없음.
- **요구사항 ID**: 새 코드 `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED` 는 모두 기존에 이미 존재하던 코드명 재사용(메시지 내용만 변경), 신규 ID 충돌 없음.
- **상태 전이**: Integration/Execution 등 엔티티 상태 머신에 영향 없음(에러 메시지 텍스트·라우팅 분류 정정에 국한).
- **RBAC**: 변경 없음. `GET /integrations/:id/activity` 의 workspace 노출 범위·권한은 그대로이며, 오히려 그 응답에 실리는 메시지의 정찰 정보량만 축소되어 기존 노출 정책과 더 정합해짐.
- **계층 책임**: `logger.warn`(서버 전용) vs `IntegrationUsageLog`(workspace 노출) 의 책임 분리가 §8.3 Rationale 에 명확히 기술되어 있고, HTTP/DB/Email 3-node 가 동일 메커니즘·동일 opt-out 플래그(`ALLOW_PRIVATE_HOST_TARGETS`)를 공유한다는 기존 결정과 대칭적으로 일치. `spec/conventions/chat-channel-adapter.md` §3.1 의 `HTTP_BLOCKED` → `executionFailedInternal` 매핑(payload `{}`, 메시지 자체를 채널에 노출하지 않음)도 이번 메시지 변경과 충돌하지 않음(오히려 사전에 이미 안전).

코드(`http-request.handler.ts` 의 `SSRF_BLOCKED_CLIENT_MESSAGE` 상수)와 spec §8.3/§6 표의 문구·라우팅 서술이 정확히 일치함을 워킹트리에서 직접 확인했다. `2-database-query.md` Rationale 은 "HTTP 도 2026-07-05 동일 일반화 완료"로 정정되어 이전 follow-up 예고와 현재 상태가 어긋나지 않는다.

### 요약
target 변경은 기존 DB Query(`DB_HOST_BLOCKED`)·Send Email(`EMAIL_HOST_BLOCKED`) 이 이미 채택한 host/IP 비노출 메시지 정책을 HTTP Request 에 대칭 적용하고, redirect SSRF 오분류를 기존 §4.2/§6 계약에 맞게 정정한 것으로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 영역에서도 다른 spec 영역과의 모순이 발견되지 않았다. 관련 문서(`0-common.md`, `1-http-request.md`, `2-database-query.md`, `2-navigation/4-integration.md`, `1-data-model.md`, `conventions/chat-channel-adapter.md`)간 상호 참조도 정합적으로 갱신되어 있다.

### 위험도
NONE
