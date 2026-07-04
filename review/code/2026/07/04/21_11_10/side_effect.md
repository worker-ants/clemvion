# 부작용(Side Effect) Review — workflow-cap-dto-bca77e

## 검토 대상

- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` (settings 타입 narrowing)
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` (신규)
- `codebase/backend/src/modules/workflows/workflows.service.ts` (`update()` — 핵심 변경)
- 관련 테스트: `workflow-dto-validation.spec.ts`, `workflows.service.spec.ts`

## 핵심 변경 요약

`WorkflowsService.update()`:

```ts
// before
Object.assign(workflow, dto);

// after
const { settings, ...rest } = dto;
Object.assign(workflow, rest);
if (settings !== undefined) {
  workflow.settings = { ...(workflow.settings ?? {}), ...settings };
}
```

## 발견사항

- **[INFO]** non-settings 필드 병합 경로는 동작 보존 확인
  - 위치: `workflows.service.ts:1202-1203` (`const { settings, ...rest } = dto; Object.assign(workflow, rest);`)
  - 상세: `rest` 에는 `name/description/isActive/tags/folderId` 등 `settings` 를 제외한 모든 DTO 필드가 그대로 담긴다. 구조분해 후 `Object.assign(workflow, rest)` 는 이전 `Object.assign(workflow, dto)` 와 `settings` 를 제외하면 완전히 동일한 대입 동작이다 (열거 가능한 자체 속성만 복사하는 `Object.assign` 의미론은 변하지 않음, `dto` 에 없는 키는 여전히 손대지 않음 — 예: `undefined` 로 명시 전달된 필드가 있다면 `workflow` 쪽 값을 `undefined` 로 덮어쓰는 기존 특성도 그대로 유지). 회귀 없음.
  - 제안: 없음 (정상).

- **[INFO]** settings 는 "un-set(제거)" 불가 — 이는 의도된 설계이며 워크스페이스 대칭
  - 위치: `workflows.service.ts:1207-1209`
  - 상세: 신 로직은 `settings` 의 개별 키를 `undefined`/`null` 로 보내도 지울 수 없다 — spread-merge 는 오직 "덮어쓰기/추가"만 가능하고 키 삭제는 불가능하다. 다만 현재 `WorkflowSettingsDto` 는 `maxConcurrentExecutions?: number` 단일 필드이고 `@IsInt() @Min(1)` 이라 애초에 `null`/`0`/음수를 DTO 레벨에서 400 으로 거부하므로, "cap 을 명시적으로 해제(기본값으로 되돌림)"하는 API 표현 자체가 현재 스키마에 없다. 이는 PR 설명(§8 admission cap 목적) 과 부합하고, 주석에 "workspace updateWorkspaceSettings 의 spread-merge 대칭"이라고 명시돼 있어 의도된 동작으로 보인다. 다만 사용자가 "cap 을 없앤다(무제한으로 되돌린다)"는 유스케이스가 향후 필요해지면 명시적 삭제 마커(`null` 허용 + 삭제 처리)가 필요하다는 점은 기록해 둘 가치가 있다.
  - 제안: 코드 수정 불필요. 향후 "cap 해제" 요구가 생기면 `maxConcurrentExecutions: null` → 키 삭제 처리하는 명시적 분기를 추가할 것(현재 스코프 밖).

- **[INFO]** 이전엔 전체 교체였던 "잔여 키"가 이제는 보존됨 — 관찰 가능한 유일한 동작 차이
  - 위치: `workflows.service.ts:1204-1209` vs 이전 `Object.assign(workflow, dto)`
  - 상세: 변경 전에는 `dto.settings` 가 오면 DB 의 `workflow.settings` 전체가 `dto.settings` 값으로 완전 치환됐다(참조 자체가 교체). 예를 들어 과거에 `{ timeoutMs: 30000, retryCount: 3 }` 같은 자유 형식 키가 저장돼 있었다면, 예전 동작은 `dto.settings = { maxConcurrentExecutions: 5 }` 요청 시 `timeoutMs`/`retryCount` 를 통째로 삭제했다. 새 동작은 이 키들을 보존한 채 `maxConcurrentExecutions` 만 병합한다. 이는 유일하게 "이전엔 교체되던 키가 이제는 보존되는" 경로다.
  - 영향 평가: 이 변경은 PR 의 명시적 목적(§8 admission cap DTO 도입, workspace 대칭)과 일치하고 실제로 이번 PR 부터는 `settings` 에 `maxConcurrentExecutions` 외 키를 write API 로 넣을 방법이 없다(`WorkflowSettingsDto` 가 whitelist+forbidNonWhitelisted 로 미지 키를 400 차단). 따라서 신규 유입 경로로는 "잔여 키 보존"이 문제를 일으키지 않는다. 다만 **DTO 도입 이전에 이미 DB 에 저장된 레거시 자유 형식 `settings` 값**(예: 과거 어떤 코드 경로로 저장된 `timeoutMs` 등, 스펙 문서상 `import-workflow.dto.ts` 의 `settings?: Record<string, unknown>` opaque 경로로 여전히 임의 키가 들어갈 수 있음 — consistency review `cross_spec.md` 에서도 지적됨)가 존재한다면, 그 값들은 이제 `update()` 호출 후에도 영구히 남는다. 예전 동작이라면 다음 `update({settings:...})` 호출 시 자연스럽게 청소(치환)됐을 것을 이제는 "청소되지 않고 계속 누적"된다는 부작용 가능성이 있다. 이는 버그라기보다 "레거시/opaque import 값이 이제 update 경로로 청소되지 않는다"는 부수효과이며, `import-workflow.dto.ts` 의 opaque `settings` 비대칭은 이미 별도 후속 항목(`plan/in-progress/workflow-cap-validated-dto.md` §후속, consistency review `cross_spec.md`)으로 트래킹되고 있어 본 PR 범위 내 결함으로 보긴 어렵다.
  - 제안: 코드 수정 불필요(별도 후속 트래킹 확인됨). 다만 리뷰 기록으로서: "settings 병합이 레거시 opaque 키를 영구 보존한다"는 점을 후속 import DTO 비대칭 해소 작업 시 함께 고려할 것.

- **[INFO]** DTO 계약 narrowing(`Record<string, unknown>` → `WorkflowSettingsDto`, 미지 키 400) — 호출자 영향 확인
  - 위치: `update-workflow.dto.ts:63-67`, `workflow-settings.dto.ts` 신규
  - 상세: 컨트롤러 유일 호출부(`workflows.controller.ts:184`)는 `@Body()` 로 바인딩된 DTO 를 그대로 서비스에 전달하므로 전역 `CustomValidationPipe`(whitelist+forbidNonWhitelisted, 프로젝트 표준) 를 거친다. 이는 기존에 `settings` 에 임의 키(`{timeoutMs, retryCount}` 등, 옛 스웨거 예제)를 보내던 API 소비자가 있었다면 이제 400 을 받게 되는 **breaking API 변경**이다. 다만 이는 PR 의 명시적 목적(§8 admission cap 도입, 스펙 §2.4 가 이미 `maxConcurrentExecutions` 로 스코프)이며 사전 consistency-check(`review/consistency/2026/07/04/20_55_13/SUMMARY.md`, "BLOCK: NO — 착수 승인")를 통과한 의도된 breaking narrowing 으로 확인된다. 새로 발견된 문제 아님.
  - `WorkflowsService.update()` 시그니처 자체(`(id, workspaceId, dto: UpdateWorkflowDto)`) 는 변경되지 않았다 — 내부 구현만 변경. 서비스 레벨 시그니처 호환성 문제 없음.
  - 제안: 없음 (승인된 설계).

- **[INFO]** 전역 상태·파일시스템·환경변수·네트워크·이벤트 부작용 없음
  - 상세: 변경은 순수하게 단일 함수(`WorkflowsService.update`) 내부의 로컬 객체 병합 로직이다. 전역 변수 도입/수정, 파일 I/O, env 읽기/쓰기, 외부 네트워크 호출, 이벤트 발행 없음. `workflow` 객체는 이 함수 호출 스코프에서 새로 로드된 로컬 엔티티 인스턴스이며 공유 상태가 아니다.

## 검증 근거 (실제 코드 확인)

- `codebase/backend/src/modules/workflows/entities/workflow.entity.ts:45-46` — `settings: Record<string, unknown>` (`@Column({ type: 'jsonb', default: {} })`). `workflow.settings ?? {}` 처리가 DB `null` 케이스와 일치.
- `codebase/backend/src/modules/workflows/workflows.controller.ts:184` — `update()` 의 유일한 호출부, DTO 검증 파이프를 통과.
- `codebase/backend/src/modules/execution-engine/execution-limits.ts:47-56` — 읽기 경로(`resolveConcurrencyCap`)는 여전히 `Record<string, unknown>` 형태의 `workflow.settings` 를 받아 파싱하므로 엔티티 타입/읽기 계약은 변경되지 않음.
- `workflows.service.spec.ts` 신규 테스트 3건(병합 보존, omit 시 무변경, null→초기화)이 위 분석과 일치하는 기대값을 검증.

## 요약

`WorkflowsService.update()` 의 `settings` 처리를 전체 교체에서 spread-merge 로 바꾼 변경은, non-settings 필드 처리(`Object.assign(workflow, rest)`)를 정확히 보존하면서 `settings` 병합 로직만 추가한 국소적 변경이다. "settings 를 언셋(삭제)할 수 없다"는 특성과 "DTO 도입 이전 레거시/opaque 키가 이제는 update 후에도 청소되지 않고 잔존한다"는 두 가지 관찰 가능한 동작 변화가 있으나, 둘 다 PR 의 명시된 설계 의도(§8 admission cap, workspace 대칭, 사전 consistency-check 승인)와 일치하며 새로운 결함으로 보기 어렵다. DTO 계약의 미지 키 400 narrowing 은 의도된 breaking change 로, 유일한 호출자(controller)와 서비스 시그니처 모두 영향받지 않는다. 전역 상태·파일시스템·환경변수·네트워크·이벤트 관련 부작용은 없다.

## 위험도

LOW

STATUS: SUCCESS
