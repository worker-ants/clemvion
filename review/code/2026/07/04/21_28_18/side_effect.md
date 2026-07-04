# 부작용(Side Effect) Review — workflow-cap-dto-bca77e (fresh re-review)

## 검토 대상 (payload = `git diff origin/main...HEAD` 와 일치 확인, mis-scope 없음)

- `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` (`settings` 타입 narrowing: `Record<string, unknown>` → `WorkflowSettingsDto`)
- `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts` (신규 — `maxConcurrentExecutions?: number`, `@IsInt @Min(1)`)
- `codebase/backend/src/modules/workflows/workflows.service.ts` — `update()` spread-merge 전환 (핵심 변경)
- 테스트: `workflow-dto-validation.spec.ts`, `workflows.service.spec.ts`, `workflow-crud.e2e-spec.ts` (B2)
- 문서: `CHANGELOG.md`, `plan/in-progress/workflow-cap-validated-dto.md`
- 그 외 payload 포함분(review/consistency 산출물 20건)은 이전 세션의 리뷰 아티팩트로 실제 부작용 검토 대상 코드가 아님 — 실질 diff(8개 파일)와 대조 시 payload 완전 일치 확인.

## 핵심 변경

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

## 실제 코드 재검증 (fresh)

- `workflows.service.ts:172-187` — diff 그대로 현재 파일에 반영됨. `WorkflowsService.update(id, workspaceId, dto)` 시그니처 불변.
- `workflows.controller.ts:184` — 유일한 호출부, 그대로 `update()` 위임. 호출자 영향 없음.
- `workflow.entity.ts:46` — `settings: Record<string, unknown>` (엔티티/컬럼 타입 불변). DTO narrowing 은 write-side 에만 적용되고 read/엔티티 계약은 그대로 — 읽기 경로(`resolveConcurrencyCap`)와 타입 불일치·회귀 없음.
- `execution-limits.ts:52-60` (`resolveConcurrencyCap`) — 여전히 `settings?.maxConcurrentExecutions` 를 duck-typing 으로 읽고 `typeof number && isInteger && >0` 가드를 유지. DTO 강화와 무관하게 backstop 병존 확인.
- `workspaces.service.ts:311-355` (`updateWorkspaceSettings`) 대조 확인 — "workspace 대칭" 주장 검증: workspace 쪽은 `timezone` 에 대해 **명시적 unset 분기**(빈 문자열 → 키 삭제)가 있는 반면, workflow 쪽 spread-merge 는 그런 분기가 없다(단일 필드 스키마이고 `@IsInt @Min(1)`이라 애초에 "해제" 값을 표현할 방법이 DTO 상 없음). 완전한 구조적 대칭은 아니고 "병합 전략"만 대칭 — 문서·주석의 "대칭" 표현이 다소 과장되어 있으나 동작상 결함은 아님(이전 세션 INFO 와 동일 결론, 재확인).

## 발견사항

- **[INFO]** non-settings 필드 처리 경로 보존 확인
  - 위치: `workflows.service.ts:178-179`
  - 상세: `const { settings, ...rest } = dto; Object.assign(workflow, rest)` 는 `settings` 를 제외하면 이전 `Object.assign(workflow, dto)` 와 완전히 동일한 대입 의미론이다. 회귀 없음. 재검증 결과 이전 리뷰와 동일 결론.

- **[INFO]** `settings` un-set(cap 해제) 경로 없음 — 스키마상 의도된 제약
  - 위치: `workflows.service.ts:183-185`, `workflow-settings.dto.ts`
  - 상세: spread-merge 는 오직 덮어쓰기/추가만 가능하고 키 삭제 표현이 없다. `maxConcurrentExecutions` 는 `@IsInt @Min(1)` 이라 `null`/`0`/음수로 "해제" 의도를 표현할 방법이 DTO 레벨에서 아예 거부된다. workspace 의 `timezone` unset 분기와 비교하면 구조적으로 비대칭이지만, 현재 스키마(단일 양의 정수 필드)에서는 무의미한 gap — 새로운 결함 아님.
  - 제안: 향후 "cap 을 명시적으로 해제(기본값 복귀)" 유스케이스가 필요해지면 별도 sentinel(`null` 허용 + 키 삭제 처리)을 추가할 것. 현재 스코프에서는 조치 불필요.

