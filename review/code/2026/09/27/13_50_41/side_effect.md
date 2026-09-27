# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 리뷰 도중 공유 워크트리에서 `nodes.service.ts` `update()` 가 리뷰 대상 diff 와 다른 내용으로 **일시적으로 미커밋 변경된 상태**를 관측함 (현재는 원복됨 — 아래 타임라인 참고)
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts` — 함수 `NodesService.update()` (git 상 당시 uncommitted modification, gate 번호 없음 — 프롬프트의 diff 는 해당 안 됨)
  - 상세(타임라인):
    1. 리뷰 착수 중 `git status --short` 로 확인한 결과 이 파일이 `M`(수정, 미커밋)으로 잡혔다.
    2. `git diff` 로 대조하니, 커밋된 버전(=프롬프트에 실린 이번 리뷰 대상 diff)은
       ```ts
       const { workflow: _workflow, ...response } = saved;
       return response;
       ```
       인데 그 시점 워킹트리는
       ```ts
       return saved as unknown as Omit<Node, 'workflow'>;
       ```
       로 바뀌어 있었다. 이 두 코드는 **타입 시그니처는 같지만 런타임 동작이 다르다** — `as unknown as` 캐스트는 타입 체커만 속일 뿐 `saved` 객체에서 실제로 `workflow` 키를 제거하지 않는다. 이 상태로 커밋됐다면 이번 PR 이 고치려는 바로 그 결함(`PATCH /nodes/:id` 응답에 IDOR 검사용 `workflow` 관계 전체가 통째로 실리는 정보 노출)이 타입 체크는 통과한 채 **조용히 되살아났을 것**이다.
    3. 리포트 작성 직전 재확인(`git diff codebase/backend/src/modules/nodes/nodes.service.ts`, `git status --short`)한 결과 이 파일은 다시 HEAD 와 완전히 일치한다(diff 없음) — destructuring 버전으로 원복돼 있다.
  - 이 변경은 이 리뷰 세션이 만든 것이 아니다 — 이 세션은 `Read`/`Bash`(읽기 전용 `grep`/`sed -n`/`git status`/`git diff`)만 사용했고 이 파일에 `Write`/`Edit` 을 쓴 적이 없다. 병렬 fan-out 리뷰 중 다른 세션(다른 리뷰어 또는 같은 워크트리를 쓰는 다른 프로세스)의 뮤테이션 검증이 진행 중이었고 이미 `cp` 로 원복까지 끝난 것으로 보인다. 규약에 따라 이 파일을 직접 고치거나 `git checkout`/`restore` 로 되돌리지 않았다.
  - 제안: 지금은 clean 하지만, 이 changeset 을 최종 커밋/push 하기 직전에 한 번 더 `git status --short`·`git diff` 로 이 파일이 destructuring 버전(HEAD)과 일치하는지 확인해 두는 것을 권한다. 같은 워크트리를 동시에 쓰는 다른 세션이 있다는 신호이므로, 최종 반영 직전 재확인 없이 "이전에 확인했으니 됐다"고 넘기지 않는 편이 안전하다.

- **[INFO]** `NodesService.update()` 반환 타입 시그니처 변경 — `Promise<Node>` → `Promise<Omit<Node, 'workflow'>>`
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts` 함수 `update()` 시그니처 (diff 게이트 58)
  - 상세: 호출부를 전수 확인(`grep -rn "nodesService.update" codebase/backend/src`)한 결과 유일한 호출자는 `nodes.controller.ts:139` (`return this.nodesService.update(id, workspaceId, dto);`) 뿐이고, 그 반환값은 별도 타입 단언 없이 그대로 HTTP 응답으로 전달된다. 전역 `ClassSerializerInterceptor` 는 등록돼 있지 않고(`app.module.ts` 는 `TransformInterceptor`/`LoggingInterceptor` 만 `APP_INTERCEPTOR` 로 등록), `TransformInterceptor` 는 `'data' in obj` 여부만 보고 `{ data }` 로 감싸므로 `Node` 클래스 프로토타입 상실(구조분해로 plain object 가 됨)이 직렬화 결과에 영향을 주지 않는다. 따라서 (파일이 destructuring 버전으로 유지되는 한) **런타임 영향은 없고**, `PATCH /api/nodes/:id` 응답에서 `workflow` 키가 사라지는 것은 CHANGELOG·plan 문서에 명시된 의도된 수정이다. 다만 이 필드는 `NodeDto` 에 선언된 적이 없던 undocumented 필드였으므로, 혹시 이 필드에 의존한 외부(API 직접 호출) 클라이언트가 있었다면 그 클라이언트 입장에서는 API 응답 형태가 바뀌는 것이 맞다 — plan 문서가 "FE `updateNode` API 클라이언트 함수는 정의만 있고 호출처가 없다"고 이미 조사해 뒀다.
  - 제안: 조치 불요(이미 조사·문서화됨).

