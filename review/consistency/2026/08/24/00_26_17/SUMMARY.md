# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — target(`spec/conventions/conversation-thread.md`)의 자기-반증형 소정정은 5조건을 모두 충족하며, 동반 갱신된 EIA §R17·WS §4.4 와도 정합한다. 유일한 실질 조치 항목은 코드 주석 한 곳이 §R17 에 실재하지 않는 표현("렌더에 필요한 키")을 2라운드째 소급 인용하는 WARNING 1건이다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | (없음) | | | | |

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | 코드 주석이 `§R17` 에 실재하지 않는 표현("렌더에 필요한 키")을 소급 인용 — `22_26_33` 라운드부터 2라운드째 미반영, 이번 라운드에서 INFO→WARNING 격상 | `codebase/backend/src/shared/utils/node-output-allowlist.ts:84-85` | `spec/5-system/14-external-interaction-api.md` §R17 (grep 결과 해당 표현 0건) | 주석을 "이 넷은 §R17 이 정의한 키가 아니라 chat-channel legacy flat shape 보존을 위한 별개 carve-out(근거: R17 'wire 전용(chat-channel 렌더러)' 행)" 으로 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 정정 블록 재배치로 인한 인접 문장 이동(내용 보존, 기능 영향 없음) | `spec/conventions/conversation-thread.md` §4 | 조치 불요 (기록 목적) |
| 2 | rationale_continuity | `node-output.md` Principle 0 닫힌 레지스트리와 wire-only 8키 간 거리감(4→8키로 확대, 이미 planner 소관 트래킹 중) | `node-output-allowlist.ts` JSDoc/배열, `spec/conventions/node-output.md` Principle 0 | 다음 planner 턴에서 Principle 0 에 "EIA/chat-channel wire 조립 레이어 필드는 계약 밖" 각주 추가 |
| 3 | rationale_continuity | `egress-masking.md` §2 파이프라인 3단계 서술이 `toFanoutEnvelope` 실제 순서(strip→allowlist→routing) 대비 낡음, 이미 planner 소관 등재됨 | `spec/conventions/egress-masking.md` §2 | 트래킹 유지, planner 턴에서 갱신 |
| 4 | convention_compliance | `conversation-thread.md` frontmatter `code:` 목록에 `websocket.service.ts` 미포함(정정 blockquote 가 이 파일의 함수를 근거로 인용하는데 glob 이 안 걸림; 가드 위반 아님) | `spec/conventions/conversation-thread.md` frontmatter (44-66행) | 다음 편집 시 `codebase/backend/src/modules/websocket/websocket.service.ts` 추가 (급하지 않음) |
| 5 | convention_compliance | 문서 최상단에 명시적 `## Overview` 헤딩 부재(diff 로 도입된 문제 아님, 기존 구조) | `spec/conventions/conversation-thread.md` 1-75행 | 차후 구조 개정 시 서문 단락 앞에 `## Overview` 추가 권장 |
| 6 | convention_compliance | 자기-반증형 소정정 조건②("예고·트리거" vs "API 계약") 경계가 미묘함 — 판정은 예고/TODO 고지 쪽으로 확정, 판단 근거만 기록 | `spec/conventions/conversation-thread.md` 388-391행 | 조치 불요, 향후 정정 대상 문장을 순수 상태-고지 문장으로 좁히는 관행 유지 권장 |
| 7 | convention_compliance | 프롬프트 번들이 예산 초과로 `node-output.md`/`swagger.md`/`error-codes.md`/`secret-store.md`/`node-cancellation.md` 및 git diff 원문을 절단 — checker 가 워크트리 직접 열람으로 우회 확인 완료, 결과엔 영향 없음 | `_prompts/convention_compliance.md` 1022-1051행 | orchestrator 번들 조립 예산 이슈로 별도 harness 트래킹 가치 있음(이 세션 범위 밖) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | target·EIA §R17·WS §4.4 세 문서가 "waiting 표면 닫힘, `envelope.output` 잔여" 경계선을 정확히 공유. 코드·캐너리·plan 트래커까지 대조해 모순 없음 |
| rationale_continuity | LOW | 직전 라운드 CRITICAL·코드리뷰 WARNING 4건 모두 취소선+정정+캐너리로 해소 확인. 신규 WARNING 1건(코드 주석 소급 인용, 2라운드째 미반영) |
| convention_compliance | LOW | 자기-반증형 소정정 5조건 실측 충족. CRITICAL/WARNING 없음, INFO 4건(추적성·구조·harness 갭) |
| plan_coherence | NONE | plan 미해결 결정 침범 없음, 선행조건 해소됨, 잔여 항목은 정본 트래커에 실측·캐너리와 함께 등재 |
| naming_collision | NONE | target diff 6줄은 기존 식별자 재인용뿐, 신규 식별자 없음. 실제 신규 4키(payload/title/rendered/nodeType) 충돌은 선행 라운드에서 이미 해소 확인 |

## 권장 조치사항
1. (WARNING 해소) `codebase/backend/src/shared/utils/node-output-allowlist.ts:84-85` 주석에서 "§R17 이 정의한 '렌더에 필요한 키'" 표현을 제거하고, "이 4키는 §R17 이 정의한 키가 아니라 chat-channel legacy flat shape 보존을 위한 별개 carve-out" 으로 정정한다.
2. (선택, 급하지 않음) `spec/conventions/conversation-thread.md` frontmatter `code:` 에 `websocket.service.ts` 추가.
3. (planner 소관, 이미 트래킹 중) `node-output.md` Principle 0 각주 추가 + `egress-masking.md` §2 파이프라인 순서 갱신 — 다음 planner 턴에서 처리.