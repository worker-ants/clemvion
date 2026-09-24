# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `1-auth.md`§3.2 정정 노트가 `removeMember()`의 구현 경로를 더 이상 정확히 서술하지 않는다
  - 위치: `spec/5-system/1-auth.md:551` (본 PR의 변경 대상 파일은 아니며, `Read`로 직접 확인한 실제 줄 번호)
  - 상세: 이 줄은 "`WorkspacesService.removeMember()` 는 `assertAdmin(workspaceId, requesterId)` 만 요구한다."고 적고 있다. 그러나 이번 PR(`codebase/backend/src/modules/workspaces/workspaces.service.ts`)에서 `removeMember`는 더 이상 `assertAdmin()`을 호출하지 않는다 — 자가 탈퇴 갈래를 살리기 위해 `getMemberRole()`을 직접 한 번만 호출하고 `ADMIN_ROLES.has(requesterRole)`을 인라인으로 검사하도록 리팩터됐다(`throwAdminRequired()`로 에러 페이로드만 `assertAdmin`과 공유). 이 서술은 2026-07-28에 "Admin 이 멤버 삭제(D)를 할 수 있다"는 결론의 근거로 쓰였고 **그 결론 자체는 여전히 참**이지만, 근거로 인용된 구체적 호출 경로는 이번 순서 변경으로 사실과 달라졌다. 같은 세션의 plan(`plan/in-progress/member-auth-order.md`)이 `1-auth.md:377`(§3.2 각주)의 정합성은 명시적으로 확인했으나, 이 §3.2 정정 노트(:551)는 그 점검 대상에 포함되지 않았고, `--impl-prep`(`review/consistency/2026/09/24/10_22_24`) 산출물에도 이 줄에 대한 언급이 없다 — 즉 이번 변경으로 새로 생긴, 아직 아무도 잡지 않은 spec 진부화다.
  - 제안: `developer`가 직접 고치는 것은 CLAUDE.md의 자기-반증형 소정정 예외 대상이 아니다(그 문장을 developer가 쓴 것도 아니고, "제품 정의·요구사항·API 계약"에 해당해 조건 2가 배제한다). `plan/in-progress/member-auth-order.md`(또는 이미 별도로 파낸 `spec-draft-nullable-notation-followups.md`의 NOT_A_MEMBER 카탈로그 항목 옆)에 planner 후속 항목으로 등재해, "assertAdmin(...) 만 요구한다"를 현재 구현(멤버십 확인 + 인라인 admin 판정, 두 단계)에 맞게 정정하도록 넘긴다.

- **[INFO]** 비-admin 멤버가 owner 를 지목했을 때의 wire 에러 코드가 `CANNOT_REMOVE_OWNER` → `ADMIN_REQUIRED` 로 바뀐다(의도된 breaking change, 영향 범위는 낮음)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember()` (admin 판정을 owner 판정보다 앞으로 옮긴 자리, 프롬프트 diff 기준 게이트 843~850행)
  - 상세: 이 변경은 두 갈래 클라이언트 모두에게 관측 가능한 응답 변화다. (1) 해당 워크스페이스와 무관한 호출자는 대상의 존재/역할과 무관하게 항상 `403 NOT_A_MEMBER`를 받는다(종전엔 `404`/`403 CANNOT_REMOVE_OWNER`/`403 ADMIN_REQUIRED` 세 갈래로 갈렸다) — 이건 정보 노출(존재·owner 오라클)을 닫는 보안 수정이라 명백히 개선이다. (2) 그러나 **정당한 워크스페이스 멤버**(editor 등 비-admin)가 owner 멤버를 대상으로 제거를 시도하는 경우에도, 종전 `403 CANNOT_REMOVE_OWNER` 대신 `403 ADMIN_REQUIRED`를 받도록 바뀐다 — 이는 크로스테넌트 오라클 차단과는 별개로, 이미 인가 경계 안에 있는 클라이언트가 보는 wire 에러 코드 자체가 바뀌는 것이라 순수 보안 수정을 넘어서는 API 계약 변경이다. HTTP 상태 코드는 403으로 동일하고, `frontend/src/app/(main)/w/[slug]/workspace/settings/page.tsx`의 멤버 제거 UI는 이 버튼 자체가 `RoleGate minRole="admin"`으로 가려져 있고 에러 코드가 아닌 `err.message` 텍스트만 토스트로 노출하므로 사내 프런트엔드에는 영향이 없음을 확인했다. 다만 이 엔드포인트를 직접 호출하는 외부/서드파티 연동이 `CANNOT_REMOVE_OWNER` 코드로 분기하고 있었다면 깨진다.
  - 제안: 커밋 메시지·PR 설명에 이미 근거(false-implication 방지: "대상이 owner 만 아니면 가능하다"는 오해 차단)가 잘 적혀 있으므로 추가 코드 수정은 불필요. `spec/5-system/3-error-handling.md`의 `NOT_A_MEMBER` 항목 설명("전환·탈퇴·멤버십 확인 경로")에 `removeMember` 의 비-멤버 차단이 세 번째 발행처로 빠져 있다는 점은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 후속 항목으로 등재돼 있으니 별도 조치 불필요.

## 요약

이번 변경은 `WorkspacesService.removeMember()`의 인가 판정 순서를 대상 조회보다 앞으로 옮겨, `@Roles()`가 없고 `handlerConsumesWorkspaceId`가 false 라 `RolesGuard`를 단축 통과하는 라우트에서 비-멤버가 `(workspaceId, memberId)` 조합에 대해 `404`/`403 CANNOT_REMOVE_OWNER`/`403 ADMIN_REQUIRED` 세 갈래로 구분되는 응답을 받던 존재·owner 오라클을 닫는다. 에러 응답의 포맷(`{code, message}` → `ForbiddenException`)과 HTTP 상태(403)는 기존 컨벤션과 일관되고, `throwNotAMember()`/`throwAdminRequired()` 헬퍼 추출로 오히려 메시지 드리프트 위험이 줄었다. 요청 검증(`ParseUUIDPipe`)·URL 설계·페이지네이션은 이번 diff의 영향 범위 밖이며 변경 없다. 비-admin 멤버가 owner 를 지목할 때의 wire 코드가 `CANNOT_REMOVE_OWNER`→`ADMIN_REQUIRED`로 바뀌는 것은 의도된 breaking change이나 실측상 사내 클라이언트 영향은 없다. 유일하게 새로 발견된 문제는 `spec/5-system/1-auth.md:551`의 "removeMember 는 assertAdmin(...)만 요구한다"는 서술이 이번 리팩터로 더 이상 구현과 일치하지 않게 된 것으로, planner 후속 항목 등재가 필요하다(결론 자체는 참이라 기능적 위험은 없음).

## 위험도

LOW
