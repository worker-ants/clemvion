# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전문 확보 완료, Critical 발견 없음.

## 전체 위험도
**MEDIUM** — Critical 은 없으나, 활성 plan(`eia-terminal-error-sanitize.md`)이 기존 Rationale(R17)·자매 트래커(`spec-sync-external-interaction-api-gaps.md`)와 조율 없이 진행 중인 점이 실질적 조치 필요 항목으로 남아 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 아래 두 항목(webhook stale legacy 서술, chat-channel 구버전 서술)은 `spec/` 수정이 필요해 궁극적으로 planner 턴 대상이지만 등급이 WARNING 이라 BLOCK 사유는 아니다. 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 등재되어 있으므로 별도 인계 없이 해당 plan 트래커로 추적한다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | `eia-terminal-error-sanitize.md` 의 DB write-time sanitize 결정이 R17 의 "egress-only masking / append-time redaction 은 후속 항목" 원칙과 반대 방향인데 R17 을 인용·조율하지 않음 | `plan/in-progress/eia-terminal-error-sanitize.md` | `spec/5-system/14-external-interaction-api.md` `## Rationale` R17 | plan/커밋 메시지에 "R17 유예는 `conversationThread`(내부 재소비 有) 한정, `Execution.error` 는 재소비 경로 없어 유예 조건 밖" 근거 1~2문장 명시. 워크플로우 에디터(신뢰 채널) `Error: <message>` 표시가 마스킹값을 받아도 되는지 별도 확인 |
| 2 | plan_coherence | `eia-terminal-error-sanitize.md` 착수가 동일 증상(종결 `error.message` 마스킹 미적용)을 다루는 `spec-sync-external-interaction-api-gaps.md` 항목을 인지·상호참조하지 않은 채 별도 메커니즘으로 진행 | `plan/in-progress/eia-terminal-error-sanitize.md` | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` ("`22_55_51` security W2" 항목) | 커밋/체크리스트에 두 plan 상호 참조 추가. `message` 필드는 write-time sanitize 로 실질 해소되는지, `details` 필드(스코프 불일치 — 현재 미사용)는 잔여로 남는지 판단해 두 plan 문서 동시 갱신 |
| 3 | cross_spec | target §5.1 이 webhook §5.2 를 "legacy statusCode/errors shape" 로 서술하나, webhook §5.2 는 2026-06-28(#754)에 이미 동일한 신규 에러 봉투로 정합화됨 — stale 사실 오류 | `spec/5-system/14-external-interaction-api.md` §5.1 (line 320) | `spec/5-system/12-webhook.md` §5.2 | "legacy" 캐비엇 제거 또는 "webhook 도 동일 공식 봉투(2026-06-28 정합화)" 로 정정. 이미 `spec-sync-external-interaction-api-gaps.md` 에 등재(미해결) — planner 턴에서 함께 처리 |
| 4 | cross_spec | `15-chat-channel.md` §5.1/§8 가 `InteractionRequestContext` 를 구버전(단일 인터페이스+optional `scope`)으로 서술, target 은 이미 discriminated union(`scope` required literal) — 토큰 우회 방지라는 보안 민감 설계 의도가 전달 안 됨 | `spec/5-system/15-chat-channel.md` §5.1(~319)/§8(~507) | `spec/5-system/14-external-interaction-api.md` §3.3.1 (EIA-AU-08) | chat-channel 문서를 target §3.3.1 을 가리키는 포인터로 교체(중복 서술 대신 SoT 인용). 이미 등재(미해결) — planner 턴에서 함께 처리 |
| 5 | convention_compliance | `interaction.triggerToken`(영구 토큰, `itk_*`) 이 같은 모듈의 형제 필드(`notification.signing.secretRef`)와 달리 `SecretResolver` 미경유, JSONB 평문 보관("향후 검토"로만 서술) | `spec/5-system/14-external-interaction-api.md` §7.1 Trigger 엔티티 확장 각주 | `spec/conventions/secret-store.md` Overview ("모든 도메인 모듈은 SecretResolver 경유") | (a) `secret://triggers/{triggerId}/interaction-token` 슬롯으로 이관 + 구현 plan 신설, 또는 (b) `secret-store.md` §1 "비대상" 절에 명시적 등재 + Rationale 근거 기록. 현재 어느 plan 에도 추적되지 않는 신규 항목 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `data-flow/15-external-interaction.md:119` 가 target 에 정의되지 않은 `EIA-AU-09` 를 인용 | `spec/data-flow/15-external-interaction.md:119` | `EIA-AU-09` 삭제(dangling ID). 이미 `spec-sync-external-interaction-api-gaps.md` 등재(미해결) — planner 턴 |
| 2 | rationale_continuity | `sanitize-error-message.ts` docstring 정정 시 R17 과의 관계를 명시할 기회 | `codebase/backend/.../sanitize-error-message.ts` 첫 줄 | "본 유틸은 R17 이 규정한 마스킹 SoT 를 종결 error 필드에도 적용" 1줄 cross-reference 추가 |
| 3 | convention_compliance | `--impl-prep` 프롬프트 번들이 target 이 실제 인용하는 `spec/conventions/*.md` 11개 본문을 예산 초과로 생략, cafe24 카탈로그가 예산 대부분 소비 | `_prompts/convention_compliance.md` | 관련 규약 본문을 카탈로그류보다 우선 배치하도록 조립 로직 변경 — 별도 harness 티켓 |
| 4 | cross_spec | 동일 원인으로 `_prompts/cross_spec.md` 도 `spec/5-system/` target 외 17개 파일·대부분 `related_specs` 를 예산 초과로 생략(직접 Read 로 보완됨) | `_prompts/cross_spec.md` | 위 #3 과 동일 harness 티켓으로 통합 |
| 5 | plan_coherence | `retry-turn-terminal-guard.md` 의 "spec 자기모순 정정"(project-planner 위임) 항목이 target(`4-execution-engine.md:1549-1550`)에 2026-07-28 자로 이미 정정 반영됐음에도 체크박스 미체크 | `plan/in-progress/retry-turn-terminal-guard.md` | 체크박스 갱신(이미 끝난 턴을 다음 세션이 재조사하지 않도록) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 광범위 정합 확인(WS·RBAC·에러봉투·Redis키·HMAC 등 다수 일치). 실질 발견 3건은 모두 "다른 문서가 target 최신 상태를 못 따라간 stale 참조"이며 기존 plan 에 이미 등재 |
| rationale_continuity | MEDIUM | 활성 plan(write-time sanitize)이 spec 내 기존 R17 원칙과 반대 방향 결정을 하면서 근거를 남기지 않음(실제 상충 가능성은 낮으나 미기록) |
| convention_compliance | LOW | 명명·포맷·문서구조 등 전반 높은 준수. `interaction.triggerToken` SecretResolver 미경유가 유일한 실질 간극, 추적 plan 없음 |
| plan_coherence | LOW | Plan 트리 대부분 정합. 두 plan(`eia-terminal-error-sanitize` / `spec-sync-external-interaction-api-gaps`)의 동일 증상 미동기화가 유일한 실질 이슈 |
| naming_collision | NONE | 이번 턴(`eia-terminal-error-sanitize`, `spec_impact: none`)은 신규 식별자 도입이 전혀 없어 충돌 가능성 자체가 없음. target spec 도 이번 턴 무변경(diff 0) |

