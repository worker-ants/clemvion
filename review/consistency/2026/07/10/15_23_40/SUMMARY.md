# Consistency Check 통합 보고서 (fresh — impl-done 재검토)

**BLOCK: NO** — Critical 없음

## 전체 위험도
**LOW** — 직전 라운드(`15_03_26`) WARNING 2건(톤 escalation·Inline Alert 등재)이 조치돼 이번 라운드에서 해소. 남은 WARNING 1건은 **pre-existing 문서 stale**(코드·신규 §4.6 정확, §6/0-common 이 낡음).

> **infra 참고**: rationale_continuity/convention_compliance/plan_coherence 3개 checker output 파일이 disk-write 갭으로 미기록됐으나 journal.jsonl 에서 회수 — 모두 `[CRITICAL]=0 [WARNING]=0` (INFO만).

## Critical
없음.

## 경고 (WARNING)

| # | Checker | 위배 | 조치 |
|---|---|---|---|
| 1 | cross_spec | `pending_install` 노드 실행 실패 코드 문서 3곳 표기 불일치 — 실제 코드(`resolveIntegration`, `status !== 'connected'` → `INTEGRATION_NOT_CONNECTED`)와 신규 §4.6/배너 주석은 **정확**하나, `4-integration.md §6`(line 726)·`4-nodes/4-integration/0-common.md §4.2` 가 `INTEGRATION_INCOMPLETE`/pending_install 누락으로 **stale**(pre-existing) | **defer → 별도 planner 후속(task 스폰)**. 본 PR 신규 텍스트는 정확하므로 회귀 아님; §6/0-common 정정은 어느 에러코드가 어느 맥락에 맞는지 planner 판단 필요(pre-existing) |

## 참고 (INFO)
- naming_collision: `onNavigate` prop 명이 `expression-autocomplete.tsx` 의 방향키 `onNavigate` 와 이름 중복(도메인·의미 상이, 실질 충돌 없음) → 후속 `onTabChange` 통일 검토.
- convention_compliance (journal): Inline Alert 톤별 ARIA role 관행과 미세 불일치(role="status" 통일) — 문서화된 정식 규약 아님, 저우선.
- rationale_continuity (journal): 배너 hint "다시 연결하세요" 가 `pending_install`/`install_timeout` 에는 "설치 완료/재등록" 이 정확 — 버튼이 개요 탭(맥락별 조치)으로 유도하므로 실사용 오도 없음, 문구 저우선 정리 여지.

## Checker별
cross_spec LOW(W1 pre-existing) · naming_collision LOW(INFO) · rationale_continuity/convention_compliance/plan_coherence — journal 회수, [CRIT]=0 [WARN]=0.

## 권장 조치
1. (defer) §6 line 726 `INTEGRATION_INCOMPLETE`→`INTEGRATION_NOT_CONNECTED` 정정 + 0-common §4.2 `pending_install` 추가 — planner 후속 task.
2. (INFO) `onNavigate`→`onTabChange` 통일, hint 문구 정리 — 후속 선택.
