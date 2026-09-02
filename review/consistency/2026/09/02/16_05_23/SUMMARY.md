# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, CRITICAL 0건)

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, spec 을 won't-do 로 갱신하면서 짝을 이루는 tracker plan(`spec-sync-websocket-protocol-gaps.md`)의 체크리스트·비고를 함께 갱신하지 않아 spec↔plan drift 가 생길 위험이 2개 checker(rationale_continuity, plan_coherence)에서 독립적으로 지적됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, plan_coherence, cross_spec(INFO→통합상향) | spec 본문 2항목(`system.maintenance`, 서버발신 app ping)을 won't-do 로 전환하면서, 같은 항목을 들고 있는 tracker plan `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 의 체크리스트·비고가 갱신 목록에서 빠짐 | `plan/in-progress/spec-draft-ws-wontdo-maintenance-appping.md` §변경안 "9개 자리 전수" 표 (spec 파일 내부 9곳만 열거, plan 파일 없음) | `plan/in-progress/spec-sync-websocket-protocol-gaps.md`:54 (`system.maintenance` `[ ]`), :68 (서버발신 ping `[ ]`), :95 비고 "잔여 3종…만 실 backlog" | target 실행 시 "9개 자리" 표에 10번째 항목 추가: (a) tracker plan 의 두 `[ ]` 를 2026-07-08 4종 선례와 동형으로 `## 비채택 (won't-do)` 섹션에 `[x] [won't-do]` 로 이관 + `R-wontdo-maintenance-appping` 참조, (b) 비고의 "잔여 3종" 을 "잔여 1종(auth.token_expired)" 으로 정정. 두 파일이 같은 커밋에서 함께 바뀌어야 spec↔plan 정합 유지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance, naming_collision | `R-<slug>` Rationale 명명 + `_(비채택 won't-do)_` 인라인 표기 패턴이 `spec/conventions/**` 에 정식 문서화되어 있지 않음 (target 은 기존 파일 선례 `R-wontdo-rawws-rest` 를 정확히 따랐으므로 target 자체의 결함 아님) | `spec/5-system/6-websocket-protocol.md`, 유사 패턴 5개 이상 spec 파일(`11-`,`14-`,`15-`,`16-system-status-api.md`) | 향후 `spec/conventions/` 에 "Rationale 항목 명명 + won't-do 인라인 표기" formalize 하는 별도 convention 문서 고려 — target 수정 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 새 엔티티·API·요구사항 ID 신설 없음, 인용 라인 앵커·실측(코드 0건, §5.1 heartbeat 확정) 전부 spec 과 일치. tracker plan 후속 동기화는 참고(INFO) |
| rationale_continuity | LOW | 실측(§5.1, `onApplicationShutdown`, code 0건) 전부 사실 부합, 기각된 대안 재도입·원칙 위반 없음. tracker plan 동기화 누락만 WARNING |
| convention_compliance | NONE | plan/spec frontmatter·명명·라이프사이클 규약 전부 준수. Rationale 명명 규약 미문서화는 INFO(target 결함 아님) |
| plan_coherence | MEDIUM | target 결정 자체는 tracker plan 의 2026-08-31 실측과 상충 없으나, tracker plan 체크리스트/비고를 갱신 목록에서 빠뜨려 반영 후 spec="비채택" vs plan="결정 필요/실 backlog 3종" 로 갈라질 위험 |
| naming_collision | NONE | 신규 식별자는 `R-wontdo-maintenance-appping` 1개뿐이며 repo 전체 grep 으로 충돌 없음 확인, 기존 `R-wontdo-*` 관례 부합 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — CRITICAL 없음) target 실행(spec 본문 편집) 시 `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 도 같은 커밋에서 함께 갱신: `system.maintenance`·서버발신 app ping 두 `[ ]` 항목을 `## 비채택 (won't-do)` 섹션으로 이관(`[x] [won't-do]`, `R-wontdo-maintenance-appping` 참조)하고, 비고의 "잔여 3종" 문구를 "잔여 1종(auth.token_expired)" 으로 정정.
2. (선택, 비차단) `spec/conventions/` 에 Rationale `R-<slug>` 명명 + `_(비채택 won't-do)_` 인라인 표기 하우스 스타일을 정식 문서화하는 것을 향후 과제로 고려.