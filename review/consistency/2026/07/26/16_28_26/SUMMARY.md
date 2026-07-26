# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, Critical 0건)

모드: 구현 완료 후 검토 (`--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`)

## 전체 위험도

**MEDIUM** — 코드 결함은 없다(7라운드 ai-review 가 Critical 0 / Warning 0 으로 수렴). 발견된 WARNING 은 전부 **문서 동기화** 두 축이다: (a) `spec/` 갱신은 developer 권한 밖이라 planner 위임 대상, (b) **plan 기록 누락** — 백로그 7건 중 5건이 어느 plan 에도 적혀 있지 않아 유실 위험이 있었다. (b) 는 developer 범위라 **이번 턴에 조치했다**.

## Critical 위배 (BLOCK 사유)

**없음.**

## 경고 (WARNING)

| # | Checker | 위배 | 조치 |
|---|---------|------|------|
| 1 | **plan_coherence** | **백로그 7건 중 5건이 어느 plan 에도 기록되지 않았다** — 선재 spec flakiness(W23) · 가드 시퀀스 헬퍼 승격(W8) · shutdown `FAILED` 미감지 · WS spec 서술 갱신 · harness diff-list 갭. 특히 W8 은 `11_48_55/RESOLUTION.md` 가 "이미 plan 에 명시돼 있음" 이라 적었으나 **사실이 아니었고**, 이후 라운드들이 그 잘못된 전제를 반복 인용만 했다. review 산출물은 시점 스냅샷이라 SoT 가 아니므로 다음 세션이 이를 다시 훑지 않으면 조용히 유실된다 | **조치함** — 5건 전부 `node-cancellation-residual-signal-propagation.md` 백로그 절에 명시 기록. W8·shutdown 항목에는 "여기 처음 기록된다" 는 경위까지 남김 |
| 2 | **plan_coherence** | plan 의 완료 서술이 **4라운드(4R~7R) 뒤처짐** — 실제 구현은 선형 3곳이 아니라 가드 5곳 + 재throw 6곳이고 Sub-Workflow·Background 확장이 plan 에 "0건" 이었다. 위임 문서 §6 표 제안도 1R 시점에서 멈춰 planner 가 그대로 반영하면 새 spec-drift | **조치함** — "후속 3 (3R~7R)" 절 추가로 최종 범위 전량 기록 + 위임 문서 갱신 필요성 명시 |
| 3 | **cross_spec** | `NodeExecution.status=cancelled` 의 **생산자 서술이 4곳에 복제**돼 있어 SoT 만 고치면 미러 3곳(`4-execution-engine.md:114`·`1-data-model.md:546`·`data-flow/3-execution.md:282` 다이어그램)이 즉시 stale 해진다 | **조치함** — 위임 #6 보강 (1) 로 `spec_impact` 확장 + 각 파일 라인 명시 |
| 4 | **cross_spec** | WS `execution.node.cancelled` 이중 생산자 이슈가 **`plan/` 어디에도 없었다**(review 산출물 안에서만 3라운드 구두 전달) | **조치함** — 위임 #6 보강 (4) 로 persist |
| 5 | **convention_compliance · rationale_continuity** (수렴) | §5.2 errorPolicy 표가 `ExecutionCancelledError` 의 **정책-무관 우회 재throw** 를 다루지 않는다 — 문면대로 읽으면 `continue` 에서 계속되는 것으로 오독 | **조치함** — 위임 #6 보강 (2) 로 §5.2 예외 명문화 요청 |
| 6 | **rationale_continuity** | 250ms 스로틀의 Rationale(카운트 기반 대안 기각 등)이 위임 #6 에 없어 병합 시 spec 에서 영구 누락 위험 | **조치함** — 위임 #6 보강 (3) 로 이관 요청 |
| 7 | **convention_compliance** | `node-cancellation.md` §2.3/§5.1 이 신규 가드를, `error-codes.md` 가 `AbortError` 를 미반영/미등재 | **이미 위임됨** — #6 본문 및 "#4 (1)" 에 기재. 보강 (5) 로 교차 참조 추가 |
| 8 | **naming_collision** | `markNodeCancelled` 가 같은 클래스의 기존 `markExecutionCancelled` 와 패턴이 겹쳐 variant 로 오독될 소지(실제 이웃은 `finalizeCancelledExecution`) | **백로그 분리** — 빌드·런타임 무영향(LOW)이고, 코드를 건드리면 방금 수렴한 7라운드 ai-review 가 다시 stale 해진다. plan 백로그에 개명(`finalizeCancelledNode`) 또는 JSDoc 명시 두 안과 함께 기록 |

## 참고 (INFO)

- `node-cancellation.md` frontmatter `pending_plans:` 가 `spec-update-node-cancellation-shutdown-classification.md` 를 아직 가리키지 않음 — planner 소관.
- (a) per-node task-queue 재도입 아님, (b) send-email in-flight 미채택 선례와 정합 — rationale_continuity 가 실측으로 확인, 위반 없음.
- `assertExecutionNotCancelled`·`finalizeCancelledExecution`·`containerCancelCheckedAtMs`·`CONTAINER_CANCEL_CHECK_THROTTLE_MS`·`ExecutionCancelledError` message 인자 — 전부 기존 명명 관례(`assert*`/`finalize<Status>Execution`/`<domain>Map`/`SCREAMING_SNAKE_CASE`)와 일치, 충돌 없음.
- BLOCKED 항목(workflow-timeout/shutdown 노드 abort)은 코드·spec·plan 3자가 일치하며 **어떤 커밋도 우회하지 않았다** — `git diff --stat -- '**/shutdown-state*'` 0건으로 실증.
- **프롬프트 번들 결함**: 5개 checker 전원이 프롬프트에서 `node-cancellation.md` 본문·실제 diff 가 컨텍스트 예산 초과로 생략됐다고 보고. 전원 워크트리를 직접 열어 검증했다(`feedback_impl_done_spec_bundle_bug` 와 동일 클래스).

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| plan_coherence | MEDIUM | 백로그 5건 미기록 + 완료 서술 4라운드 지연 (둘 다 조치함). BLOCKED 항목 정상 보존 확인 |
| convention_compliance | MEDIUM | §2.3/§5.1 미문서화 · §5.2 예외 누락 · `AbortError` 미등재 · §5.1 `meta.success` 미이행 — 전부 "구현이 규약을 앞서간" SPEC-DRIFT, 위임 완료 |
| cross_spec | LOW | 생산자 서술 4곳 복제 + WS 이슈 plan 미기록 (둘 다 조치함). 데이터 모델·API·요구사항 ID·RBAC 충돌 없음 |
| rationale_continuity | LOW | 기각된 대안 재도입 **없음**(per-node queue·send-email 선례 모두 정합). 스로틀·§5.2 예외 Rationale 의 위임 이관만 필요 |
| naming_collision | LOW | 신규 식별자 6개 중 5개는 기존 관례 준수. `markNodeCancelled` 명명만 혼동 소지 |

## 권장 조치사항

1. **(완료)** plan 백로그 5건 기록 + 완료 서술을 최종 범위(가드 5곳·재throw 6곳, Sub-Workflow·Background 포함)로 갱신.
2. **(완료)** 위임 #6 을 5개 항목으로 보강 — `spec_impact` 확장(미러 3파일) · §5.2 예외 · 250ms Rationale · WS 생산자/`error` optional · `AbortError` 등재.
3. **(planner 턴)** 위 위임을 `spec/` 에 반영. developer 권한 밖.
4. **(백로그)** `markNodeCancelled` 개명 또는 JSDoc 명시.
