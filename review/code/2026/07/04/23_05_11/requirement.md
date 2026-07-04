# 요구사항(Requirement) Review — ImportWorkflowDto.settings strict DTO (patch 대칭)

## 참고: payload 스코프 확인

전달된 requirement.md 페이로드(CHANGELOG, import-workflow.dto.ts, workflow-dto-validation.spec.ts,
workflows.service.spec.ts, workflows.service.ts, workflow-crud.e2e-spec.ts, plan 문서, 기존
consistency-check 산출물 10건 포함)는 실제 diff 범위와 정확히 일치한다
(`git diff origin/main...HEAD --stat` 로 대조 확인, 16개 파일 전부 대응). 다만 파일 5
(`workflows.service.ts`)의 "전체 파일 컨텍스트"가 prompt-size cap 으로 중간에 잘려 있어, 해당
파일의 `update()`/`exportWorkflow()`/`importWorkflow()` 전체와 `spec/1-data-model.md §2.4`,
`spec/5-system/4-execution-engine.md §8`, `workflow-settings.dto.ts`, `update-workflow.dto.ts` 는
worktree 에서 직접 Read 하여 보강했다. mis-scope 아님 — fallback(git diff) 불필요했다.

## 점검 결과

### 1. 기능 완전성
`ImportWorkflowDto.settings` 가 `Record<string, unknown>` (`@IsObject()`만) 에서
`WorkflowSettingsDto`(`@IsObject @ValidateNested @Type(() => WorkflowSettingsDto)`)로 정확히
전환됐다. 전역 `CustomValidationPipe`(`whitelist:true, forbidNonWhitelisted:true`,
`codebase/backend/src/common/pipes/validation.pipe.ts` L30-31)가 이미 존재하므로 미지 키·비양수·
비정수 `maxConcurrentExecutions` 는 400 으로 거부된다. 서비스 write 경로(`importWorkflow`)도
`settings: { ...dto.settings } as Record<string, unknown>` 로 갱신되어 검증된 인스턴스를 jsonb 로
평탄화한다. `{ ...undefined }` → `{}` 이므로 settings 생략 시 종전 `dto.settings ?? {}` 와 동일하게
동작 — 단위 테스트(`workflows.service.spec.ts` "defaults settings to {} when the import omits it")로
직접 검증됨. 기능은 의도대로 완전히 구현됐다.

### 2. 엣지 케이스
- 경계값 `maxConcurrentExecutions=1` 허용, `0`/`-1`/`1.5`/`문자열` 거부 — DTO 단위 테스트 9건이
  각각 커버 (`workflow-dto-validation.spec.ts` L560-625, `it.each([0,-1,1.5])` 포함).
- `settings` 생략, `settings: {}` (빈 객체) 모두 허용 — 정상.
- 미지 키(`bogusKey`) 단독 및 유효 키와 혼합(`{maxConcurrentExecutions:3, bogusKey:1}`) 모두 거부.
- e2e 테스트 G 가 실 인프라에서 export→import round-trip 성공 + 미지 키 400 을 둘 다 검증.
빠진 경계 케이스 없음.

### 3. TODO/FIXME
`git diff origin/main...HEAD -- codebase/` grep 결과 TODO/FIXME/HACK/XXX 없음.

### 4. 의도와 구현 간 괴리
JSDoc·ApiProperty 설명이 실제 데코레이터 조합과 정확히 일치한다. `UpdateWorkflowDto.settings`
(L71-80)와 `ImportWorkflowDto.settings`(L167-176) 를 나란히 대조한 결과 데코레이터 순서·
`@ApiPropertyOptional` 문구까지 문자 그대로 미러 — "Mirror of UpdateWorkflowDto" 요구사항을
충족한다.

### 5. 에러 시나리오
전역 pipe 가 `class-validator` 에러를 표준 400 `VALIDATION_ERROR` 봉투로 매핑하는 기존 경로를
그대로 재사용 — 신규 에러 처리 로직 없음, 회귀 위험 낮음. e2e 로 실제 400 상태코드까지 확인됨.

### 6. 데이터 유효성
`WorkflowSettingsDto.maxConcurrentExecutions`: `@IsOptional @IsInt @Min(1)` — spec §8/§2.4의
"양의 정수, 미설정 시 기본 3" 요구사항과 정확히 일치. Import/Patch 양쪽에서 동일 클래스를
재사용하므로 검증 로직 중복/드리프트 위험이 구조적으로 없다.

