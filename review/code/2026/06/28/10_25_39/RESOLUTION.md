# Resolution — #738 follow-up (items 1+2)

대상 리뷰: 본 세션 `review/code/2026/06/28/10_25_39/SUMMARY.md` (ai-review, MEDIUM, Critical 0 / Warning 3)
+ 동반 `review/consistency/2026/06/28/10_24_52/SUMMARY.md` (consistency `--spec`, BLOCK: NO, Warning 3 / INFO 6)

변경 범위(이 PR): `triggers.mdx`·`triggers.en.mdx`(endpointPath 예시 v4 UUID 정정) + `spec/5-system/16-system-status-api.md §1`(workspace-invitations-pruner 행) + `spec/data-flow/9-observability.md §1.4`(큐 수 16→17, 아래 C-W1 해소로 추가).

## 처리 결과

| 출처 | # | 발견 | 분류 | 조치 |
|------|---|------|------|------|
| consistency | W1 | `9-observability.md §1.4` 큐 수 "16개" — §4 카탈로그·spec/16(17개)와 불일치 | **FIXED** | 본 PR 에서 §1.4 flowchart 레이블 + 본문 "16개"→"17개" 수정. 전 spec 표면(0-overview §4·spec/16 §1·9-observability §1.4) 17 로 정합 확인 (`grep "16개"` 0건) |
| ai-review | W3 | `workspace-invitations-pruner` 가 `MONITORED_QUEUES` 에 등재됐는지 불명확 | **NO ACTION (false positive)** | 이미 등재됨 — `system-status.constants.ts:75` (`WORKSPACE_INVITATIONS_PRUNER_QUEUE`, group=system, concurrency=1). 리뷰어가 changeset(스펙/문서)만 보고 확신 못 한 것. 코드 변경 불필요 |
| ai-review | W1 | 웹훅 `429` 설명이 "60 req/min per-trigger" — spec WH-SC-05 는 "100 req/min 글로벌" | **DEFERRED (out-of-scope)** | #738(endpointPath/큐) 와 무관한 **기존** rate-limit 문서 드리프트. 본 PR 이 건드리지 않은 라인(`triggers.mdx` L152 / `.en` L141). 별도 background task 로 분리 |
| ai-review | W2 | Inbound `429 RATE_LIMITED`(per-execution 60 cmd/min) 가 구현완료처럼 기재 — spec(EIA-NX-11)은 "미구현(Planned)" | **DEFERRED (out-of-scope)** | 동일 — 기존 드리프트, 본 PR 무관. 위 W1 과 함께 background task 로 분리 |
| consistency | W2 | `§1 ⚠ 구현 갭` 노트의 "V-15 추적" 오기 + `agent-memory-extraction` 추적 plan 부재 | **DEFERRED (pre-existing, 별 queue)** | `agent-memory-extraction`(본 PR 의 workspace-invitations-pruner 아님) 관련 기존 노트. #738 follow-up 범위 밖 |
| consistency | W3 | `exec-intake-queue-impl.md` PR2b MAINT#9 가 §3 getter 패턴과 충돌 가능 | **NO ACTION (pre-existing)** | 미착수 plan 의 잠재 충돌 경고. 본 PR 은 §3 미변경. PR2b 착수 시점 책임 |
| consistency | INFO 1-6 | `## Overview` 누락·그룹/UI 매핑·R-5 가독성·status 검토 등 | **DEFERRED** | 전부 본 PR 이전부터 존재한 구조/Rationale 보강 제안. 비차단. 차후 spec 편집 시 일괄 처리 |

## 재검증

- 코드(`codebase/**`) 변경분(MDX 2건)은 본 세션 ai-review 가 커버하며, 본 RESOLUTION.md 로 resolved 처리.
- 추가 수정(9-observability)은 `spec/**` 로 review-guard 의 codebase 게이트 대상 아님. MDX 는 리뷰 이후 재편집 없음(스펙 파일만 추가 수정) — fresh re-review 불요.
- 변경 파일 중 spec `code:` 글로브 매치 0건 → `--impl-done` 게이트 비해당.

## 분리한 후속 작업

- ai-review W1/W2 (웹훅/Inbound rate-limit 문서 드리프트) → 별도 background task 로 spawn.
