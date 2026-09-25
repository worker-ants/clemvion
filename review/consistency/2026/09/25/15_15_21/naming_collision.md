# 신규 식별자 충돌 검토 — 경로 파라미터 워크스페이스 가드 (impl-prep)

대상: `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md`, `spec/data-flow/12-workspace.md`
(커밋 `e2e257707` — `plan/in-progress/workspace-path-guard-impl.md` 구현 착수 전 검토)

## 조사한 신규 식별자와 결과

이 변경이 실제로 새로 도입하는 식별자는 좁다 — 새 엔티티·DTO·API endpoint·이벤트·ENV
var 는 없다(전부 기존 라우트에 데코레이터·에러 코드를 얹는 변경). 확인한 항목:

| 식별자 | 종류 | 충돌 여부 |
|---|---|---|
| `@WorkspaceParam('<name>')` | 신규 파라미터 데코레이터 | 코드베이스 전수 grep 결과 기존 정의 없음(`common/decorators/workspace.decorator.ts` 에 `WorkspaceId` 만 존재). spec 3파일 + `swagger.md` 전체가 동일 표기로만 사용 — 충돌 없음 |
| `EDITOR_REQUIRED` | 신규 에러 코드 | 코드베이스 전수 grep 0건(진짜 신규, RolesGuard 는 현재 코드 없는 bare 403 만 반환). `ADMIN_REQUIRED`/`OWNER_REQUIRED` 와 같은 표(`3-error-handling.md §1.2`)에 나란히 등재돼 명명 패턴 일관 — 충돌 없음 |
| `NOT_A_MEMBER` / `ADMIN_REQUIRED` / `OWNER_REQUIRED` (가드 레벨로 확장) | 기존 서비스 레이어 코드의 가드 레이어 재사용 | `workspaces.service.ts`(621·674·751·915·923)·`auth.service.ts`(1135)·frontend(`workspace-store.ts`·`settings/page.tsx`)에 이미 동일 의미로 존재. 신규 발행처(RolesGuard)가 **같은 의미**로 같은 문자열을 재사용하는 것이며 spec 스스로 이 재사용을 §"가드 거부의 오류 코드" Rationale 에서 명시(서비스 발행분을 대체) — 다른 의미의 충돌 아님 |
| 저장소 가드 `workspace-param-binding` (plan §4, `codebase/backend/src/repo-guards/__tests__/`) | 신규 CI 정적 가드 파일명 | 아래 발견사항 참조 |

## 발견사항

- **[WARNING]** 신규 repo-guard 이름이 같은 디렉터리의 기존 가드와 근접 명명
  - target 신규 식별자: `workspace-param-binding` (plan `workspace-path-guard-impl.md` §구현요구 4, `plan/complete/spec-draft-workspace-path-guard.md:271` — 파일명은 관례상 `workspace-param-binding-guard.ts` + `workspace-param-binding.spec.ts`가 될 것으로 보임, `param-uuid-pipe-guard.ts`/`param-uuid-pipe.spec.ts` 패턴과 동형)
  - 기존 사용처: `codebase/backend/src/repo-guards/__tests__/workspace-roles-attachment.spec.ts` (이미 존재하는 회귀 가드 — `RolesGuard`가 `APP_GUARD`로 등록돼 있는지 + 특정 8개 핸들러에 `@Roles()` 메타데이터가 실제로 붙어 있는지를 reflection으로 고정)
  - 상세: 두 가드 모두 `repo-guards/__tests__/` 같은 디렉터리에 있고, 둘 다 "workspace" + "RolesGuard 관련 메타데이터 reflection" 이라는 같은 의미 공간을 다룬다. `workspace-param-binding`은 "`@Param(...)`으로 워크스페이스 ID를 받는 이름 패턴(`workspaceId`/`*WorkspaceId`)을 금지"하는 것이고, `workspace-roles-attachment`는 "특정 핸들러에 `@Roles()` 메타데이터가 실제로 붙어 있는지"를 검사하는 것 — 목적은 다르지만 이름만으로는 구분이 어렵다. 실제로 `plan/complete/spec-draft-workspace-path-guard.md:271`은 "이름은 기존 `param-uuid-pipe-guard`와 구분되게" 라고 근접 명명을 이미 한 차례 의식했으나, 같은 디렉터리에서 이름이 더 가까운 `workspace-roles-attachment`는 그 비교 대상에서 빠졌다.
  - 제안: 신규 파일 상단 docstring(다른 repo-guard들의 관례)에 "`workspace-roles-attachment.spec.ts`와는 별개 — 이쪽은 경로 파라미터 바인딩 이름 패턴을, 그쪽은 특정 핸들러의 `@Roles()` 부착 여부를 검사한다" 식으로 경계를 명시하거나, 더 구분되는 이름(예: `workspace-path-param-name-guard`)을 검토. CRITICAL은 아님 — 두 가드가 같은 대상을 다른 의미로 판정하는 것은 아니고 실제 충돌(다른 의미의 동일 식별자)은 없음.

- **[INFO]** 가드 레벨 에러 코드 재사용은 의도된 통합이지 충돌이 아님을 재확인
  - target 신규 식별자: `RolesGuard`가 새로 던지는 `NOT_A_MEMBER`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`/`EDITOR_REQUIRED`
  - 기존 사용처: `codebase/backend/src/modules/workspaces/workspaces.service.ts:621,674,751,915,923`, `codebase/backend/src/modules/auth/auth.service.ts:1135`
  - 상세: 표면적으로는 "기존에 다른 곳에서 이미 쓰이는 코드"이지만, `spec/data-flow/12-workspace.md` §"가드 거부의 오류 코드" Rationale이 이 재사용을 정확히 의도(서비스 발행분을 가드가 대체·통합)로 설명하고 있고, 의미도 100% 동일(같은 403 거부 사유)하다. 다만 구현 시 두 발행처(가드/서비스)가 **동시에** 살아남는 경로(예: `leaveWorkspace`·`addMemberByEmail`의 "두 번째 선")가 있으므로, 구현자는 두 레이어가 같은 조건에서 같은 코드를 내는지 e2e로 고정해야 한다(plan §구현요구 7에 이미 명시돼 있음 — 별도 조치 불요, 확인만).
  - 제안: 없음(이미 plan에 반영됨) — 기록 목적.

## 요약

이번 변경은 새 엔티티·DTO·API endpoint·이벤트·ENV var를 도입하지 않고, 기존 라우트에 신규 파라미터 데코레이터(`@WorkspaceParam`)와 신규 에러 코드(`EDITOR_REQUIRED`) 하나, 그리고 기존 서비스 레이어 에러 코드(`NOT_A_MEMBER`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)를 가드 레이어로 의도적으로 재사용·통합하는 구조다. 코드베이스 전수 검색으로 확인한 결과 이 신규 식별자들은 기존에 다른 의미로 쓰이는 곳이 없어 실질적 명명 충돌(CRITICAL)은 발견되지 않았다. 유일한 주목할 점은 plan이 신설을 예고한 repo-guard 파일명 `workspace-param-binding`이 같은 디렉터리의 기존 가드 `workspace-roles-attachment.spec.ts`와 이름이 근접해 향후 유지보수자가 혼동할 여지가 있다는 것(WARNING) — plan 자신이 `param-uuid-pipe-guard`와의 구분은 이미 언급했으나 이 쌍은 놓쳤다.

## 위험도

LOW
