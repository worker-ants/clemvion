# Plan 정합성 검토 — spec/4-nodes/4-integration/

검토 모드: --impl-prep (구현 착수 전)

## 발견사항

- **[WARNING] 선행 plan(`http-ssrf-all-auth-followups.md`)의 미완료 항목이 target 범위와 직접 겹침 — payload 에 누락되어 전달됨**
  - target 위치: `spec/4-nodes/4-integration/1-http-request.md` §4 step 8 (SSRF 가드), §5.3/§6 에러 코드 (`HTTP_BLOCKED`)
  - 관련 plan: `plan/in-progress/http-ssrf-all-auth-followups.md` §코드 첫 항목 — "**SSRF 에러 메시지 클라이언트 일반화**: `http-safety.ts` 의 `SSRF_BLOCKED: hostname "..."` 메시지가 차단 host/IP 를 `output.error.message` 로 노출(정찰 면). 클라이언트엔 일반화("Request blocked by SSRF policy"), 상세는 서버 로그 — 단 http-safety 는 HTTP/DB/Email 공용이라 3노드 영향 audit 동반." (미체크, 유일한 미해결 코드 항목)
  - 상세: 본 plan 정합성 검토용 payload(`_prompts/plan_coherence.md`)에 `plan/in-progress/` 하위 6개 문서(ai-agent-tool-connection-rewrite, cafe24-backlog-residual, chat-channel-discord-gateway, chat-channel-slack-socket-mode, chat-channel-visual-ssr-png, competitive-analysis-n8n-flowise)만 포함되고, 실제로는 `plan/in-progress/` 에 존재하는 `http-ssrf-all-auth-followups.md` 와 `spec-sync-integration-common-gaps.md` 는 payload 에서 빠져 있었다(직접 디스크 확인으로 발견). 이 두 plan 은 target 영역(`spec/4-nodes/4-integration/`)에 **가장 직접적으로** 관련된 진행 중 작업이며, worktree 이름(`ssrf-error-generalize`)이 가리키는 작업 의도와 정확히 일치한다. 실제 코드(`codebase/backend/src/nodes/integration/http-request/http-safety.ts:96,100,106,129,146`)를 확인한 결과 `SSRF_BLOCKED: ...` 메시지에 여전히 차단된 hostname/protocol 등 상세가 포함돼 있어 plan 이 지적한 문제가 그대로 남아 있다. 반면 target spec 중 `2-database-query.md`(`DB_HOST_BLOCKED` Rationale, line 375)와 `3-send-email.md` 는 이미 "클라이언트 노출 메시지는 host/IP 를 포함하지 않는 일반화 문구" 를 명문화해 두었는데, `1-http-request.md` §4 step 8 은 여전히 `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 호출만 기술하고 메시지 일반화 여부를 언급하지 않는다 — 즉 spec 자체가 이미 3-node 비대칭 상태다. 이는 이번 구현(ssrf-error-generalize)이 정확히 겨냥해야 할 갭이며, 착수 전 이 plan 문서를 먼저 읽고 그 항목의 범위 설명("http-safety 는 HTTP/DB/Email 공용이라 3노드 영향 audit 동반")을 반영해야 한다.
  - 제안: (1) 구현 착수 전 `plan/in-progress/http-ssrf-all-auth-followups.md` 를 반드시 읽고 해당 체크박스 항목을 작업 범위로 삼을 것. (2) 이번 작업 완료 후 그 plan 파일의 체크박스를 `[x]` 로 갱신하고 완료 사유·PR 번호를 기록할 것(다른 항목들이 이미 그렇게 관리되고 있음 — `[x] ... **(완료, PR ...)**` 패턴). (3) `1-http-request.md` §4 step 8 / §5.3 / §6 에 DB Query·Send Email 과 동일한 "클라이언트 메시지는 host/IP 미포함 일반화 문구, 상세는 활동 로그(`logUsage`)에만 기록" 문구를 대칭 추가해 3-node 비대칭을 해소할 것. (4) 향후 plan 정합성 checker 호출 시 payload 생성 단계에서 `plan/in-progress/` 전체 목록을 빠짐없이 스캔하도록 orchestrator 측 점검 필요 — 이번처럼 대상 영역과 가장 밀접한 plan 이 누락되면 검토 자체가 무력화된다.

- **[INFO] `EMAIL_HOST_BLOCKED` 관련 메시지 일반화는 이미 구현돼 있어 대칭 참고 가능**
  - target 위치: `spec/4-nodes/4-integration/3-send-email.md` §8.0, `2-database-query.md` Rationale "DB_HOST_BLOCKED 전용 SSRF 차단 코드 신설"
  - 관련 plan: `plan/in-progress/http-ssrf-all-auth-followups.md` (동일 항목의 배경 설명 — "동일 원칙을 HTTP/Email SSRF 메시지 일반화 follow-up 과 공유한다")
  - 상세: DB Query 쪽 스펙 Rationale 은 "메시지 일반화... 동일 원칙을 HTTP/Email SSRF 메시지 일반화 follow-up 과 공유한다" 라고 이미 명시하고 있어, 이번 HTTP 작업이 그 "follow-up" 자체임을 spec 스스로 예고해 두었다. 즉 정합성 문제라기보다 이번 작업이 그 예고를 이행하는 관계다.
  - 제안: 구현 시 DB/Email 의 메시지 일반화 패턴(에러 코드는 유지하되 message 필드만 generic화, 상세는 `logUsage` 활동 로그에만 기록)을 그대로 재사용해 3-node 일관성을 만들 것. `IntegrationError` 코드명(`HTTP_BLOCKED`) 자체는 변경 대상이 아님에 주의.

- **[INFO] `spec-sync-integration-common-gaps.md` 는 이번 target 영역과 인접하지만 본 작업과 직접 충돌 없음**
  - target 위치: `spec/4-nodes/4-integration/0-common.md` §5 (`⚠ Missing integration` 배지)
  - 관련 plan: `plan/in-progress/spec-sync-integration-common-gaps.md` (배지 아키텍처 결정, 옵션 A 권장 — 미확정)
  - 상세: 이 plan 은 SSRF 에러 메시지와 무관한 별개 미구현 항목(삭제된 Integration 참조 감지 배지)을 다루며, 이번 SSRF 에러 일반화 작업의 범위와 겹치지 않는다. payload 에는 프론트매터의 `pending_plans` 참조로만 언급되고 본문은 누락돼 있었으나, 확인 결과 실질적 충돌은 없다.
  - 제안: 별도 조치 불요. 단, 이번 작업 중 `0-common.md` §4.1/§4.2 를 편집하게 되면 같은 파일의 §5 인접 섹션에 실수로 영향 주지 않도록 주의.

## 요약

Target 영역(`spec/4-nodes/4-integration/`)에 대한 plan 정합성 검토용 payload 에 `plan/in-progress/http-ssrf-all-auth-followups.md` 가 누락되어 있었으나, 이 문서는 이번 작업(worktree `ssrf-error-generalize`)이 직접 이행해야 할 유일한 미해결 코드 항목("SSRF 에러 메시지 클라이언트 일반화", HTTP/DB/Email 3-node 공용 audit 필요)을 담고 있다. 실제 코드(`http-safety.ts`)와 target spec(`1-http-request.md`)을 대조한 결과 HTTP Request 쪽만 메시지 일반화가 안 된 채 DB Query·Send Email 과 비대칭 상태이며, DB Query spec 의 Rationale 은 이미 "HTTP/Email follow-up 과 원칙 공유" 를 명문화해 이번 작업의 근거·기대치를 제공한다. 결정 충돌은 없으며(미해결 결정을 우회하는 사례 아님), 다만 선행 plan 의 완료 항목 갱신(체크박스 `[x]`화 + 근거 기록)이 구현 완료 후 반드시 동반돼야 한다. `spec-sync-integration-common-gaps.md` 는 인접 영역이지만 이번 작업과 무관하다.

## 위험도

MEDIUM
