# Rationale 연속성 검토

## 검토 메모 (payload 이슈)

`_prompts/rationale_continuity.md` 에 담긴 "Target 문서" 본문은 `spec/5-system/1-auth.md` (인증/인가/감사) 전체와 그 밖의 무관한 spec Rationale 발췌(§Cafe24, §WebAuthn 등)로만 구성되어 있으며, 실제 대상인 `Workflow.settings` DTO strict 검증 변경(diff, `workflow-settings.dto.ts` 등)은 payload 어디에도 포함되어 있지 않음(`grep -n "maxConcurrentExecutions\|settings\|diff --git"` 등으로 전수 확인, 0건). orchestrator 가 다른 태스크(auth spec)용 payload 를 이 세션에 잘못 전달한 것으로 판단되어, 사용자 지시에 따라 `git diff origin/main...HEAD` 로 폴백해 실제 변경분을 직접 분석했다.

- 실제 diff 대상: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`, `dto/workflow-settings.dto.ts`(신규), `workflows.service.ts`, 관련 테스트·plan 문서.
- 대조 spec: `spec/1-data-model.md §2.4 Workflow`, `spec/5-system/4-execution-engine.md §8`, 그리고 명시적으로 미러링 대상인 `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`(PR2b, #801, 이미 merge 된 선례).

## 발견사항

이번 변경(target)에서 Rationale 연속성 위반은 발견되지 않았다.

- **[INFO]** "임의 속성" 문구는 Rationale 결정이 아니라 Swagger 주석이었음 — 재검토 확인
  - target 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` (변경 전 `@ApiPropertyOptional({ description: '워크플로우 설정 객체 (실행/UI 관련 임의 속성)', additionalProperties: true, ... })`)
  - 과거 결정 출처: 없음. `spec/1-data-model.md` 의 `## Rationale` 섹션, `spec/5-system/4-execution-engine.md` 의 `## Rationale` 섹션 어디에도 "workflow settings 를 임의 속성으로 열어둔다"는 결정 문장이 없다(grep 확인 0건). §2.4 표 본문은 이미 `settings` 를 `maxConcurrentExecutions: number?` 단일 키로 명시 스코프하고 있어("알려진 키: `maxConcurrentExecutions`"), Swagger 예시(`{ timeoutMs, retryCount }`)는 스펙과 무관한 코드 레벨 placeholder 였다.
  - 상세: 즉 target 이 "기각된 대안"을 재도입하는 게 아니라, 오히려 spec 이 이미 스코프해둔 계약을 코드가 뒤늦게 strict 하게 반영한 것 — 방향이 spec → code 정합화이지 code → spec 역행이 아니다. plan 문서(`plan/in-progress/workflow-cap-validated-dto.md`)도 변경 전 상태를 "opaque passthrough (nested 미검증)"으로 정확히 명명하고 있어, 팀이 이를 의도된 설계로 간주하지 않았음을 자인한다.
  - 제안: 별도 조치 불요. 다만 spec §2.4 를 "코드가 `maxConcurrentExecutions` 만 strict 검증한다"는 사실과 명시적으로 연결하는 각주를 추가하면(예: DTO 파일 경로 포인터) 향후 이런 오탐성 재검토를 예방할 수 있다 — 낮은 우선순위.

- **[INFO]** strict 정책은 새 결정이 아니라 기존 Rationale("동시성 cap admission gate", PR2b)의 대칭 적용
  - target 위치: `workflow-settings.dto.ts` 신규, `update-workflow.dto.ts` 의 `ValidateNested`/`Type` 전환
  - 과거 결정 출처: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` (PR2b, #801) — 동일한 `@IsOptional @IsInt @Min(1) maxConcurrentExecutions` 패턴이 이미 workspace 레벨에 존재. `spec/5-system/4-execution-engine.md §8` 의 "PR2b 구현 완료" 각주와 `[§Rationale "동시성 cap admission gate"]` 링크가 이 설계의 SoT.
  - 상세: target 은 이 기존 패턴을 workflow 레벨로 대칭 확장한 것으로, 새로운 설계 원칙을 도입하지도, 기존 원칙과 충돌하지도 않는다. 전역 `CustomValidationPipe(whitelist+forbidNonWhitelisted)` 라는 이미 존재하는 시스템 invariant 를 우회하지 않고 오히려 그 invariant 에 맞춰 (이전엔 예외적으로 열려 있던) opaque 필드를 닫은 것 — "결정의 무근거 번복"이 아니라 "일관성 보완"에 해당한다.
  - 제안: 조치 불요. plan 문서에 이미 이 대응 관계가 명시되어 있어 추적 가능.

- **[INFO]** ImportWorkflowDto.settings 비대칭 잔존 — 후속 트래킹 확인
  - target 위치: plan 문서 "후속(별도)" 섹션 — `ImportWorkflowDto.settings` 는 여전히 opaque `Record`
  - 과거 결정 출처: 해당 없음(신규 갭 인지)
  - 상세: import 경로는 이번 변경 범위 밖이라 strict 검증이 적용되지 않아 동일 `Workflow.settings` JSONB 에 대해 patch(strict) vs import(opaque) 검증 강도가 비대칭해진다. 이는 Rationale 위반이 아니라 스코프 밖 잔여 갭이며, target 문서(plan)가 이미 명시적으로 인지·기록하고 있다.
  - 제안: 별도 후속 plan 항목으로 이미 추적됨 — 추가 조치 불요.

## 요약

실제 변경분(diff origin/main...HEAD)을 기준으로 볼 때, 이번 target 은 spec `## Rationale` 에서 기각된 대안을 재도입하거나 합의 원칙을 무시하는 지점이 없다. `settings` 를 "임의 속성"으로 허용한 것은 애초에 Rationale 결정이 아니라 Swagger 주석/코드 레벨 opaque 설계였고, `spec/1-data-model.md §2.4` 는 이미 `maxConcurrentExecutions` 로 스코프를 명시해 두었다. 오히려 target 은 PR2b(#801)에서 확립된 workspace-settings strict DTO 패턴을 workflow 레벨로 대칭 적용해 spec-코드 정합을 강화하는 방향이며, 이는 기존 Rationale("동시성 cap admission gate")의 연장선이다. 다만 이번 세션에 전달된 `_prompts/rationale_continuity.md` payload 자체는 이 태스크와 무관한(인증 spec) 내용으로 채워져 있어 — orchestrator 측 payload 배선 오류로 별도 확인이 필요하다(코드 변경 자체와는 무관한 프로세스 이슈).

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS