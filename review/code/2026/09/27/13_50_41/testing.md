# 테스트(Testing) 리뷰 — patch-omit-undefined

## 검증 방법

저장소 트리에서 직접 실행/뮤테이션 후 `cp` 로 즉시 원복(`git checkout`/`restore` 미사용). 판정 기준: HEAD `52744b0cf`.

- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 로 `omit-undefined.spec.ts` · `workflows.service.spec.ts` · `nodes.service.spec.ts` · `auth-configs.service.spec.ts` 4개 스펙 172개 전부 GREEN 확인(맨 `npx jest` 직접 호출은 워크스페이스 루트 모듈 해석 문제로 ESM 에러 — `package.json` `test` 스크립트가 쓰는 `node --experimental-vm-modules` 플래그가 필요했다).
- 뮤턴트 재현 2건(P1, N1) — 원본을 scratch(`/private/tmp/.../scratchpad/*.orig`)에 `cp` 로 백업 후 저장소 파일을 직접 고쳐 재현, 확인 즉시 `cp` 로 원복. 두 경우 모두 plan(`plan/in-progress/patch-omit-undefined.md` §뮤턴트)의 예측·귀속과 실측이 일치했다:
  - **P1** (`Object.assign(workflow, rest)` 로 되돌림): `workflows.service.spec.ts` "보내지 않은 필드(undefined)로 로드한 값을 덮지 않는다" RED — `description`/`folderId`/`isActive`/`tags` 전부 `undefined` 로 관측. 주장대로 KILLED.
  - **N1** (`Omit<Node,'workflow'>` 스트립 제거, `return saved` 로 되돌림): `nodes.service.spec.ts` "응답에 IDOR 검사용 workflow 관계를 싣지 않는다" RED — `{"id":"wf-1","workspaceId":"ws-1"}` 가 `workflow` 키로 그대로 노출됨을 관측. KILLED.
  - 두 재현 모두 원복 후 `git status --short`/`git diff --stat` 로 클린 확인.
- controller 3곳(`workflows.controller.ts:194`, `nodes.controller.ts:139`, `auth-configs.controller.ts:132`) 을 직접 읽어, 서비스가 DTO **인스턴스**를 그대로 받는다는 전제(단위 테스트가 `new UpdateXxxDto()` 인스턴스를 넘기는 근거)를 대조 확인 — 실제 프로덕션 경로와 일치.
- `WorkflowSettingsDto` 정의 확인 — `maxConcurrentExecutions?: number` 단일 필드, "빈 settings" 테스트가 실제 클라이언트가 보낼 수 있는 형태(`{}` → 인스턴스 필드 전부 undefined)를 정확히 재현함을 확인.
- `auth-configs.service.spec.ts` 의 mock repo 가 in-memory `Map` 기반 fake(`save` 가 실제로 값을 저장하고 `findOne` 이 조회)라는 점을 확인 — 순수 stub 보다 실제 동작에 가깝다.

## 발견사항

- **[INFO]** e2e 케이스 C 의 `toolOwnerId` 가 가르지 않는 fixture
  - 위치: `codebase/backend/test/patch-partial-body.e2e-spec.ts` 케이스 C (`it('C. 노드 — …')`), `keys` 배열에 `'toolOwnerId'` 포함
  - 상세: 케이스 C 는 `child` 노드 생성 시 `description`·`containerId`·`positionX`·`positionY`·`isDisabled`·`config` 는 non-null/non-default 값으로 채워 결함(거짓 null·키 누락)을 실제로 가르지만, `toolOwnerId` 는 생성 바디에 전혀 설정하지 않는다. `CreateNodeDto`/`UpdateNodeDto` 는 `toolOwnerId?: string | null` 을 실제로 받으므로 다른 필드처럼 값을 채워 검증하는 것이 가능했다. 지금 상태에서는 `toolOwnerId` 가 결함이 있든 없든 저장값·응답값이 둘 다 `null` 이라 `pick` 비교가 항상 같아지고, plan 이 이 필드를 결함 대상으로 명시(`plan/in-progress/patch-omit-undefined.md` §실측 "…`toolOwnerId`…" — `NodeDto.toolOwnerId` 가 §5.4 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 동결 목록에 있음)했음에도 이 필드에 대해서는 회귀 보호가 실질적으로 비어 있다.
  - 제안: 케이스 C 의 `child` 생성 바디에 (예: `box` 를 `toolOwnerId` 로) 값이 있는 상태를 만들어 `toolOwnerId` 도 다른 필드처럼 discriminating 하게 만들거나, 가르지 못한다는 사실을 주석으로 남긴다.

