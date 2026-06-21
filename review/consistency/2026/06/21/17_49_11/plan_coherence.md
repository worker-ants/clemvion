# Plan 정합성 검토 결과

검토 대상: `spec/4-nodes/4-integration` (구현 완료 후 --impl-done 검토)
검토 기준: `plan/in-progress/**` 의 진행 중 작업·미해결 결정

---

## 발견사항

### [INFO] spec-sync-integration-common-gaps.md 의 미해결 결정이 target 영역을 직접 참조

- **target 위치**: `spec/4-nodes/4-integration/0-common.md §5` ("⚠ Missing integration" 배지 설명 주석)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-integration-common-gaps.md` 전체 — 특히 §결정 옵션(2026-06-13) 의 "A/B/C/D 옵션" 과 "권장안 — 옵션 A"
- **상세**: `0-common.md:107` 의 `⚠ Missing integration` 배지 약속은 plan 에서 아직 미결정 구현 항목(`[ ]`)으로 추적 중이다. target spec 본문은 이 배지를 "계획 (미구현)" 으로 명시하고 있어 plan 과 정합하다. 단 plan §결정 옵션 에서 옵션 A(프론트 캔버스 렌더 시 integration 목록 대조)를 권장하면서도 **"project-planner 로 개정(배지 작동 방식·데이터 소스 명문화)"이 선행 필요**하다고 명시했는데, target spec 에는 이 명문화가 반영되지 않았다. 현재 구현 완료 후 검토(--impl-done)이므로 spec 갱신 선행 여부를 확인할 필요가 있다.
- **제안**: 단순 추적 메모 — 이 검토는 `spec/4-nodes/4-integration` 의 현재 구현 완료 범위(M-2 OAuth strategy 분리)와 직접 충돌하지는 않는다. plan 의 미결 배지 항목은 현행 spec 본문에 "미구현(티어3)" 으로 정확히 표기되어 있어 비차단. 단 향후 옵션 A 구현 착수 시 spec 갱신 선행을 잊지 않도록 plan 에 메모 권장.

---

### [INFO] node-output-redesign/http-request.md 의 P3 잔여 항목 — target 에서 미해소 상태임이 정합

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §5.3.2` (`output.response: { error: <message> }` legacy 잔재 주석)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/node-output-redesign/README.md` Phase E § P3 항목 ("HTTP transport-failed envelope 의 `output.response: { error }` legacy 잔재 제거") + `/Volumes/project/private/clemvion/plan/in-progress/node-output-redesign/http-request.md` §진단 항목 1
- **상세**: node-output-redesign plan 이 P3(낮은 우선순위)로 분류한 transport 실패 시 `output.response: { error: <message> }` legacy 잔재 제거가 target spec 에서 "Deprecated (legacy 호환 잔재)" 로 명시되어 plan 의 미해소 상태와 정합한다. 현재 구현 완료 후 검토 대상(M-2 OAuth strategy)은 이 영역을 건드리지 않으므로 충돌 없음.
- **제안**: 정보 메모만. 비차단.

---

### [INFO] refactor/02-architecture §M-2 plan 이 IntegrationOAuthService 분리를 추적 중이며, spec/4-nodes/4-integration 은 직접 영향 없음

- **target 위치**: `spec/4-nodes/4-integration` 전반 (특히 `4-cafe24.md`, `5-makeshop.md` — OAuth 흐름 관련)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` §M-2 ("IntegrationOAuthService 2,579줄 — 다중 OAuth 프로토콜 혼합") — 현재 worktree `m-2-oauth-strategy-a246b9` 에서 구현 완료됨 (최근 커밋: `21ecd609`, `2a64b7d3`)
- **상세**: M-2 의 개선 방안이 "facade 명 유지 시 다이어그램 무변" 으로 명시되어 있고 spec 갱신 불요로 기록되어 있다. target spec (`4-cafe24.md`, `5-makeshop.md`)의 OAuth 흐름·spec 내용은 M-2 구현(OAuthProviderStrategy 분리)에 의해 변경될 이유가 없다. 단 `02-architecture.md §M-6` 이 "이전 순서: integration-oauth 7곳(M-2 와 동일 PR) → mcp → ..."로 명시했으나 M-6 은 이미 별도 완료된 상태이므로 M-2와 M-6 사이 연계 의도 확인이 권고된다.
- **제안**: 정보 메모. 비차단.

---

### [INFO] http-ssrf-all-auth-followups.md 의 미완료 항목이 target spec 과 연관

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §4 step 8` (SSRF 가드 설명), `spec/4-nodes/4-integration/2-database-query.md §4 SSRF 가드` 주석
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/http-ssrf-all-auth-followups.md` — "SSRF 에러 메시지 클라이언트 일반화" (`[ ]` 미완료), "0-overview §6.1·mcp-client §3.2·4-execution-engine §10: SSRF 전 인증 공통/meta.durationMs 동기화" (`[ ]` 보류)
- **상세**: target spec 에 이미 구현 완료된 "전 인증 방식 SSRF 가드 적용" 내용이 정확히 반영되어 있다. 단 follow-ups plan 의 미완료 항목("SSRF 에러 메시지 클라이언트 일반화")은 현재 target spec 에서 "차단 host/IP 를 포함하지 않는 일반화 문구"로 이미 명시되어 있어 plan 추적 상태가 target 기준으로 앞서 있는 상태다. 현행 M-2 작업과 직접 충돌 없음.
- **제안**: 정보 메모. 비차단.

---

## 요약

`spec/4-nodes/4-integration` 는 현재 진행 중인 plan 들과 전반적으로 정합하다. 가장 관련성이 높은 `plan/in-progress/spec-sync-integration-common-gaps.md` 의 미결 항목(`⚠ Missing integration` 배지)은 target spec 에 "계획 (미구현)" 으로 정확히 표기되어 plan 상태와 일치한다. 현재 worktree(`m-2-oauth-strategy-a246b9`)가 수행 중인 M-2 OAuth strategy 분리 작업은 `spec/4-nodes/4-integration` 의 spec 내용을 직접 변경하지 않으므로, "미해결 결정 우회"나 "선행 plan 미해소"에 해당하는 CRITICAL/WARNING 등급 충돌은 발견되지 않았다. `node-output-redesign` plan 의 P3 잔여 항목과 `http-ssrf-all-auth-followups` 의 일부 미완료 항목은 target spec 에 이미 명시적으로 표기("Deprecated", "미구현") 되어 있어 plan 추적과 정합한다.

## 위험도

NONE

STATUS: SUCCESS
