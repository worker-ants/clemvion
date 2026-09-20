All call sites consistently updated to the new `{ parentPresence, triggerIds }` return shape. No stale `ids`/`parent` naming leftovers.

Based on the full review of the target document set (`spec/2-navigation`, primarily `1-workflow-list.md` / `2-trigger-list.md` / `3-schedule.md` — the only files not budget-truncated in the bundle) plus the actual implementation diff read directly from the worktree (`trigger-resource-release.ts`, `trigger-resource-releaser.service.ts`, `workflows.service.ts`, `workspaces.service.ts` and their specs/e2e), I did not find a convention violation to report.

### 발견사항

없음 — CRITICAL/WARNING 없음.

검토 근거 요약(관점별):

- **명명 규약**: 신설 에러 코드 없음. `code: 'RESOURCE_NOT_FOUND'`(`workflows.service.ts:282`)와 `code: 'WORKSPACE_NOT_FOUND'`(`workspaces.service.ts:532`)는 각각 `spec/5-system/2-api-convention.md §5.3`의 404 기본 코드, `spec/5-system/3-error-handling.md`가 "`workspaces.service` 전역 CRUD 공통 generic 코드"로 이미 등재한 값을 재사용한 것 — 신규 명명 판단이 필요 없는 자리다. 메시지 문구(`'Workflow not found'` 영문 / `'워크스페이스를 찾을 수 없습니다.'` 한글)도 각 모듈이 기존에 쓰던 언어 컨벤션과 정확히 일치한다(동일 문자열이 `workspaces.service.ts` 전역에 6곳 이상 이미 존재). 신설 TS 인터페이스 `LockedParentTriggers`/필드 `parentPresence`는 wire 로 나가지 않는 내부 타입이라 Swagger DTO 명명 규약(`spec/conventions/swagger.md §1-7` 등) 대상이 아니다. 신설 e2e 파일명(`workflow-delete-concurrency.e2e-spec.ts` 등)도 저장소 기존 패턴(`integration-rotate-concurrency.e2e-spec.ts`)과 일치.
- **출력 포맷 규약**: 에러 봉투는 `NotFoundException({ code, message })` 형태로 `GlobalExceptionFilter`가 감싸는 기존 envelope(`{ error: { code, message, requestId } }`, `spec/5-system/2-api-convention.md §5.3`)를 그대로 따른다. 내부 구현 원문 echo 없음(CWE-209 조항 위반 없음).
- **문서 구조 규약**: 이번 PR 은 `spec/2-navigation` 델타 0 — Overview/본문/Rationale 구조나 `0-`/`_product-overview.md` prefix 규칙에 영향 없음.
- **API 문서 규약**: DTO/Swagger 데코레이터 변경 없음(순수 서비스 레이어 로직 수정) — 해당 없음.
- **금지 항목**: `spec/conventions/error-codes.md` §1의 `UPPER_SNAKE_CASE`, `secret-store.md`/`swagger.md`의 엔티티 패스스루·비밀 노출 금지 등 위반 패턴 없음.

참고(비위반, 정보용): `plan/in-progress/dup-delete-audit.md`가 이미 자체적으로 `spec_impact: none`을 선언하고 그 근거로 `2-trigger-list.md §4.4`의 "동시 삭제 두 번째 요청은 404" 선례를 인용했으며, 해당 판단은 이 PR의 `--impl-prep`(`review/consistency/2026/09/20/19_30_57`, BLOCK:NO, Warning 2)에서도 문제 삼지 않았다. `1-workflow-list.md`/워크스페이스 관련 spec에는 트리거 문서처럼 "동시 삭제 시 두 번째는 404" 문구가 명시돼 있지 않지만, 이는 `api-convention §5.3`의 404 기본값(generic REST 시맨틱)으로 이미 커버되는 영역이라 신규 CRITICAL/WARNING 사유로 보지 않았다 — 다만 트리거 문서와의 표현 일관성을 원한다면 추후 `1-workflow-list.md §3`/워크스페이스 spec에도 동일 문구를 additive 로 얹는 것을 고려할 수 있다(INFO, 강제 아님).

동일 plan 문서가 이미 별도로 추적 중인 기존 불일치(`2-trigger-list.md §3`의 `details.field='endpoint_path'`가 같은 문서의 wire 필드명 `endpointPath`와 다른 문제, planner 항목으로 등재됨)는 이번 diff와 무관한 선재 이슈이므로 재-flag 하지 않았다.

### 요약

이번 `--impl-done` 대상 코드 diff(9파일/611줄, `trigger-resource-release.ts`·`trigger-resource-releaser.service.ts`·`workflows.service.ts`·`workspaces.service.ts` 및 대응 유닛/e2e 테스트)는 신규 에러 코드·DTO·엔드포인트를 도입하지 않고 기존에 확립된 에러 코드(`RESOURCE_NOT_FOUND`/`WORKSPACE_NOT_FOUND`)와 모듈별 메시지 언어 컨벤션을 그대로 재사용해 동시 DELETE 감사 중복 버그를 고쳤다. `spec/2-navigation` 자체는 이번 PR 에서 변경되지 않았고(델타 0), 조회 가능한 범위(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`) 안에서 명명·출력 포맷·문서 구조·API 문서·금지 항목 규약 위반은 발견되지 않았다.

### 위험도

NONE
