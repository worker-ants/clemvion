# 부작용(Side Effect) 리뷰 — dup-delete-audit (21_07_19)

## 검증 방법

- `grep -rn "lockParentAndListTriggerIds"` 로 backend 전체를 재조회 — 소비처는
  `workflows.service.ts:273`, `workspaces.service.ts:522` 두 곳뿐임을 직접 확인(누락 호출부 없음).
- `codebase/backend/src/modules/workflows/workflows.service.ts`, `workspaces.service.ts`,
  `trigger-resource-release.ts` 전체 파일을 `Read`로 열어 diff가 주장하는 분기·주석과 실제 코드가
  라인 단위로 일치하는지 대조.
- `git status --short` — 이번 세션 출력 디렉터리(`review/code/2026/09/20/21_07_19/`) 외 변경 없음.
  저장소 뮤테이션 없이 read-only로만 조사했다.

## 발견사항

- **[INFO]** 공유 포트 시그니처 변경(`Promise<string[]>` → `Promise<LockedParentTriggers>`)의 blast
  radius는 두 호출자로 완전히 닫혀 있다
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts` (`LockedParentTriggers`
    인터페이스, `TriggerResourceReleasePort.lockParentAndListTriggerIds` 선언), 구현
    `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`
    (`lockParentAndListTriggerIds`)
  - 상세: 이 포트는 `ModuleRef.get(..., { strict: false })` 로만 지연 해석되는 backend 내부 모듈
    경계 인터페이스이고, HTTP로 노출되지 않는다. 반환 계약이 `string[]` → `{ parentPresence:
    'present' | 'absent'; triggerIds: string[] }` 로 바뀌었지만, 유일한 구현체와 유일한 두 호출자
    (`WorkflowsService.remove`, `WorkspacesService.deleteWorkspace`), 관련 spec mock 3개
    (`trigger-resource-releaser.service.spec.ts`, `workflows.service.spec.ts`,
    `workspaces.service.spec.ts`) 전부가 같은 커밋들 안에서 함께 갱신됐음을 grep + Read로 직접
    재확인했다. 필드명도 첫 라운드에서 `parent`였다가(파라미터 `parent: TriggerParent`와 같은
    함수 안에서 충돌) 리뷰로 지적돼 `parentPresence`로 리네임된 뒤 전 호출부·인터페이스 JSDoc에
    일관되게 반영돼 있다 — 잔여 `parent:` 필드 사용처 없음.
  - 제안: 조치 불요.

- **[INFO]** 공개 API 부작용 — 동시 `DELETE` 요청 중 "패자"의 응답이 200/204(거짓 성공)에서
  404로 바뀜(의도된 수정, 스코프 안)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `remove()` 트랜잭션 내부
    `if (locked.parentPresence === 'absent') { throw new NotFoundException(...) }`, 대칭으로
    `codebase/backend/src/modules/workspaces/workspaces.service.ts` `deleteWorkspace()` 동일 분기.
  - 상세: 이 부작용이 이 PR의 목적 그 자체다 — 동시 DELETE 두 건 중 나중에 도착한 요청이 "이미
    지워진 부모"를 지운 척하며 `workflow.deleted`/워크스페이스 감사 행을 중복 기록하던 것을 막는다.
    트리거 삭제(spec 트리거 목록 §4.4 "동시 삭제: 두 번째는 404 RESOURCE_NOT_FOUND")의 기존 선례를
    그대로 확장한 것으로, e2e(`workflow-delete-concurrency.e2e-spec.ts`,
    `workspace-delete-concurrency.e2e-spec.ts`)가 `SELECT ... FOR UPDATE`로 실제 경합을 결정적으로
    재현해 응답 코드쌍(`[204,404]`/`[200,404]`)과 감사 행 수(1건)를 실측 고정했다. `.catch()`에
    새로 추가된 `if (err instanceof NotFoundException) throw err;` 가드는 **던지는 예외 자체를
    바꾸지 않는다** — 두 분기 모두 최종적으로 같은 `err`를 재던지며, 유일한 차이는 `this.logger.error`
    호출 여부다. 즉 호출자(컨트롤러)가 받는 예외/응답 코드에는 이 가드가 영향을 주지 않고, 서버
    로그(부작용의 일종)만 억제한다.
  - 제안: 조치 불요 — 의도된 스코프 안 변경이고 e2e로 판별력까지 확인됨.

- **[INFO]** 신규 파일 생성은 전부 프로젝트 컨벤션이 요구하는 plan/review 산출물 — 런타임 코드의
  예상치 못한 파일시스템 부작용 없음
  - 위치: `plan/in-progress/dup-delete-audit.md`, `review/code/2026/09/20/20_06_26/**`,
    `review/code/2026/09/20/20_43_03/**`, `review/consistency/2026/09/20/19_30_57/**`
  - 상세: 이번 diff에 새로 생성된 비-코드 파일은 모두 `CLAUDE.md` "정보 저장 위치" 표가 정한 경로
    (`plan/in-progress/<name>.md`, `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`,
    `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 정확히 놓여 있다. 애플리케이션 코드
    경로(`codebase/**`) 자체는 파일시스템에 쓰기 동작을 하는 어떤 로직도 추가하지 않았다.
  - 제안: 조치 불요.

- **[INFO]** (투명성 고지, 이번 diff의 결함 아님) 과거 리뷰 라운드 산출물(`review/code/.../database.md`)에
  "리뷰 도중 다른 세션이 워킹트리를 일시적으로 뮤테이션한 것을 관측했다"는 기록이 남아 있다
  - 위치: `review/code/2026/09/20/20_06_26/database.md` "환경 관측" 절 (해당 회차의 database
    reviewer가 `workflows.service.ts`가 일시적으로 `M`으로 표시된 것을 목격, 재확인 시 원상복구
    확인)
  - 상세: 이는 이번 diff가 만든 부작용이 아니라, 병렬 fan-out 리뷰 중 어느 세션의 뮤테이션 테스트가
    다른 세션의 관측 창에 잠깐 노출됐던 과거 사건의 기록이며, 이후 라운드(RESOLUTION.md들)가 명시한
    대로 원복 확인 후 종료됐다. 현재 세션에서 `git status --short`를 재확인한 결과 이 워킹트리에는
    이번 리뷰의 출력 디렉터리 외 어떤 잔여 변경도 없다 — 재발 아님.
  - 제안: 조치 불요. 다음 리뷰어가 이 기록을 보고 "지금도 진행 중인 오염"으로 오인하지 않도록
    과거형 기록임을 명시해 둔다.

## 요약

핵심 변경은 `TriggerResourceReleasePort.lockParentAndListTriggerIds`가 잠금 뒤 읽은 부모 행의
존재 여부(`parentPresence: 'present' | 'absent'`)를 더 이상 버리지 않고 호출자에게 돌려주는
반환 시그니처 확장이다. 이 인터페이스 변경의 소비처는 grep으로 재확인한 결과 두 곳
(`WorkflowsService.remove`, `WorkspacesService.deleteWorkspace`)뿐이며 관련 spec mock까지 전부
동기화돼 있어 시그니처 변경의 blast radius가 완전히 닫혀 있다. 동시 DELETE 패자의 응답이
200/204에서 404로 바뀌는 것은 이 PR의 의도된 목적이자 트리거 삭제 선례를 확장한 것이고, e2e로
판별력이 실측됐다. `.catch()`에 추가된 `NotFoundException` 조기 재던짐 가드는 실제로 던져지는
예외를 바꾸지 않고 오직 서버 error 로그(운영 부작용)만 억제한다. 신규 생성 파일은 전부 프로젝트가
정한 plan/review 산출물 경로에 있으며 런타임 파일시스템 부작용을 추가하지 않는다. 전역 변수 도입,
환경 변수 읽기/쓰기, 신규 네트워크 호출, 이벤트/콜백 발생 방식 변경은 발견되지 않았다. 과거 리뷰
라운드가 기록해 둔 "다른 세션의 일시적 워킹트리 뮤테이션 관측"은 이미 종료된 과거 사건이며 현재
워킹트리에는 잔여물이 없음을 재확인했다.

## 위험도

LOW
