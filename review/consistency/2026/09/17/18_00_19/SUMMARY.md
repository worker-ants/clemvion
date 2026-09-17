# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음(5개 checker 전원 CRITICAL 0건, WARNING/INFO 만 존재)

## 전체 위험도
**MEDIUM** — Critical 없음(구현 착수 자체는 안전)이나, `plan_coherence` 가 지적한 "조건부 후속이 살아있는 트래커에 안 남고 사라질 위험"(같은 트래커 문서가 이미 겪은 패턴 재발)이 plan 갱신 없이 넘어가면 이후 회복 비용이 크다.

## Critical 위배 (BLOCK 사유)

(해당 없음 — Critical 0건)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | DRT-2 종결 시 "구현 뒤 planner 후속"(`spec/5-system/15-chat-channel.md` R8의 «(또는 `TriggersService.remove`)» 괄호를 실제 listener registry 해제 호출부로 넓히는 작업)을 새 planner 항목으로 옮겨 적는 단계가 체크리스트에 없음 | `plan/in-progress/trigger-deletion-release.md` `## 체크리스트` | `plan/in-progress/spec-draft-nullable-notation-followups.md` DRT-2 항목 본문 + `plan/complete/spec-draft-deletion-releases-trigger-resources.md` 비대상 표 | DRT-2 종결 노트에 "chat-channel.md R8 확장을 새 planner 항목으로 옮겨 적는다"를 체크리스트 단계로 명시 |
| 2 | plan_coherence | "사후 정리(sweeper)" — 고아 `secret_store` row·provider 등록·schedule job 정리 여부를 "구현 뒤 별도 판단"하기로 한 조건부 결정에 살아있는 트래커 소유자가 없음(현재 `complete/` 로 봉인될 draft 안에만 존재) | `plan/in-progress/trigger-deletion-release.md`(해당 항목 부재) | `plan/complete/spec-draft-deletion-releases-trigger-resources.md` "## 이 draft 가 **안** 하는 것" | "sweeper 필요 여부는 구현 뒤 재판단 — 아직 미결"을 새 트래커 항목(DRT-2 종결 노트 또는 별도)으로 옮겨 적는다 |
| 3 | plan_coherence | 트래커가 "동시 회전 보상"(W-a~W-e, D5 인터리빙 논증)을 **e2e 재진입** 검증으로 못박았는데 계획 체크리스트는 이를 "단위" 항목으로 축소, e2e 항목에는 미포함 | `plan/in-progress/trigger-deletion-release.md` `## 체크리스트` "e2e 먼저"/"단위" 항목 | `plan/in-progress/spec-draft-nullable-notation-followups.md` DRT-2 항목 표 6번("편한 지점에서 끊으면 진짜 결함도 초록") | 체크리스트에 "동시 회전 보상(W-a~W-e) — 재진입 훅으로 인터리빙 지점 고정한 e2e"를 별도 항목으로 추가하거나, 단위로 충분한 근거를 plan에 명시 |
| 4 | rationale_continuity | `spec/5-system/15-chat-channel.md` R8 "반드시 unregister" invariant(listener registry)가 설계 불릿에는 포함됐지만 체크리스트의 e2e/단위 검증 항목 어디에도 이름으로 등재되지 않음 | `plan/in-progress/trigger-deletion-release.md` "설계"·"체크리스트" 절 | `spec/5-system/15-chat-channel.md` R8 | 단위 항목에 "네 경로 모두 `ChannelListenerRegistry.has(triggerId)` 가 정리 후 false" 등 명시적 검증 서술 추가, 또는 e2e에 chat-channel 트리거 삭제 케이스 포함 (※ 위 #1과 같은 R8 자리를 다른 각도로 지적 — 체크리스트 보강 시 함께 처리 가능) |
| 5 | cross_spec | `spec/data-flow/10-triggers.md` §1.4 "Trigger 직접 삭제" 행만 형제 행(Schedule 삭제·Workflow/Workspace 삭제)과 달리 "— 미구현 (Planned)" 태그 없이 비밀 정리 순서를 현재형으로 서술 — `2-trigger-list.md` §4.3 이 명시한 "현재는 순서가 반대(비밀을 행 삭제 전에 지움)"와 모순 | `spec/data-flow/10-triggers.md` §1.4 표, "Trigger(type='schedule') 직접 삭제" 행 | `spec/2-navigation/2-trigger-list.md` §4.3 상단 2026-09-17 결정 문단 | 해당 행에 "— 미구현 (Planned)" 태그 추가 또는 시제 정정 — `spec_impact: none` plan 이므로 별도 `project-planner` 짧은 정정 턴 필요(developer 자기-반증 예외 미해당: 그 문장을 developer가 쓴 것이 아님) |
| 6 | naming_collision | `TriggerResourceReleaser`가 같은 `triggers/` 디렉토리의 injectable provider 4개(`TriggersService`, `ChatChannelBinderService`, `ChatChannelTokenRotatorService`, `NotificationSecretRotatorService`) 전부가 지키는 `*Service` 접미 컨벤션을 깸(다른 의미 충돌 아님, grep 0건) | `plan/in-progress/trigger-deletion-release.md` §설계, "`TriggerResourceReleaser` (`triggers/`, injectable)" | 같은 모듈의 기존 4개 provider 명명 100% 일관 사례 | `TriggerResourceReleaserService`로 개명(파일 `trigger-resource-releaser.service.ts`) 또는 개명하지 않는 근거를 plan에 한 줄 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `Trigger.type='manual'` row가 실행 시점에 무엇과 결부되는지 어느 문서에도 없음(기존 갭, 이번 스코프 밖) | `spec/2-navigation/2-trigger-list.md` vs `spec/data-flow/10-triggers.md` §1.1, `spec/4-nodes/7-trigger/1-manual-trigger.md` | 별도 트랙에서 정비 검토. 이번 삭제 자원 정리가 manual 타입도 포함하는지만 회귀 테스트 설계 시 확인 |
| 2 | rationale_continuity | `ModuleRef.get(TOKEN, {strict:false})`의 새 실패 모드(throw)가 `spec/5-system/4-execution-engine.md` §4.4 표의 기존 두 사례(둘 다 no-op)와 다른데 표에 반영 안 됨 | `plan/in-progress/trigger-deletion-release.md` "모듈 위치" 절 vs `spec/5-system/4-execution-engine.md` §4.4 | 후속 planner 턴에서 §4.4 표에 트리거 쪽(throw) 사례 행 추가 |
| 3 | rationale_continuity | DRT-2 트래커의 "부수 주의 둘"(커밋 뒤 정리 단계가 이미 지워진 workspace_id 참조 audit row 안 남김, 신규 `deleteByPrefix` 호출부도 prefix를 UUID로 조립)이 설계상 충족되나 plan 문서에 근거로 명시되지 않음 | `plan/in-progress/trigger-deletion-release.md` (해당 절 없음) | `deleteTriggerSecretsAfterCommit` 불릿에 "audit_log 아님 — 커밋 뒤 시점엔 workspace_id FK가 이미 없음" 한 줄 추가 |
| 4 | convention_compliance | `secret-store.md §2.1` vs §2 인터페이스 불일치(이전 라운드 WARNING)는 이미 해소 확인됨 | `spec/conventions/secret-store.md` §2 | 조치 불요 |
| 5 | convention_compliance | `spec-impl-evidence.md §3.1` 전이 규칙에 "실측에 의한 하향 정정" 경로가 여전히 미명문화(기존 갭, 재관측) | `spec/conventions/spec-impl-evidence.md` §3.1 | 별도 planner 턴에서 하향 전이 규칙 추가 검토 |
| 6 | naming_collision | `W-a`~`W-e` 라벨이 저장소 전역의 `W<N>`(리뷰 발견 WARNING 번호) 관용구와 시각적으로 겹침(형태 다름, 파싱 충돌 없음) | `plan/in-progress/trigger-deletion-release.md` §착수 전 실측 "쓰기 경로" 표 | 필수 아님 — 재사용 여지를 없애려면 `RP-1`~`RP-5` 등으로 교체 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `data-flow/10-triggers.md` §1.4 한 행의 Planned 태그 누락(시제 모순) |
| rationale_continuity | LOW | R8 listener registry invariant가 체크리스트 검증 대상에서 누락 |
| convention_compliance | LOW | 새 위반 없음. 기존 갭(하향 전이 미명문화) 재확인만 |
| plan_coherence | MEDIUM | DRT-2 종결 시 사라질 위험이 있는 조건부 후속 2건 + e2e→단위 축소 1건 |
| naming_collision | LOW | `TriggerResourceReleaser`의 `*Service` 접미 컨벤션 이탈 |

## 권장 조치사항
1. `plan/in-progress/trigger-deletion-release.md` 체크리스트에 다음 세 단계를 명시적으로 추가한다 (WARNING #1~#3, MEDIUM 등급의 근원):
   - DRT-2 종결 노트에 `spec/5-system/15-chat-channel.md` R8 확장을 새 planner 항목으로 옮겨 적는다.
   - sweeper(사후 정리) 필요 여부 재판단을 살아있는 트래커 항목으로 옮겨 적는다.
   - 동시 회전 보상(W-a~W-e)의 e2e 재진입 검증(인터리빙 지점 고정)을 별도 체크리스트 항목으로 명시한다.
2. 같은 체크리스트 보강 작업 중 listener registry unregister(R8 invariant, WARNING #4)를 단위/e2e 검증 대상으로 이름 붙인다.
3. `TriggerResourceReleaser` 명명을 `*Service` 접미 컨벤션에 맞추거나(개명), 예외 근거를 plan에 한 줄 남긴다(WARNING #6).
4. `spec/data-flow/10-triggers.md` §1.4 "Trigger 직접 삭제" 행에 "— 미구현 (Planned)" 태그를 추가하는 짧은 `project-planner` 정정 턴을 별도로 예약한다(WARNING #5, developer 권한 밖).
5. INFO 항목은 이번 구현 착수를 막지 않으므로 별도 트랙(향후 planner 턴)에서 처리한다.
