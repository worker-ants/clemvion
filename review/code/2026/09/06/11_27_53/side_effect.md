# 부작용(Side Effect) 리뷰

## 검증 방법 메모

저장소를 뮤테이션하지 않고 읽기 전용으로 확인했다 (`git status --short` 확인 결과 시작·종료
시점 모두 이 리뷰 세션 산출물 외에는 clean):

- `git diff --stat origin/main...HEAD -- codebase/` 로 실제 코드 변경 파일 11개를 직접 대조
  (프롬프트가 크기 제한으로 diff 를 생략한 fixture/guard/spec 3개 파일 포함) — 프롬프트가
  기재한 목록과 정확히 일치.
- `user-entity-exposure-guard.ts`/`user-entity-exposure.spec.ts`/
  `user-relation-load.fixture.ts` 전문을 `Read` 로 열어 순수 함수·읽기 전용 `fs` 접근만
  있음을 확인.
- `user-secret-absence.ts` 를 grep 하여 `expect`/`import` 참조가 전혀 없음을 확인 — 이전
  라운드(`10_13_22` INFO#7)가 지적한 Jest 전역 `expect` 암묵 의존이 이번 diff 시점에는 이미
  `throw new Error(...)` 직접 던지기로 고쳐져 있다.
- `codebase/backend/src/modules/workspaces/workspaces.service.ts` 와
  `workspace-invitations.service.ts` 를 grep 하여 `workspace_member` 를 만드는 4자리
  (`workspaces.service.ts:65,184,262`, `workspace-invitations.service.ts:471`) 전부
  `joinedAt: new Date()` 로 즉시 채우고, `listMembers`(`:223`)가 `joinedAt: m.joinedAt` 을
  무조건 싣는 것을 직접 확인 — `WorkspaceMemberDto.joinedAt` 추가가 wire 동작을 바꾸지
  않는다는 diff 내 주장과 일치.
- `WorkflowVersionsService.findOne` 의 유일한 두 호출자를 전수 확인:
  `workflow-versions.controller.ts:81`(가공 없이 pass-through) ·
  `workflows.service.ts#restoreVersion:666`(`target.snapshot`·`target.version` 만 소비). 새
  `select` 목록(`id`·`workflowId`·`version`·`changeSummary`·`snapshot`·`createdBy`·
  `createdAt`·`creator`)이 이 두 소비 필드를 모두 포함하므로 데이터 결손 없음.
- `tsconfig.build.json` 의 `exclude` 를 열어 신규 비-`spec.ts` 파일 2곳
  (`src/repo-guards/__tests__/user-entity-exposure-guard.ts`,
  `src/shared/testing/user-secret-absence.ts`)이 각각 `src/repo-guards/**`·
  `src/shared/testing/**` 기존 제외 패턴 하위 경로임을 확인 — 프로덕션 dist 오염 없음.
- `CREATOR_PROJECTION` 상수 도입을 확인 — production 2곳
  (`findByWorkflow`/`findOne`) + spec 2곳이 모두 이 상수 하나를 참조하도록 통합돼, 직전
  라운드가 지적한 "같은 리터럴 4곳 수기 복제"(그리고 그 복제가 Critical 1 의 근본 원인)가
  이번 diff 시점 상태에서는 실제로 해소돼 있다.

## 발견사항

- **[INFO]** `WorkflowVersionsService.findOne` 의 반환 데이터가 축소됐지만 선언 타입은 그대로 넓다 (기존 라운드에서 이미 지적·"조치 불요"로 처분된 항목의 재확인)
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findOne` 메서드 (반환 타입 `Promise<WorkflowVersion>`)
  - 상세: `relations: ['creator']`(투영 없음) → `relations: { creator: true } + select: { …, creator: CREATOR_PROJECTION }` 로 좁혔다. 실제 두 호출자(컨트롤러 pass-through, `restoreVersion`)는 `creator` 필드 자체를 참조하지 않아 이번 diff 범위에서는 무해함을 직접 확인했다. 다만 TS 반환 타입은 여전히 `WorkflowVersion`(`creator: User` 전체 컬럼을 컴파일 타임에 약속)이라, "타입이 런타임보다 넓다"는 방향의 타입-런타임 불일치가 남아 있다 — 좁아지는 방향(유출 방지)이라 안전하지만, 향후 `target.creator.xxx` 를 참조하는 새 호출자가 추가되면 컴파일은 통과하되 런타임에 `undefined` 를 받을 수 있다.
  - 제안: 조치 불요(이번 diff 범위 무해, 이미 이전 라운드가 같은 결론으로 처분함). 후속 보강 여지가 있다면 반환 타입을 `Omit<WorkflowVersion,'creator'> & { creator: Pick<User,'id'|'name'|'email'> }` 류로 좁히는 것을 고려.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가 — 공개 API(OpenAPI 문서) 변경이지만 wire 동작은 바꾸지 않음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`WorkspaceMemberDto`)
  - 상세: `GET /api/workspaces/:id/members` 의 OpenAPI 계약에 새 필드가 추가되지만, 실측으로 확인한 대로 `WorkspacesService.listMembers` 는 이미 항상 `joinedAt: m.joinedAt` 을 실어 왔고 프런트엔드도 이미 `joinedAt: string | null` 을 독립적으로 소비 중이다 — 추가적(additive) 선언 보강이라 하위 호환 파괴 없음.
  - 제안: 조치 불요.

- **[INFO]** 신규 정적 가드(`user-entity-exposure-guard.ts`)·이름 기반 단언(`user-secret-absence.ts`) 모두 순수 함수 + 읽기 전용 `fs.readFileSync`/`fs.readdirSync` 뿐이며, 전역 가변 상태·환경 변수 접근·네트워크 호출이 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (`collectUserRelationNames`·`findUserRelationLoads`), `codebase/backend/src/shared/testing/user-secret-absence.ts` (`findUserSecretLeaks`·`expectNoUserSecrets`)
  - 상세: 모듈 스코프 상수(`SRC_ROOT`·`USER_SECRET_KEYS`·`FORBIDDEN`(Set)·`EXPECTED_USER_RELATION_LOADS`)는 전부 불변이고, 각 호출마다 `out`/`seen`/`names`/`hits` 를 새로 만들어 함수 간 공유 가변 상태가 없다. `user-entity-exposure.spec.ts` 의 `describe` 본문(모듈 로드 시점)이 `src/modules` 전체를 동기 스캔하는 것은 이 저장소의 기존 구조적 가드들(`swagger-dto-contract-guard` 등)과 동일한 확립된 패턴이라 새로운 부작용이 아니다. 두 신규 파일 모두 `tsconfig.build.json` 기존 exclude 패턴 하위 경로임을 확인해 프로덕션 dist 오염 위험도 없다.
  - 제안: 조치 불요.

- **[INFO]** `expectNoUserSecrets` 가 Jest 전역 `expect` 에 암묵 의존하던 결함(이전 라운드 `10_13_22` INFO#7)이 이번 diff 시점에는 이미 해소돼 있음
  - 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts` (`expectNoUserSecrets`)
  - 상세: 현재 파일 전체에 `import` 문이 없고 `throw new Error(...)` 를 직접 던진다(grep 으로 `expect(` 참조 0건 확인) — 자매 헬퍼 `assertMatchesContract` 와 동일한 형태다. `injectGlobals:false` 전환 시 조용히 깨질 위험이 제거됐다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/**`·`review/consistency/**` 하위 대량의 신규 파일(RESOLUTION.md·SUMMARY.md·meta.json·`_retry_state.json` 등, 파일 14~54)은 이전 리뷰/consistency 라운드의 산출물이 커밋된 것 — 이번 diff 가 만드는 새로운 파일시스템 부작용이 아니라 이 저장소의 정상 워크플로(리뷰 산출물은 `review/**` 에 커밋해 보존)다
  - 위치: `review/code/2026/09/06/10_13_22/**`, `review/code/2026/09/06/10_53_48/**`, `review/consistency/2026/09/06/10_13_23/**`, `review/consistency/2026/09/06/10_53_50/**`
  - 상세: 모두 읽기 전용 텍스트 보고서/메타데이터이고 애플리케이션 코드 실행 경로에 관여하지 않는다. `_retry_state.json` 도 harness 진행 상태 스냅샷일 뿐 런타임에 소비되지 않는다.
  - 제안: 조치 불요 — 기록용.

## 요약

이번 diff(실질 코드 변경 11파일 + CHANGELOG/plan 문서 + 리뷰 산출물)의 실질 side-effect 표면은
두 곳뿐이다 — (1) `WorkflowVersionsService.findOne` 이 로드하는 `creator` 컬럼을 전체 `User`
에서 3필드(`CREATOR_PROJECTION`)로 좁힌 것(유일한 두 호출자 모두 축소된 필드셋으로 충분함을
직접 대조 확인, 유출을 막는 안전한 방향의 축소), (2) `WorkspaceMemberDto.joinedAt` 선언
추가(이미 wire 에 나가고 있던 값의 뒤늦은 선언, 4개 생성 지점 + 소비 지점을 실측으로 대조해
하위 호환 파괴 없음을 확인). 나머지는 전부 순수 함수(AST 스캔·재귀 워커)·읽기 전용 파일시스템
접근·e2e 단언 추가·문서 갱신·이전 라운드 리뷰 산출물 커밋이며, 전역 가변 상태 도입, 예상 밖
파일시스템 쓰기, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다. 이전
라운드가 지적했던 side-effect 인접 결함들(`expect` 암묵 의존, `creator` 리터럴 4곳 수기
복제)은 이번 diff 시점의 코드를 직접 열어 대조한 결과 실제로 해소돼 있음을 확인했다. 신규
테스트 전용 파일 2종 모두 기존 `tsconfig.build.json` exclude 패턴 하위에 위치해 프로덕션 빌드
오염 위험도 없다. 이 PR 은 스스로를 "방어가 아니라 검출"이라고 명시하며, 실제 코드도 런타임
경로에 새 부작용을 만들지 않는다는 설계 목표와 일치한다. 새로 지적할 Critical/Warning 급
부작용은 없다.

## 위험도

NONE
