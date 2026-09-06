# 요구사항(Requirement) 리뷰

## 검증 방법 메모

이 diff 는 이미 3라운드의 `/ai-review` + 3라운드의 `/consistency-check` 를 거친 브랜치의 누적
상태다(`review/code/.../10_13_22`, `10_53_48`, `11_27_53` 및 대응 consistency 라운드). 새 결함을
찾기 전에 이전 라운드가 "고쳤다"고 적은 것이 실제로 코드에 반영돼 있는지 직접 확인했다(읽기
전용 — 저장소를 뮤테이션하지 않음):

- `npx jest --config jest.config.ts user-entity-exposure user-secret-absence workflow-versions.service.spec` → **3 suites / 33 tests 전부 통과**.
- `npx tsc --noEmit -p tsconfig.build.json` → **clean**(`tsconfig.json` 전체 스캔에서 나온 carousel/chart/table 관련 에러는 diff 밖 기존 상태이며 `origin/main` 이후 그 디렉터리에 변경이 없음을 `git diff --stat` 로 확인 — 이번 PR 이 만든 회귀 아님).
- `grep -n "두 검증자" spec/5-system/2-api-convention.md spec/conventions/swagger.md` → 여전히 "두 검증자" 문구 존재. `grep -rn "user-entity-exposure\|user-secret-absence" spec/` → **0건**.
- `WorkflowVersionsService.findOne`/`findByWorkflow` 의 `CREATOR_PROJECTION` 이 `WorkflowVersionCreatorDto`(id/name/email)와 실제로 일치함을 DTO 소스와 대조.
- `WorkspacesService.listMembers` 및 `workspace_member` 행 생성 4자리(`workspaces.service.ts:65,184,262`, `workspace-invitations.service.ts:471`)가 전부 `joinedAt: new Date()` 로 즉시 채움을 확인 — `WorkspaceMemberDto.joinedAt` JSDoc 의 "상시 존재" 주장과 일치.
- `Execution.executor`(타입이 `User`) 관계가 `addSelect(['executor.id','executor.name'])` 로 이미 투영되어 있어 오탐/누락 없음을 확인.

## 발견사항

- **[WARNING] `[SPEC-DRIFT]`** §5.4 "두 검증자" 서술이 실제 검증자 수(4개)와 더 이상 맞지 않는다
  - 위치: `spec/5-system/2-api-convention.md` §5.4 "검증 층" (`"그 자리를 **두 검증자**가 나눠 맡는다"`), `spec/conventions/swagger.md` §5-1 (`"**두 검증자**의 경계는 … 이 소유한다"`)
  - 상세: 이번 PR 이 신설한 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`(구조 축)와 `codebase/backend/src/shared/testing/user-secret-absence.ts`(이름 축, 배선 무관)는 §5.4/swagger.md §5-1 이 "두 검증자(선언↔선언 정적 / 값↔선언 런타임)"로 못박은 바로 그 문제 영역(`User` 비밀값의 응답 노출)에 대한 제3·제4 검출축이다. 코드 쪽 JSDoc(`user-entity-exposure.spec.ts` 파일 헤더)이 "왜 select:false 가 아닌가", "왜 이름 기반 검증이 추가로 필요한가"를 실측 수치와 함께 상세히 근거를 남기고 있어 이 확장 자체는 의도적이고 근거가 탄탄하다 — 즉 **코드가 옳고 spec 문구가 낡은 형태**다. 다만 spec 본문(`code:` frontmatter 포함)은 여전히 이 두 파일을 전혀 언급하지 않아(`grep -rn "user-entity-exposure\|user-secret-absence" spec/` 0건), 이 가드들이 나중에 약화·삭제돼도 spec-consistency 게이트가 걸리지 않는 사각지대가 남는다.
  - 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(367번째 줄 부근 "신규 검출 2축을 §5.4 「검증 층」과 `code:` 에 등재", owner: planner, `[ ]` 미완료)에 정확히 이 항목으로 등재돼 있고, 3차례의 consistency-check 가 독립적으로 재확인했다. `spec/` 쓰기는 developer 권한 밖이라 이 브랜치가 직접 집행할 수 없는 것도 맞다 — 새로 조치할 것은 없지만, 요구사항(#9 spec fidelity) 관점의 재확인 결과로 명시한다.
  - 제안: (코드 변경 없음, spec 반영 대상) `project-planner` 턴에서 `2-api-convention.md` §5.4 검증 층 표에 두 축(구조/AST · 이름/값)을 나열 형태로 추가하고 `code:` frontmatter 에 두 파일 glob 등재. `swagger.md §5-1` 의 "두 검증자" 문구도 개수 대신 나열 형태로 교체(plan 이 이미 이 방향을 못박아 둠).

- **[WARNING] `[SPEC-DRIFT]`** `User` 민감 7컬럼의 응답 노출 금지가 spec 규범 문장으로 없다
  - 위치: `spec/conventions/secret-store.md §1.1` (Trigger/AuthConfig 계열에는 "컬럼 수준 `select:false` 는 내부 경로가 조용히 오작동하므로 쓰지 않는다"는 정확히 같은 논리의 규범 문장이 이미 있으나 `User` 절이 없음 — `grep -n "User" spec/conventions/secret-store.md` 0건), `spec/1-data-model.md §2.1 User` (컬럼 표에 노출 금지 서술 없음)
  - 상세: 이번 PR 의 `USER_SECRET_KEYS`(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken`)가 이 불변식의 **유일한 SoT** 다. 결정 근거(19곳 공유 깔때기·46개 호출 지점·fail-silent 위험) 자체는 `secret-store.md §1.1` 의 기존 원칙과 정합(번복 아님)하지만, 그 규범이 spec 본문에 문장으로 존재하지 않는다.
  - 이미 같은 plan 파일(395번째 줄 부근, owner: planner, `[ ]` 미완료)에 등재돼 있고 3차례의 consistency-check 가 재확인했다. 새로 조치할 것 없음 — spec fidelity 관점에서 재확인.
  - 제안: (코드 변경 없음, spec 반영 대상) `secret-store.md §1.1` 또는 `1-data-model.md §2.1` 에 `User` 7컬럼 노출 금지 규범 문장 + `## Rationale` 에 결정 근거를 옮기고 두 가드 파일을 `code:` 로 연결.

