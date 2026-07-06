# Consistency Check 통합 보고서 (--impl-done 재검증, spec 동기화 후) — 5 checker 완료

**BLOCK: NO** — Critical 0. 이전 --impl-done(22_42_31) 의 naming_collision CRITICAL 2건(SPEC-DRIFT)이 spec 동기화로 **해소**. 5 checker 전원 재실행 완료.

## Checker별 결과
| Checker | 위험도 | 핵심 |
|---|---|---|
| cross_spec | NONE | 0 findings — spec(§2.1/§1.1/§2.19/12-background)이 코드와 정합 |
| naming_collision | NONE | INFO 3 (DTO resourceType 주석 정확성/선택, V047 표기 유사 이미 방어, resourceType='workflow' 정상 일관화) |
| convention_compliance | NONE | INFO 2 |
| plan_coherence | OK | 이상 없음 |
| rationale_continuity | LOW | WARNING 1 — ModuleRef DI 해법이 spec §4.4 "엔진 순환=forwardRef" 원칙 미문서 예외 (아래 followup) |

## Critical
(없음)

## WARNING (rationale_continuity, LOW — 비차단)
`ExecutionEngineService` 의 `ModuleRef(strict:false)` 지연 해석은 spec `5-system/4-execution-engine.md §4.4`
의 "엔진 순환 의존 = forwardRef" 원칙에 대한 미문서화 예외다(기존 `NotificationsService.getWebsocket()` ModuleRef
선례도 미문서). 기능은 정상(둘 다 NestJS 표준). **followup**: spec §4.4(또는 conventions)에 "순환 DI 해법 = forwardRef +
ModuleRef 지연해석 2종, 각 적용 기준" 을 정리 → planner 위임(`notif-hardening-followups.md` §후속 아키텍처 부채와 연동).

## 판정
SPEC-CONSISTENCY 게이트 해소: spec 이 코드(V107·findByBackgroundRun·resourceType='workflow'·초기/재개 세그먼트
dispatch·ModuleRef 해석)와 정합. rationale WARNING 은 LOW·비차단(spec-doc followup 등록). **BLOCK: NO**.
