# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견(Rationale 연속성). 하향 없이 그대로 유지.

## 전체 위험도
**CRITICAL** — target 의 핵심 결론("설계는 처음부터 ref, 지금 구현만 이탈")이 같은 컬럼에 대해
이미 "24h grace 동안 평문, 승격 후 ref = 의도된 설계"라고 판정해 둔 두 개의 살아있는 Rationale
(`spec/data-flow/15-external-interaction.md` §1.5, `spec/5-system/15-chat-channel.md` R-K)을
인용·갱신 없이 뒤집는다. 그 외 checker 는 모두 LOW/MEDIUM/NONE 이며 조율·추적 성격의 WARNING.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | `notification_secret_v2` 를 "설계는 ref, 구현만 이탈한 알려진 이탈"로 재정의하는 결정이, 같은 컬럼을 이미 "24h grace 평문 → 승격 후 ref = 의도된 설계"로 정착시킨 두 개의 살아있는 Rationale 을 인용도 갱신도 없이 지나간다. 실행되면 EIA §7.1(정정본)·data-flow §1.5·chat-channel R-K 세 문서가 이 컬럼의 "정상 상태"에 대해 서로 다른 주장을 하는 상태가 새로 생긴다 | `plan/in-progress/spec-draft-notification-secret-storage.md` §② 결정, `## Rationale`(기각한 대안 (a)) | `spec/data-flow/15-external-interaction.md` `## Rationale` "§1.5 구현 갭 — 해소 이력 (C3 fix)"(2026-06-10) + `spec/5-system/15-chat-channel.md` `## Rationale` R-K("두 컬럼은 의미상 직교") | (i) target (b) 방향 유지 시: 두 문서(data-flow §1.5, chat-channel R-K)를 함께 갱신 — "C3 는 승격 버그만 해소, rotate 시점 평문 저장은 잔존 이탈이었다"로 재평가하고 `spec_impact` 에 두 파일 추가. (ii) 두 문서의 기존 판정을 존중 시: target §②를 "24h grace 동안 평문은 자매 컬럼과 의도적으로 다른 패턴(근거 R-K)"으로 고쳐 쓰고, 이 경우 이미 "기각한 대안"으로 표시한 (a)(grace-window 한정 예외 등재)의 기각 사유를 재검토 |

## planner 인계 (권한 밖 Critical)

