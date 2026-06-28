# Code Review 통합 보고서 (Batch 3)

> 대상: Batch 3 (AgentMemoryAdminService 분리 + page.tsx 분해 + clearScope X-Deleted-Count/0건 토스트) + #738 main-red 보정 2건. 14 reviewer 중 9 실행(router) + summary.

## 전체 위험도
**MEDIUM** — Critical 0. 단 X-Deleted-Count CORS 노출 누락(W1, 기능 무력화 위험)이 핵심. WARNING 12 + SPEC-DRIFT 1 + INFO.

## Critical
없음.

## SPEC-DRIFT + 처리
- **S1**: X-Deleted-Count 헤더 + 0건 중립 토스트가 spec §6/§2 미정의 — 코드가 옳음(의도된 멱등 UX). → **FIX**: `17-agent-memory.md §6` + `2-navigation/16-agent-memory.md §2` 에 명시 추가(spec back-flow).

## WARNING + 처리
| # | 발견 | 처리 |
|---|------|------|
| W1 | X-Deleted-Count CORS exposedHeaders 누락 → cross-origin 브라우저가 못 읽어 항상 0 폴백(0/다건 분기 무력화) | **FIX** — main.ts defaultOptions + CorsOptionsLike 에 `exposedHeaders: ['X-Deleted-Count']` 추가 |
| W2 | AgentMemoryService admin 메서드 제거 — 외부 소비자 런타임 파괴 위험 | **검증완료 non-issue** — 외부 소비자(execution-engine/ai-memory-manager/processor)는 recall/saveMemories/scheduleExtraction 만 호출, admin 메서드 미사용(grep 확인) |
| W3 | system-status e2e 변경이 W7 구현 없이 포함 | **의도적** — #738 이 큐 추가하고 e2e 미갱신해 main red 였던 것 보정(별건 found-breakage) |
| W4 | 타 worktree plan 파일(trigger-review-deferred-fixes) 수정 | **의도적** — #738 Gate C red 보정(found-breakage). RESOLUTION 기록 |
| W5 | 동적 SQL 파라미터 슬롯($2/$3/$4) 패턴 취약 | **이월** — 기존 패턴 verbatim 이동(신규 아님). buildWhereClause 추출은 별도 cleanup |
| W6 | AgentMemoryAdminService.logger dead code | **FIX** — logger 필드+import 제거 |
| W7 | 두 패널 로딩/에러/빈 JSX 중복 | **이월** — PanelAsyncContent 추출은 후속(방금 분해한 패널의 추가 추상화) |
| W8 | MemoryListPanel 단위 테스트 부재 | **FIX** — memory-list-panel.test.tsx 6케이스 추가 |
| W9 | ScopeListPanel 단위 테스트 부재 | **FIX** — scope-list-panel.test.tsx 5케이스 추가 |
| W10 | deletedRowCount flat-array 분기 미검증 | **FIX** — admin spec 에 flat-array 케이스 추가 |
| W11 | listScopes/listMemories api 테스트 부재 | **FIX** — agent-memories.test.ts 3케이스 추가 |
| W12 | clearScope 컨트롤러 res 파라미터 — 추가 호출자 | **검증완료 non-issue** — 직접 호출자 없음(grep) |

## INFO — 요약
대부분 이월/비채택: I1(listMemories 2쿼리 vs listScopes 단일쿼리 비대칭, 의도적), I2/I3(NestJS Express 결합, 현 규모 수용), I4(패널 props 다수, 테스트성 유리), I5/I8(KIND_OPTIONS export — 외부 미사용이나 무해), I6(useCallback), I9(headers cast), I10(magic max-h). 현 상태 안전.

## 에이전트별
security/architecture/requirement/scope/side_effect/maintainability/testing/documentation/api_contract 실행(router). performance/dependency/database/concurrency/user_guide_sync skip(무관). Critical 0.

## 판정
MEDIUM(W1 CORS 기능 위험). W1 fix + 테스트 보강 + spec back-flow 적용. 상세 RESOLUTION.md.
