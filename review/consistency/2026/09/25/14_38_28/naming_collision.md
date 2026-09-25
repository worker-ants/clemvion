# 신규 식별자 충돌 검토 — spec-draft-workspace-path-guard

## 검토 방법

target draft(`plan/in-progress/spec-draft-workspace-path-guard.md`)가 도입·재사용하는 식별자를 실제 저장소(`spec/`, `codebase/`)에 `git grep` 전수 대조했다. 새로 도입되는 식별자는 `@WorkspaceParam(...)` 데코레이터와 `EDITOR_REQUIRED` 에러 코드 두 개다. 나머지(`NOT_A_MEMBER` · `OWNER_REQUIRED` · `ADMIN_REQUIRED`)는 이미 코드/spec 에 존재하는 식별자를 재사용·공식화하는 것이라 "신규 식별자" 축이 아니라 "기존 정의와의 정합" 축으로 확인했다.

## 발견사항

### 새 식별자 — 충돌 없음 (확인됨)

- **[INFO]** `@WorkspaceParam('<name>')` 데코레이터 — 신규, 충돌 없음
  - target 신규 식별자: `@WorkspaceParam('<name>')` (C-1(c), D-1)
  - 기존 사용처: 없음 — `grep -rn "WorkspaceParam" .` 전체 저장소에서 target 문서 자신 외 매치 0건
  - 상세: 기존 `@WorkspaceId()`(`codebase/backend/src/common/decorators/workspace.decorator.ts:46`)와 이름·목적이 분명히 구분된다(헤더/토큰 컨텍스트 vs 경로 파라미터). 명명 패턴(`Workspace` + 역할어)도 기존 컨벤션과 일치해 혼동 소지가 없다.
  - 제안: 없음(현행 유지).

- **[INFO]** `EDITOR_REQUIRED` 에러 코드 — 신규, 충돌 없음
  - target 신규 식별자: `EDITOR_REQUIRED` (C-1(e), C-2)
  - 기존 사용처: 없음 — `grep -rn "EDITOR_REQUIRED"` backend·frontend·spec 전체에서 매치 0건(문자열 "EDITOR" 자체도 workflow-editor/text-editor류 오탐 제외 시 이 코드와 무관한 용례뿐)
  - 상세: 기존 `ADMIN_REQUIRED`/`OWNER_REQUIRED` 와 같은 `<ROLE>_REQUIRED` 명명 패턴이고, `ROLE_HIERARCHY`(`roles.guard.ts:26-30`, `viewer/editor/admin/owner`)의 `editor` role 과 정확히 대응한다. 근접 명명 충돌 없음.
  - 제안: 없음(현행 유지).

### 재사용 식별자 — 기존 정의와 정합 (충돌 아님, 확인용 기록)

- **[INFO]** `OWNER_REQUIRED` — spec 미등재였을 뿐 코드 의미는 기존과 동일
  - target 신규 식별자 아님: 이미 `codebase/backend/src/modules/workspaces/workspaces.service.ts:621,751` · `workspaces.controller.spec.ts:197` · `workspace-rbac.e2e-spec.ts:197-221` · frontend `workspace/settings/page.tsx:1010` 에서 "Owner 역할 필요" 의미로 사용 중
  - 기존 사용처: 위 코드 경로들 (spec 카탈로그 `3-error-handling.md §1.2` 에는 기존에 행이 없었음 — target 이 지적한 그대로 확인됨)
  - 상세: target 의 C-2 는 이 기존 코드를 spec 표에 **처음 등재**하는 것이고 의미 변경이 없다. 충돌 없음.
  - 제안: 없음.

- **[INFO]** `NOT_A_MEMBER` — 기존 정의(§1.2, `1-auth.md`, `12-workspace.md`)와 의미 일치, 적용 범위만 확장
  - 기존 사용처: `spec/5-system/3-error-handling.md:49` (「대상 워크스페이스 멤버십 검증 실패 — 전환/탈퇴/멤버십 확인 경로」), `spec/data-flow/12-workspace.md:113,123`, `auth.service.ts:1135`, `workspaces.service.ts:674,915` 등
  - 상세: target C-1(e) 는 이 코드의 발행 범위를 "가드의 모든 멤버십 거부(헤더 위조·경로 워크스페이스·부재 워크스페이스)"로 넓히지만 **의미(비멤버 판정)는 그대로**다 — 다른 의미로의 전용이 아니라 커버리지 확대이므로 충돌이 아니다.
  - 제안: 없음. 단, C-2 에서 `NOT_A_MEMBER` 행 설명에 "구분하지 않는다" 문구를 추가하는 것은 정확하니 그대로 반영 권장.

