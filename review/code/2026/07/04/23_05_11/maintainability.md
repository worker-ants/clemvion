# 유지보수성(Maintainability) Review

## 리뷰 대상
`ImportWorkflowDto.settings` 를 opaque `Record<string, unknown>` 에서 strict nested `WorkflowSettingsDto` 로 전환 (PR #805 `UpdateWorkflowDto.settings` 와 patch/import 검증 대칭화). 대상 파일:

- `codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts`
- `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.service.ts`
- `codebase/backend/src/modules/workflows/workflows.service.spec.ts`
- `codebase/backend/test/workflow-crud.e2e-spec.ts`
- `CHANGELOG.md`, `plan/in-progress/import-workflow-settings-dto.md`, `review/consistency/**`(산출물)

payload 는 정상 스코프였다(대상 파일 목록·diff·전체 파일 컨텍스트가 실제 변경과 일치). fallback 불필요.

## 발견사항

- **[INFO]** `settings: { ...dto.settings } as Record<string, unknown>` 캐스팅의 의도가 코드만으로는 즉시 드러나지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` L284-286
  - 상세: `dto.settings` 는 이제 `WorkflowSettingsDto` 클래스 인스턴스(`class-transformer` 가 생성)이고, jsonb 컬럼에는 plain object 로 저장되어야 하므로 spread 로 평탄화 후 `as Record<string, unknown>` 캐스팅한다. 다행히 바로 위에 "검증된 WorkflowSettingsDto 인스턴스를 jsonb Record 로 평탄화(값은 동일)" 주석이 있어 읽는 사람이 의도를 파악할 수 있다 — 주석 품질은 좋음. 다만 `dto.settings` 가 `undefined` 인 경우 `{ ...undefined }` 는 `{}` 로 안전하게 평가되지만, 이 사실(spread 가 nullish 를 안전하게 처리한다는 전제)에 의존하는 코드라는 점이 명시적이지 않아 향후 `dto.settings` 타입이 바뀌면 조용히 깨질 수 있는 미묘한 결합이다. 종전 `dto.settings ?? {}` 쪽이 이 전제를 명시적으로 드러냈던 것과 대비된다.
  - 제안: 필수는 아니나, `dto.settings ?? new WorkflowSettingsDto()` 형태로 nullish 처리를 명시하거나, 주석에 "`dto.settings` 가 `undefined` 여도 spread 는 `{}` 로 안전하게 평가된다" 한 줄을 덧붙이면 다음 유지보수자의 재확인 비용을 줄일 수 있다.

- **[INFO]** `ImportWorkflowDto.settings` 와 `UpdateWorkflowDto.settings` 의 데코레이터 순서가 다름
  - 위치: `import-workflow.dto.ts` L321-326 (`@IsOptional / @IsObject / @ValidateNested / @Type`) vs `update-workflow.dto.ts` L76-80 (동일 순서: `@IsOptional / @IsObject / @ValidateNested / @Type`)
  - 상세: 실제 확인 결과 두 파일의 데코레이터 순서는 동일하다(`@IsOptional() @IsObject() @ValidateNested() @Type(...)`). consistency-check 산출물(`convention_compliance.md`)에서도 "정확히 일치" 로 확인됨. 별도 조치 불요 — 일관성 우려 없음(오탐 배제 차원에서 기록).

- **[INFO]** `ExportWorkflowDto.settings` 는 여전히 opaque `Record<string, unknown>` 로 남아 있어, import(strict)·export(loose) 간 스키마 표현 비대칭이 존재
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`(export 응답 DTO, 이번 diff 범위 밖)
  - 상세: 이번 변경 스코프는 의도적으로 input(import) 측만 강화하고 output(export) 측은 그대로 둔 것으로 plan·consistency 산출물에 명시되어 있다(§8 안전성 논거: export 가 이미 post-#805 settings 를 as-is emit 하므로 round-trip 자체는 안전). 유지보수 관점에서 향후 신규 기여자가 "왜 export DTO 는 strict 가 아닌가" 를 재확인해야 하는 비용이 남지만, 이는 이번 PR 의 의도된 스코프 경계이며 코드 자체의 결함은 아니다.
  - 제안: 조치 불필요(기결정 사항, 별도 후속 과제로 문서에 이미 기록됨).

- 나머지 항목(가독성·네이밍·함수 길이·중첩 깊이·매직 넘버·중복 코드·복잡도)은 전반적으로 양호:
  - `WorkflowSettingsDto` 는 이미 존재하는 단일 필드 DTO를 재사용했을 뿐 신규 복잡도 유입이 없다.
  - JSDoc(필드·클래스 레벨)이 SoT 스펙 섹션(§2.4, §8)을 명시적으로 링크해 근거 추적이 쉽다.
  - `import-workflow.dto.ts` 의 변경은 4줄 데코레이터 교체 + JSDoc 추가뿐으로 함수/클래스 길이·중첩·복잡도에 영향 없음.
  - 테스트(`workflow-dto-validation.spec.ts`)는 `UpdateWorkflowDto` 케이스와 병렬 구조(동일 boundary/reject 케이스 세트)를 그대로 미러링해 대칭성이 테스트 코드 레벨에서도 명확히 드러난다 — 오히려 두 describe 블록 간 거의 동일한 케이스 배열(`it.each([0, -1, 1.5])` 등)이 반복되지만, 각 DTO 가 독립된 클래스이고 회귀 감지 목적상 의도된 반복이라 문제 삼지 않는다(과도한 추출 시 오히려 두 DTO 가 우연히 같은 동작을 공유한다는 착시를 줄 수 있음).
  - `workflows.service.ts` 변경은 한 줄 표현식 교체이며 부작용 범위가 명확(신규 생성 경로 한정, merge 로직 없음 — 주석에도 명시).

## 요약
변경은 기존 `UpdateWorkflowDto.settings` 패턴(#805)을 문자 그대로 재사용하는 좁고 국소적인 DTO 타이핑 강화로, 신규 추상화·복잡도·매직넘버·중복 로직이 유입되지 않았다. 데코레이터 순서·네이밍·JSDoc 근거 링크 모두 기존 컨벤션과 일치하며, service 변경 1줄에는 의도를 설명하는 주석이 동반되어 있다. 테스트는 대칭 케이스를 명시적으로 미러링해 회귀 감지력을 높였다. 발견된 사항은 전부 INFO 수준(캐스팅 전제의 암묵성, export DTO 비대칭)이며 어느 것도 즉각적인 수정을 요하지 않는다.

## 위험도
NONE

STATUS: SUCCESS
