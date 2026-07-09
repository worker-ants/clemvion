# 신규 식별자 충돌 검토 — naming_collision

## 점검 대상 요약

이번 target 은 `spec/2-navigation/` 스코프로 배정되었으나, 실제 diff(`plan/in-progress/slug-routing-hardening.md` 명시대로 "순수 FE 리팩터, spec/API/데이터모델 무변경")는 **spec 파일 변경 없이 코드만** 변경되었다 (`git diff origin/main --stat` 확인, `spec/**` 0건). 따라서 본 검토는 이 하드닝 PR 이 새로 도입한 코드 식별자(함수명·파일 경로·타입)가 기존 spec 문서(`spec/2-navigation/*`, `spec/0-overview.md`, `spec/1-data-model.md`) 및 기존 코드베이스 사용처와 충돌하지 않는지를 확인했다.

신규 도입 식별자 목록 (HEAD 워킹트리 `git diff origin/main` 기준):

| 식별자 | 종류 | 위치 |
|---|---|---|
| `buildExecutionHref(slug, workflowId, executionId?)` | 함수 | `codebase/frontend/src/lib/workspace/href.ts` (신규 export, 기존 `buildWorkspaceHref` 옆) |
| `toSafeInternalPath(path)` | 함수 | `codebase/frontend/src/lib/workspace/safe-path.ts` (신규 파일) |
| `isSafeInternalPath(pathname)` | 함수 | `codebase/frontend/src/lib/workspace/safe-path.ts` (신규 파일) |
| `codebase/frontend/src/lib/workspace/types.ts` | 신규 파일 | `WorkspaceRole`/`WorkspaceSummary` 를 `workspace-store.ts` 에서 이동(re-export 로 하위호환 유지, 이름 자체는 신규 아님) |
| `no-raw-execution-href.test.ts`, `safe-path.test.ts` | 신규 테스트 파일 | `codebase/frontend/src/lib/workspace/__tests__/` |

## 발견사항

없음 — 위 신규 식별자 전부에 대해 다음을 교차 확인했으며 충돌을 발견하지 못했다.

- **요구사항 ID**: 이번 변경은 spec 문서를 전혀 수정하지 않아 신규 요구사항 ID 부여 자체가 없다.
- **엔티티/타입명**: `WorkspaceSummary`/`WorkspaceRole` 은 `workspace-store.ts` → `lib/workspace/types.ts` 로 **이동**(신규 명명 아님). `git grep -n "WorkspaceSummary\|WorkspaceRole" spec/` 및 backend 전역 결과 0건 — spec 문서나 backend 에 동명의 다른 의미 엔티티 없음.
- **API endpoint**: 신규 endpoint 없음 (diff 에 `@Get/@Post/@Put/@Patch/@Delete` 등 컨트롤러 변경 0건).
- **이벤트/메시지명**: 신규 webhook/queue/SSE 이벤트 없음 (diff 에 `emit(`/`eventName`/`queue.` 패턴 0건).
- **환경변수·설정키**: 신규 ENV/config key 없음 (diff 에 `process.env`/`ENV_` 패턴 0건).
- **파일 경로**:
  - `lib/workspace/types.ts` — 동일 디렉토리 관례(`lib/node-definitions/types.ts`, `lib/i18n/types.ts`, `lib/notifications/types.ts` 등 다수 `lib/<domain>/types.ts` 선례)와 일치, 기존 파일과 경로 충돌 없음.
  - `lib/workspace/safe-path.ts` — `find codebase/frontend/src -iname "*safe-path*"` 결과 이번에 신설된 본 파일과 그 테스트 파일 외 없음. 신규 경로, 충돌 없음.
  - `__tests__/no-raw-execution-href.test.ts` — 동명·유사 가드 테스트 없음.
- **근접 명명(참고, 충돌 아님)**: `codebase/frontend/src/lib/api/executions.ts` 에 기존부터 존재하는 `executionPath: string[]` 필드(재귀/서브워크플로우 체인 경로 — URL 과 무관, 이번 diff 로 변경되지 않음)와 신규 `buildExecutionHref` 함수명이 표면적으로 "Execution" + "Path/Href" 로 유사해 보이나, 하나는 DTO 필드·하나는 URL 빌더 함수로 네임스페이스·용법이 명확히 분리되어 실질적 혼동 가능성은 낮다고 판단해 별도 등급 없이 기록만 남긴다.
- `isSafeRedirectPath` (`codebase/frontend/src/components/ui/error-page.tsx`, 기존 함수명 유지)는 내부 구현만 신규 `isSafeInternalPath` 로 위임하도록 리팩터되었을 뿐 식별자 자체는 변경되지 않았다 — 충돌 대상 아님.

## 요약

이번 target(`slug-routing-hardening`)은 spec 변경이 없는 순수 FE 코드 하드닝이며, 새로 도입된 식별자(`buildExecutionHref`, `toSafeInternalPath`, `isSafeInternalPath`, `lib/workspace/types.ts`, `lib/workspace/safe-path.ts`, 신규 테스트 파일 2건)는 모두 스코프가 좁고(`lib/workspace/` 디렉토리 내부) 기존 spec 문서·backend·frontend 어느 사용처와도 이름이 겹치거나 의미가 상충하지 않는다. `WorkspaceSummary`/`WorkspaceRole` 타입은 파일만 이동했을 뿐 이름은 그대로이며 하위호환 re-export 로 소비처 16곳도 영향 없음을 확인했다. 신규 식별자 충돌 관점에서 차단 사유는 없다.

## 위험도
NONE
