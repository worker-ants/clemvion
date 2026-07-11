# Consistency Check (--impl-done) 통합 보고서

대상: EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드 구현
(spec/5-system/14-external-interaction-api.md 영역 + 코드 diff vs `52f46f95f`)

BLOCK: NO

## BLOCK 결정: **NO**

5개 checker 모두 CRITICAL 0. 병합/push 차단 사유 없음. 반복 검출된 WARNING 은 단일
사안(spec 본문이 신규 3번째 거부 케이스를 아직 열거하지 않음)으로, `plan/in-progress/
eia-command-waiting-surface-guard.md` 의 S-1 로 project-planner 위임이 등재돼 추적 중이다.

## checker 별 결과

| checker | 위험도 | CRITICAL | 핵심 |
|---|---|---|---|
| cross_spec | LOW | 0 | 신규 코드 없이 기존 STATE_MISMATCH/INVALID_EXECUTION_STATE 재사용, EIA-IN-13 필수 계약의 미이행 갭을 메움. §7.5.1·EIA §5.1/§6.2·§10.9·§9·data-flow §1.2 는 "값 모순" 아닌 "비완전 열거" — plan S-1 추적. 위젯·chat-channel 소비처는 STATE_MISMATCH 를 사유 무관 graceful 처리라 깨지는 계약 없음 |
| rationale_continuity | MEDIUM | 0 | AI 표면 4종 허용이 §10.9 button_click re-park invariant + §6.2 render_form 응답 보존(회귀 테스트로 고정). fail-closed 는 기존 fail-open 선례(인프라 가용성 한정)와 상충 없음(PR #637 선례와 동방향). WARNING=spec 본문 미반영(plan S-1) |
| convention_compliance | LOW | 0 | error-codes 규약 준수(기존 코드 재사용), §5.3 응답 shape·§7.5.2 client-safe/serverDetail 분리 준수. WARNING 2=spec 열거 완결성 |
| plan_coherence | LOW | 0 | plan 체크리스트가 diff·RESOLUTION 과 정합, Warning 미조치 4건이 F-1/F-2/F-3/S-1 로 정확히 이관. WARNING=F-1 이 자매 애그리게이터 plan 에 미러링 안 됨(유실 위험 낮음) |
| naming_collision | LOW | 0 | 신규 식별자 8종 전역 grep 충돌 없음. WaitingSurface(3값)↔WaitingInteractionType(4값) 근접하나 별개 개념(plan 인지) |

## 후속 (BLOCK 아님, plan 추적)

- **S-1** — spec 본문 동기(§7.5.1 표 3번째 행+Rationale, EIA §5.1/§6.2, §10.9, §9, registry cross-ref): project-planner 위임.
- **F-1** — `spec-sync-external-interaction-api-gaps.md` 애그리게이터에 F-1 미러링(plan_coherence WARNING).
