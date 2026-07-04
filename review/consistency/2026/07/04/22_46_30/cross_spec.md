# Cross-Spec 일관성 검토 — ImportWorkflowDto.settings strict 화 (PR #805 후속)

## 사전 안내: payload mis-scope 발견 및 fallback 적용

`_prompts/cross_spec.md` 에 담긴 target 문서 내용은 실제로는 **`spec/1-data-model.md`** (§2.17
AuthConfig ~ §2.19 Notification 부근, `spec/5-system/1-auth.md` 발췌 포함)이며, 오케스트레이터가
서술한 작업 대상(`ImportWorkflowDto.settings` strict 화, `UpdateWorkflowDto.settings`,
`Workflow.settings` §2.4, §8 admission gate)과 무관하다. 이는 기존에 관측된
"impl-done spec 번들 버그"(prompt 에 target spec 본문이 실리지 않는 mis-scope) 와 동일한 실패
유형으로 판단했다. 지시된 fallback 절차에 따라 spec/코드를 직접 읽어 아래 분석을 수행했다.

직접 확인한 근거:

- `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts` — 현재 `settings?:
  Record<string, unknown>` (`@IsObject()` 만, nested validation 없음)
- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` — 이미 `settings?:
  WorkflowSettingsDto` (`@ValidateNested @Type(() => WorkflowSettingsDto)`)
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` — `maxConcurrentExecutions?:
  number` 단일 필드, 주석이 `spec/1-data-model.md §2.4` + `§8 admission gate` 를 SoT 로 명시
