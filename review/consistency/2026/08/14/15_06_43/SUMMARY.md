# Consistency Check 통합 보고서

**BLOCK: YES** — naming_collision checker 가 `turnDebug` 명칭 충돌을 CRITICAL 로 판정했으며, 이 항목은 다른 4개 checker(cross_spec/rationale_continuity/convention_compliance/plan_coherence) 도 각각 WARNING 수준으로 독립 관측해 교차 확인된다.

## 전체 위험도
**HIGH** — target(`plan/in-progress/spec-draft-eia-62-waiting-payload.md`) 자신이 실증까지 마친 `turnDebug` 명칭 충돌(top-level object vs `nodeOutput.meta.turnDebug` 배열, WS §4.4:449 정본)의 처분이 "변경 제안 (1)~(7)" 확정 범위·"spec 반영 7항목" 체크리스트 어디에도 닫히지 않은 채 `[ ]` 로 남아 있다. 이 상태로 spec 에 반영되면 정식 명칭 충돌이 고착된다. 그 외에는 `error.code` optional화가 `data-model.md §2.14`·`15-chat-channel.md R-CC-15`·swagger.md 부재표현 규약에 파급되는 지점이 미결로 남아 있는 정도의 MEDIUM/LOW 위반.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | `turnDebug` 명칭 충돌 처분이 미확정 — target 문서 자신이 발견한 handoff("planner 인계: §6.2 재작성 시…")가 정확히 이 문서 자신을 가리키는데, "변경 제안 (1)~(7)" 어디에도 리네임/disambiguation 이 포함되지 않았고 체크리스트 항목은 `[ ]` 로 열려 있음 | `## 🔴 조사 중 발견 > ### 처분 (실제 상태)` 두 번째 미체크 항목; `## 변경 제안 (1)`(안쪽 JSON 그대로 둔다) 및 `(3)`(blockquote 재작성, `turnDebug` 미포함) | `spec/5-system/6-websocket-protocol.md:449` §4.4 표 — `nodeOutput.meta.turnDebug`(배열, 정본) vs `ai-turn-orchestrator.service.ts:615-617` top-level `turnDebug`(object, `llmCalls`/`metadata`) | 이번 라운드에서 체크리스트 항목을 명시적으로 닫을 것: (a) **범위 확정형** — "(1)의 결정으로 §6.2 는 top-level `turnDebug` 를 문서화하지 않는다"를 본문에 못박고 `[x]` 로 닫으며 별도 후속 항목으로 재등재, 또는 (b) **해소형** — (3)의 blockquote 에 `turnDebug` 행을 추가해야 한다면 리네임(`turnDebugSnapshot` 등) 또는 WS §4.2 `resumed` 필드에 이미 쓰인 disambiguation 문구 패턴을 그 행 옆에 부착 |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 이 Critical 은 `spec/` drift 가 아니라 **target plan 문서 자신의 미결 체크리스트 항목**이며, 이 문서를 작성 중인 세션(consistency-check 를 호출한 바로 그 turn)의 권한 범위 안에서 해소 가능하다. 다만 target 문서 자신이 이미 이 항목을 "planner 인계" 로 명명해 두었으므로, 다음 표에 참고용으로 기재한다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | target 문서 자신의 표현("planner 인계")을 따르면 §6.2 최종 spec 반영은 project-planner 권한(spec/ 쓰기) 이지만, 이 처분 자체는 지금 이 draft 를 쓰는 세션에서 결정 가능 — 강한 의미의 "권한 밖"은 아님 | project-planner (spec/14-external-interaction-api.md, spec/5-system/6-websocket-protocol.md 반영 시) | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` `## 🔴 조사 중 발견` 체크리스트 + `## 변경 제안 (1)`/`(3)` + `## 체크리스트`(7항목 카운트) | `10_32_29` naming_collision CRITICAL 1 (원 발견), 본 라운드 naming_collision/cross_spec/convention_compliance/plan_coherence 4개 checker 교차 확인 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | "현행 §6.2 와의 대조" 표가 오너십이 다른 필드(`waitingNodeLabel`/`nodeExecutionId`/`startedAt` = WS §4.4 기소유·의도된 스코프 밖 vs `turnDebug` = 소유 미선언·진짜 gap)를 한 행("(언급 없음)")으로 합쳐, (3) 집행 시 과대 스코프 오독 위험 | "현행 §6.2 와의 대조" 표 | `spec/5-system/6-websocket-protocol.md:394,975` 오너십 분리 컨벤션 | "(언급 없음)" 행을 둘로 쪼개 WS §4.4 기소유 3필드 / `turnDebug` 진짜 gap 을 구분 표기 |
| 2 | cross_spec | `error.code` 옵셔널화(제안 (4))가 같은 draft 의 (5) `data-model.md §2.14` 갱신 범위에 반영 안 됨 — "구조" 행이 여전히 `code` 를 항상 존재하는 것으로 서술 | `## 변경 제안 (4)` / `(5)` | `spec/1-data-model.md §2.14` "구조" 행; `plan/in-progress/eia-terminal-payload.md` 동일 누락 반복 | (5)의 편집 범위를 `{nodeId: "uuid"\|null, code?: "ERROR_CODE", message, details?}` 로 확장하고 `eia-terminal-payload.md` 해당 행도 함께 정정 |
| 3 | cross_spec | `turnDebug` 이름 충돌(CRITICAL)이 "spec 반영 7항목 (1)~(7)"에 포함 안 됨 — naming_collision Critical #1 과 동일 근본 원인, 다른 각도(체크리스트 스코프 누락) | `## 🔴 조사 중 발견` 체크리스트 vs `## 체크리스트` "7항목" | `spec/5-system/6-websocket-protocol.md §4.4` | (1)~(7) 중 하나(예: (3))에 disambiguation 문구 포함 또는 별도 (8)항목 승격, "7항목" 표기 갱신 |
| 4 | rationale_continuity | title/Overview/하단 `## Rationale` 이 item (1) 의 철회("안쪽 JSON 은 그대로 둔다")와 반대되는 문구("실측 shape 으로 재작성"/"안쪽 구조가 통째로 실제와 다르다"/"왜 예시를 실측으로 맞추나")를 여전히 담고 있음 | frontmatter `title`, `## Overview`, 하단 `## Rationale` | `spec/5-system/6-websocket-protocol.md` `## Rationale` "§4.4 wire 필드 caveat" 선례와의 정합 여부가 문면상 모호해짐 | `title` 을 "봉투 caveat + blockquote 필드명 정정" 계열로 좁히고, Overview 에 (1) 철회 반영 한 줄 추가, 하단 Rationale "왜 예시를 실측으로 맞추나" 항목의 적용범위를 blockquote 로 명시 한정 |
| 5 | rationale_continuity | item (4) `error.code` optional화가 `15-chat-channel.md` R-CC-15 의 closed-enum 분류 입력 전제를 건드리는데 cross-reference·`spec_impact` 없음 | `### (4)` 본문; frontmatter `spec_impact`(3개 파일만 등재) | `spec/5-system/15-chat-channel.md` R-CC-15 "분류 입력 화이트리스트 + placeholder 1종 정책" | (4)에 R-CC-15 cross-ref 추가, `error.code` 부재 시 unknown-code fallback(`executionFailedInternal`)으로 안전 흡수됨을 확정하거나 `spec_impact` 에 `15-chat-channel.md` 추가 + R-CC-15 addendum |
| 6 | convention_compliance | `error.code` optional화가 부재 표현(`null` vs 키 생략) 결정·사유 명시 없음 — 형제 필드 `nodeId` 는 이미 `null` 관례 사용 | `## 변경 제안 (4)` | `spec/conventions/swagger.md §1-3/§1-5` DTO 선언-wire 1:1 대응 요구 | "code 부재는 `null` 로 표현(형제 필드 `nodeId` 와 동일 관례)" 한 문장 추가, §6.4 필드 표에 `?`/`null` 명시 |
| 7 | convention_compliance | `turnDebug` 이름 충돌이 "landed" 상태로 남을 위험 — node-output.md Overview 예측가능성 설계원칙과 상충 (naming_collision Critical #1 과 동일 근본 원인) | `### 처분 (실제 상태)` 두 번째 미체크 항목 | `spec/conventions/node-output.md` Overview | 7항목 체크리스트에 handoff 항목을 선행조건으로 명시하거나 §6.2 예시에 즉시 구분 가능한 이름 적용 |
| 8 | plan_coherence | 이름 충돌 해소 항목이 "spec 반영 7항목" 카운트에서 빠짐 (naming_collision Critical #1 과 동일 근본 원인, plan 체크리스트 동기화 각도) | `### 처분 (실제 상태)` L211~217 vs `## 체크리스트` L260~262 | (동일 문서 내 상호 참조 누락) | 체크리스트 8번째 항목으로 disambiguation 명시 등재 또는 item (3) 본문에 상호 참조 추가 |
| 9 | plan_coherence | §R17 재서술(item (7))이 `spec-sync-external-interaction-api-gaps.md` 의 열린 "nodeOutput allowlist 잔여" 항목과 상호 참조 없이 진행 — 재서술 시 그 트래커 인용문이 stale 해질 위험 | `### (7) llmCalls strip SoT 가 실제 누출 표면을 안 덮는다` L153~156 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` `[ ] getStatus 일반 nodeOutput 키-allowlist (§R17 잔여)` | item (7) 실행 시 §R17 "일반 키 allowlist (미구현·잔여)" 불릿 보존 또는 형제 plan 인용문 동시 갱신을 체크리스트에 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 형제 plan(`spec-draft-eia-notification-payload-contract.md`) 각주는 이미 반영돼 있음 — "포함한다"(미래형) 서술만 정정 필요 | `### (3)` 하단 "형제 plan 과 충돌한다" 블록 | 문구를 "이미 반영됨(확인)" 으로 갱신 |
| 2 | convention_compliance | `interaction.token`(Planned) 필드 — 향후 구현 시 `writeOnly` 데코레이터 적용 미리 언급해두면 좋음 | `## 변경 제안 (2)` | 필수 아님 — 참고용 |
| 3 | convention_compliance | 문서 구조 규약(frontmatter/3섹션/체크리스트) 전반 준수 확인 | 전체 구조 | 긍정 확인, 조치 불요 |
| 4 | plan_coherence | `error.code` 옵셔널 근거(4개 emit 지점)가 SIGTERM 종료 경로(`shutdown-state.service.ts`)를 포함 안 함 — 그 경로는 emit 자체가 없어 스코프 밖이나, `spec-update-node-cancellation-shutdown-classification.md` (a)/(b) 택일 미결 상태와 맞물려 유동적 | `### (4)` L122~128 | item (4)/(5) 반영 시 "emit payload 한정" 명시 또는 해당 plan 결정 상태 재확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `error.code` optional화가 (5) data-model 갱신에 미반영 + `turnDebug` 충돌이 7항목 스코프 밖 |
| rationale_continuity | MEDIUM | title/Overview/Rationale 이 item (1) 철회와 문면 모순 + R-CC-15 파급 미검토 |
| convention_compliance | LOW | `error.code` 부재표현 미결정(swagger.md) + `turnDebug` landed 위험(node-output.md) |
| plan_coherence | LOW | 이름충돌 항목 체크리스트 카운트 누락 + §R17 재서술과 형제 트래커 상호참조 누락 |
| naming_collision | HIGH | `turnDebug` 명칭 충돌 처분 미확정 — **CRITICAL** |

## 권장 조치사항
1. **(BLOCK 해소 최우선)** `turnDebug` 명칭 충돌 체크리스트 항목을 이번 라운드에서 명시적으로 닫는다 — "범위 확정형"(§6.2 는 top-level `turnDebug` 를 다루지 않는다고 못박고 후속 항목으로 재등재) 또는 "해소형"(리네임/disambiguation 문구 부착) 중 택일해 target 문서 본문에 결론을 기록.
2. "spec 반영 7항목" 체크리스트에 위 결론을 8번째 항목 또는 기존 항목의 명시적 하위 조건으로 반영해, 이름충돌 처분이 카운트 밖으로 새지 않도록 한다.
3. `error.code` optional화(제안 (4))의 파급 범위를 정리 — (a) `data-model.md §2.14` "구조" 행에 `code?`/`details?` 반영, (b) `15-chat-channel.md` R-CC-15 와의 관계를 cross-ref 또는 `spec_impact` 추가로 명시, (c) 부재 표현을 `null`(형제 필드 `nodeId` 와 동일 관례)로 확정.
4. title/Overview/하단 Rationale 문구를 item (1) 의 최종 결론(안쪽 JSON 유지, 봉투만 재작성)에 맞춰 정정.
5. §R17 재서술(item (7)) 시 `spec-sync-external-interaction-api-gaps.md` 의 "allowlist 잔여" 불릿 보존 여부를 확인하고 필요 시 형제 트래커 문구를 동시 갱신.