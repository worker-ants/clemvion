# Rationale 연속성 검토

## 검토 범위

이번 diff(30 files / 3473 lines)의 실질은 `spec/data-flow/12-workspace.md` 신규 절
「경로 파라미터 워크스페이스도 가드가 본다 (2026-09-25)」·「가드 거부의 오류 코드 (2026-09-25)」와
그에 따른 `spec/5-system/1-auth.md`·`spec/2-navigation/6-config.md`·`spec/2-navigation/9-user-profile.md`·
`spec/5-system/2-api-convention.md`·`spec/5-system/3-error-handling.md`·`spec/5-system/13-replay-rerun.md`·
`spec/conventions/error-codes.md`·`spec/conventions/swagger.md` 미러 갱신, 그리고 이를 구현한
`codebase/backend/src/common/decorators/workspace.decorator.ts`(`@WorkspaceParam`)·
`codebase/backend/src/common/guards/roles.guard.ts`·`codebase/backend/src/repo-guards/__tests__/workspace-param-binding-guard.ts`·
`workspaces.service.ts`(`leaveWorkspace`/`addMemberByEmail`/`transferOwnership`/`removeMember`)다.

가장 먼저 확인해야 할 것은 이 변경이 정확히 과거 Rationale이 **명시적으로 기각한 패턴**("라우트별
opt-in 마커")과 겹치는 것처럼 보인다는 점이었다 — `1-auth.md` §Rationale "부트 캐너리" (b)는
`SetMetadata` + `Reflector` opt-in 마커를 "다음 라우트에서 같은 누락이 재발한다(이미 최소 2회
발생)"는 이유로 재기각한 바 있다. `@WorkspaceParam`은 표면적으로 "라우트마다 붙이는 새 데코레이터"이므로
같은 부류로 재도입된 것 아니냐는 것이 본 검토의 핵심 가설이었다.

## 발견사항

### 검토 결과: 신규 CRITICAL/WARNING 없음 — 이미 자체 소명되고 이전 라운드에서 정합화됨

- **target 위치**: `spec/data-flow/12-workspace.md` §"경로 파라미터 워크스페이스도 가드가 본다" 및
  `spec/5-system/1-auth.md` §"부트 캐너리" (b) 말미 "(2026-09-25 보탬)" 단락.
- **과거 결정 출처**: `spec/5-system/1-auth.md` §Rationale "부트 캐너리 — `@WorkspaceId()` reflection
  자가검증" (b) — "라우트별 opt-in 마커" 재기각.
- **상세**: target은 이 긴장을 은폐하지 않고 **직접 인용해 반박**한다 — "`@WorkspaceParam`은
  재기각된 «opt-in 마커»가 아니다"라는 절을 별도로 두고, 구분 근거를 (1) 마커는 값 바인딩과
  무관한 부가 메타데이터라 빠뜨려도 라우트가 정상 동작하는 반면 `@WorkspaceParam`은 핸들러가
  경로 워크스페이스 값을 받는 방법 그 자체다, (2) 그럼에도 "같은 값을 평범한 `@Param`으로 받는"
  회피 경로가 남는다는 것을 인정하고, 이를 새로운 AST 기반 CI 가드(`workspace-param-binding`,
  허용목록 없음·fail-closed)로 닫는다, (3) 이름 규칙(`workspaceId`/`*WorkspaceId`) 밖은 못 본다는
  한계까지 명시한다는 세 축으로 제시한다. 실제 코드(`workspace.decorator.ts`·
  `workspace-param-binding-guard.ts`·`roles.guard.ts`)를 대조한 결과 이 설명과 정확히 일치하게
  구현돼 있다.
  또한 이 긴장은 이번 라운드에서 처음 나온 것이 아니라 이미 `review/consistency/2026/09/25/15_15_21`
  라운드(rationale_continuity W2)가 지적했고, 그 지적이 `plan/complete/spec-draft-workspace-path-guard-followup.md`
  변경 2로 `1-auth.md` §부트 캐너리 (b)에 "(2026-09-25 보탬)" 각주로 이미 반영되어 있다 — 즉
  이 검토가 다시 발견한 문제는 이미 닫힌 루프다.
