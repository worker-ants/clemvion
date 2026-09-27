# 부작용(Side Effect) 리뷰

## 작업 트리 확인

리뷰 착수 시 `git status --short` — 이 세션 산출 디렉터리(`review/code/2026/09/27/14_20_00/`, untracked) 외 변경 없음. HEAD `1a9d9b414`. 저장소 파일에 아무것도 쓰거나 뮤테이션하지 않았다(정적 분석 + 호출부 grep 전수 확인만 수행).

## 발견사항

- **[INFO]** `omitUndefined` 시그니처에 `NotArray<T>` 교차 타입 제약 추가 — 컴파일 타임 전용, 런타임 무영향
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts` 함수 `omitUndefined` (diff 게이트 21-23)
  - 상세: `export function omitUndefined<T extends object>(obj: T & NotArray<T>): Partial<T>`. 배열이면 `T & never` = `never` 로 붕괴해 컴파일이 막힌다. 실제 호출부 6곳을 전수 확인(`grep -rn "omitUndefined(" codebase/backend/src`) — `folders.service.ts:75`, `triggers.service.ts:622`, `workflows.service.ts:249,260`, `nodes.service.ts:78`, `auth-configs.service.ts:247` — 전부 DTO 파생 객체(`rest`/`dto`/`settings`)를 넘기고 배열은 없다. 기존 호출자 중 이 제약으로 컴파일이 깨지는 곳이 없다.
  - 제안: 조치 불요.

- **[INFO]** `NodesService.update()` 반환 타입·런타임 응답 형태 변경 — `Promise<Node>` → `Promise<Omit<Node, 'workflow'>>`, `workflow` 관계 키를 실제로 응답에서 제거
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts` 함수 `update()` (diff 게이트 58 시그니처, 82-83 구조분해)
  - 상세: 유일한 내부 호출자는 `nodes.controller.ts:139`(`return this.nodesService.update(id, workspaceId, dto);`)뿐이고, `NodesService` 를 참조하는 파일 전수(`grep -rln "NodesService" codebase/backend/src codebase/backend/test`)에도 `.workflow` 를 소비하는 다른 내부 호출부는 없다. 다만 이 변경은 **관측 가능한 공개 API 응답 형태 변화**다 — `PATCH /api/nodes/:id` 를 직접 호출해 (선언되지 않았던) `workflow` 필드를 읽던 외부 클라이언트가 있었다면 그 필드가 사라진다. `NodeDto`/OpenAPI 에 애초에 없던 필드라 계약 위반은 아니며, CHANGELOG(`CHANGELOG.md` 게이트 40-41)에 명시적으로 문서화됐고 e2e(`patch-partial-body.e2e-spec.ts` 케이스 C: `expect(result).not.toHaveProperty('workflow')`)로 고정됐다.
  - 제안: 조치 불요 — 이미 문서화·테스트로 고정됨. 참고로만 남김.

