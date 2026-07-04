# API 계약(API Contract) Review — workflow cap validated write DTO (fresh re-review)

- 대상: `PATCH /api/workflows/:id` `settings` opaque → 검증 nested `WorkflowSettingsDto` 전환 (unknown key → 400)
- Diff base 검증: `git diff origin/main...HEAD --stat` 결과가 payload 파일 목록(8개 코드/plan 파일 + 이전 리뷰 산출물)과 정확히 일치 — payload mis-scope 아님, fallback 불요.
- 이전 리뷰(`review/code/2026/07/04/21_11_10/api_contract.md`) 결론 재검증 목적의 fresh 세션.

## 재검증 사실관계

1. **소비 범위**: backend 가 `Workflow.settings` 에서 실제 읽는 키는 `maxConcurrentExecutions` 단 하나 (`resolveConcurrencyCap`, execution-limits.ts). DTO 예시로만 등장했던 `timeoutMs`/`retryCount` 는 어디서도 소비되지 않음.
2. **프런트 유일 호출부**: `codebase/frontend/src/app/(main)/workflows/page.tsx:229` `workflowsApi.update(id, { isActive: !isActive })` — `settings` 미전송. 워크플로우 `settings` 를 쓰는 UI 자체가 없음 (grep 결과 다른 호출부 없음). 클라이언트 측 타입 `codebase/frontend/src/lib/api/workflows.ts` 는 `settings: Record<string, unknown>` 로 남아있으나 이는 read/응답 타입일 뿐 write 페이로드 빌더가 아니므로 breaking 리스크와 무관.
3. **spec 스코프 근거**: `spec/5-system/4-execution-engine.md:1076` 이 `Workflow.settings.maxConcurrentExecutions` 를 `PATCH /api/workflows/:id` (Editor+, §2.4) 로 명시적으로 문서화 — 이번 DTO 강화는 이미 문서화된 스코프의 강제(enforcement)이지 신규 계약 창작이 아님.
4. **workspace 선례**: `UpdateWorkspaceSettingsDto` 가 이미 동일 strict 패턴(`@IsOptional @IsInt @Min(1)` + 전역 `whitelist:true, forbidNonWhitelisted:true` pipe)을 `PATCH /api/workspaces/:id/settings` 에 적용 중 — 이번 변경은 그 패턴을 workflow 측에 대칭 적용한 것.
5. **전역 pipe 확인**: `codebase/backend/src/common/pipes/validation.pipe.ts:30-31` 에 `whitelist: true, forbidNonWhitelisted: true` 확인 — nested DTO(`ValidateNested` + `Type`) 전환 시 미지 `settings.*` 키가 400 을 받는 메커니즘이 실제로 존재함을 코드 레벨에서 재확인.
6. **CHANGELOG 반영**: `CHANGELOG.md` Unreleased 섹션에 breaking 성격·영향 범위·근거가 명시적으로 기록됨 (§2.4 스코프, workspace 대칭, 프런트 미영향, backend 미소비 근거).
7. **spread-merge 유지**: `workflows.service.ts` `update()` 가 `settings` 를 전체 교체(`Object.assign`)가 아니라 `{ ...(workflow.settings ?? {}), ...settings }` 로 병합 — DB 에 이미 저장된, DTO 밖 잔여 키(과거에 opaque 상태에서 쓰였을 수 있는 임의 키)를 보존한다. 즉 **읽기 경로·기존 데이터는 영향 없음**, 영향 범위는 오직 "새로운 PATCH 요청의 request body 검증"으로 국한됨.

## 발견사항

없음(No findings). 이전 리뷰의 결론(우려되는 breaking change 아님)을 독립적으로 재확인. 세부:

- **[INFO]** 하위 호환성 — 이론적 breaking 표면은 존재하나 실질 영향 없음
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts`, `workflow-settings.dto.ts`
  - 상세: 계약상으로는 opaque object → strict nested DTO 전환이 breaking change 분류에 해당한다 (기존에 통과하던 `{ settings: { anyKey: ... } }` 요청이 이제 400). 그러나 (a) 문서화된 유일 백엔드 소비 키가 이미 화이트리스트에 포함, (b) 유일 프런트 호출부가 `settings` 자체를 전송하지 않음, (c) import DTO 는 opaque 유지로 별도 스코프, (d) CHANGELOG 에 사전 고지. 실질 파급 없음.
  - 제안: 조치 불요. 후속으로 계획된 `ImportWorkflowDto.settings` opaque/strict 비대칭 정리 시 동일 화이트리스트 확장 패턴 재사용 권장(이미 plan 파일에 후속 항목으로 기록됨).
- **[INFO]** 에러 응답 형식
  - 위치: 전역 `ValidationPipe` (`validation.pipe.ts`)
  - 상세: nested DTO 검증 실패 시 `errors[0].property === 'settings'` (unit test 로 확인) — 기존 top-level 필드 검증과 동일한 `400 + ValidationError[]` 포맷을 그대로 따름. 별도 에러 스키마 분기 없음.
  - 제안: 없음.

## 요약

`PATCH /api/workflows/:id` 의 `settings` 필드를 opaque `Record<string, unknown>` 에서 검증된 `WorkflowSettingsDto`(`maxConcurrentExecutions: @IsInt @Min(1)`)로 좁히는 변경은, 전역 `whitelist+forbidNonWhitelisted` pipe 특성상 형식적으로는 breaking-change 표면(미지 키 400)을 갖지만, 문서화된 소비 스코프(`spec/5-system/4-execution-engine.md §8`·`spec/1-data-model.md §2.4`)와 실제 소비 코드(단일 필드)·유일 프런트 호출부(`{isActive}`만 전송)·workspace 대칭 선례·서비스 레이어의 spread-merge(DB 잔여 키 보존)·CHANGELOG 사전 고지가 모두 일치해 실질적인 클라이언트 영향이 없음을 재확인했다. `git diff origin/main...HEAD` 로 payload 스코프도 정합함을 검증했다. 에러 응답 형식은 기존 파이프 규약을 그대로 따르며 URL/버전/페이지네이션/인증 관점은 이번 변경과 무관하다. 이전 리뷰 결론을 그대로 확인(confirm)하며 추가 발견사항 없음.

## 위험도

LOW
(전 항목 INFO 수준 — Critical/Warning 없음. 이전 리뷰와 동일 결론 재확인.)

STATUS: SUCCESS