- **[INFO]** 레거시/opaque `settings` 잔여 키 보존 — 유일하게 관찰 가능한 동작 변화
  - 위치: `workflows.service.ts:183-185` vs 이전 `Object.assign(workflow, dto)`(전체 치환)
  - 상세: 이전 동작은 `dto.settings` 제공 시 DB `settings` 컬럼 전체를 치환했다. 신규 동작은 병합이므로, `ImportWorkflowDto.settings`(여전히 opaque `Record`, 이번 PR 범위 밖)를 통해 유입된 임의 키나 과거 자유 형식 값이 있다면 이후 `PATCH` 호출로도 청소되지 않고 영구 잔존한다. 이는 PR 의 명시된 목적(§8 cap DTO, 잔여 키 보존)과 일치하고, `ImportWorkflowDto` opaque 비대칭은 plan 문서·CHANGELOG 에 후속 항목으로 명시적으로 트래킹된다. 신규 유입 경로(PATCH)로는 `WorkflowSettingsDto` whitelist+forbidNonWhitelisted 가 미지 키를 400 으로 막으므로 문제 재생산 안 됨.
  - 제안: 코드 수정 불필요. 이미 별도 후속(ImportWorkflowDto opaque 해소)으로 추적 중 — 재확인.

- **[INFO]** DTO 계약 narrowing — 호출자·시그니처 영향 재검증
  - 위치: `update-workflow.dto.ts:63-94`, `workflow-settings.dto.ts` 신규
  - 상세: `settings: Record<string, unknown>` → `settings?: WorkflowSettingsDto` 전환은 전역 `whitelist+forbidNonWhitelisted` pipe 로 인해 미지 키 요청을 400 으로 거부하는 **의도된 breaking 계약 축소**다. 컨트롤러 유일 호출부(`workflows.controller.ts:184`)는 `@Body()` 바인딩 DTO 를 그대로 전달하므로 파이프를 그대로 통과 — 서비스 레벨 시그니처(`update(id, workspaceId, dto: UpdateWorkflowDto)`)는 변경되지 않았다. `WorkflowsService.update()` 를 호출하는 다른 내부 소비자 없음(grep 재확인: `workflows.controller.ts` 단일 호출).
  - 사전 consistency-check(`review/consistency/2026/07/04/20_55_13/`) 통과 + 프런트 유일 호출부(`workflowsApi.update`)가 `{ isActive }` 만 전송함을 코드 근거로 확인된 승인된 설계 — 신규 결함 아님.
  - 제안: 없음.

- **[INFO]** 전역 상태·파일시스템·환경변수·네트워크·이벤트/콜백 부작용 없음
  - 상세: 변경은 `WorkflowsService.update()` 단일 메서드 내부의 로컬 객체 병합 로직으로 국한된다. 전역 변수 도입/수정 없음, 파일 I/O 없음, `process.env` 읽기/쓰기 없음, 외부 네트워크 호출 없음, 이벤트 발행/콜백 변경 없음. `workflow` 는 이 함수 호출 스코프에서 새로 로드된 로컬 엔티티 인스턴스(공유 상태 아님).

## 검증 근거 (실제 코드 fresh 확인, 이번 세션에서 재수행)

- `workflows.service.ts:172-187` — 현재 파일 상태와 diff 완전 일치.
- `workflows.controller.ts:184` — 유일 호출부 재확인.
- `workflow.entity.ts:46` — 엔티티 컬럼 타입 불변 재확인.
- `execution-limits.ts:52-60` — 읽기 경로 backstop 병존 재확인, DTO 강화와 독립적으로 동작.
- `workspaces.service.ts:311-355` — "workspace 대칭" 주장에 대한 독립 대조 — 병합 전략은 대칭이나 unset 분기 유무는 비대칭(스키마 차이로 인해 무해).
- payload 파일 목록(8개 실질 변경) vs `git diff origin/main...HEAD --stat`(8개 코드/문서 파일 + 20개 review 아티팩트) 완전 일치 — mis-scope 없음, fallback 불필요.

## 요약

이번 fresh 재검토에서도 이전 세션(21_11_10)과 동일한 결론에 도달했다. `WorkflowsService.update()` 의 `settings` 처리를 전체 치환에서 spread-merge 로 바꾼 변경은 non-settings 필드 처리를 정확히 보존하는 국소적 변경이며, "settings 언셋 불가"·"레거시 opaque 키 잔존" 두 가지 관찰 가능한 동작 변화는 모두 PR 의 명시된 설계 의도(§8 admission cap, workspace 유사 전략, 사전 consistency-check 승인)와 일치하고 별도 후속으로 트래킹되고 있어 신규 결함이 아니다. DTO 계약의 미지 키 400 narrowing 은 의도된 breaking change 이며 유일한 호출자(controller)·서비스 시그니처 모두 영향받지 않음을 코드로 재확인했다. "workspace 대칭" 서술은 병합 전략 수준에서는 맞지만 unset 분기 유무까지 포함한 완전한 구조적 대칭은 아니라는 점을 이번에 추가로 명확히 했으나(단일 필드 스키마상 무해), 이는 문서 표현의 미세한 과장일 뿐 동작 결함은 아니다. 전역 상태·파일시스템·환경변수·네트워크·이벤트 관련 부작용 없음.

## 위험도

LOW

STATUS: SUCCESS