(없음) — target 자체가 planner 턴의 draft 문서이며, 위 Critical 은 그 draft 를 spec/ 에 반영하기
직전 단계에서 발견된 것이라 호출자(planner)가 직접 §② 결정과 `## Rationale`/`spec_impact` 를
수정할 권한과 위치를 모두 가지고 있다. developer 턴 spec drift 인계 케이스가 아니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | 위 CRITICAL 이 해소되려면 최소 하나는 갱신돼야 하는 두 파일이 `spec_impact` frontmatter 에서 누락 | frontmatter `spec_impact:` | `spec/data-flow/15-external-interaction.md`, `spec/5-system/15-chat-channel.md` | CRITICAL 해소안 확정 후 `spec_impact` 에 두 파일 추가 |
| 2 | convention_compliance | draft 본문이 `## Rationale` 뒤에 `## \`--spec\` 번들 관찰` 섹션을 덧붙여 "Rationale 이 본문 마지막 섹션" 규약 위반 | draft L147~166 | `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3 / §절대 원칙(3섹션 구성) | 해당 관찰을 `## Rationale` 하위 항목으로 옮기거나 Rationale 앞으로 재배치 |
| 3 | convention_compliance | 새로 인정한 구현 이탈(코드측 ref 화, 결정 (b))이 `pending_plans:` 로 연결되지 않아 "책임 plan 없는 영구 누락" 실패 모드 재현 위험 | `## ② 결정`, `## ③ 변경안`(EIA §7.1) | `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 정의 + R-5 근거 | `14-external-interaction-api.md` 의 기존 `pending_plans` 대상(`spec-sync-external-interaction-api-gaps.md`)에 이탈 해소 체크박스 신설하거나 새 developer-track plan 생성 후 `pending_plans:` 에 추가 |
| 4 | plan_coherence | W2(`swagger-dto-contract*.ts` 를 `2-api-convention.md` `code:` 에 추가)가 직전 완료 처리된 plan 의 "유일한 코드" 서술을 사실상 반증하는데 그 plan 문서를 갱신하지 않음 | target §③ W2 | `plan/in-progress/spec-draft-nullable-notation-followups.md:313-329`("§5.4 를 시행하는 유일한 코드"로 완료 처리) | target 커밋에 해당 라인 정정 각주 추가 — "유일한 코드"를 "런타임으로 시행하는 유일한 코드(정적 축은 swagger-dto-contract-guard.ts 겸함)"로 좁힘 |
| 5 | plan_coherence | "(b) 코드측 ref 화" 후속 작업을 추적하는 `plan/in-progress` 항목이 전무(신설 필요) — WARNING #3(convention_compliance)과 동일 근본 원인, 별각도 지적 | target §② 결정 / §③ 변경안 | `plan/in-progress/` 전수 검색 0건 | `notification-secret-v2-ref-migration.md`(가칭) 신설 또는 기존 항목에 체크박스 추가, EIA §7.1 blockquote 에서 서술 인용으로 역참조 |
| 6 | cross_spec | W3(`4-integration.md` §9.1) 전제(`IntegrationDto` 신규 필드 5개 선언)가 아직 `origin/main` 에 없는 병렬 미병합 브랜치(`claude/sweep-response-contract-5ba0ad`)에만 존재 — 병합 순서에 의존 | target §③ W3 | 로컬 브랜치 `dfb2664af`("트리거 회전 secret 이 두 경로로…") | `4-integration.md` §9.1 반영을 해당 브랜치 병합 이후로 순서 명시하거나 target 문서에 선행 의존 한 줄 명기 |
| 7 | cross_spec | W3 가 포인터화하려는 5필드 중 `consecutiveNetworkFailures` 는 같은 코드 트랙에서 이미 "FE 미소비 — 제거 후보"로 등재됨. 5필드를 동급 문서화하면 이 사실이 가려짐 | target §③ W3 | `dfb2664af` 커밋 본문 + 해당 DTO 필드 JSDoc("제거는 wire 변경, 별도 트래커 항목") | 포인터 문구에 `consecutiveNetworkFailures`"FE 미소비 — 제거 후보로 별도 추적 중" 캐비엇 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `2-api-convention.md` frontmatter `code:` 를 동시에 겨냥하는 별도 완료 초안(983fd0ade, W2 와 무관한 §5.4 런타임 검증자 등재)이 있으나 등재 대상 검증자가 서로 달라 내용 충돌은 없음 | `spec/5-system/2-api-convention.md` frontmatter | 머지 전 983fd0ade 반영분을 기준으로 rebase 확인만 |
| 2 | cross_spec | `spec/1-data-model.md §2.8` 의 `notification_secret_v2` 행이 `secretRef` 우선순위를 언급하지 않아 인접 SoT 가 target 교정 범위 밖에 남음(모순 아님) | `spec/1-data-model.md:240` | 후속 그루밍 항목으로 별도 등재 |
| 3 | cross_spec | EIA-NX-12(§3.1, "1회 평문 반환")와 §7.1 신설 blockquote("DB 컬럼 자체가 평문")는 서로 다른 것을 말하나 나란히 두면 혼동 가능(모순 아님) | `spec/5-system/14-external-interaction-api.md:81`, §7.1 신설 blockquote | §7.1 blockquote 말미에 EIA-NX-12 상호 참조 한 줄 추가 |
| 4 | rationale_continuity | `chat-channel.md` R-K 는 secret-store 전환(#264, 2026-05-22) 하루 전 작성돼 "ref 전환 이후 현실"을 반영 못한 상태 — CRITICAL 의 근본 원인 중 하나 | `spec/5-system/15-chat-channel.md` R-K | CRITICAL 해소 작업에서 R-K 본문도 함께 재검토 |
| 5 | rationale_continuity | W2/W3 변경안 자체는 기존 Rationale 과 충돌 없음(자구 단위 대조 완료) | target §③ W2/W3 | 조치 불요 |
| 6 | convention_compliance | 실측 인용이 편집 대상 파일 줄 번호(L922)에 고정돼 draft 실행 시 stale 가능 | target §③ EIA §7.1 변경안 | 줄 번호 대신 앵커 문구로 대상 특정 |
| 7 | naming_collision | 신규 요구사항 ID·엔티티·endpoint·이벤트명·ENV var·spec 파일 경로 전부 미도입, 전 항목 충돌 없음 확인 | 전체 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 사실관계 정정은 인접 spec 과 모순 없음. 병합 순서 의존(W3)·필드 하나 제거후보 캐비엇 누락만 |
| rationale_continuity | CRITICAL | 두 개의 살아있는 Rationale(data-flow §1.5, chat-channel R-K)을 인용 없이 뒤집는 결정 |
| convention_compliance | LOW | draft 구조가 "Rationale 마지막 섹션" 규약 위반 + 이탈 후속작업 pending_plans 미연결 |
| plan_coherence | MEDIUM | 직전 완료 plan 의 "유일한 코드" 서술을 사실상 반증하면서 그 plan 미갱신 + 후속 코드작업 추적 plan 부재 |
| naming_collision | NONE | 신규 식별자 없음, 전 항목 기존 사용처와 충돌 없음 |

## 권장 조치사항
1. **(BLOCK 해소, 최우선)** rationale_continuity CRITICAL — (i) 또는 (ii) 중 하나를 택해
   `spec/data-flow/15-external-interaction.md` §1.5 와 `spec/5-system/15-chat-channel.md` R-K 를
   target 의 §② 결정과 정합시키고, 택한 방향을 `## Rationale` 에 명시. `spec_impact` 에 두 파일 추가.
2. draft 본문에서 `## --spec 번들 관찰` 섹션을 `## Rationale` 앞/하위로 재배치해 3섹션 구성 규약 준수.
3. "(b) 코드측 ref 화" 후속 작업을 추적할 plan 항목을 신설하거나 기존
   `spec-sync-external-interaction-api-gaps.md` 에 체크박스로 흡수하고, `14-external-interaction-api.md`
   `pending_plans:` 에 반영.
4. `plan/in-progress/spec-draft-nullable-notation-followups.md:313-329` 의 "유일한 코드" 완료 서술에
   W2 실측 결과를 반영한 정정 각주 추가.
5. W3(`4-integration.md` §9.1) 반영 시점을 `claude/sweep-response-contract-5ba0ad` 브랜치 병합
   이후로 명시하고, `consecutiveNetworkFailures` 는 제거 후보 캐비엇을 함께 기재.