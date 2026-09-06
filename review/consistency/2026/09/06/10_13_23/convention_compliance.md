# 정식 규약 준수 검토 — user-entity-column-defense (impl-done, scope=spec/5-system/)

## 검토 방법 메모

- scope(`spec/5-system/`) 델타는 **0개 파일** — 이 브랜치는 spec 텍스트를 바꾸지 않았다. 코드 전용 PR 이므로 이 자체는 정상이며 그 사실만으로 CRITICAL 근거를 삼지 않았다.
- 프롬프트 번들의 `## 구현 변경 사항`(diff 본문)이 예산에 잘려 비어 있었다. 대신 현재 세션 CWD 가 대상 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)와 동일함을 `pwd`/`git status` 로 확인한 뒤 `git diff origin/main...HEAD` 로 실제 변경분(10 files, 694 insertions / 2 deletions)을 직접 확인했다.
- 변경 요지: (1) `WorkspaceMemberDto.joinedAt` 필드 추가, (2) `User` 엔티티 전체 로드 구조를 잡는 신규 정적 가드(`user-entity-exposure-guard.ts`) + 응답 본문 이름 기반 스캔 가드(`user-secret-absence.ts`) 및 그 소비 unit/e2e 테스트, (3) CHANGELOG·plan 체크박스 갱신. `spec/**` 쓰기는 없다 — CLAUDE.md 의 "developer 는 `spec/` read-only" 경계를 그대로 지켰다.

## 발견사항

- **[WARNING]** 신규 응답-노출 검증 가드 2건이 §5.4/§5-1 의 "검증자 양쪽 문서 `code:` 등재" 관례를 따르지 않음
  - target 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` · `user-entity-exposure.spec.ts` · `codebase/backend/src/shared/testing/user-secret-absence.ts` · `user-secret-absence.spec.ts` (전부 신규 파일)
  - 위반 규약: `spec/5-system/2-api-convention.md#검증-층--이-규칙을-무엇이-강제하는가`(§5.4) + `spec/conventions/swagger.md` §5-1("엔티티를 그대로 노출하지 말고... 비밀값은 마스킹하거나 제외")
  - 상세: §5.4 는 "그 검증자는 양쪽 문서의 `code:` 에 모두 등재돼 있다 — 한쪽만 등재하면 다른 축의 변경이 재검토 트리거를 못 건드린다"고 명시하고, 직전 커밋(`21182db02`)이 바로 이 이중 등재 관례를 확정했다. 이번 PR 의 두 가드는 §5-1 이 요구하는 바로 그 방어("비밀값 마스킹/제외", 특히 §5-1 이 예시로 든 `GET /api/audit-logs` 26키 유출과 동일 계열의 `User` 노출)를 코드로 구현했지만, 파일명이 기존 glob(`swagger-dto-contract*.ts`, `response-contract*.ts`, `swagger-probe*.ts`)에 매칭되지 않아 `2-api-convention.md`·`swagger.md` 어느 `code:` 에도 걸리지 않는다. `spec/5-system/1-auth.md`(§4 감사 로그·`User` 보안의 자연스러운 소유 문서)의 `code:` 에도 없다. 결과적으로 이 가드가 나중에 약화되거나 삭제돼도 `code:` 기반 재검토 트리거(consistency-check, spec-coverage)가 걸리지 않는다 — §5.4 가 스스로 경고한 실패 모드가 그대로 재현된 형태다.
  - 제안: `user-entity-exposure-guard*.ts` 를 `spec/5-system/2-api-convention.md`(§5.4 검증 층 표에 세 번째 행 추가)와 `spec/conventions/swagger.md` 의 `code:` 에, `user-secret-absence*.ts` 를 `spec/5-system/1-auth.md`(§4)의 `code:` 에 각각 등재. developer 권한 밖이므로 `project-planner` 턴에서 처리.

