# 부작용(Side Effect) 리뷰

## 검증 방법 메모

저장소를 뮤테이션하지 않고 읽기 전용으로 확인했다 (`git status --short` 시작·종료 시점 모두
review 세션 산출물 외에는 clean):

- `workflow-versions.service.ts#findOne` 의 유일한 두 호출부를 전수 확인:
  `workflow-versions.controller.ts:81`(가공 없이 pass-through) ·
  `workflows.service.ts:666`(`restoreVersion`, `target.snapshot`/`target.version` 만 소비).
  새 `select` 가 두 필드 모두 포함하므로 다른 호출자에 데이터 결손을 유발하지 않는다.
- `WorkflowVersion` 엔티티(`workflow-version.entity.ts`) 전체 컬럼과 새 `select` 목록을
  대조 — `workflow`(관계) 제외 전부 일치, 그 관계는 애초에 `relations` 에 없었으므로
  회귀 아님.
- `tsconfig.build.json` 의 `exclude` 를 열어 신규 파일 2곳(`src/repo-guards/__tests__/**`,
  `src/shared/testing/**`)이 기존 제외 패턴 하위 경로임을 확인 — 프로덕션 dist 오염 없음.
- `user-secret-absence.ts`/`user-entity-exposure-guard.ts` 전문을 읽어 `fs.readFileSync` 외
  파일시스템 쓰기·네트워크 호출·환경변수 접근이 없음을 확인.

## 발견사항

- **[INFO]** `WorkflowVersionsService.findOne` 의 반환 데이터 형태가 축소됐다 — 선언 타입은 그대로
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`findOne`,
    반환 타입 `Promise<WorkflowVersion>`)
  - 상세: `relations: ['creator']`(투영 없음, `creator: User` 전체 컬럼)에서
    `relations: { creator: true } + select: { creator: { id, name, email } }` 로 좁혔다. 이번
    검증에서 확인한 대로 기존 두 호출자(컨트롤러 pass-through, `workflows.service.ts#restoreVersion`)
    모두 축소된 필드셋으로 충분해 실제 side effect 는 없다. 다만 메서드 시그니처의 TS 반환
    타입은 여전히 `WorkflowVersion`(즉 `creator: User` — `passwordHash` 등 전체 컬럼을 컴파일
    타임에 약속)이라, 런타임 값이 타입이 약속하는 것보다 좁아지는 방향의 "타입-런타임 불일치"가
    새로 생겼다. 이번 방향(좁아짐)은 유출 방지이므로 안전하지만, 이후 이 메서드에 `creator.xxx`
    필드를 참조하는 새 호출자가 추가되면 컴파일은 통과하되 런타임에 `undefined` 를 받는다.
  - 제안: 조치 불요(이번 diff 범위에서는 무해). 다만 다른 리뷰어가 이미 지적했을 수 있는
    "반환 타입을 `Omit<WorkflowVersion, 'creator'> & { creator: Pick<User,'id'|'name'|'email'> }`
    류로 좁혀 컴파일 타임에도 드러나게 한다" 는 후속 보강은 side-effect 관점에서도 유효하다.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 공개 API(OpenAPI 문서) 변경이지만 wire
  동작은 바꾸지 않는다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
    (`WorkspaceMemberDto`)
  - 상세: `WorkspacesService.listMembers`(이 diff 밖의 기존 코드)가 이미 항상
    `joinedAt: m.joinedAt` 을 실어 왔고, 프런트엔드도 이미 `joinedAt: string | null` 을 소비
    중이었다는 서술을 diff 내 근거(CHANGELOG·DTO 주석·plan)로 확인했다 — 추가적(additive)
    선언 보강이라 하위 호환 파괴 없음. "인터페이스 변경" 점검 항목에 해당하므로 기록만 남긴다.
  - 제안: 조치 불요.