- **[INFO]** `omitUndefined` 헬퍼 시그니처에 `NotArray<T>` 타입 제약 추가 — 컴파일 타임 전용, 런타임 무영향
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts` 함수 `omitUndefined` 시그니처 (diff 게이트 17-19)
  - 상세: `export function omitUndefined<T extends object>(obj: T & NotArray<T>): Partial<T>` 로 좁아졌다. 5개 호출부(`folders.service.ts`, `triggers.service.ts`, `workflows.service.ts` 2곳, `nodes.service.ts`, `auth-configs.service.ts`)를 전수 확인했고 모두 최상위 인자가 객체 타입(DTO 인스턴스 또는 `Partial<Entity>` rest)이지 배열이 아니므로 `NotArray<T>` 가 `never` 로 붕괴하는 호출부는 없다 — 컴파일 브레이크 없음, 런타임 동작도 배열이 아닌 정상 입력에 대해 동일. 새 유닛 테스트가 `@ts-expect-error` 로 이 제약 자체를 검증한다.
  - 제안: 조치 불요.

- **[INFO]** e2e 신설 파일의 네트워크·DB 부작용은 기존 패턴과 일치
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts` 함수 `beforeAll`/`afterAll`
  - 상세: `process.env.E2E_BASE_URL` 폴백 방식, `pg.Client` 연결/종료, `registerAndLogin`/`createTeamWorkspace` 헬퍼 사용이 형제 e2e 파일들과 동일한 관행이다. 의도치 않은 외부 서비스 호출이나 정리 누락은 관찰되지 않았다(`afterAll` 에서 `db.end()` 호출 확인).
  - 제안: 조치 불요.

- **[INFO]** 신규 서비스 단위 테스트의 mock 은 `beforeEach` 로 매 테스트 재생성 — 테스트 간 상태 오염 없음
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts`, `codebase/backend/src/modules/nodes/nodes.service.spec.ts`, `codebase/backend/src/modules/workflows/workflows.service.spec.ts` 각 파일의 `describe('...보내지 않은 필드', ...)` 블록
  - 상세: 세 파일 모두 `beforeEach` 안에서 서비스·mock 저장소를 새로 만들므로, 새로 추가된 테스트가 `service.create(...)` 로 레코드를 만들거나 `mockRepository.save.mock.calls` 를 읽어도 다른 테스트에 전이되는 공유 가변 상태가 없다.
  - 제안: 조치 불요.

- **[NONE]** `Object.assign(entity, omitUndefined(rest))` 패턴 — 기존에 이미 존재하던 in-place 엔티티 뮤테이션 패턴을 그대로 유지, 두 번째 인자만 필터링을 거치도록 바뀜. `recordAudit` 호출부(workflows/auth-configs 공통)는 `dto`/`rest` 내용이 아니라 `resourceId` 등 식별자만 로깅하므로 이 변경으로 감사 로그 내용이 달라지지 않는다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `update()`, `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` `update()`
  - 제안: 조치 불요.

- **[NONE]** `CHANGELOG.md`, `plan/in-progress/*.md`, `review/consistency/2026/09/27/13_11_33/*` — 전부 문서성 변경(이미 존재하는 이전 consistency-check 세션의 산출물 포함)으로 런타임 부작용 없음.

## 요약

리뷰 대상 diff 자체(커밋된 코드)는 부작용 관점에서 깨끗하다 — `omitUndefined` 시그니처 강화는 컴파일 타임 전용이고 전 호출부가 안전하며, `NodesService.update()` 반환 타입 축소는 유일한 호출자(컨트롤러)를 통해서만 소비되고 전역 직렬화 인터셉터가 없어 런타임 영향이 없다. e2e/유닛 테스트의 네트워크·DB·mock 사용도 기존 관행과 일치한다. 유일하게 눈에 띈 이상 신호는 코드 자체가 아니라 리뷰 도중의 실행 환경이었다 — 공유 워크트리의 `nodes.service.ts` 가 한때 `workflow` 필드를 실제로는 벗기지 않는 `as unknown as` 캐스트로 미커밋 변경돼 있었으나(다른 병렬 세션의 산출물로 추정), 리포트 작성 시점 재확인 결과 이미 destructuring 버전으로 원복되어 현재는 HEAD 와 완전히 일치한다. 최종 커밋/push 직전 한 번 더 `git status`로 clean 함을 재확인할 것을 권한다.

## 위험도

LOW — diff 자체엔 결함이 없다. 리뷰 중 관측한 워크트리 오염은 리포트 작성 시점 기준 이미 원복돼 있으나, 병렬 세션이 같은 파일을 건드렸다는 사실 자체가 최종 커밋 전 재확인을 요하는 신호라 WARNING 항목으로 남긴다.
