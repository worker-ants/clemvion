# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

### [WARNING] triggers.mdx / triggers.en.mdx 의 endpointPath 예시값 stale

- **변경 파일**: `codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts`, `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts`
- **매트릭스 항목**: `backend-api-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- **누락된 동반 갱신**:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (line 201)
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` (line 190)
- **상세**: `endpointPath` 필드가 `@IsString()/@MaxLength(255)` 에서 `@IsUUID('4')` 로 변경됐다. 이제 v4 UUID 형식이 아닌 값은 서버에서 400으로 거부된다. 그런데 두 MDX 모두 트리거 생성 예시 payload 에 `"endpointPath": "uuid-or-slug"` 를 그대로 기재하고 있어, 이 예시를 따라 slug 형식 값을 보내면 요청이 실패한다. 사용자가 API를 직접 호출하는 경우 잘못된 예시로 인해 혼란이 발생할 수 있다.
- **제안**: 두 파일 모두 `"endpointPath": "uuid-or-slug"` 를 `"endpointPath": "550e8400-e29b-41d4-a716-446655440000"` (또는 `"<v4 UUID>"`) 로 교체하고, 해당 예시에 v4 UUID 만 허용된다는 주석/안내를 추가한다.

---

## 비해당 항목 (No trigger match)

다음 변경 파일들은 doc-sync 매트릭스의 어떤 trigger 에도 매칭되지 않거나, 동반 갱신이 이미 같은 변경 set 에 포함됐다:

| 변경 파일 | 판정 |
|---|---|
| `codebase/backend/src/modules/websocket/execution-seq-allocator.service.spec.ts` | 테스트 내부 타입 캐스트 정리(`as never` → `as unknown as RedisConnectionProvider`) — 동작·API 변경 없음. 매트릭스 trigger 없음 |
| `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` | 매직 넘버 → 모듈 상수 추출 리팩터링 — 동작 변경 없음. 매트릭스 trigger 없음 |
| `codebase/backend/test/system-status.e2e-spec.ts` | e2e 큐 목록에 `workspace-invitations-pruner` 추가 — 테스트 파일 only. 매트릭스 trigger 없음 |
| `codebase/backend/src/modules/workspaces/jobs/workspace-invitations-pruner.service.ts` (신규) | 워크스페이스 만료 초대 정리 background job. `auth/**` glob 외부이며, 사용자에게 직접 노출되는 UI 변경·에러코드·경고코드 없음. `spec/data-flow/12-workspace.md` 가 같은 changeset 에서 이미 갱신됨 |
| `codebase/backend/src/modules/system-status/system-status.constants.ts` | `MONITORED_QUEUES` 에 새 큐 등록 — 시스템 상태 내부 관리 상수. 사용자 가이드 대상 trigger 없음 |
| `plan/complete/trigger-review-deferred-fixes.md` | plan 파일에 `spec_impact` frontmatter 추가 — doc-sync 대상 없음 |
| `spec/5-system/12-webhook.md` | `spec-major-change` trigger 해당(glob `spec/5-*/**`). 동반 갱신 요건(frontmatter code:/status:/pending_plans: 정합)은 spec-impl-evidence 범주로 별도 점검 대상이며 user-guide MDX 동반 갱신 요건은 아님 |
| `spec/data-flow/{0-overview,10-triggers,12-workspace}.md` | `spec/data-flow/` 는 `spec-major-change` glob(`spec/2-*/**` 등) 밖. 매트릭스 trigger 없음 |

---

## 요약

doc-sync 매트릭스 총 18개 row 중 이번 변경 set 에 매칭되는 trigger 는 `backend-api-change` 1개. 해당 row 의 동반 갱신 요건(`02-nodes/triggers.mdx` + `.en.mdx` 의 API 예시 업데이트) 이 누락됐다. `endpointPath` 가 `@IsUUID('4')` 로 강제되면서 유저 가이드 예시값 `"uuid-or-slug"` 가 stale 됐으나, `spec/5-system/12-webhook.md` 는 같은 changeset 에서 이미 동기됐다. 다른 변경 파일(테스트 리팩터링, background job 신설, plan 파일)은 doc-sync 매트릭스의 어떤 trigger 에도 매칭되지 않아 누락 없음.

## 위험도

WARNING

STATUS=success ISSUES=1