- **[INFO]** `settings` 병합 가드를 `!== undefined` 에서 `!= null` 로 변경 — 명시적 `settings: null` 요청에 대한 동작이 "필드별 null=삭제" 규칙과 다르게 no-op 으로 남음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` 함수 `update()` (diff 게이트 257)
  - 상세: `omitUndefined(rest)` 쪽(게이트 249)은 `null` 을 그대로 통과시켜 "명시적 null = 값 지움"을 유지하지만, `settings` 병합은 `null` 을 걸러 아무것도 바꾸지 않는다 — 같은 메서드 안에서 필드에 따라 null 의미가 갈린다. 이는 새로 만든 불일치가 아니라 **고치기 전 동작(`{ ...(workflow.settings??{}), ...null }` = 원본 유지)을 그대로 보존**한 것이고, 주석(게이트 255-256)과 단위 테스트("settings: null 은 던지지 않고 저장된 설정을 그대로 둔다")·e2e B 가 그 의도를 명시적으로 고정한다. 이 비대칭 자체는 이번 PR 의 축이 아니라 사전에 존재하던 설계이므로 새 결함으로 보지 않는다.
  - 제안: 조치 불요 — 의도된 보존이며 회귀 테스트로 고정됨(이전 라운드 Critical 1 로 이미 지적·수정된 사안, `edd79ca40`).

- **[NONE]** `Object.assign(entity, omitUndefined(rest|dto))` — 기존에 이미 존재하던 in-place 엔티티 뮤테이션 패턴 유지, 두 번째 인자만 필터링 경유
  - 위치: `workflows.service.ts` `update()`, `nodes.service.ts` `update()`, `auth-configs.service.ts` `update()`
  - 상세: 세 곳 모두 `recordAudit`/audit 로그 호출은 `resourceId`·`workspaceId`·`userId` 등 식별자만 기록하고 `rest`/`dto` 내용을 로깅하지 않아(각 파일에서 `recordAudit` 호출부 확인), 이번 필터링 변경이 감사 로그 내용에 영향을 주지 않는다. `auth-configs.service.ts` 의 `configPatch`(비밀값 shallow-merge 경로)는 `rest` 구조분해에서 이미 제외돼 `omitUndefined` 필터와 상호작용하지 않는다(게이트 238-247).
  - 제안: 조치 불요.

- **[NONE]** 신규 e2e(`test/patch-partial-body.e2e-spec.ts`)의 네트워크·DB 부작용은 형제 e2e 파일과 동일한 관행
  - 위치: 파일 전체 `beforeAll`/`afterAll`
  - 상세: `process.env.E2E_BASE_URL` 폴백 읽기, `pg.Client` 연결은 `beforeAll`에서 생성·`afterAll`에서 `db.end()` 로 정리. 의도치 않은 외부 서비스 호출·전역 상태·정리 누락 없음.
  - 제안: 조치 불요.

- **[NONE]** 신규 단위 테스트(`workflows.service.spec.ts`·`nodes.service.spec.ts`·`auth-configs.service.spec.ts`)의 mock 은 `beforeEach` 로 매 테스트 재생성 — 테스트 간 공유 가변 상태 없음.

- **[NONE]** `CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/2026/09/27/13_50_41/**`, `review/consistency/2026/09/27/13_11_33/**` — 전부 문서·이전 리뷰 산출물이며 런타임 부작용 없음. 이전 라운드(`13_50_41`) 산출물 중 `RESOLUTION.md`(게이트 4, 10-13)가 리뷰 도중 관측된 공유 워크트리 뮤테이션(`nodes.service.ts` 일시적 `as unknown as` 캐스트)을 이미 보고·확인·원복 완료로 기록했고, 현재 `git status --short` 로 해당 파일이 HEAD 와 일치함을 재확인했다 — 재발 없음.

## 요약

이번 diff(누적 커밋 `52744b0cf`~`1a9d9b414`)는 부작용 관점에서 깨끗하다. `omitUndefined` 의 `NotArray<T>` 제약 추가는 컴파일 타임 전용이며 전 호출부(6곳)가 배열을 넘기지 않아 안전하다. `NodesService.update()` 의 반환 타입 축소 및 `workflow` 키 제거는 유일한 내부 호출자를 거쳐서만 소비되고, 공개 API 응답 형태가 바뀌는 지점(undeclared 필드 제거)이지만 이미 CHANGELOG·e2e 로 문서화·고정됐다. `settings` 병합의 `!= null` 가드는 이전 라운드에서 지적된 Critical(500 회귀)을 고치면서 "명시적 null = no-op"이라는 사전 존재 동작을 보존한 것으로, 필드별 null 의미 비대칭이 있으나 새로 만든 결함이 아니고 단위·e2e 로 고정돼 있다. 감사 로그·비밀값 shallow-merge 경로는 이번 필터링 변경과 상호작용하지 않는다. 신규 e2e·단위 테스트의 네트워크/DB/mock 사용도 기존 관행과 일치하며 공유 리소스 오염이 없다. 이전 라운드에서 관측·기록된 공유 워크트리 뮤테이션은 현재 시점 기준 완전히 원복돼 재발하지 않았다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

NONE
