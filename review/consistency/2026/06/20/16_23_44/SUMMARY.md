# Consistency Check (--spec) 통합 보고서 — port-id UUID→slug draft

**BLOCK: YES** — 정당한 발견(오탐 아님). 변경안 #4(carousel)가 Presentation ButtonDef.id 모델과 신규 충돌. draft 수정 후 재검토 필요.

## 전체 위험도
**HIGH** — 변경안 #1·#2·#3은 SoT 부합·채택 안전. #4(Carousel ButtonDef.id)가 `6-presentation/0-common.md` UUID v4 일관 모델·backfill 로직과 직접 충돌.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | 조치 |
|---|---------|------|------|
| 1 | Cross-Spec | `1-logic/0-common.md §7`(line140) UUID v4 ↔ SoT §1.3 slug 모순 | **변경안 #1 채택** (안전) |
| 2 | Cross-Spec | `3-workflow-editor/1-node-common.md §1.5`(line97) UUID v4 ↔ SoT §1.3 · `2-switch.md §3.3` 모순 | **변경안 #2 채택** + line102 참조-본문 모순 동시 제거 |
| 3 | Cross-Spec | `3-ai/_product-overview.md ND-AG-20`(line80) UUID v4 ↔ SoT. 동일 도메인 `1-ai-agent.md §2` ConditionDef.id(line79)도 UUID 잔존 | **변경안 #3 채택 + `1-ai-agent.md §2` line79 ConditionDef.id 동반 갱신** |
| 4 | Cross-Spec/Naming | **변경안 #4 가 틀림** — carousel:429 를 slug 로 바꾸면 ButtonDef.id SoT(`6-presentation/0-common.md §1` `String(UUID v4)`·§7.1·§10.5 `backfillButtonUuids`)와 정면 충돌. "자동 slug" 신규 용어 미정의 | **변경안 #4 폐기** — Presentation ButtonDef.id 는 UUID v4 유지(정상; slug regex 통과 호환). carousel:429 는 `0-common.md §1` cross-ref 로만(또는 무수정) |

## 경고 (WARNING)
- W1 (Rationale): §7 UUID 채택 근거 원래 부재 — "무근거 번복" 아닌 "SoT 교정". plan 에 명기.
- W2 (Cross-Spec): `1-ai-agent.md §2` ConditionDef.id(line79) UUID 잔존 — #3 과 동반 갱신.
- W3 (Cross-Spec): `0-overview.md §1.3` 범위 vs Presentation ButtonDef.id(UUID) 불명확 — §1.3 에 "Presentation ButtonDef.id 는 UUID v4(`0-common.md §1` SoT), slug regex 호환 예외" 명시 또는 §1.3 을 switch/classifier config 항목 전용으로 한정.

## 참고 (INFO)
- ND-AG-17 도구명 UUID 제외 정확(포트 ID 아님). `0-overview ## Rationale` 신설 충돌 없음(적극 권장). `1-node-common §1.5` "ID 불변" 행도 slug 맥락 동기화 권장. `stable slug id` 용어 SoT(§1.3 line121)에 기존재. carousel 은 `spec-sync-carousel-gaps.md` 와 동일파일 — rebase hunk 주의.

## Checker별 위험도
Cross-Spec HIGH(#4 신규충돌, #1~3 방향 타당) · Rationale-Continuity LOW(기각대안 재채택 아님) · Convention NONE · Plan-Coherence NONE · Naming MEDIUM(#4 용어충돌)

## 권장 (draft 수정 방향)
1. **#4 폐기** — Presentation ButtonDef.id UUID v4 유지. carousel:429 무수정 또는 `0-common.md §1` cross-ref.
2. **#1·#2·#3 채택** + `1-ai-agent.md §2` line79 ConditionDef.id 동반 slug 갱신.
3. **§1.3 에 Presentation ButtonDef.id(UUID, slug-regex 호환) 예외 명시** (W3 해소).
4. `0-overview ## Rationale` 신설 진행.
