# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

> proxy.ts(auth-flow `code:` 매치 spec-linked) 변경의 Gate 2 freshness 복구용 재실행(scope=2-navigation).

## 전체 위험도
**LOW** — 5개 checker 모두 Critical 0. WARNING 1건(이번 변경과 무관한 선재 execution-history API 경로 명명), INFO 다수.

## Critical 위배
없음.

## 경고 (WARNING)
| # | Checker | 위배 | 처분 |
|---|---------|------|------|
| W-1 | Convention | `GET /api/executions/workflow/:workflowId` vs 프런트 `/workflows/:id/executions` REST 일관성 확인 권장 (`14-execution-history.md`) | **dismiss(out of scope)** — 이번 라이브 미리보기 수정과 무관한 선재 spec 영역. 별도 grooming |

## 참고 (INFO) — 이번 변경 관련
| # | 항목 | 처분 |
|---|------|------|
| I-6 | `/_widget` prefix 추가 — 7-channel-web-chat 정의와 의미 일치, cross-ref 정확 | 현행 유지 |
| I-7 | `next.config rewrites` 표준 키, 충돌 없음 | 현행 유지 |
| I-5 | `spec-draft-web-chat-console.md` 체크리스트에 auth-flow §7.1 갱신 누락 | defer — spec-draft 는 별도 in-progress plan(이번 PR 무관). 선택적 추적 |
| I-1~4 | 선재 Rationale 가시성·Overview 섹션 보완 제안 | defer(선재, 비차단) |

## 처리
BLOCK 없음 → Gate 2 통과. 이번 변경(proxy `/_widget` 예외 + rewrite + auth-flow §7.1)의 cross-spec·naming·convention 정합 확인됨(I-6·I-7 일치). 무관 WARNING/INFO 는 별도 grooming.