- `spec/1-data-model.md §2.4 Workflow` — `settings` JSONB, "알려진 키: `maxConcurrentExecutions:
  number?`"
- `spec/5-system/4-execution-engine.md §8` — 워크플로우당 동시 Execution 상한 = `Workflow.settings.
  maxConcurrentExecutions` (기본 3, Editor+, `PATCH /api/workflows/:id`)
- `spec/2-navigation/1-workflow-list.md §3/§3.2` — import/export API 계약 (SoT 는 `import-
  workflow.dto.ts`/`ExportWorkflowDto`), import 검증 순서 1~5 및 Rationale §2 "permissive config
  정책"
- `workflows.service.ts` — `importWorkflow()`: `settings: dto.settings ?? {}` 로 그대로 저장
  (merge 없음, 신규 row 이므로 병합 대상 없음). `exportWorkflow()`: `settings: workflow.settings`
  그대로 emit. `update()`: `settings` 는 기존 값과 spread-merge.
- `workflows.controller.ts` — `POST /api/workflows/import` 는 `@Roles('editor')`, `PATCH
  /api/workflows/:id` 도 editor 이상 — RBAC 레벨 동일.

## 발견사항

- **[INFO]** Import 문서(§3.2)의 "미지 키 거부" 동작 서술 부재
  - target 위치: 계획된 변경 — `import-workflow.dto.ts` `ImportWorkflowDto.settings` 를
    `WorkflowSettingsDto` nested 로 교체 (전역 whitelist+forbidNonWhitelisted 적용)
  - 충돌 대상: `spec/2-navigation/1-workflow-list.md §3.2` "Import — 검증·동작 순서" 1~5번 목록
  - 상세: §3.2 는 import 의 검증 항목을 노드 `type`/`label`/`config` 관점에서만 열거하고
    `settings` 필드의 검증 정책(미지 키 400 거부)을 언급하지 않는다. 계획대로 strict 화하면
    새로운 400 실패 모드가 생기지만 §3.2 목록에는 반영되지 않아, import 문서만 읽는 소비자는
    이 동작을 놓칠 수 있다. 단, §3.2 Rationale ("config 내용은 soft, 구조는 hard")과 직접
    모순되지는 않는다 — `settings` 는 "구조"가 아니라 워크플로우 레벨 실행 설정이라 이 이분법
    범위 밖이다. 또한 `WorkflowSettingsDto` 자체가 이미 `UpdateWorkflowDto` 를 통해 동일 정책으로
    시행 중이므로 신규 모순이 아니라 **문서 동기화 누락**에 가깝다.
  - 제안: `§3.2` 검증 목록에 6번째 항목으로 "`settings` 는 `WorkflowSettingsDto` 로 검증 —
    `maxConcurrentExecutions` 외 키는 400 `VALIDATION_ERROR`" 를 추가하거나, 최소한
    `Workflow.settings §2.4`/`§8` 링크를 §3.2 안에 명시. project-planner 소관.

- **[INFO]** `importWorkflow()` 의 `settings` 처리가 `update()` 의 merge 패턴과 다른 이유는
  spec 에 명시되어 있지 않음
  - target 위치: `workflows.service.ts` `importWorkflow()` (`settings: dto.settings ?? {}`)
    vs `update()` (`{ ...(workflow.settings ?? {}), ...settings }`)
  - 충돌 대상: 없음 (실제 모순 아님) — import 는 신규 row 생성이라 병합 대상 자체가 없으므로
    당연한 차이다.
  - 상세: 실질적 충돌은 아니지만, `WorkflowSettingsDto` 를 두 DTO 가 공유하게 되면 리뷰어가
    "왜 import 는 merge 하지 않는가" 를 오인할 수 있다.
  - 제안: 코드 주석 한 줄로 충분 (신규 row 이므로 merge 불필요) — spec 변경 불요.

## 데이터 모델 / API 계약 / RBAC 확인 결과 (충돌 없음)

- **데이터 모델**: import·update·export 모두 동일한 `Workflow.settings` JSONB 컬럼을 다루고,
  §2.4 의 스코프(`maxConcurrentExecutions` 단일 키)와 `WorkflowSettingsDto` 필드 정의가 정확히
  일치한다. 계획대로 `ImportWorkflowDto.settings` 를 같은 `WorkflowSettingsDto` 로 nested 하면
  두 진입점(import/update)의 write-side 검증 스키마가 완전히 수렴해 오히려 기존 비대칭(느슨한
  import vs strict update)을 해소한다.
- **API 계약**: export 가 `workflow.settings` 를 그대로 emit 하고(`exportWorkflow()`), post-#805
  기준 저장 가능한 키는 `maxConcurrentExecutions` 뿐이므로 round-trip(export→import)은 항상
  스키마를 만족한다. §3.2 의 "Swagger DTO 가 `formatVersion` 을 선언하나 미구현" 경고와 유사하게,
  이번 변경도 기존 "선언 vs 실제 동작" 격차를 넓히지 않는다(오히려 import 쪽이 update 와
  정합되어 격차를 줄인다).
- **요구사항 ID**: 신규 요구사항 ID 부여 없음(§2.4/§8 기존 ID 재참조만). ID 충돌 없음.
- **상태 전이**: 해당 없음 — `Workflow.settings` 는 상태 머신 필드가 아니다.
- **권한/RBAC**: `POST /api/workflows/import` 와 `PATCH /api/workflows/:id` 모두 `editor` 이상
  요구 — 두 진입점의 RBAC 레벨이 이미 동일하므로 검증 로직 통일이 권한 모델과 충돌하지 않는다.
- **계층 책임**: `WorkflowSettingsDto` 를 import/update 양쪽이 재사용하는 것은 "설정 검증 로직의
  단일 진실은 DTO" 라는 기존 결정(주석에 명시된 workspace `UpdateWorkspaceSettingsDto` 대칭 원칙)
  과 일치한다. 새로운 책임 분할 결정이 필요하지 않다.

## 요약

계획된 변경(`ImportWorkflowDto.settings` 를 `WorkflowSettingsDto` nested 로 교체해 import 를
update 와 동일한 strict 검증 정책으로 수렴)은 기존 `spec/1-data-model.md §2.4`,
`spec/5-system/4-execution-engine.md §8`, `spec/2-navigation/1-workflow-list.md §3.2` 어느 것과도
직접 모순되지 않는다. 오히려 현재 느슨한 import DTO 와 이미 strict 한 update DTO 사이의 비일관성을
해소하는 방향이다. 유일한 아쉬운 점은 §3.2 의 import 검증 목록이 `settings` 필드의 (신규) 400
거부 동작을 명시적으로 열거하지 않는다는 것으로, 이는 CRITICAL/WARNING 이 아닌 문서 동기화
권장(INFO) 수준이다. 참고로 이번 호출의 입력 prompt payload 자체는 `spec/1-data-model.md`
§2.17~§2.19 발췌를 잘못 실어 mis-scope 상태였으며, 지시에 따라 spec/코드를 직접 읽어 분석을
대체했다 — 오케스트레이터 측 prompt 조립 로직 점검을 권장한다.

## 위험도

LOW

BLOCK: NO

STATUS: SUCCESS
