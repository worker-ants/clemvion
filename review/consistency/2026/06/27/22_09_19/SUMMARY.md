# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

검토 모드: `--impl-done spec/7-channel-web-chat/` (spec 영역 + 코드 diff vs origin/main)
일시: 2026-06-27 22:09:19

## 전체 위험도
**LOW** — 5개 checker 모두 Critical/Warning 0. Cross-Spec 1건 LOW (spec/overview 동기화 지연), 나머지 NONE. 전부 INFO 비차단.

> **본 PR 과의 관계**: 발견된 spec-impl 갭(ended 재open·ERROR→pending 해제·isTextInputSurface 단일화의 spec 본문 미반영)은 전부 **pre-existing 동작**의 문서화 제안이다 — ended 재open·ERROR→pending 해제는 reducer 에 이미 존재했고(본 PR 은 테스트만 추가), isTextInputSurface 는 기존 3중 판정을 중앙화한 것이다. INFO·비차단이므로 planner spec polish followup 으로 이관(ai-review SPEC-DRIFT #1 과 동일 항목).

## Critical 위배 (BLOCK 사유)
해당 없음.

## 경고 (WARNING)
해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 처리 |
|---|---------|------|------|
| 1 | Cross-Spec | `ended` 상태 OPEN 전이가 `1-widget-app §3.1` 상태기계 미기술 | planner followup (pre-existing 동작) |
| 2 | Cross-Spec | `isTextInputSurface` 단일화 spec 본문 미반영 | planner followup — `§2` 에 SoT cross-ref 한 문장 |
| 3 | Cross-Spec | `ERROR` 시 `pending` 해제 `§3.1` 미기술 | planner followup (pre-existing 동작) |
| 4 | Cross-Spec | `0-overview §6.2` 웹채팅 🚧·`NAV-WC-06` 🚧 미동기화 | co-deploy 완료 확인 후 planner 동기화 (범위 밖) |
| 5 | Convention | `_product-overview.md` 헤더 `## 1. 개요` vs 권장 `## Overview` | 규약 carve-out 또는 변경 (planner, 비차단) |
| 6 | Convention | 4개 파일 `## Overview` 부재 | 규약 carve-out 권장 (planner, 비차단) |
| 7 | Plan Coherence | §A 착수 시 spec 3곳 동반 — 현 plan 추적 중 | 추가 조치 불요 |
| 8 | Naming | `id: common` 다중(범위 밖) | 해당 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec-impl 직접 모순 없음. ended 재open·ERROR→pending·isTextInputSurface 단일화의 spec 본문 미반영(암묵 갭, pre-existing). overview 동기화 지연 |
| Rationale Continuity | NONE | 기각 대안 재도입·원칙 위반 없음. §R6·§2 합의 결정의 테스트 확대·판정 단일화 |
| Convention Compliance | NONE | frontmatter·네임스페이스·에러 코드·index 가드 준수. Overview 형식만 권장사항 |
| Plan Coherence | NONE | `spec_impact: []` 선언과 diff 일치. §A 는 현 PR 외, plan 추적 정상 |
| Naming Collision | NONE | `web-chat-` prefix·`wc:`·`isTextInputSurface` 내부 스코프 충돌 없음 |

## 권장 조치사항
1. **(planner spec polish followup, 비차단)** `1-widget-app §3.1`(ended 재open·ERROR→pending 해제), `§2`(isTextInputSurface SoT cross-ref) 문서화.
2. **(확인 필요)** co-deploy Phase 1 완료 여부 → `0-overview §6.2`·`NAV-WC-06` 🚧 동기화.
3. **(추적 메모)** §A 착수 시 plan `spec_impact` 에 3-auth-session·4-security·2-sdk 포함 (이미 기재).
