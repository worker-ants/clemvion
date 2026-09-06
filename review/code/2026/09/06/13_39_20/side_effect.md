# 부작용(Side Effect) 리뷰

## 개요

이번 diff(`origin/main...HEAD`, 7개 커밋)는 `User` 엔티티 민감 컬럼 노출을 잡는 검출 3축(구조축
`user-entity-exposure-guard.ts`, 이름축 `user-secret-absence.ts`, DTO JSDoc 인용축
`dto-jsdoc-citation-guard.ts`)을 신설하고, 그 과정에서 드러난 실유출(`WorkflowVersionsService
.findOne` 이 `creator` 관계를 투영 없이 반환)을 수정한 것이 핵심이다. `review/**` 하위의 과거
리뷰 라운드 산출물(`10_13_22`~`12_53_28`)은 이번 세션이 검토할 "변경"이 아니라 이전 라운드들의
기록이므로, 실질 코드/스펙 변경 20개 파일(`git diff --stat origin/main...HEAD -- . ':!review'`)
을 대상으로 분석했다.

## 발견사항

- **[INFO]** `WorkflowVersionsService.findOne` 반환 타입이 `Promise<WorkflowVersion>` →
  `Promise<WorkflowVersionDetail>` 로 좁혀짐 — 유일한 내부 호출자는 영향 없음, 확인 완료
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`findOne`
    메서드 시그니처, `WorkflowVersionDetail`/`ProjectedCreator`/`CREATOR_PROJECTION` 신규 export)
  - 상세: `grep -rn "WorkflowVersionsService" codebase/backend/src` 로 전수 호출자를 추적한 결과
    이 서비스를 쓰는 곳은 `workflow-versions.controller.ts`(반환 타입 무주석, 추론에 의존)와
    `workflows.service.ts:666` `restoreVersion` 뿐이다. `restoreVersion` 은 `target.snapshot`
    만 읽고(`workflows.service.ts:667-671`), 새 `WorkflowVersionDetail` 도 `snapshot` 을 그대로
    포함하므로 컴파일·런타임 모두 영향 없음을 직접 코드로 확인했다. 런타임 쿼리도
    `select: {...}` 로 버전 엔티티의 **모든 own 컬럼**(`id`/`workflowId`/`version`/
    `changeSummary`/`snapshot`/`createdBy`/`createdAt`)을 명시 selection 했고, 유일하게 좁힌
    것은 이미 전 컬럼 유출 버그였던 `creator`(`User`→3필드)뿐이라 응답 형태 축소로 인한
    기존 소비자 영향도 없다(`WorkflowVersionCreatorDto` 가 원래부터 3필드만 광고했음을
    `workflow-version-response.dto.ts` 로 확인 — API 계약 관점은 이미 별도 라운드가 처분).
    시그니처가 넓어지지 않고 **좁아지는 방향**이라 하위 호환 리스크는 원리적으로 낮다.
  - 제안: 조치 불요 — 새 호출자가 생기면 `WorkflowVersionDetail` 타입이 컴파일 타임에
    `.workflow`/`.creator` 의 확장된 필드 접근을 계속 차단해 줄 것이므로 현재 설계가 안전판
    역할을 한다.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 순수 additive — 기존 소비자 영향 없음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:93`
  - 상세: `grep -n "joinedAt" codebase/backend/src/modules/workspaces/` 로 확인한 결과
    `WorkspacesService.listMembers`(`workspaces.service.ts:223` `joinedAt: m.joinedAt`)가 이번
    diff 이전부터 이미 무조건 이 값을 wire 로 실어 왔다. DTO 선언 추가는 기존 런타임 응답
    형태를 사후에 문서화한 것뿐이라 필드 추가에 따른 실제 인터페이스 동작 변경은 없다.
  - 제안: 조치 불요.

- **[INFO]** 신규 가드 3종(`user-entity-exposure-guard.ts`/`user-secret-absence.ts`/
  `dto-jsdoc-citation-guard.ts`)은 파일시스템 읽기만 하며 쓰기·네트워크·환경변수 접근이 없다
  - 위치: 위 3개 신규 파일 전체 + `codebase/backend/src/shared/testing/user-secret-absence.ts`
  - 상세: `grep -n "writeFileSync|fs\.write|fs\.rm|process\.env|fetch(|axios"` 로 전수 확인한
    결과 매치 0건. 파일 스캔(`fs.readFileSync`)은 전부 export 된 함수 **호출 시점**에만
    실행되고, 모듈 로드 시점에 계산되는 것은 `SRC_ROOT = path.resolve(__dirname, '..', '..')`
    같은 결정적 경로 상수뿐이라(`user-entity-exposure-guard.ts:14`,
    `dto-jsdoc-citation-guard.ts:16`) import 만으로 디스크를 훑는 부작용은 없다.
    `Object.freeze(CREATOR_PROJECTION)` 도 읽기 전용 방어일 뿐 TypeORM 쪽에서 이를 변경하지
    않으므로 문제 없음.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e 케이스(`audit-logs.e2e-spec.ts`, `workspace-rbac.e2e-spec.ts` `J.`,
  `workflow-crud.e2e-spec.ts` `H.`)의 부작용은 기존 헬퍼를 통한 정상적인 테스트 DB 상태 변경뿐
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` 신규 `it('J. ...')`,
    `codebase/backend/test/workflow-crud.e2e-spec.ts` 신규 `it('H. ...')`
  - 상세: 두 케이스 모두 `registerAndLogin`/`createTeamWorkspace`/`inviteAndAccept`(rbac) 또는
    워크플로우 생성+캔버스 저장(crud) 등 파일 내 기존에 이미 쓰이던 헬퍼만 재사용해 새 사용자·
    워크스페이스·워크플로우 행을 만든다. 새로운 종류의 부작용(전역 mock 대체, 외부 서비스
    호출, 신규 env 의존)은 없다.
  - 제안: 조치 불요.

