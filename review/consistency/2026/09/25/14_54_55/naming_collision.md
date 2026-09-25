# 신규 식별자 충돌 검토 — spec-draft-workspace-path-guard (14_54_55)

## 검토 방법

target draft(`plan/in-progress/spec-draft-workspace-path-guard.md`)가 새로 도입·재사용하는 식별자를 저장소 전수(`spec/`, `codebase/`, `plan/`)에 `git grep` 대조했다. 본 세션은 직전 라운드(`14_38_28`)의 naming_collision 검토를 이어받는 재검토다 — target 이 그 라운드의 지적을 자체 반영했는지까지 함께 확인했다.

새로 도입되는 식별자는 이전 라운드와 동일하게 둘뿐이다: `@WorkspaceParam(...)` 데코레이터, `EDITOR_REQUIRED` 에러 코드. `NOT_A_MEMBER` · `ADMIN_REQUIRED` · `OWNER_REQUIRED` 는 이미 코드/spec 에 존재하는 식별자의 재사용·최초 spec 등재이므로 "신규 식별자" 축이 아니라 "기존 정의와의 정합" 축으로 별도 확인했다.

## 발견사항

### 새 식별자 — 충돌 없음

- **[INFO]** `@WorkspaceParam('<name>')` 데코레이터 — 신규, 충돌 없음
  - target 신규 식별자: `@WorkspaceParam('<name>')` (C-1(c), D-1)
  - 기존 사용처: 없음 — `grep -rn "WorkspaceParam" .` 저장소 전체에서 target 문서(및 그 문서를 인용하는 이번 리뷰 산출물) 외 매치 0건
  - 상세: 기존 `@WorkspaceId()`(`codebase/backend/src/common/decorators/workspace.decorator.ts`)와 이름·목적이 분명히 구분된다(헤더/토큰 컨텍스트 vs 경로 파라미터). `Workspace` + 역할어 명명 패턴도 기존 컨벤션과 일치한다.
  - 제안: 없음(현행 유지).

- **[INFO]** `EDITOR_REQUIRED` 에러 코드 — 신규, 충돌 없음
  - target 신규 식별자: `EDITOR_REQUIRED` (C-1(e), C-2, C-8)
  - 기존 사용처: 없음 — `grep -rn "EDITOR_REQUIRED"` backend·frontend·spec 전체에서 매치 0건. `codebase/backend/src` 안의 다른 "EDITOR" 문자열도 전부 `workflow-editor` 계열이라 이 코드와 무관 — 근접 명명 오탐도 없음을 직접 확인.
  - 상세: 기존 `ADMIN_REQUIRED`/`OWNER_REQUIRED` 와 같은 `<ROLE>_REQUIRED` 패턴이고, `roles.guard.ts` 의 `ROLE_HIERARCHY`(`viewer/editor/admin/owner`)의 `editor` 역할과 정확히 대응한다.
  - 제안: 없음(현행 유지).

### 재사용 식별자 — 기존 정의와 정합 (충돌 아님)

- **[INFO]** `OWNER_REQUIRED` / `ADMIN_REQUIRED` / `NOT_A_MEMBER` — spec 미등재였거나 적용 범위만 넓어질 뿐 코드 의미는 기존과 동일
  - 기존 사용처: `workspaces.service.ts` · `auth.service.ts` · `3-error-handling.md §1.2` · `12-workspace.md` · `1-auth.md §5` 등에서 동일한 「멤버십/역할 판정」 의미로 이미 사용 중.
  - 상세: target 은 이 코드들을 (a) 가드 계층까지 발행 주체를 넓히거나 (b) spec 표에 처음 등재하는 것이고, 의미 변경·전용은 없다. `RERUN_PERMISSION_DENIED`(`13-replay-rerun.md`)도 그대로 유지되며 새 코드들과 레이어만 나뉜다(C-8) — 다른 의미로 재사용되는 자리는 없다.
  - 제안: 없음.

### 직전 라운드(`14_38_28`) 지적 사항 — target 이 자체 반영 완료 (재확인)

- **[INFO → 해소 확인]** 구현 단계 신규 정적 가드 이름이 `param-uuid-pipe-guard.ts` 와 시각적으로 인접할 위험
  - 직전 라운드는 D-4 "저장소 가드"의 이름이 미정이라 `param-uuid-pipe-guard.ts` 와 이름이 유사해질 경우 책임 경계가 헷갈릴 수 있다고 INFO 로 지적했다.
  - 이번 target(D-4)은 이를 반영해 **예시 이름을 `workspace-param-binding`으로 명시**하고, "기존 `param-uuid-pipe-guard` 와 구분되게" 라고 직접 명문화했다. 또한 그 가드의 스캔 모집단에서 `@WorkspaceParam` 으로 옮긴 파라미터가 빠지는 것을 기록한다는 조항도 추가했다(INFO 6 대응).
  - 현재 저장소에 `workspace-param-binding` 이름을 가진 파일은 없다(`grep -rn "workspace-param-binding"` 결과는 target 문서와 이전 리뷰 산출물뿐) — 신규 도입 시 충돌 없음.
  - 제안: 없음. 구현 PR 착수 시 실제 파일명이 `workspace-param-binding-guard.ts` 류로 고정되는지만 확인.

## 확인된 무충돌 항목 (참고)

- **요구사항 ID**: target 이 새로 부여하는 요구사항 ID 없음(`RR-PL-06` 등은 기존 ID 참조뿐).
- **API endpoint**: 새 endpoint 없음 — 기존 15개 라우트의 가드 계층만 바뀐다.
- **이벤트/메시지명**: 해당 없음(webhook·queue·SSE 이벤트 신설 없음).
- **환경변수·설정키**: 신설 없음.
- **파일 경로**: `spec_impact` 9개 파일 모두 기존 파일이며 신규 spec 파일 경로 없음. `12-workspace.md` 신설 Rationale 제목 2개(«경로 파라미터 워크스페이스도 가드가 본다», «가드 거부의 오류 코드»)는 해당 문서의 기존 heading 목록과 대조해 중복 없음을 재확인했다.

## 요약

target draft 가 실제로 새로 만드는 식별자는 `@WorkspaceParam(...)` 데코레이터와 `EDITOR_REQUIRED` 에러 코드 두 개뿐이며, 저장소 전수 grep 결과 둘 다 기존 사용처·근접 명명과 충돌하지 않고 기존 컨벤션(`@WorkspaceId()`, `<ROLE>_REQUIRED`)과 정합한다. `NOT_A_MEMBER`·`ADMIN_REQUIRED`·`OWNER_REQUIRED`는 기존 코드의 재사용·최초 spec 등재일 뿐 의미 전용이 아니며, `RERUN_PERMISSION_DENIED` 등 인접 기존 코드와도 레이어만 나뉠 뿐 겹치지 않는다. 신규 API endpoint·요구사항 ID·이벤트명·환경변수·spec 파일 경로 신설도 없다. 직전 라운드(`14_38_28`)가 남긴 유일한 관찰(구현 단계 신규 정적 가드 이름의 인접 위험)은 이번 target 이 `workspace-param-binding` 이라는 구분되는 이름을 명문화해 자체 반영했다 — 잔여 이슈 없음.

## 위험도
NONE
