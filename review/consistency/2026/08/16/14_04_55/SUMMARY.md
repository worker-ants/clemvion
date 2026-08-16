# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 2건 발견 (근거 오인용 1건 + anchor placeholder 1건)

## 전체 위험도
**CRITICAL** — §R17 신설 5번째 불릿의 핵심 정당화가 인용한 spec 원문을 정반대로 읽었고, 그 정당화로
닫으려던 미결 트래커 항목(I1)은 언급조차 없이 조용히 확정됐다. 별도로 §6.4 캐비엇의 앵커가
미완성 placeholder 라 그대로 반영하면 build 가드를 깬다. 둘 다 spec 반영(§5) 이전 국소 수정으로
해소 가능하며, 두 항목 모두 target 문서(`plan/in-progress/spec-draft-eia-error-masking-catalog.md`)를
쓰는 project-planner 자신의 권한 범위 안에 있다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity(CRITICAL), convention_compliance(WARNING), cross_spec(WARNING), plan_coherence(WARNING) | "내부 REST 는 마스킹하지 않는다(비대칭 — 의도)" 근거로 인용한 `execution.ai_message` 불릿이 실제로는 **정반대**(내부 WS·Chat Channel 도 마스킹됨)를 말한다. 아직 채택되지 않은("후속 개선 여지") 대안을 이미 확정된 판단처럼 근거로 썼고, 이 정확한 질문은 트래커에 미결(I1)로 열려 있는데 언급·해소 없이 조용히 확정했다 | `plan/in-progress/spec-draft-eia-error-masking-catalog.md` §R17 5번째(삽입상 4번째) 신설 불릿의 마지막 하위 항목 | (1) 같은 §R17 의 `execution.ai_message` 불릿(`spec/5-system/14-external-interaction-api.md:1436-1440`, "내부 WS·Chat Channel 도 마스킹됨(수용된 trade-off)") — 인용 대상이 정확히 반대 결론 (2) `spec/2-navigation/14-execution-history.md:466` — 동일 엔드포인트(`GET /api/executions/:id`) 안전성을 "롤 게이팅이 아니라 masking parity 에 의존" 으로 규정, target 의 "인증 기반 신뢰" 논리와 상충 (3) `plan/in-progress/spec-sync-external-interaction-api-gaps.md:180-184` I1 미결 항목 — target 이 사실상 (a)안을 선택하면서도 트래커를 언급·해소하지 않음 | 인용을 `llmCalls` strip(`stripExternalOnlyFields`) 선례 또는 `conversationThread` 의 "egress-only(의도)" 하위 항목으로 교체해 정확한 근거로 재작성. 또는 masking-parity 원칙(옵션 b: 내부 REST 도 마스킹 범위 포함)으로 설계 자체를 재검토. 어느 쪽이든 I1 항목을 이 결정으로 체크·링크 |
| 2 | convention_compliance(CRITICAL), naming_collision(INFO) | §6.4 캐비엇 추가문의 `[§R17](#r17-…)` 앵커가 말줄임표가 남은 미완성 placeholder — 실제 heading slug 와 불일치 | 변경안 `② §6.4 — 페이로드 절에 캐비엇 추가` 인용 블록 | `spec/conventions/spec-impl-evidence.md` §4.2 `spec-link-integrity.test.ts` build 차단 가드(heading slug 대조). 그대로 landing 시 build 가 즉시 깨짐 | 같은 문서 L698 선례의 완전한 슬러그(`#r17-getstatus-의-currentnodecontext-실값-노출-...`)로 교체하거나, 다른 R17 인용들(L449, L836)처럼 plain-text `§R17` 참조로 낮춰 anchor 의존 제거 |

## planner 인계 (권한 밖 Critical)