- **[INFO]** `WorkflowVersionDetail`/`WorkflowVersionListItem` 의 `creator` 타입이 항상 값이 있다고 가정하지만 DTO 는 `optional + nullable` 로 더 보수적으로 선언돼 있다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`ProjectedCreator`, `CREATOR_PROJECTION` 타입) vs `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts` (`creator?: WorkflowVersionCreatorDto | null`)
  - 상세: `WorkflowVersion.creator` 는 `@ManyToOne(() => User)`(nullable 옵션 없음, `created_by` 컬럼도 not-null)이라 런타임에 항상 채워지는데, DTO 는 방어적으로 `optional + nullable` 을 선언한다. 타입/계약이 실제보다 **넓은**(더 관대한) 방향이라 유출·런타임 오류 위험은 없다 — 이전 라운드(`review/code/2026/09/06/11_27_53` RESOLUTION "남긴 것" INFO#1)가 같은 지점을 "범위 밖"으로 이미 처분했다. 재확인 목적으로만 기록, 조치 불요.

## 요약

이 브랜치는 감사 로그 26키 유출(#1288) 이후 미결이던 "`User` 엔티티 컬럼 수준 방어" 결정을
전수 열거로 매듭짓고, 그 과정에서 발견한 실제 유출(`WorkflowVersionsService.findOne` 이
`creator` 를 투영 없이 반환)을 세 축(이름 부재·계약 대조·참조 3필드 양성)으로 봉인했다. 기능
완전성·엣지 케이스(빈 목록·중첩 객체·`as`/`satisfies` 캐스트·감싸는 변수·대소문자·`select`
값이 boolean 인 위장 투영)·에러 시나리오·반환값 모두 fixture 12개(위반 11형태+겹침 1 · 준수
5형태)로 mutation-tested 상태이고, 직접 `npx jest`/`npx tsc --noEmit -p tsconfig.build.json`
로 재실행해 green 을 재확인했다. TODO/FIXME/HACK 성 미완성 주석은 없다. 함수명·JSDoc 과 실제
구현이 정확히 일치하며(각 위반 fixture 의 이유가 코드 동작과 대조해 전부 맞았다), `CREATOR_PROJECTION`
은 이제 단일 SoT 이고 `WorkflowVersionCreatorDto` 의 OpenAPI 스키마와 테스트로 강제 동기화된다.
spec fidelity 관점에서는 신규 검출 2축이 §5.4/`swagger.md §5-1` 의 "두 검증자" 서술 및
`secret-store.md`/`1-data-model.md` 의 `User` 노출 금지 규범 문장에 아직 반영되지 않은 두 건의
SPEC-DRIFT 가 있으나, 둘 다 developer 권한 밖(`spec/` 쓰기)이며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 planner 후속 항목으로 정확히 등재·3차 재확인된 known-gap 이라 이번 라운드에서 새로 조치할
것은 없다. 새로운 Critical/Warning 급 기능 결함은 발견하지 못했다.

## 위험도
LOW