- **[INFO]** 신규 정적 가드(`user-entity-exposure-guard.ts`)와 fixture 는 순수 함수 + 읽기 전용
  `fs.readFileSync` 뿐이며, 전역 가변 상태·환경 변수·네트워크 호출이 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`
    (`collectUserRelationNames`, `findUserRelationLoads`), 소비처
    `user-entity-exposure.spec.ts` — 모듈 로드(=`describe` 본문) 시점에 `src/modules` 전체를
    동기 스캔한다.
  - 상세: 각 호출마다 `out`/`seen`/`names` 를 새로 만들어 함수 간 공유되는 가변 상태가 없다.
    `SRC_ROOT`(경로 상수)·`EXPECTED_USER_RELATION_LOADS`(문자열 배열 상수) 외 모듈 스코프
    전역 변수 신규 도입 없음. 신규 파일 둘 다 `tsconfig.build.json` exclude 하위 경로라
    프로덕션 dist 로 새지 않는다(위 검증 방법 참조).
  - 제안: 조치 불요.

- **[INFO]** `user-secret-absence.ts` (`findUserSecretLeaks`/`expectNoUserSecrets`)도 동일하게
  순수 재귀 워커이고, 이전 라운드에서 지적된 "암묵적 전역 `expect` 의존"(INFO#7)이 이번
  diff 에서 이미 `throw new Error(...)` 직접 던지기로 수정돼 있다
  - 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts` (`expectNoUserSecrets`)
  - 상세: `review/code/2026/09/06/10_13_22/RESOLUTION.md` INFO#7 이 지적한 패턴(Jest 전역
    `expect` 암묵 의존 → `injectGlobals:false` 전환 시 호출부 전체 조용히 깨짐)이 현재 파일에는
    존재하지 않는다 — 자매 헬퍼 `assertMatchesContract` 와 동일하게 직접 `throw` 한다. 회귀
    없음을 확인.
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/09/06/10_13_22/**` · `review/consistency/2026/09/06/10_13_23/**`
  하위 신규 파일 다수(RESOLUTION.md, SUMMARY.md, meta.json, `_retry_state.json` 등)는 이전
  리뷰·consistency 라운드의 산출물이 커밋된 것 — 이번 diff 가 만드는 새 파일시스템 부작용이
  아니라 이 저장소의 정상 워크플로(리뷰 산출물은 `review/**` 에 커밋해 보존)다
  - 위치: 파일 14~34 (해당 디렉터리 전체)
  - 상세: 모두 읽기 전용 텍스트 보고서/메타데이터이고 코드 실행 경로에 관여하지 않는다.
    부작용 관점에서 findings 없음 — 기록만 남긴다.
  - 제안: 조치 불요.

## 요약

이번 diff 의 실질 side-effect 표면은 두 곳뿐이다 — (1) `WorkflowVersionsService.findOne` 이
로드하는 `creator` 컬럼을 전체 `User` 에서 3필드로 좁힌 것(유일한 두 호출자 모두 축소된
필드셋으로 충분함을 직접 대조 확인, 안전한 방향의 축소), (2) `WorkspaceMemberDto.joinedAt`
선언 추가(이미 wire 에 나가고 있던 값의 뒤늦은 선언, 하위 호환 파괴 없음). 나머지는 전부
순수 함수·읽기 전용 정적 스캔·e2e 단언 추가·문서(CHANGELOG/plan)/리뷰 산출물 커밋이며, 전역
가변 상태 도입, 예상 밖 파일시스템 쓰기, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경은
전혀 발견되지 않았다. 신규 테스트 전용 파일 2종(`repo-guards/__tests__/**`,
`shared/testing/**`) 모두 기존 `tsconfig.build.json` exclude 패턴 하위에 위치해 프로덕션
빌드 오염 위험도 없음을 직접 확인했다. `findOne` 반환 타입이 실제 데이터보다 넓게 선언된
채로 남은 것(타입-런타임 불일치, 좁아지는 방향)은 이번 diff 의 범위에서는 무해하지만 향후
새 호출자가 생기면 잠재적으로 `undefined` 참조를 유발할 수 있어 INFO 로 기록한다.

## 위험도

NONE