- **[INFO]** `spec/conventions/review-citations.md`/`spec-impl-evidence.md` 정정은 CLAUDE.md
  §자기-반증형 소정정 절차를 따른 문서 인터페이스 변경 — 코드 동작에는 영향 없음
  - 위치: `spec/conventions/review-citations.md`(`code:` frontmatter + 본문 취소선 정정),
    `spec/conventions/spec-impl-evidence.md`(`code` 필드 설명 취소선 정정)
  - 상세: 두 파일 모두 원문을 삭제하지 않고 취소선(`~~...~~`)으로 남긴 뒤 "정정 (2026-09-06)"
    블록을 덧붙이는 방식이라 CLAUDE.md 가 요구하는 절차(원문 보존·국소 정정·근거 병기)와
    형태가 일치한다. `dto-jsdoc-citation-guard.ts` 를 `code:` 에 새로 등재한 것은 실행 코드
    쪽 변경이 아니라 문서-구현 대응 관계를 갱신한 것뿐이라, 부작용 관점에서는 런타임 동작에
    영향을 주지 않는 순수 문서 변경이다.
  - 제안: 조치 불요 — 절차 준수 여부(자기 자신이 쓴 문장인지 등)는 scope/consistency 리뷰
    영역이라 이 리뷰에서는 판단하지 않는다.

뮤테이션 검증을 위해 저장소 파일을 고쳐 재현할 필요는 없었다 — 전수 `grep`/`git diff`/코드
직독으로 호출자·부작용 표면을 확인했다. `git status --short` 로 확인한 결과 이 리뷰 세션이
저장소에 남긴 변경은 없다(현재 세션 자신의 `review/code/2026/09/06/13_39_20/`,
`review/consistency/2026/09/06/13_39_25/` 출력 디렉터리만 untracked로 존재).

## 요약

이번 diff 의 핵심 변경(`findOne` 시그니처 축소, `WorkspaceMemberDto.joinedAt` 추가)은 둘 다
사용자 관점의 side effect 8개 축(의도치 않은 상태 변경·전역 변수·파일시스템·시그니처·인터페이스·
환경변수·네트워크·이벤트/콜백) 어디에도 새로운 위험을 만들지 않는다. 시그니처가 좁아지는
방향이고 유일한 내부 호출자가 영향받지 않음을 직접 추적해 확인했으며, DTO 필드 추가는 이미
존재하던 런타임 값을 사후 선언한 순수 additive 변경이다. 신규 검출 가드 3종은 테스트 시점에만
동작하는 순수 스캔 로직으로 파일 쓰기·네트워크·환경변수 접근이 전혀 없다. e2e 신규 케이스는
기존 헬퍼로 정상적인 테스트 데이터를 생성할 뿐이다. spec/conventions 정정은 절차를 준수한 문서
변경으로 코드 동작에 영향이 없다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

NONE
