# Cross-Spec 일관성 검토 — user-entity-column-defense (impl-done, scope=spec/5-system/)

## 검토 방법 메모

- scope(`spec/5-system/`) 델타는 0개 파일 — 이 브랜치는 spec 을 바꾸지 않았다. 코드 전용 PR 이므로 이 자체는 정상이며 CRITICAL 근거로 쓰지 않았다.
- 프롬프트 번들의 `## 구현 변경 사항` 섹션은 예산에 잘려 비어 있었다. 대신 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`, 현재 세션 cwd 와 동일)에서 `git diff origin/main` 을 직접 실행해 실제 diff(10 files, 694 insertions / 2 deletions)를 확인했다.
- 변경 요지: (1) `WorkspaceMemberDto.joinedAt` 필드 추가, (2) `User` 엔티티 전체 로드를 잡는 신규 구조 가드(`user-entity-exposure-guard.ts`) + 값 스캔 가드(`user-secret-absence.ts`) 및 그 소비 e2e/스펙 테스트, (3) CHANGELOG·plan 체크박스 갱신.

## 발견사항

- **[WARNING]** 신규 응답-검증 가드 2건이 §5.4 "검증 층" 이중 등재 관례를 따르지 않음
  - target 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts`, `codebase/backend/src/shared/testing/user-secret-absence.ts`, `codebase/backend/src/shared/testing/user-secret-absence.spec.ts` (모두 신규 파일, `spec/5-system/` 델타 없음)
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.4 "검증 층 — 이 규칙을 무엇이 강제하는가" 표 + `spec/conventions/swagger.md` (둘 다 frontmatter `code:` 에 `repo-guards/__tests__/swagger-dto-contract*.ts` 와 `shared/testing/response-contract*.ts` 를 **양쪽 문서에 동일하게 등재**하고 있다 — 직전 커밋 `21182db02`("§5.4 검증자를 양쪽 규약에 등재하고 두 검증자의 경계를 적는다")가 이 패턴을 확정)
  - 상세: `2-api-convention.md` §5.4 는 "그 검증자는 양쪽 문서의 `code:` 에 모두 등재돼 있다 — 한쪽만 등재하면 다른 축의 변경이 재검토 트리거를 못 건드린다" 고 명시한다. 이번 PR 이 추가한 두 가드는 같은 디렉터리(`repo-guards/__tests__/`, `shared/testing/`)에 있고 개념적으로 같은 클래스(응답에 무엇이 실리면 안 되는가를 판정하는 검증자)이지만, 파일명이 기존 glob(`swagger-dto-contract*.ts`, `response-contract*.ts`, `swagger-probe*.ts`)에 매칭되지 않아 **어느 spec 문서의 `code:` 에도 등재되지 않았다**. `spec/5-system/1-auth.md`(§4 감사 로그 / `User` 보안이 자연스러운 소유 문서)의 frontmatter `code:` 에도 없다. 이 상태로는 향후 이 가드 파일이 바뀌어도 `code:` 기반 재검토 트리거(consistency-check, spec-coverage)가 걸리지 않는다 — §5.4 가 스스로 지적한 실패 모드("한쪽만 등재하면 다른 축의 변경이 재검토 트리거를 못 건드린다")가 그대로 재현된 형태다.
  - 제안: `user-entity-exposure-guard*.ts` 를 `spec/5-system/2-api-convention.md`(§5.4 검증 층 표에 세 번째 행 추가) 와 `spec/conventions/swagger.md` 의 `code:` 에, `user-secret-absence*.ts` 를 `spec/5-system/1-auth.md`(§4 감사 로그·`User` 민감 컬럼 노출 방지) 의 `code:` 에 각각 등재하고, §5.4 표의 "무엇과 무엇을 대조하나" 열에 이 새 축("구조 — AST" / "값 — 이름 기반, 선언 무관")을 한 줄로 요약해 두는 것을 권한다(정합 문서 갱신은 `project-planner` 몫).

## 요약

이번 diff 는 spec 이 정의한 데이터 모델(`WorkspaceMember.joined_at: Timestamp?`)·§5.4 nullable 표기 규약(`@ApiProperty({nullable:true})` 기본형)·RBAC 매트릭스(`멤버 관리: Viewer=R`)와 정면으로 모순되는 지점은 없었다 — `joinedAt` 필드 추가는 기존 spec 정의를 그대로 노출한 것이고, `User` 민감 컬럼 목록(7개)도 엔티티 실측과 정확히 일치한다. 유일하게 지적할 지점은 신규 응답-검증 가드 2건이 바로 직전 커밋에서 확정된 "검증자는 자신이 강제하는 spec 문서 양쪽에 `code:` 로 등재한다" 는 관례를 따르지 않아, 향후 이 영역이 바뀌어도 spec 쪽 재검토 트리거가 걸리지 않는 잠재적 갭이 생겼다는 것이다. 이는 기능 저해나 직접 모순은 아니므로 WARNING 등급이 적절하다.

## 위험도
LOW