(없음) — target 은 `plan/in-progress/spec-draft-eia-error-masking-catalog.md` 자체이며, 이는
project-planner 가 `--spec` 검토 직전에 쓰는 자기 소유 draft plan 이다(spec/**, plan/** 모두
project-planner 쓰기 권한 범위). 위 Critical 2건 모두 이 draft 문서 자체의 인용 오류·미완성
placeholder 이므로 project-planner 가 spec 반영(§5) 전에 직접 수정 가능 — 다른 role 로 인계할
권한 밖 사유가 없다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | target 이 이행하는 두 tracker(W1·I1)의 체크박스를 spec 반영 후 `[x]` 로 갱신하는 절차가 target 안에 없고, 같은 followup 의 원 출처인 `eia-terminal-error-sanitize.md` 후속 항목도 `pending_plans` 에서 누락돼 하나만 닫히면 다른 하나가 stale 로 남는다 | frontmatter `pending_plans` + 본문 전체 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W1/I1, `plan/in-progress/eia-terminal-error-sanitize.md` "후속(이 PR 범위 밖)" 첫 항목 | target 의 조치 절에 "spec 반영 후 두 tracker + 원출처 plan 의 해당 체크박스를 `[x]` 로 갱신" 명시 추가, `eia-terminal-error-sanitize.md` 도 `pending_plans` 에 추가 |
| 2 | naming_collision | §R17 신설 불릿 표제가 기존 3번째 불릿과 표제 레벨에서 백틱 `` `error` `` 토큰을 공유 — 본문 캐비엇으로 방어돼 있으나 표제만 훑는 독자(과거 "REST 와 대칭" 오기 전례 있음)는 다시 미끄러질 수 있음 | §R17 5번째(4번째) 신설 불릿 표제 | `spec/5-system/14-external-interaction-api.md:1441` 3번째 불릿 표제(`nodeOutput.conversationConfig` + terminal `result`/`error`) — 서로 다른 컬럼인데 표제만 보면 구분 안 됨 | 표제 자체에 이벤트명·DB 컬럼명을 직접 명시 (예: `` **종결 이벤트 `execution.failed` payload 의 `error.message`/`error.details` (DB `Execution.error` 원문, 강제됨 — 2026-08-16)** ``) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `Execution.error` 문구가 `spec/1-data-model.md` 필드 설명과 대조해도 모순 없음(data-model.md 는 masking 미언급, egress 마스킹은 EIA 문서 소관이라는 기존 관례와 일치) | `spec/1-data-model.md:556-563` | 별도 수정 불필요, 확인만 |
| 2 | convention_compliance | plan frontmatter `pending_plans:` 를 plan-대-plan cross-link 용도로 쓰는 패턴이 spec-impl-evidence.md §2.1 정의(spec 전용)와 다르지만, 형제 draft(`spec-draft-eia-notification-payload-contract.md`)도 동일하게 써서 지역 관행으로 굳어져 있고 build 가드 대상도 아님 | frontmatter `pending_plans:` | (선택) 의미 혼동 방지 위해 `related_plans:` 로 명칭 분리 검토 — 규약 갱신 제안이지 현재 위반 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `ai_message` 불릿 오인용 + 같은 엔드포인트의 masking-parity 원칙(다른 spec 문서)과 상충(WARNING), pending_plans 트래커 동기화 누락(INFO) |
| rationale_continuity | CRITICAL | "내부 표면은 원문 유지" 근거가 인용한 R17 불릿을 정반대로 읽음 + 트래커 미결 항목(I1)을 언급 없이 확정 |
| convention_compliance | MEDIUM (문서 내 CRITICAL 1건 포함) | §6.4 앵커 미완성 placeholder — build 가드(`spec-link-integrity.test.ts`) 위반(CRITICAL), 동일 오인용 문제(WARNING) |
| plan_coherence | MEDIUM | I1 근거 오인용(WARNING) + tracker 체크박스 동기화 계획 누락(WARNING) |
| naming_collision | LOW | §R17 신설 불릿 표제의 `error` 토큰 공유(WARNING, 본문 방어 有) + §6.4 축약 앵커(INFO) |

## 권장 조치사항
1. **(BLOCK 해소 최우선)** §R17 5번째 신설 불릿의 "내부 REST 는 마스킹하지 않는다" 근거 인용을
   `execution.ai_message` 불릿에서 `llmCalls` strip(`stripExternalOnlyFields`) 선례 또는
   `conversationThread` 의 "egress-only(의도)" 하위 항목으로 교체. `2-navigation/14-execution-history.md`
   의 masking-parity 원칙과의 상충도 함께 검토해 두 spec 문서가 같은 엔드포인트에 상반된 보안 모델을
   병치하지 않도록 한다. 수정 후 `spec-sync-external-interaction-api-gaps.md` I1 항목을 체크·링크.
2. **(BLOCK 해소)** §6.4 캐비엇의 `[§R17](#r17-…)` 를 완전한 heading slug(L698 선례) 로 교체하거나
   plain-text `§R17` 참조로 낮춰 `spec-link-integrity.test.ts` build 가드를 통과하도록 한다.
3. spec 반영(§5) 완료 후 `spec-sync-external-interaction-api-gaps.md` W1·I1, `eia-terminal-error-sanitize.md`
   해당 후속 항목을 `[x]` 로 갱신하고 두 plan 이 서로 참조하도록 정리. target frontmatter
   `pending_plans` 에 `eia-terminal-error-sanitize.md` 도 추가.
4. (선택, 견고화) §R17 신설 불릿 표제 자체에 이벤트명·DB 컬럼명을 명시해 3번째 불릿과 표제
   레벨에서부터 구분되게 한다.