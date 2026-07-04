# Rationale 연속성 검토 — ImportWorkflowDto.settings strict DTO

## 대상

`plan/in-progress/import-workflow-settings-dto.md` — `ImportWorkflowDto.settings`(현재 opaque `@IsObject() Record<string, unknown>`)를 PR #805 가 `UpdateWorkflowDto.settings` 에 도입한 strict `WorkflowSettingsDto`(`@ValidateNested @Type`, `maxConcurrentExecutions` 단일 키, 전역 whitelist+forbidNonWhitelisted)로 대칭화하는 impl-prep 단계 계획.

## 발견사항

- **[INFO]** Import 의 "permissive 정책" Rationale 은 node `config` 한정 — `settings` 는 원 범위 밖이라 계획 자체는 그 원칙과 충돌하지 않으나, 문면 재확인 필요
  - target 위치: `plan/in-progress/import-workflow-settings-dto.md` §"설계 결정" 1–2
  - 과거 결정 출처: `spec/2-navigation/1-workflow-list.md` `## Rationale` → "2. Import 의 permissive config 정책 (§3.2)"
  - 상세: 해당 Rationale 은 "JSON 가져오기 시 노드 `config` 의 schema parse 가 실패해도 가져오기를 거부하지 않고 raw config 를 그대로 보존한다" 는 **node-level `config`** 전용 결정이며, 명시적으로 "config 내용(soft) vs 구조(hard, `type`/`label`)" 이분법을 세운다. 워크플로우 레벨 `settings`(admission-gate 파라미터, `maxConcurrentExecutions`)는 이 Rationale 이 다루는 두 범주(node config 내용 / 노드 구조) 어디에도 속하지 않는다 — 즉 이 항목을 "재도입" 하거나 "위반" 하는 것이 아니라 애초에 스코프 밖이다. 다만 문구상 "Import = permissive" 라는 인상이 강해, 리뷰어가 표면적으로 이 Rationale 을 근거로 `settings` strict-화에 반대할 여지가 있다.
  - 제안: PR 본문 또는 spec 갱신 시 "Import 의 permissive 정책(§Rationale 2)은 node `config` 콘텐츠에 한정되며, 워크플로우 레벨 `settings`(admission-gate 파라미터)는 PR #805 가 이미 §2.4 스코프에 따라 strict-화한 `UpdateWorkflowDto.settings` 와 동일 대칭 정책을 따른다" 는 한 줄을 `spec/2-navigation/1-workflow-list.md §3.2` 또는 해당 Rationale 항목에 추가해 두 정책이 공존하는 이유를 명시하면 향후 checker/리뷰어의 오탐을 막을 수 있다 (필수는 아님, 있으면 더 견고).

- **[INFO]** PR #805 가 `settings` DTO strict 전환 근거를 스스로 spec `## Rationale` 에 신설하지 않음 — 이번 PR 도 동일 패턴을 반복
  - target 위치: `plan/in-progress/import-workflow-settings-dto.md` §"설계 결정" 2 ("strict 안전성(=#805 논거 재사용)")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md`(§8 admission gate 표) / `spec/1-data-model.md §2.4` — 두 문서 모두 `Workflow.settings.maxConcurrentExecutions` 를 기술하지만, "DTO 레벨에서 미지 키를 400 으로 거부한다" 는 **API 계약 narrowing** 자체를 명시한 Rationale 항목은 `4-execution-engine.md`의 `## Rationale`(줄 1273 이하, PR2b 관련 항목들 포함)에 없다 — 이 결정은 PR #805 본문에만 존재하고 spec 에는 반영되지 않았다.
  - 상세: 이는 "결정 번복" 은 아니다(과거 관대한 결정을 뒤집는 것이 아니라 **미지정이었던 강도(strictness)를 처음으로 명시**하는 것). 따라서 "무근거 번복" 기준(관점 3)에는 해당하지 않지만, PR #805·이번 PR 모두 계약 narrowing 을 코드 주석과 PR 설명에만 남기고 spec Rationale 에는 남기지 않는 패턴이 반복되고 있어 향후 `ImportWorkflowDto`/`UpdateWorkflowDto` 재작업 시 근거를 spec 에서 찾지 못하는 SoT 분산 위험이 있다.
  - 제안: 필수 차단 사유는 아니나, 이번 PR 에서 `spec/5-system/4-execution-engine.md ## Rationale` 에 "workflow/workspace settings DTO strict 검증 (PR #805/#806 계열)" 항목을 신설해 "왜 opaque Record 대신 nested strict DTO 로 좁혔는지, import/update 양쪽에 대칭 적용하는 이유" 를 1회 통합 기록하면 이후 유사 확장(예: workspace import 유무)의 근거 조회가 쉬워진다.

- **[INFO]** round-trip 안전성 근거 확인 — 기각된 대안 재도입 없음
  - target 위치: `plan/in-progress/import-workflow-settings-dto.md` §"설계 결정" 2 "strict 안전성(=#805 논거 재사용)"
  - 과거 결정 출처: PR #805 본문 "계약 narrowing 안전성" 단락
  - 상세: PR #805 는 `ImportWorkflowDto.settings` 를 "opaque 유지(별도 후속)" 로 **명시적으로 defer** 했을 뿐, "strict 화하지 않기로 결정(기각)" 한 것이 아니다 — 오히려 본문에 "별도 후속" 이라 적어 이번 작업이 바로 그 후속임을 스스로 예고했다. 즉 이번 계획은 과거에 기각된 대안을 재도입하는 것이 아니라 예고된 후속을 이행하는 것이며, cross_spec INFO 가 반복 지적한 비대칭도 이번 변경으로 해소된다. export(`exportWorkflow`)가 DB `settings`(이미 strict 키만 보유) 를 as-is emit 하므로 export→import round-trip 이 strict 화 이후에도 깨지지 않는다는 논거도 코드 근거(§3.2 export 표·현재 `workflows.service` 소비 키 = `maxConcurrentExecutions` 단일)와 부합한다.
  - 제안: 없음 (정합 확인 목적의 기록).

## 요약

이번 계획(`ImportWorkflowDto.settings` strict DTO 전환)은 기존 spec 의 `## Rationale` 에서 명시적으로 기각된 대안을 재도입하지 않으며, "Import = permissive" 원칙(`spec/2-navigation/1-workflow-list.md` Rationale 2)은 node `config` 콘텐츠에 한정된 결정이라 워크플로우 레벨 `settings`(admission-gate 파라미터)의 strict 화와 직접 충돌하지 않는다. PR #805 가 이미 `UpdateWorkflowDto.settings` 를 동일하게 strict 화했고 스스로 `ImportWorkflowDto.settings` narrowing 을 "별도 후속" 으로 예고했으므로, 이번 계획은 결정의 무근거 번복이 아니라 예고된 확장이다. 다만 (1) permissive Rationale 이 node config 한정임을 spec 문면에 한 줄 더 명시하면 향후 오독을 막을 수 있고, (2) settings strict 화의 근거 자체가 아직 `4-execution-engine.md ## Rationale` 에 정식 등재되지 않아 SoT 가 PR 본문에만 분산돼 있다는 점은 이번 기회에 보완할 만하다. 두 사항 모두 CRITICAL/WARNING 급 충돌이 아닌 INFO 수준의 정합 보완 제안이다.

## 위험도

LOW

BLOCK: NO

STATUS: SUCCESS