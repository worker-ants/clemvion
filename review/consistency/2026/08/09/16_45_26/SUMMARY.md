# Consistency Check 통합 보고서

**BLOCK: NO** — CRITICAL 위배 없음 (5개 checker 전원 성공, 전문 확보 완료)

## 전체 위험도
**LOW** — CRITICAL 은 0건. WARNING 2건은 모두 기존에 이미 인지·추적 중인 미해소 항목(신규 회귀 아님)이며, 이번 turn 의 실제 코드 변경(backend `*.spec.ts` 5개, 타입체크 정합)과는 무관한 `spec/conventions/` 스냅샷 자체 점검 결과다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `mains_update`/`mains_delete` 제거 근거("공식 docs 부재 확정")가 field-level 카탈로그와 모순 — 2026-07-26 발견 후 오늘까지 미해소 | `spec/conventions/cafe24-api-catalog/_overview.md` §Rationale | `spec/conventions/cafe24-api-catalog/category/mains.md`(update/delete 실존 기록) + `plan/in-progress/cafe24-backlog-residual.md`(CRITICAL 등재, 처리 체크박스 전부 미체크) | cafe24 category 관련 작업 착수 시 plan 의 "처리(착수 시)" 체크리스트(외부 docs 재확인 선행)를 먼저 닫을 것. 건드리지 않는다면 미해소 상태 유지만 기록 |
| 2 | naming_collision | Rationale ID `R8` 이 스펙 전역 3중 정의(15-chat-channel/14-EIA/1-widget-app)인데 target 이 자신이 선언한 "cross-file 인용 시 파일 prefix 명시" 규칙을 어기고 bare `R8` 로 3곳 인용 | `spec/conventions/chat-channel-adapter.md` §1.3, §R-CCA-7 (a)(c) | `spec/5-system/15-chat-channel.md §R8`(의도된 대상으로 추정) vs `14-external-interaction-api.md §R8` vs `7-channel-web-chat/1-widget-app.md §R8` | 3곳 `R8` 인용을 `[CC §R8]`(파일 prefix)+실제 앵커 링크로 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | Coverage Matrix 485 endpoint 합계가 `4-cafe24.md` 실측치와 정확히 일치 (교차검증 완료, 문제 없음) | `spec/conventions/cafe24-api-catalog/_overview.md §5` | 조치 불요 — 기록 목적 |
| 2 | rationale_continuity | 컨텍스트 예산으로 263개 conventions 파일 + 72개 cross-ref spec 파일 미검증 | `spec/conventions/` 전체 | 해당 파일 대상 실제 spec 변경 발생 시 그 시점 `--spec` 검토에서 커버 |
| 3 | convention_compliance | `CONVENTION:` 계열 문서 3건(`_overview.md`/`cafe24-api-metadata.md`/`chat-channel-adapter.md`)이 명시적 `## Overview` 헤딩 없이 산문 도입부로 대체 (SKILL.md 3섹션은 "권장", 기존 스타일로 보임) | 각 문서 도입부 | 급하지 않음. 다음에 손볼 때 헤딩 명시 또는 SKILL.md 에 CONVENTION 문서 예외 명문화 검토 |
| 4 | plan_coherence | `node-cancellation.md` §2.3 "사용자 cancel 버튼" 서술에 Editor+ 권한 제약(`@Roles('editor')`) 미반영 — 이미 plan 이 정확히 추적 중인 정상 미착수 상태 | `spec/conventions/node-cancellation.md §2.3` | 실행 취소/Stop 버튼 권한 작업이면 `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md §1` 먼저 확인. 아니면 조치 불요 |
| 5 | plan_coherence | 이번 세션 실제 미커밋 변경분(backend `*.spec.ts` 5개, 타입체크 정합)과 검토 scope(`spec/conventions/`)가 서로 무관해 보임 (저신뢰 참고) | 프롬프트 전체 | 조치 불요 — scope 유효성 재확인용 참고만 |
| 6 | naming_collision | `execution.node.completed` — WS 프로토콜 이벤트명과 `ChatChannelInternalEvent` 내부 타입이 동일 이벤트명·다른 payload shape (의도된 재사용이나 명시적 필드 매핑 표 부재) | `spec/conventions/chat-channel-adapter.md §1.3` vs `spec/5-system/6-websocket-protocol.md:183` | §1.3/§3 에 WS→내부타입 필드 매핑 1줄 표 추가 |
| 7 | naming_collision | cafe24 `store.md` 의 `privacy_*` operation id 와 `privacy` resource 의 `customers_privacy_*` — 접두 중첩(기존 self-flagged, 미해결, 신규 아님) | `spec/conventions/cafe24-api-catalog/store.md`(L445-450) vs `privacy.md` | cafe24 카탈로그 다음 손볼 때 `store_privacy_*` 류로 리네이밍 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 컨벤션 문서군이 소비측 spec 과 요구사항 ID·필드·수치 모두 대칭. 신규 충돌 없음 |
| rationale_continuity | LOW | 대표 표본 5축 교차검증 전부 정합(R-CCA-8 이 모범적 Rationale 연속성 사례). 263개 잔여 파일 미검증(INFO) |
| convention_compliance | NONE | frontmatter·명명·`_` prefix·pending_plans 실존성 전부 준수. Overview 헤딩 형식 편차만 INFO |
| plan_coherence | LOW | mains_update/delete 모순 미해소(WARNING, 기존 추적 중) + node-cancellation 권한 미반영(INFO, 정상 추적) |
| naming_collision | LOW | R8 3중 정의 bare 인용(WARNING) + execution.node.completed 동명이의(INFO) + privacy_* 접두 중첩(INFO, 기존 self-flagged) |

## 권장 조치사항
1. (BLOCK 없음 — 즉시 조치 불요) cafe24 category/`mains` 리소스를 건드리는 작업이 있으면 착수 전 `plan/in-progress/cafe24-backlog-residual.md` 의 "처리(착수 시)" 체크리스트(외부 docs 재확인)를 먼저 닫을 것.
2. `chat-channel-adapter.md` 의 bare `R8` 인용 3곳(§1.3, §R-CCA-7 a/c)에 파일 prefix(`[CC §R8]`)와 앵커 링크를 추가해 EIA/widget-app 의 동명 `R8` 과의 혼동을 제거할 것.
3. (낮은 우선순위) `execution.node.completed` WS↔내부타입 필드 매핑 표, cafe24 `privacy_*` 리네이밍, `CONVENTION:` 문서 Overview 헤딩 통일은 다음 해당 영역 작업 시 함께 처리.
4. 이번 turn 의 실제 변경(backend `*.spec.ts` 타입체크 정합)은 `spec/conventions/` 와 무관하므로 이 검토 결과를 근거로 구현을 진행해도 무방하다.