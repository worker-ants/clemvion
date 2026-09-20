# 부작용(Side Effect) 리뷰 — dup-delete-audit (20_43_03)

## 검증 방법 (참고)

저장소 뮤테이션 없음 — 정적 검토만 수행. 아래 항목은 diff 게이트 숫자 대신, `Read`/`Grep` 으로
현재 저장소를 직접 열어 재확인한 결과다(프롬프트 diff 게이트와 실제 파일 내용이 일치함을 확인).

- `grep -rn "lockParentAndListTriggerIds|LockedParentTriggers" codebase/` (non-spec) → 호출부 2곳
  (`workflows.service.ts:273`, `workspaces.service.ts:522`) + 포트/구현 정의뿐, 다른 소비처 없음.
- `grep -rln "TriggerResourceReleasePort|triggerReleaser"` → mock 도 두 spec 파일뿐, 누락된 stale
  mock 없음.
- `git status --short` → `review/code/2026/09/20/20_06_26/_resolution_log.md`(미커밋 문서),
  `review/code/2026/09/20/20_43_03/`(이 세션 자신의 산출물 디렉터리) 외 잔여 변경 없음 — 이전 라운드가
  기록한 뮤테이션 실험은 전부 원복되어 있다.

## 발견사항

- **[INFO]** 공유 포트 시그니처 변경(`Promise<string[]>` → `Promise<LockedParentTriggers>`) — blast
  radius 전수 확인
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts`
    (`export interface LockedParentTriggers`, `lockParentAndListTriggerIds` 선언),
    구현은 `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`
    (`async lockParentAndListTriggerIds`)
  - 상세: `TriggerResourceReleasePort.lockParentAndListTriggerIds` 의 반환 타입이 바뀌었으나, 이
    메서드를 부르는 곳은 `codebase/backend/src/modules/workflows/workflows.service.ts`(`remove()`)와
    `codebase/backend/src/modules/workspaces/workspaces.service.ts`(`deleteWorkspace()`) 단 둘뿐이고
    둘 다 같은 커밋에서 `locked.parentPresence`/`locked.triggerIds` 로 갱신됐다. 이 포트는
    `ModuleRef.get(TOKEN, { strict: false })` 로 지연 해석되어 타입체크가 놓칠 수 있는 자리인데도,
    실측(plan 체크리스트)이 "단위는 GREEN 인데 `build` 가 import 누락을 잡았다"를 기록해 두어
    실제로 타입 경계가 작동함을 확인했다.
  - 제안: 조치 불요 — 이미 전수 갱신·검증됨.

- **[INFO]** 동시-삭제 "패자" 요청의 HTTP 응답 코드가 두 경로 모두 바뀐다(의도된 변경)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts`
    (`if (locked.parentPresence === 'absent') throw new NotFoundException(...)`, `remove()`),
    `codebase/backend/src/modules/workspaces/workspaces.service.ts`
    (동일 패턴, `deleteWorkspace()`)
  - 상세: 워크플로 경로는 `204`(성공)에서 `404`로 바뀌고(트리거 목록 §4.4 선례에 맞춤,
    `CHANGELOG.md`·plan·신규 e2e 로 실측·문서화됨). 워크스페이스 경로는 이번 diff 가 **추가로** 닫은
    비대칭이라 더 눈여겨볼 만하다 — 고치기 전에는 `assertWorkspaceDeletable` 의 "멤버십(권한) → 존재"
    판정 순서 때문에 진 쪽 요청이 `403 OWNER_REQUIRED` 를 받았는데(CASCADE 로 멤버 행까지 사라졌으므로),
    이번 수정으로 `404 WORKSPACE_NOT_FOUND` 로 바뀐다. 매우 좁은 동시-삭제 경합 창에서만 관측되는
    변화이고 두 코드 다 클라이언트가 "삭제 실패"로 취급하는 응답이라 실질적 파급은 낮지만, 이 경합
    윈도우를 상태 코드로 구분해 처리하는 호출자가 있었다면(있을 가능성은 낮음) 그 분기가 영향을 받는다.
    이 변경은 plan(`plan/in-progress/dup-delete-audit.md` §B 정정문)과 `CHANGELOG.md` 에 "403→404,
    의도된 변경"으로 명시돼 있다.
  - 제안: 조치 불요(문서화·테스트 완비). 참고 사항으로 기록.

