# 신규 식별자 충돌 검토 — target: backend README 캐너리 절 정정 · `transferOwnership` 재검사 분기 테스트

대상: `codebase/backend/README.md` (문서 정정), `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (신규 테스트 케이스 추가). `spec/` 영역 델타는 0개 파일(코드/문서 전용 PR, 정상).

## 점검 관점별 확인

1. **요구사항 ID 충돌** — 신규 요구사항 ID 없음. `plan/in-progress/canary-readme-recheck-test.md`(`spec_impact: none`)로 동작 변경 없는 문서·테스트 보강임을 명시.
2. **엔티티/타입명 충돌** — README diff 가 언급하는 `@WorkspaceParam(...)` 데코레이터와 `workspaceParamNamesOf` 헬퍼는 **이번 diff 가 새로 도입하는 식별자가 아니다**. 두 식별자는 커밋 `5ba95e4b8`/`bcc0402bb`(둘 다 `origin/main` 에 이미 포함)에서 도입됐고, 직전 라운드(`review/consistency/2026/09/25/20_01_21/naming_collision.md`)에서 이미 충돌 없음(NONE)으로 검토·확정됐다. 이번 target 은 그 기존 식별자를 README 산문에서 `@WorkspaceId()` 와 나란히 설명하도록 서술을 넓힌 것뿐이며, `codebase/backend/src/common/decorators/workspace.decorator.ts` 자체는 이번 diff 대상이 아니다(수정 없음). 재발(re-flag) 대상 아님.
3. **API endpoint 충돌** — 신규 endpoint 없음. diff 는 README 산문·테스트 파일만 건드리고 컨트롤러/라우트 변경이 없다.
4. **이벤트/메시지명 충돌** — webhook·queue·sse 이벤트 신설 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/설정 키 없음.
6. **파일 경로 충돌** — 신규 spec/코드 파일 없음. 기존 `workspaces.service.spec.ts` 에 `it.each` 블록을 추가한 것뿐이며 새 파일 경로가 생기지 않았다.

### 신규 테스트가 참조하는 식별자 재확인

추가된 테스트(`'인가 선행은 owner 였지만 락 재검사에서 %s OWNER_REQUIRED — 멤버를 바꾸지 않는다'`)가 단언하는 에러 코드 `OWNER_REQUIRED` 는 `codebase/backend/src/modules/workspaces/workspaces.service.ts:621`·`workspaces.controller.spec.ts:197` 등 기존 코드베이스 전역에서 이미 동일 의미(owner 이양 권한 필요)로 광범위하게 쓰이는 상수다 — grep 으로 사전 존재 확인. 새 의미를 부여하거나 다른 코드와 충돌하지 않는다. 테스트가 쓰는 로컬 변수명(`lockedRole`, `requesterReads`)도 해당 스펙 파일 스코프 내 신규 로컬 식별자로, 파일 전체 grep 상 중복 없음.

## 발견사항

없음 — 이번 target 은 순수 문서 정정(기존에 이미 존재하는 `@WorkspaceParam`/`workspaceParamNamesOf` 를 README 산문에 반영) + 기존 동작(트랜잭션 재검사 분기)에 대한 신규 유닛 테스트 추가로, 새로 도입되는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로가 전혀 없다.

## 요약

이번 diff(README.md 11줄, workspaces.service.spec.ts 54줄)는 신규 식별자를 하나도 도입하지 않는다. README 가 언급하는 `@WorkspaceParam(...)`/`workspaceParamNamesOf` 는 이미 `origin/main` 에 병합되어 있고 직전 naming_collision 라운드에서 NONE 으로 확정된 식별자이며, 이번 변경은 그 서술을 문서에 반영한 것뿐이다. 신규 테스트가 참조하는 `OWNER_REQUIRED` 코드 역시 코드베이스 전역에서 기존 의미로 이미 널리 쓰이는 상수다. 신규 식별자 충돌 관점에서 문제 없음.

## 위험도

NONE
