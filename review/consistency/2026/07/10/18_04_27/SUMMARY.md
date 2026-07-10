# Consistency Check 통합 보고서 (--spec draft)

**BLOCK: NO** — Critical 없음

## 전체 위험도
**MEDIUM** — 차단 사유 없음. 4개 변경 중 2건 정정 필요(send-email pending_install 도달 불가, §6 노드/AI Agent 구분 미반영). cross_spec/rationale/plan/naming 은 NONE.

## Critical
없음.

## 경고 (WARNING) — 전부 draft 반영으로 조치

| # | Checker | 위배 | 조치 |
|---|---|---|---|
| 1 | convention | 변경 4 (`3-send-email.md:221` 에 `pending_install` 추가)는 코드상 도달 불가 — email(SMTP)은 pending_install 대입 경로(cafe24/makeshop install 전용)를 거치지 않고, `resolveIntegration` 이 serviceType 불일치를 status 검사보다 먼저 throw | **변경 4 제외** — send-email 은 expired/error 유지 |
| 2 | convention + rationale | 변경 1 (§6 line 726)이 §4.6(#894 확정) 구분 미반영 — 노드=`INTEGRATION_NOT_CONNECTED` 즉시 실패, AI Agent=MCP bridge 가 tool 미노출로 호출·에러코드 자체 없음(`buildTools` status:'skipped', throw 안 함) | **§6 문구를 §4.6 구분 반영 + cross-link** 로 재작성 |
| 3 | convention | 변경 1 의 "§4.2" bare 참조 모호(로컬 §4.2 UI 섹션 vs 0-common §4.2). line 1082 는 이미 명시 링크 사용 | **명시적 cross-file 링크**(`[공통 §4.2](../4-nodes/4-integration/0-common.md#42-공통-에러-코드)`)로 교체 |

## 참고 (INFO)
- cross_spec(positive): `1-data-model.md §2.10` enum 은 이미 pending_install 포함 4종, `data-flow/5-integration.md` 스캐너도 3종 명시 — target 4곳(정정 대상)이 오히려 stale outlier. 방향 정합 확인.
- rationale(positive): PR #894 커밋이 본 정정을 `task_6f46d7eb` 후속으로 명시 예고, 연결테스트 가드·status-vs-credential 구분 원칙과 정합.
- backlog(차단 아님): `_product-overview INT-US-03`·`0-common §2` UI 경고 배지 축의 pending_install 포함 여부 별도 검토(다른 축).
- naming: 신규 식별자 없음.

## Checker별
cross_spec NONE · rationale_continuity NONE · convention_compliance MEDIUM(W1/2/3) · plan_coherence NONE · naming_collision NONE.

## 결론
BLOCK:NO. WARNING 3건은 draft 반영(send-email 제외, §6 재작성+링크)으로 조치 후 spec 적용. UI 배지 축은 backlog.
