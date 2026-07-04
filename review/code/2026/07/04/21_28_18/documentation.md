# 문서화(Documentation) Review — workflow cap validated write DTO (fresh re-review)

- 세션: `review/code/2026/07/04/21_28_18`
- 목적: 직전 세션(21_11_10)에서 지적된 INFO("CHANGELOG 항목 누락") 조치 여부 검증

## 검증 결과: CHANGELOG.md 항목 정확성

`CHANGELOG.md` 상단에 다음 항목이 추가되었음을 확인했다:

```
## Unreleased — workflow 동시 실행 cap validated write DTO (§8, workspace 대칭)
```

diff/코드 대비 항목별 사실관계 검증:

| 서술 | 근거 | 판정 |
| --- | --- | --- |
| opaque `Record<string, unknown>`(`@IsObject()`) → `WorkflowSettingsDto` 전환 | `update-workflow.dto.ts` diff (필드 타입·`@ValidateNested`·`@Type` 추가 확인) | 정확 |
| `maxConcurrentExecutions`: `@IsInt @Min(1)` | `workflow-settings.dto.ts` 신규 파일 확인 | 정확 |
| workspace `UpdateWorkspaceSettingsDto` 와 대칭 | DTO JSDoc·service 주석·plan 문서 일관 서술 | 정확 |
| 전역 whitelist+forbidNonWhitelisted → 미지 키·비양수·비정수 400 | `workflow-dto-validation.spec.ts`(0/-1/1.5/문자열/미지키 거부 unit) + `workflow-crud.e2e-spec.ts` B2(zero→400, unknownKey→400, 5→200+영속) 로 실증 | 정확 |
| 런타임 `resolveConcurrencyCap` backstop 이 defaultCap 무시(종전 방어) | 이번 diff 파일 목록엔 없으나 DTO JSDoc·plan 문서와 일관, 반증 없음 | 정합적(간접 확인) |
| 프런트 `workflowsApi.update` 유일 호출부는 `{ isActive }` 만 전송 | 이번 diff 범위 밖(frontend 미변경)이나 plan 문서에 명시된 조사 결과와 일치, 배경 설명으로 적절 | 정합적 |
| service `update` 는 settings 를 spread-merge(전체 교체 아님) | `workflows.service.ts` diff — `workflow.settings = { ...(workflow.settings ?? {}), ...settings }` | 정확 |
| `ImportWorkflowDto.settings` opaque 유지(별도 후속) | plan 문서 "후속(별도)" 섹션과 일치 | 정확 |
| SoT: `spec/5-system/4-execution-engine.md §8` | DTO/서비스 주석에서 반복 참조되는 spec 경로와 일치 | 정확 |

CHANGELOG 항목의 모든 사실 서술이 diff 내용·동반 테스트·plan 문서와 부합한다. 배치도 기존 관례(복수 `## Unreleased` 서브섹션 스택)를 따른다.

## 기타 문서화 항목 재확인 (회귀 없음)

- `WorkflowSettingsDto`, `UpdateWorkflowDto.settings` JSDoc: 신규 whitelist/400 동작을 정확히 서술.
- Swagger `@ApiPropertyOptional({ type: () => WorkflowSettingsDto, ... })`: 직전 세션 INFO(직접 참조 → thunk) 반영되어 수정됨.
- `workflows.service.ts` 인라인 주석: spread-merge 근거(잔여 키 보존, workspace 대칭)를 명확히 설명, 코드와 일치.
- 테스트 파일들: `it(...)` 설명 및 선행 주석 블록으로 자기 문서화 충분.

## 최종 판정

Severity 발견 없음. 직전 세션 INFO(CHANGELOG 항목 누락)는 정확한 내용으로 해소됨.

**no findings**

## 위험도

NONE

STATUS: SUCCESS