- **제안**: 조치 불요. 다만 후속 관찰로, 이 절 스스로 인정한 **잔여 비대칭**("헤더·토큰 모델에서
  `@WorkspaceId()` 대신 `req.user.workspaceId`를 직접 읽는 라우트 4곳은 정적 가드가 없다")은
  범위 밖으로 명시돼 있으나, 그 4곳 목록이 spec에 하드코딩돼 있지 않아 향후 늘어나도 checker가
  스냅샷 결정으로 오인하지 않게 하려면(§"부트 캐너리"가 이미 쓰는 "구체 수치는 spec에 박지 않는다"
  원칙과 동일선상) 굳이 지금 추가 조치할 필요는 없음 — INFO 수준의 관찰로만 남긴다.

### 결정 번복의 새 Rationale 작성 여부 — 준수

- `assertAdmin`이 종전 비멤버·역할미달을 구분 없이 `ADMIN_REQUIRED`로 던지던 것(origin/main 실측,
  `workspaces.service.ts` L936-942)을 이번 변경이 "비멤버는 요구 역할과 무관하게 `NOT_A_MEMBER`"로
  바꾸는 것은 실제 wire 코드 behavior change다. target은 이를 §"가드 거부의 오류 코드"에서
  (가)/(나) 두 대안을 실측과 함께 제시하고, 대가("Admin/Owner 요구 10곳에서 비멤버가 받는 코드가
  바뀐다")를 명시적으로 기록한 뒤 채택했다 — 무근거 번복이 아니라 근거를 갖춘 번복이다.
- "existence oracle" 수정 대상이 최초 2개 메서드(`leaveWorkspace`·`addMemberByEmail`)에서 3개
  (`transferOwnership` 추가)로 정정된 이력도 원문을 삭제하지 않고 취소선(`~~두~~`)으로 남기며
  실측 경위("계획 단계 표는 `@Roles('owner')`가 붙었다는 이유로 이 메서드를 가드 쪽으로
  분류했다")까지 적었다. `grep`으로 전수 확인한 결과 스테일한 "두 메서드" 언급이 spec 내
  다른 곳에 남아있지 않다.

### 암묵적 가정 충돌 — 없음

- "URL slug = FE 라우팅 SoT (≠ backend 인가 SoT)" 절의 불변식(header-first 우선순위, token-first
  회귀 기각)에 대해 이번 변경은 "경로 파라미터 워크스페이스 라우트는 이 모델의 예외"라고 명시적
  범위를 좁혀 덧붙였을 뿐 원 불변식을 재해석하거나 침해하지 않는다. `9-user-profile.md`·
  `2-api-convention.md`의 동일 모델 반복 서술도 같은 문구로 동기화됐다(각각의 followup 변경 1·5).
- "`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터 — UUID 검증 강도 비대칭" 절의 원 논리("`:id`는
  인가 판정의 입력이 아니라 리소스 지목")를 워크스페이스 `:id`에 한해 뒤집는 변경도, 원문을
  삭제하지 않고 인용구로 범위를 한정하는 정정 각주(`> **(2026-09-25 정정 — 워크스페이스 `:id`에
  한해)**`)로 처리했다 — `:memberId`·`:invitationId`에는 원 논리가 그대로 유효함을 명시.

## 요약

이번 diff의 핵심 신규 결정(`@WorkspaceParam` 경로 파라미터 가드, 가드 거부 코드 신설)은 과거
Rationale이 기각한 "라우트별 opt-in 마커" 패턴과 표면적으로 충돌하는 것처럼 보이지만, target은
그 긴장을 스스로 인용하고 세 갈래 근거(값 바인딩 자체 vs 부가 메타데이터·정적 CI 가드로 회피
경로 봉쇄·이름 규칙 한계 명시)로 반박하며, 그 반박은 실제 코드(`workspace.decorator.ts`·
`workspace-param-binding-guard.ts`·`roles.guard.ts`)와 정확히 일치한다. 이 긴장은 이미 이전
라운드(`15_15_21`)가 지적해 `1-auth.md`·`data-flow/12-workspace.md`·`9-user-profile.md`·
`2-api-convention.md`에 상호 참조 각주로 반영을 마쳤고, 이번 검토는 그 반영이 spec 전체에
스테일 없이 propagate됐음을 재확인했다. 그 외 실제 behavior change(비멤버 거부 코드 통일,
existence oracle 대상 2→3 정정)도 원문을 취소선으로 보존하며 근거·대가를 명시한 새 Rationale과
함께 기록돼 있어, 결정의 무근거 번복이나 합의 원칙 위반에 해당하는 새로운 CRITICAL/WARNING을
찾지 못했다.

## 위험도

NONE