### 7. 비즈니스 로직
- `CreateWorkflowDto` 에는애초 `settings` 필드가 없어(grep 결과 0건) settings 를 쓸 수 있는
  경로는 `PATCH`(strict, #805)와 `import`(본 PR, strict) 뿐 — CHANGELOG 의 "round-trip 은 항상
  안전" 주장이 코드로 뒷받침된다(신규 workflow 는 두 strict 경로로만 settings 를 얻는다).
- `update()`(PATCH)는 spread-merge, `importWorkflow()`는 신규 row 라 merge 불필요 — 의도된 비대칭이며
  plan·cross_spec 리뷰가 이미 이 점을 명시(INFO, 실질 모순 아님)했고 코드 주석(L180-182)도 이를
  설명한다.

### 8. 반환값
`importWorkflow` 트랜잭션 내 `manager.save(Workflow, workflow)` 결과가 정상적으로 `Workflow`
엔티티(검증된 settings 포함)를 반환 — 기존 반환 경로 무변경, 누락 없음.

### 9. spec fidelity — `spec/2-navigation/1-workflow-list.md §3.2` item 6 / §2.4 / §8

- **§3.2 item 6** (`git diff` 로 직접 확인): "워크플로우 `settings` 는 strict nested DTO
  (`WorkflowSettingsDto`) 로 검증 — 현재 `maxConcurrentExecutions`(양의 정수, §8 admission gate)만
  허용하고 **미지 키·비양수·비정수는 400 `VALIDATION_ERROR`**. `UpdateWorkflowDto.settings`(patch)와
  동일 strict 정책이며, 노드 `config`(soft, item 3)와 달리 workflow-level 실행 파라미터는
  admission-gate 정합을 위해 hard-fail 한다" — 코드(`WorkflowSettingsDto` + 전역 pipe)와 line-level
  로 정확히 일치. 에러코드 `VALIDATION_ERROR` 도 `CustomValidationPipe` 표준 매핑과 일치(별도 확인:
  `GlobalExceptionFilter`/`common/pipes` 경로가 이미 전역으로 이 매핑을 수행).
- **Rationale 추가분**: "워크플로우 `settings`(admission-gate 파라미터)는 이 permissive 예외에
  포함되지 않는다" — item 3 의 permissive 정책(노드 config)과 이번 hard-fail 정책의 스코프 분리를
  명확히 하며, 코드의 실제 동작(둘은 완전히 다른 필드·다른 검증 강도)과 모순 없음.
- **§2.4** (`spec/1-data-model.md` L120): "Workflow.settings ... 알려진 키:
  `maxConcurrentExecutions: number?`" — `WorkflowSettingsDto` 의 유일한 필드와 정확히 일치.
- **§8** (`spec/5-system/4-execution-engine.md` L1076): "워크플로우당 동시 Execution 수 3 ...
  `Workflow.settings.maxConcurrentExecutions` (Editor+, `PATCH /api/workflows/:id`)" — import
  엔드포인트도 controller 상 `@Roles('editor')` (cross_spec 산출물에서 이미 확인됨, 본 리뷰에서
  RBAC 레벨 동일성 재확인 완료)이므로 §8의 "Editor+" 권한 요건과 import 경로도 일치.
- **Mirror of UpdateWorkflowDto**: 위 4번 항목에서 line-level 대조 완료 — 완전 미러.

불일치 없음(CRITICAL 대상 spec-code 괴리 0건). 코드가 spec 을 정확히 따르고 있으며, spec 본문도
이번 PR 로 함께 갱신되어(§3.2 item 6 + Rationale) 코드와 spec 이 같은 커밋에서 동기화됐다 —
SPEC-DRIFT 해당 없음.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** Export 측(`ExportWorkflowDto.settings`, `workflow-response.dto.ts` L37/L154)은 여전히
  loose `Record<string, unknown>` 로 남아 input(import/patch)만 strict 화된 비대칭이 존재한다.
  - 상세: 현재는 위험 없음 — `CreateWorkflowDto` 에 `settings` 필드가 없고 PATCH/Import 양쪽 write
    경로가 모두 strict 이므로, `Workflow.settings` 에는 구조적으로 `maxConcurrentExecutions` 외의
    키가 새로 유입될 수 없다(신규 workflow 기준). pre-#805 레거시 row 에 한해 이론상 잔여 키가
    남아있을 수 있으나 이는 이번 변경 스코프 밖이며 기존에도 동일했던 리스크다.
  - 제안: 별도 후속 과제로 `ExportWorkflowDto.settings` 도 `WorkflowSettingsDto` 참조로 정렬할지는
    project-planner 판단 사안 — 이번 PR 의 결함은 아니다.

- **[INFO]** plan 체크리스트의 `ai-review + impl-done consistency`, `PR` 항목이 아직 미체크 —
  본 리뷰(`/ai-review`) 실행 자체가 그 체크 항목의 일부이므로 정상적인 진행 중 상태이며 결함이
  아니다.

## 요약

`ImportWorkflowDto.settings` 를 `UpdateWorkflowDto.settings` 와 동일한 strict nested
`WorkflowSettingsDto`(`@IsObject @ValidateNested @Type`)로 전환한 변경은 기능적으로 완전하고,
DTO 단위 테스트 9건·서비스 단위 테스트 2건·e2e round-trip 테스트가 정상 경로·경계값·에러 경로를
빠짐없이 커버하며(전부 통과 확인: `npx jest` 80 passed), 서비스 write 경로(`{ ...dto.settings }`)의
undefined-spread 의미론도 기존 동작과 동일하다. `spec/2-navigation/1-workflow-list.md §3.2` item 6
(및 신규 Rationale 문장), `spec/1-data-model.md §2.4`, `spec/5-system/4-execution-engine.md §8` 모두
코드와 line-level 로 정확히 일치하며, `UpdateWorkflowDto` 와의 미러링도 데코레이터 순서·문구까지
완전 일치함을 직접 대조로 확인했다. TODO/FIXME 없음, 반환값 누락 없음, 발견된 CRITICAL/WARNING 없음
— 두 건의 INFO(향후 고려사항)만 기록한다.

## 위험도

NONE

STATUS: SUCCESS