- **[WARNING]** `User` 엔티티 노출 방지 불변식이 `spec/1-data-model.md §2.1 User` 에 선언적으로 등재되지 않음 (인접 문서 — 참고용, 엄밀히는 target scope `spec/5-system/` 밖)
  - target 위치: `spec/1-data-model.md` §2.1 User (54~83행) — `AuthConfig` 의 §2.17.2 "마스킹·노출 정책" 서브섹션과 대구되는 절이 `User` 에는 없음
  - 위반 규약(유사 선례): `spec/conventions/secret-store.md` §1.1 "비대상 필드도 응답 바디에는 나가지 않는다" — Trigger/AuthConfig 계열 비밀에 대해서는 2026-09-05 에 정확히 이런 문장(엔티티 패스스루 금지·응답-계약 검증 축)이 정식 규약으로 추가됐다("*이 전까지 이 컬럼들이 응답에 나가면 안 된다는 요구가 spec/** 어디에도 정규 문장으로 없었고(실측 0건)*"). `User` 의 7개 민감 컬럼(passwordHash 등)은 이번 PR 로 사실상 동일한 계층의 코드 방어를 갖췄으나, 그 불변식을 정식 규약 문장으로 선언한 spec 대응 절이 아직 없다.
  - 상세: `spec/1-data-model.md §2.1` 표는 컬럼별 NULL 조건은 서술하지만 "응답에 노출되면 안 된다"는 명시적 금지 문장이 없다. `USER_SECRET_KEYS`(7컬럼)가 코드의 유일한 SoT 로 남아 있어, 다음에 이 목록을 spec 없이 코드에서만 바꾸면 아무 정합성 가드도 안 걸린다(spec 쪽에 대응 문장이 없으므로 drift 자체를 감지할 지점이 없음).
  - 제안: `project-planner` 턴에서 `secret-store.md §1.1` 또는 `1-data-model.md §2.1` 에 `User` 7컬럼 노출 금지를 정식 규약 문장으로 추가하고, 위 가드 두 개를 그 절의 `code:`/본문 링크로 건다. developer 는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 결정 근거를 기록해 뒀으므로(스스로 spec 을 못 고치는 경계를 지킴), 다음 planner 턴에서 그 기록을 그대로 승격하면 된다.

- **[INFO]** `WorkspaceMemberDto.joinedAt` JSDoc 의 "아직 수락 전이면 `null`" 서술이 현재 도달 불가능한 상태를 근거로 듦
  - target 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:80-89`
  - 위반 규약: 직접 위반은 아님 — §5.4 "null(키 present) = 상시 존재, 지금은 값이 없다" 자체는 지켰다(`WorkspacesService.listMembers` 가 `joinedAt: m.joinedAt` 을 무조건 싣고, `nullable: true` + `T | null` 선언도 정확).
  - 상세: 실측 — `WorkspaceMember` 생성 경로 3곳(`workspaces.service.ts:65,184,262`, `workspace-invitations.service.ts:471`) 전부 `joinedAt: new Date()` 로 즉시 채운다. "미가입 초대" 상태는 `WorkspaceInvitation` 별도 엔티티로 모델링되고 `WorkspaceMember` row 자체가 생성되지 않으므로, 현재 코드에는 "row 는 있는데 `joinedAt` 이 null" 인 경로가 없다. DB 컬럼이 `nullable: true`(스키마 레벨)이므로 `nullable: true` 선언 자체는 정당하지만, JSDoc 의 구체적 트리거 서술("아직 수락 전이면")은 현재 관측 불가능한 시나리오를 근거로 든다.
  - 제안: (a) 무시 가능한 수준이나, 정정한다면 "스키마상 nullable — 현재 모든 생성 경로가 즉시 채우지만 미래 경로 대비 방어적으로 선언" 식으로 바꾸는 편이 실제 코드와 더 정확히 맞는다. spec 변경은 불요.

## 요약

이번 diff 는 `spec/5-system/` 을 전혀 건드리지 않은 코드 전용 PR 로, 신규 DTO 필드(`joinedAt`)는 §5.4 nullable 표기 기본형·swagger §1-1 JSDoc 의무를 정확히 지켰고, 신규 가드/테스트 파일의 명명·배치(`repo-guards/__tests__/<name>-guard.ts` + `<name>.spec.ts`, `shared/testing/<name>.ts` + `<name>.spec.ts`)도 기존 형제 가드(`swagger-dto-contract-guard.ts`, `nullable-type-lie-cast-guard.ts`)의 확립된 패턴을 그대로 따라 명명 규약 위반은 없었다. 다만 이번에 새로 만든 두 검증자가 §5.4/§5-1 이 요구하는 "양쪽 문서 `code:` 등재" 관례를 따르지 않아 향후 재검토 트리거가 걸리지 않는 갭이 남았고, 그 갭의 근본 원인인 "`User` 민감 컬럼 노출 금지"라는 신규 불변식 자체가 아직 어떤 spec 문서에도 정식 규약 문장으로 선언돼 있지 않다(Trigger/AuthConfig 계열은 이미 그런 문장을 갖고 있다). 둘 다 기능을 저해하거나 기존 계약과 정면으로 모순되지는 않으므로 WARNING 등급이며, developer 는 spec 쓰기 경계를 지켰으므로 다음 project-planner 턴에서 정합화하면 된다.

## 위험도
LOW
