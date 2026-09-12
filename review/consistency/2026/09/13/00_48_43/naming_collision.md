# 신규 식별자 충돌 검토

## 검토 방법

`spec/5-system/` 델타는 0개 파일(코드 전용 PR, 정상). 대신 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/filter-pg-invalid-text`)를 절대경로로
직접 열어 `git diff origin/main...HEAD` 전체(11개 파일)를 확인했다:

- `codebase/backend/src/common/utils/uuid.ts` — JSDoc만 갱신 (함수 시그니처 불변)
- `codebase/backend/src/modules/auth/login-history.service.ts` — `decodeCursor`에 검증 1줄 추가
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` — `decodeCursor`에 검증 1줄 추가
- 위 세 파일에 대응하는 `*.spec.ts` 3개 + 신규 e2e 2개 (`background-monitoring.e2e-spec.ts`,
  `session-revocation.e2e-spec.ts`)
- `CHANGELOG.md`, `plan/in-progress/keyset-cursor-uuid-validation.md`(신규),
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(기존 트래커 편집)

## 점검 관점별 결과

1. **요구사항 ID 충돌** — 신규 요구사항 ID 없음. plan 문서는 파일 경로로만 참조되고 번호형
   ID(`#NNNN`)를 새로 발급하지 않는다.
2. **엔티티/타입명 충돌** — 신규 엔티티·DTO·인터페이스 없음. `isUuidShaped`는 기존 함수(시그니처
   불변)를 두 신규 호출부(`login-history.service.ts`, `background-runs.service.ts`)에서
   재사용했을 뿐이다.
3. **API endpoint 충돌** — 신규 endpoint 없음. 테스트가 참조하는 `GET
   /api/users/me/login-history`, `GET /api/executions/:executionId/background-runs/:backgroundRunId`
   는 모두 `origin/main`에 이미 존재하던 endpoint다(`git show origin/main:...` 로 확인).
4. **이벤트/메시지명 충돌** — webhook·queue·sse 이벤트 신규 도입 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/config key 없음.
6. **파일 경로 충돌** — 신규 파일은 `plan/in-progress/keyset-cursor-uuid-validation.md`
   (frontmatter `worktree`/`owner`/`spec_impact` 정상) 및 두 e2e 스펙 파일. 기존 명명 컨벤션과
   충돌 없음. `session-revocation.e2e-spec.ts`에 추가된 신규 테스트케이스 라벨 `'F. ...'`는
   기존 `A.`~`E.` 순차 라벨(`git grep` 확인)을 정확히 이어받아 충돌·중복 없음.

에러 코드도 확인했다 — `background-runs.service.ts`에서 사용하는 `INVALID_CURSOR` ·
`INVALID_LIMIT` · `EXECUTION_NOT_FOUND`는 이 diff 이전(`origin/main`)부터 존재하던 코드이며,
diff는 새 코드를 발급하지 않고 기존 `throw new BadRequestException({ code: 'INVALID_CURSOR', ... })`
분기에 도달하는 새 조건 하나(`!isUuidShaped(parsed.i)`)만 추가했다.

`spec-draft-nullable-notation-followups.md`에 새로 등재된 planner 항목(§1.13 신설 제안 등)은
아직 **제안 문구**일 뿐 실제 spec 섹션을 추가하지 않았다 — spec 본문에 반영되지 않았으므로
현시점 충돌 대상이 아니다.

## 발견사항

없음.

## 요약

이 배치는 새 식별자를 사실상 도입하지 않는다 — 기존 함수(`isUuidShaped`)·기존 에러 코드
(`INVALID_CURSOR` 등)·기존 endpoint 를 재사용해 keyset 커서 디코더 2곳에 검증 조건 한 줄씩만
추가했다. 신규 파일(plan 문서 1개, e2e 스펙 2개의 신규 `it()` 케이스)도 기존 명명 컨벤션(순차
라벨 `A.`~`F.`, kebab-case plan 파일명)을 그대로 따른다. 요구사항 ID·엔티티/타입명·API
endpoint·이벤트명·환경변수·파일 경로 6개 관점 모두에서 충돌 후보를 찾지 못했다.

## 위험도

NONE