## 권장 조치사항
1. `eia-terminal-error-sanitize.md` 구현 시 `spec-sync-external-interaction-api-gaps.md` 의 동일 항목과 상호 참조를 명시하고, R17 과의 관계(왜 `Execution.error` 는 egress-only 유예 조건 밖인지)를 커밋/plan 문서에 1~2문장으로 남긴다.
2. `interaction.triggerToken` 의 `SecretResolver` 미경유 문제 — 이관 plan 신설 또는 `secret-store.md` 예외 등재 중 하나로 결정하고 근거를 Rationale 에 기록한다.
3. cross_spec 이 지적한 2건(webhook §5.2 "legacy" stale 서술, chat-channel `InteractionRequestContext` 구버전 서술)은 이미 `spec-sync-external-interaction-api-gaps.md` 에 등재돼 있으므로, 다음 planner 턴에서 함께 정정한다.
4. 저비용 INFO 항목(`EIA-AU-09` dangling 참조 삭제, docstring R17 cross-link, `retry-turn-terminal-guard.md` 체크박스 정리)은 위 조치와 함께 반영한다.
5. `--impl-prep` 프롬프트 번들의 예산 배분 문제(cross_spec·convention_compliance 공통 지적 — 관련 규약/spec 본문이 무관한 카탈로그에 밀려 생략됨)는 별도 harness 개선 티켓으로 남긴다.