### 관찰 — 향후 구현 단계에서 주의할 인접 항목 (스펙 단계 충돌 아님)

- **[INFO]** 미명명 "저장소 가드"(D-4)가 기존 `param-uuid-pipe-guard.ts` 와 스코프가 인접
  - target 신규 식별자: D-4 "컨트롤러 핸들러가 워크스페이스 ID 를 `@Param` 으로 바인딩하지 않는다" — 구현 PR 이 만들 새 정적 가드는 이름이 아직 없음
  - 기존 사용처: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` — 이미 "id-형 `@Param`" 을 스캔해 `ParseUUIDPipe`/`@ApiParam format:'uuid'` 두 축을 검사하는 가드가 존재. `@WorkspaceParam` 전환 후에는 워크스페이스 `:id` 가 이 가드의 스캔 모집단에서 빠져야 정합이 맞는다.
  - 상세: 이름 충돌은 아니지만, 후속 developer PR 이 새 가드 파일명을 지을 때 `param-uuid-pipe-guard` 와 시각적으로 유사한 이름(`param-*-guard.ts`)을 쓰면 두 가드의 책임 경계가 코드 리뷰에서 헷갈릴 수 있다. spec draft 자체의 결함은 아니다.
  - 제안: 구현 PR 에서 새 가드에 `workspace-param-binding-guard.ts` 류의 구분되는 이름을 쓰고, `param-uuid-pipe-guard` 의 스캔 모집단에서 `@WorkspaceParam` 전환 라우트를 제외하는 처리를 함께 기록할 것을 권고(정보성, 이 draft 의 spec 변경 범위 밖).

## 확인된 무충돌 항목 (참고)

- **요구사항 ID**: target 이 새로 부여하는 요구사항 ID 없음 (`RR-PL-06` 은 기존 ID 를 참조만 함, 재정의 아님).
- **API endpoint**: 새 endpoint 없음 — 기존 15개 라우트의 가드 계층만 바뀐다.
- **이벤트/메시지명**: 해당 없음(webhook·queue·SSE 이벤트 신설 없음).
- **환경변수·설정키**: 신설 없음.
- **파일 경로**: `spec_impact` 9개 파일 모두 기존 파일 — 신규 spec 파일 경로 없음. 12-workspace.md 안에 새로 추가하는 Rationale 제목 2개(«경로 파라미터 워크스페이스도 가드가 본다», «가드 거부의 오류 코드»)는 해당 파일 내 기존 heading 목록과 대조해 중복 없음을 확인했다.

## 요약

target draft 가 실제로 새로 만드는 식별자는 `@WorkspaceParam(...)` 데코레이터와 `EDITOR_REQUIRED` 에러 코드 두 개뿐이며, 저장소 전수 grep 결과 둘 다 기존 사용처와 충돌하지 않고 기존 명명 컨벤션(`@WorkspaceId()`, `<ROLE>_REQUIRED` 패턴)과 정합한다. `OWNER_REQUIRED`·`NOT_A_MEMBER`·`ADMIN_REQUIRED`는 이미 코드/spec 에 존재하는 식별자를 그대로 재사용(또는 최초 spec 등재)하는 것으로, target 이 인용한 기존 라인(§1.2 표, `1-auth.md §1.5.4`, `error-codes.md` 등)을 직접 대조한 결과 전부 사실과 일치했다 — 다른 의미로 전용되는 자리는 없었다. 신규 API endpoint·요구사항 ID·이벤트명·환경변수·spec 파일 경로 신설도 없다. 유일한 잔여 관찰은 구현 단계(D-4)에서 이름이 아직 정해지지 않은 새 정적 가드가 기존 `param-uuid-pipe-guard.ts` 와 스코프상 인접한다는 점인데, 이는 spec draft 의 결함이 아니라 후속 developer PR 을 위한 참고 사항이다.

## 위험도
NONE