- **[INFO]** 명시적 `null` (tri-state 의 "초기화") 경로가 이번 세 표면에서 단위·e2e 어느 쪽에도 없다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts`, `.../nodes/nodes.service.spec.ts`, `.../auth-configs/auth-configs.service.spec.ts` 의 "보내지 않은 필드" describe 블록들 / `codebase/backend/test/patch-partial-body.e2e-spec.ts`
  - 상세: 이 PR 이 근거로 드는 §5.4 tri-state(키 생략=불변·`null`=초기화·값=설정) 중 "키 생략" 경로만 새 테스트가 덮는다. `omitUndefined` 는 `null` 을 남기므로(JSDoc·헬퍼 스펙 1번째 케이스가 명시) `Object.assign(entity, omitUndefined(dto))` 에서 `dto.foo === null` 이면 여전히 엔티티 값을 `null` 로 덮어써야 하는데, 이번 세 서비스 어디에도 "명시적으로 `null` 을 보내면 실제로 지워진다" 를 확인하는 케이스가 없다(폴더·트리거 선례에서도 grep 상 동일한 공백 — 이 PR 이 새로 만든 갭은 아니고 기존 패턴을 그대로 따른 것). `nodes.service.ts` 의 `containerId`/`description` 처럼 nullable 로 광고된 필드가 실제로 "null 로 지우기" 요청에 반응하는지는 이번 회귀 스위트로 보장되지 않는다.
  - 제안: 필수는 아니나, 세 서비스 spec 중 최소 하나에 "명시적 null 은 로드한 값을 지운다" 캐너리를 추가해 두면 `omitUndefined` 의 "null 은 남긴다" 계약이 상위 서비스 레이어에서도 실제로 활용되는지(즉 `!== undefined` 필터가 `=== null` 요청까지 걸러버리는 회귀가 생기면)를 잡는다.

- **[INFO]** `omit-undefined.spec.ts` 의 배열 캐너리는 런타임 게이트가 아니라 문서화 목적임이 스스로 명시돼 있음 — 점검 결과 정확
  - 위치: `codebase/backend/src/common/utils/omit-undefined.spec.ts:49-58`
  - 상세: `@ts-expect-error` 는 `ts-jest`(`isolatedModules`) 하에서 타입 삭제되어 실행에 영향이 없고, 실제 가드는 `tsconfig.json` 이 spec 을 포함하는 build 단계 타입체크 ratchet 이라는 주석이 정확하다 — 직접 `NotArray` 제거 뮤턴트(T1, plan 표에 기재)를 재현하지는 않았지만 헬퍼 코드(`type NotArray<T> = T extends readonly unknown[] ? never : unknown`)와 주석 서술이 일치함을 확인했다. 별도 조치 불요, 정확성만 기록.

## 요약

세 서비스(workflows·nodes·auth-configs) 각각에 실제 요청과 동일하게 **DTO 인스턴스**를 넘기는 단위 테스트가 추가됐고, 세 도메인을 한 e2e 스펙(`patch-partial-body.e2e-spec.ts`)이 저장값(GET)→응답 값→응답 계약 순서로 단언해 계약 대조만으로는 못 잡는 거짓 null·키 누락을 실제로 가른다. 핵심 뮤턴트 2건(P1: 워크플로 `rest` 병합, N1: 노드 응답의 `workflow` 스트립)을 저장소에서 직접 재현해 plan 이 주장한 KILLED 판정과 실측이 일치함을 확인했고, 172개 관련 단위 테스트가 HEAD 에서 GREEN 이다. Mock 은 auth-configs 가 in-memory fake, workflows/nodes 가 save-identity mock 으로 실제 동작과의 괴리가 낮고, `jest.clearAllMocks()` 로 테스트 격리도 확보돼 있다. 남은 갭은 모두 INFO 급이다 — e2e 케이스 C 의 `toolOwnerId` 가 값이 채워지지 않아 가르지 못하는 fixture 라는 점, 그리고 §5.4 tri-state 중 "명시적 null → 초기화" 경로가 이번 세 표면 어디에도 새로 테스트되지 않았다는 점(단, 이는 폴더·트리거 선례에도 있던 기존 패턴이라 이 PR 이 새로 만든 결손은 아니다). CRITICAL/WARNING 급 결함은 발견하지 못했다.

## 위험도

LOW
