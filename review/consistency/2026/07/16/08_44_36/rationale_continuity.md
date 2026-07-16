# Rationale 연속성 검토 결과

대상: `spec/conventions/audit-actions.md`, `spec/conventions/cafe24-api-catalog/**`
검토 모드: `--impl-prep` (구현 착수 전 검토, scope=`spec/conventions/`)

## 방법 노트

프롬프트 payload 의 "관련 Rationale 발췌" 절은 크기 제한으로 `spec/2-navigation/4-integration.md` 까지만 포함되고 잘렸다(`... (truncated due to size limit) ...`). target 이 실제로 참조하는 SoT Rationale — `spec/5-system/1-auth.md §Rationale 4.1.A/4.1.B`, `spec/data-flow/12-workspace.md §Rationale "workspace.deleted 감사 제외"`, `spec/data-flow/1-audit.md §1.1`, `spec/conventions/cafe24-api-metadata.md §Rationale`, `spec/conventions/cafe24-restricted-scopes.md §Rationale` — 는 이 잘린 발췌 목록에 없어, repo 를 직접 Read/Grep 해 교차검증했다.

## 발견사항

- **[INFO]** 리뷰 payload 구성이 alphabetical/부분 순회로 잘려 정작 target 이 인용하는 SoT Rationale 을 누락함
  - target 위치: 해당 없음 (payload 구성 이슈, target 문서 자체의 결함 아님)
  - 과거 결정 출처: 해당 없음
  - 상세: `_prompts/rationale_continuity.md` 의 "관련 Rationale 발췌" 는 `spec/0-overview.md` → `spec/1-data-model.md` → `spec/2-navigation/0-dashboard.md` … `spec/2-navigation/4-integration.md` 순으로 나열되다 크기 한도에서 끊겼다. `audit-actions.md` 가 명시적으로 인용하는 `5-system/1-auth.md §4.1/§4.1.A`, `data-flow/12-workspace.md`, `data-flow/1-audit.md §1.1` 와, `cafe24-api-catalog/_overview.md` 가 인용하는 `cafe24-api-metadata.md`·`cafe24-restricted-scopes.md` 는 모두 이 발췌 밖이라, payload 만 보는 리뷰는 실제 상호참조를 검증하지 못한 채 "이상 없음" 으로 오판할 위험이 있다.
  - 제안: orchestrator 의 Rationale 발췌 수집 로직을 "target 문서가 참조 링크로 명시한 spec" 우선 포함(alphabetical 전수보다 우선순위 큐)으로 바꾸거나, 크기 한도 초과 시 target 의 명시적 cross-ref 문서를 최우선 유지하도록 개선.

## 교차검증 결과 (repo 직접 대조, 위반 없음)

아래는 target 이 인용하는 실제 SoT Rationale 대비 확인한 항목이며, 모두 **정합** — 별도 CRITICAL/WARNING 항목 없음.

1. **`audit-actions.md` §2.3 (도메인 고유 동사) / §Rationale "기각된 대안"** — `workspace.transfer_ownership` 을 `workspace.ownership_transferred` 로 과거분사 정규화하는 안을 기각한 결정은 `5-system/1-auth.md §4.1.A`("`workspace.transfer_ownership` 분류 (refactor 04 후속 A-2)")의 동일 결론과 정확히 일치하며, target 은 이를 번복 없이 재확인·문서화한다(§3 레지스트리 `workspace | 도메인 동사 (§2.3) | transfer_ownership`).
2. **`audit-actions.md` §3 Planned 행 (workflow/trigger/schedule 과거분사, model_config 현재형)** — `1-auth.md §4.1.A` 의 "나머지 Planned 액션의 시제도 정규화" 결정(과거분사 기본, `model_config.*` 만 현재형 예외 유지)과 1:1 일치. `data-flow/1-audit.md` 커버리지 갭 서술("workflow.*/trigger.*/schedule.*/model_config.* 여전히 미구현")과도 상태(미구현) 일치.
3. **`audit-actions.md` §3 하단 주 "`workspace.deleted` 는 레지스트리에 없다 (구조적 제외)"** — `data-flow/12-workspace.md §Rationale "workspace.deleted 감사 제외 (구조적 제약)"`(FK `ON DELETE CASCADE`, V001) 및 `5-system/1-auth.md §4.1` L419 의 동일 서술과 근거·결론 모두 일치. `data-flow/1-audit.md` L86-88 도 동일하게 서술 — 3개 문서가 하나의 결정을 일관되게 재확인하고 있으며 target 의 신규 서술이 이를 왜곡하지 않는다.
4. **`cafe24-api-catalog/_overview.md` §Rationale "미문서화 seed 9개 outright 제거 (G-3l, 2026-06-27)"** — 실제 파일(`application.md`, `category.md` 등)을 grep 한 결과 제거 대상으로 명시된 `customer_get/update`·`coupon_get/delete`·`applications_list`·`webhooks_list`·`mains_update/delete`·`socials_apple_settings_get` 는 Rationale 서술 자체를 제외하고 어떤 catalog 표에도 재등장하지 않는다 — 기각(제거)된 항목의 재도입 없음.
5. **`cafe24-api-catalog/_overview.md` §2/§4 (`restricted`·`constraints` 컬럼 비노출)** — `cafe24-api-metadata.md §Rationale "Cafe24 API 조건부 필수 — constraints 신설"`(catalog 컬럼 미노출 원칙)과 "backend `label` 필드 제거 — frontend i18n dict 단일 SoT" 결정 모두, target 카탈로그가 `constraints`/`approvalGroup` 을 컬럼화하지 않고 `라벨(한)`/`English title` 을 참조용 표기로만 유지하는 현재 구조와 상충하지 않는다.
6. **`audit-actions.md` §1 "prefix 없는 표기는 금지 (cross-audit G-02 정정 사례)"** — `data-flow/1-audit.md` L73-81 이 동일 정정(`re_run_initiated` → `execution.re_run`)을 legacy row 보존 원칙과 함께 서술 — 과거 잘못된 표기를 "재도입" 하지 않고 정정 사실만 역사로 남기는 패턴이 일관된다.

## 요약

target(`spec/conventions/audit-actions.md`, `spec/conventions/cafe24-api-catalog/**`)은 자신이 명시적으로 인용하는 모든 상위 Rationale(`5-system/1-auth.md §4.1.A/4.1.B`, `data-flow/12-workspace.md`, `data-flow/1-audit.md §1.1`, `cafe24-api-metadata.md`, `cafe24-restricted-scopes.md`)과 대조한 결과 기각된 대안의 재도입, 원칙 위반, 무근거 번복, invariant 우회 사례를 발견하지 못했다 — 오히려 여러 문서가 동일 결정(예: `workspace.deleted` 감사 제외, `workspace.transfer_ownership` 분류, G-3l seed 제거)을 일관되게 재확인하는 건강한 SoT 분리 구조다. 유일한 이슈는 target 문서 자체가 아니라 이 검토를 위해 조립된 payload 의 발췌 수집 로직이 크기 제한으로 정작 관련도 높은 문서를 누락한 프로세스 갭이며, 이번엔 repo 직접 대조로 보완했다.

## 위험도

NONE
