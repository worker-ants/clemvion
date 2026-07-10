# Plan 정합성 검토 — spec/2-navigation/4-integration.md (§4.6 연결 안 됨 배너)

## 발견사항

- **[INFO]** `activity-disconnected-banner.md` 의 REVIEW WORKFLOW 체크박스 미완
  - target 위치: 해당 없음 (plan 자체 메타)
  - 관련 plan: `plan/in-progress/activity-disconnected-banner.md` §워크플로 — `[ ] REVIEW WORKFLOW (/ai-review + impl-done)`
  - 상세: 본 `--impl-done` 검토가 그 워크플로 단계 자체이므로 현재 미완 상태는 정상. 검토 완료 후 plan 이 체크·complete 이동 처리를 받아야 한다.
  - 제안: 이번 REVIEW WORKFLOW(ai-review + impl-done) 가 clean 하면 developer 가 plan 체크박스를 갱신하고 `plan/complete/` 로 이동.

## 검토 상세

1. **미해결 결정과의 충돌**: 없음. `activity-disconnected-banner.md` §결정(product) 이 트리거 조건(`status !== "connected"`), 배너 배치(빈 상태·목록 양쪽), 문구, `[상태 확인]`→개요 탭 이동 버튼을 명시적으로 확정해 두었고, target diff(`ActivityDisconnectedBanner` 컴포넌트·`ActivityTab` 배선·spec §4.6 신규 bullet·i18n ko/en)는 그 결정을 정확히 그대로 구현한다. 다른 in-progress plan 중 이 결정과 겹치거나 상충하는 "결정 필요" 항목은 없음 (`plan/in-progress/**` 전수 grep — `pending_install`/`expires-soon`/`연결 안 됨`/`integration status` 키워드가 `activity-disconnected-banner.md` 외 어디에도 없음).

2. **선행 plan 미해소**: 없음. 배너가 전제하는 두 사실 — (a) `IntegrationDto.status` 가 `connected`/`error`/`expired`/`pending_install` 값을 가진다는 것, (b) 미연결 통합은 AI Agent MCP bridge 가 tool 노출을 skip 하고 직결 노드는 `INTEGRATION_NOT_CONNECTED` 로 즉시 실패한다는 것 — 모두 이미 구현된 기존 동작이며 어떤 `plan/in-progress` 항목도 이 전제를 아직 "결정 대기"로 남겨두지 않았다. `resume-llm-usage-attribution.md`(#501 관련, llm_usage_log attribution)는 배경 각주에서만 이어질 뿐 §4.6 활동 탭 UI/배너와는 무관한 별개 결함 트랙이라 선행조건 충돌 없음.

3. **후속 항목 누락**: 없음. `plan/in-progress/**` 37개 파일 중 `spec/2-navigation/4-integration.md`(정확 경로) 또는 `activityEmpty`/`activitySummary` 를 언급하는 것은 `activity-disconnected-banner.md` 자신과 `cafe24-backlog-residual.md`(§9.3 catalog API 관련, 배너와 무관한 필드/경로 정합 트랙) 뿐이며 둘 다 이번 변경으로 무효화되거나 새 후속이 필요해지지 않는다. `marketplace-and-plugin-sdk.md` 의 "4-integration.md" 매치는 `prd/4-integration.md`(마켓플레이스 PRD, 별개 파일)를 가리키는 false positive.

## 요약

`activity-disconnected-banner.md` plan 의 product 결정(트리거 조건·배치·문구·CTA)과 spec §4.6 신규 bullet·코드 diff(`ActivityDisconnectedBanner` 컴포넌트, `ActivityTab` 배선, i18n ko/en)가 1:1 로 정합한다. 다른 in-progress plan 의 미해결 결정을 우회하거나, 아직 해소되지 않은 선행조건에 의존하거나, 후속 plan 항목을 무효화하는 지점은 발견되지 않았다. 유일한 메모는 이번 REVIEW WORKFLOW 완료 후 plan 체크박스·complete 이동이 필요하다는 절차적 INFO 뿐이다.

## 위험도

NONE