- **[INFO]** 트랜잭션 `.catch()` 의 error 로그 억제가 두 경로 모두에 추가됨 — 억제 범위를 직접 추적해
  다른 케이스를 삼키지 않음을 확인
  - 위치: `workflows.service.ts:289-293`(`if (err instanceof NotFoundException) throw err;`),
    `workspaces.service.ts:549-553`(동일 패턴)
  - 상세: 두 `.catch()` 블록 모두 이전에는 트랜잭션 실패를 무조건 `this.logger.error(...)`("수동 정리가
    필요하다")로 남겼다. 이제 `NotFoundException` 이면 로그 없이 재던지고 그 외에는 그대로 로그를
    남긴다. 이 억제가 **다른 정당한 실패까지 조용히 삼키지는 않는지** 직접 코드를 추적했다 — 워크플로
    트랜잭션 콜백 안에서 `NotFoundException` 을 던질 수 있는 곳은 이번에 추가된 `absent` 분기 하나뿐이고
    (`manager.remove` 는 TypeORM 자체 에러만 던진다), 워크스페이스 쪽도 마찬가지로 새 `absent` 분기가
    유일한 소스다 — `assertWorkspaceDeletable` 의 두 번째(잠금) 호출이 던질 수 있는 `NotFoundException`
    (`!workspace`)은, 이미 같은 트랜잭션이 `pessimistic_write` 로 그 행을 잠근 뒤라 도달 불가능해졌다
    (동일 커넥션이 이미 쥔 행이라 재조회가 사라짐을 볼 수 없다). 반대로 역할 변경으로 인한
    `ForbiddenException`(`OWNER_REQUIRED`)은 이 가드에 걸리지 않아 여전히 로그가 남는다(기존 동작
    유지, 회귀 아님). 운영 관측 관점에서는 이 두 경로에 대한 "수동 정리 필요" 오경보가 줄어드는
    의도된 side effect이며, 그 반대급부로 진짜 조사가 필요한 향후 `NotFoundException` 원인이 이 경로에
    새로 추가되면 로그 없이 삼켜질 잠재적 위험이 생긴다(현재는 해당 없음 — 위 추적대로 소스가 하나뿐).
  - 제안: 조치 불요. 다만 이 `.catch` 블록에 향후 새 예외 분기를 추가할 때는, `NotFoundException` 을
    조건 없이 필터링하고 있다는 사실(원인 특정이 아니라 타입 전체를 억제)을 유념할 것 — 새 개발자가
    이 헬퍼를 확장하며 무관한 `NotFoundException` 소스를 추가하면 로그가 조용히 사라질 수 있다.

- **[INFO]** 신규 생성 파일은 모두 plan/review 산출물 또는 테스트 — 런타임 코드 경로의 예상치 못한
  파일시스템 부작용 없음
  - 위치: `plan/in-progress/dup-delete-audit.md`, `review/code/2026/09/20/20_06_26/**`,
    `review/consistency/2026/09/20/19_30_57/**`, `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts`
  - 상세: 전부 프로젝트 컨벤션(plan 라이프사이클·리뷰 산출물 저장 규칙)이 요구하는 위치에 정확히
    생성됐다. 신규 e2e 는 API 호출 + 직접 DB 커넥션(`pg.Client`)만 쓰고, 테스트가 만든 team
    workspace/사용자를 명시적으로 정리하지 않지만 — 같은 디렉터리의 다른 e2e 스펙들도 동일하게
    `createTeamWorkspace` 이후 별도 워크스페이스 삭제를 하지 않는 기존 관례이므로 이 diff 가 새로
    도입한 패턴이 아니다.
  - 제안: 조치 불요.

## 요약

핵심 변경은 `TriggerResourceReleasePort.lockParentAndListTriggerIds` 가 이미 잠그며 읽던 부모 행의
존재 여부를 버리지 않고 호출자에게 돌려주는 것이며, 이 반환 시그니처 변경의 유일한 두 소비처
(`WorkflowsService.remove`, `WorkspacesService.deleteWorkspace`)가 이번 diff 에서 함께 갱신됐음을
grep 으로 재확인했다 — 놓친 호출부·stale mock 없음. 두 삭제 경로 모두에 새로 추가된 "잠금 뒤 부모
부재 → 404 + 로그 억제" 분기는 동시 삭제 "패자" 요청의 응답 코드(워크플로 204→404, 워크스페이스
403→404)와 운영 error 로그 발생 여부를 의도적으로 바꾸는데, 둘 다 CHANGELOG·plan·신규 테스트로
문서화·검증되어 있고, 로그 억제 범위를 직접 추적한 결과 다른 정당한 실패 경로를 조용히 삼키지
않는다. 전역 상태·환경 변수·네트워크 호출·이벤트/콜백에 새로운 부작용은 없으며, 신규 파일은 전부
프로젝트 컨벤션이 요구하는 산출물이다. 저장소에 뮤테이션 잔여물도 없다(`git status --short` 확인).
Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

LOW
