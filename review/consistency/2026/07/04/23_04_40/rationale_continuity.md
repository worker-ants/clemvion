# Rationale 연속성 검토 결과

## 검토 대상

- target: `spec/2-navigation/1-workflow-list.md` §3.2 item 6(신규) + `## Rationale` §2 신규 불릿
- 구현: `ImportWorkflowDto.settings` (`codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts`) 를 opaque `@IsObject()` Record 에서 strict nested `WorkflowSettingsDto`(`@ValidateNested` + `@Type`)로 전환
- commit: `ba677f874` (feat(workflows): import settings validated DTO, patch 대칭, #805 파생), 선행 commit `07b6d598f`(#805, `UpdateWorkflowDto.settings` 동일 전환)

## 발견사항

검토 관점 1~4 전부에서 CRITICAL/WARNING 없음. 상세 근거는 아래.

- **[INFO] 신규 Rationale 불릿의 소급 근거 문서화는 양호, 다만 "예외에 포함되지 않는다"는 문구가 최초로 명문화된 시점이 지금이라는 점을 명시하면 더 명확**
  - target 위치: `spec/2-navigation/1-workflow-list.md` `## Rationale` → `### 2. Import 의 permissive config 정책 (§3.2)` 마지막 불릿(`**워크플로우 \`settings\`(admission-gate 파라미터)는 이 permissive 예외에 포함되지 않는다**...`)
  - 과거 결정 출처: 동일 문서 `## Rationale` §2 원문(전환 전) — "JSON 가져오기 시 노드 `config` 의 schema parse 가 실패해도... raw config 를 그대로 보존한다"
  - 상세: 기존 Rationale §2 는 표제와 본문 모두 "노드 `config`" 로 한정 서술되어 있었고, "워크플로우 `settings`" 라는 대상 자체를 언급한 적이 없다. 즉 기존 텍스트가 명시적으로 `settings` 를 permissive 정책의 일부로 선언한 적이 없으므로, 신규 불릿은 과거 결정을 "번복"하는 것이 아니라 **처음부터 대상 범위 밖이었던 것을 사후에 명문화**하는 스코프 확인(scope clarification)이다. `spec/1-data-model.md` §2.4(line 120)가 이미 `Workflow.settings` 를 `maxConcurrentExecutions` 하나로 스코프하고 있고, 선행 PR #805(`07b6d598f`)에서 patch DTO(`UpdateWorkflowDto.settings`)가 이미 동일한 strict 정책으로 전환되며 "§2.4 가 이미 settings 를 이 키로 스코프 → 계약 정합(narrowing 아님)" 이라는 동일 논리가 이미 한 번 채택된 바 있다. 이번 변경은 import DTO 를 그 선례에 대칭시킨 것으로, 원칙 위반이나 무근거 번복이 아니다.
  - 제안: 현행 문구로 충분히 안전하나, 향후 재점검 편의를 위해 "본 구분은 §3.2 최초 작성 시 암묵적이었고 2026-07-04 에 명시화했다" 는 한 문장을 추가하면 "결정 번복처럼 보이는 명문화"와 "실제 정책 변경"을 혼동할 여지를 원천 차단할 수 있다. (선택 사항, 필수 아님)

## 교차 검증 근거

- `spec/1-data-model.md:120` — `Workflow.settings` JSONB 알려진 키를 `maxConcurrentExecutions` 로 명시적으로 한정(§2.4). target 의 신규 Rationale 불릿이 인용하는 근거와 실제로 일치.
- `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts:161-176` — `settings` 필드가 `@IsObject() @ValidateNested() @Type(() => WorkflowSettingsDto)` 로 strict 전환된 것을 확인. 노드 `config`(line 56-63, `@IsObject()` 단독, `Record<string, unknown>`)는 그대로 permissive 유지 — target 서술과 코드가 정합.
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` — `UpdateWorkflowDto`(#805)와 `ImportWorkflowDto`(본 변경)가 동일 `WorkflowSettingsDto` 를 공유해 patch/import 대칭 주장이 코드 수준에서도 사실.
- `git log`: `07b6d598f`(#805, patch 측 strict 전환 선행) → `ba677f874`(본 diff, import 측 대칭) 순서로, "narrowing 아님 / 계약 정합" 논리가 이미 한 차례 검증·채택된 뒤 그 연장선에서 적용됨. 새로운 원칙의 최초 도입이 아니라 기존 결정의 재적용.
- 기존 Rationale §2 원문(변경 전, `07b6d598f` 시점)에는 "워크플로우 settings" 에 대한 언급 자체가 없었음 — 즉 이번 추가가 뒤집는 기존 선언이 존재하지 않는다.

## 요약

target 은 노드 `config` 의 permissive 정책(가져오기 시 schema parse 실패해도 raw 보존)을 변경하지 않았고, 그 예외가 애초에 다루지 않았던 workflow-level `settings` 를 strict 검증 대상으로 명시적으로 스코프 확정했을 뿐이다. `spec/1-data-model.md §2.4` 가 이미 `settings` 를 `maxConcurrentExecutions` 단일 키로 한정하고 있고, 선행 PR #805 에서 patch DTO 에 동일 strict 정책을 이미 적용하며 "narrowing 아님" 근거를 확립한 바 있어, 이번 import DTO 전환은 그 선례의 대칭 적용이지 새로운 원칙 도입이나 과거 결정의 무근거 번복이 아니다. 기각된 대안의 재도입, 합의 원칙 위반, invariant 우회 어느 것도 발견되지 않았다.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
