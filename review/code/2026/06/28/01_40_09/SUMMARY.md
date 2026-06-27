# Code Review 통합 보고서 (최종, --branch origin/main)

리뷰 대상: `useWidget` God hook 분리 — `useTokenRefresh` / `usePendingMessageQueue` (B1, behavior-preserving)
일시: 2026-06-28 01:40:09 (HEAD 7bba45cbd)

## 전체 위험도
**LOW — Critical 0, Warning 0.** 7 reviewer 전원 INFO 등급만 보고. 행동 보존 리팩터로 기능·보안·부작용 이상 없음. (3차에 걸친 후속에서 타입우회·섀도잉·stable-ref 전제·커버리지 보강 반영 후 수렴.)

## Critical 발견사항
없음.

## 경고 (WARNING)
없음.

## 참고 (INFO) — 전부 비차단
| 분류 | 항목 | 처리 |
|---|---|---|
| 보안(#1·#3·#4) | console.warn 원문·triggerEndpointPath 키·configFromQuery apiBase 미검증 | **pre-existing**, backlog/설계 의도 — 본 PR 범위 밖 |
| 보안(#2) | submit_message nodeId=undefined 가능 | 의도된 동작(pending=null 과도 상태) — EIA §6.2 가 누락 허용 |
| SPEC-DRIFT(#5) | 3-auth-session frontmatter `code:` 신규 훅 미명시 | **planner followup**(glob 커버·가드 통과, developer spec read-only) |
| 요구사항(#6) | session-store sessionStorage 정합 | **확인 완료** — #744 로 sessionStorage 채택, 테스트 정합 |
| 테스트(#7~13) | 순서·reject·null-ref·재귀2회·LEAD smoke 등 추가 커버리지 | 핵심 경로 커버 완비, 선택적 보강 followup |
| 유지보수/문서(#14~20) | named-fn 패턴·cancelledRef 주석·pendingSendRef 네이밍·README | 선택적 polish followup |

## 에이전트별 위험도
security NONE · requirement LOW(INFO만) · scope NONE · side_effect NONE · maintainability NONE · testing LOW(INFO만) · documentation NONE. 전원 Critical/Warning 0.

## 권장 조치사항
1. **(planner followup)** 3-auth-session/1-widget-app frontmatter `code:` 에 신규 훅 명시(비차단, glob 커버).
2. **(선택 followup)** 재귀 재예약 2회·sendCommand reject·null-ref race 테스트 + README 갱신.
3. **(backlog)** configFromQuery apiBase 검증 — pre-existing.

> Critical/Warning 0 — RESOLUTION 불요. 잔여 INFO 는 비차단 followup/backlog.
