# 요구사항(Requirement) 충족 검토 — 워크플로우 duplicate 가 nodes/edges 를 복사하지 않던 결함 수정

대상: `WorkflowsService.duplicate()` 재구현 (메타-only → 캔버스 전체 복제) + 관련 controller Swagger·unit·e2e·spec 변경.

## 발견사항

- **[INFO]** 존재확인이 트랜잭션 밖에서 수행돼, 그 사이 원본이 삭제되면 404 대신 "빈 캔버스 사본"이 조용히 생성될 수 있음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:233-236`
  - 상세: `const original = await this.findById(id, workspaceId);` (233-234행, 주석: "권한·존재 확인은 트랜잭션 밖에서") 이후 `this.dataSource.transaction(...)` 을 새로 연다(236행). 이 함수 호출과 트랜잭션 오픈 사이의 극히 좁은 창에서 동시 `DELETE /api/workflows/:id` 가 원본을 지우면, `container_id`/`edge` 는 FK CASCADE 로 함께 삭제되므로 트랜잭션 내부의 `manager.find(Node, {where:{workflowId:id}})`/`Edge` 조회는 단순히 빈 배열을 반환한다. `nodeRows.length > 0`/`edgeRows.length > 0` 가드(285·307행)가 빈 배열을 정상 케이스(빈 워크플로우 복제)와 동일하게 처리하므로, 이 레이스에서는 에러 없이 "빈 캔버스" 사본이 만들어진다 — 바로 이번 plan 이 고치려는 결함과 표면적으로 동일한 증상이 아주 좁은 동시성 창에서 재현될 수 있다는 뜻이다. 실무적 발생 확률은 극히 낮고(밀리초 단위 레이스), 이 저장소의 다른 서비스 메서드(`update`/`remove`)도 동일한 "밖에서 확인 후 조작" 패턴을 쓰므로 이 diff 가 새로 만든 위험 등급은 아니다.
  - 제안: 현재 설계(404 케이스에서 트랜잭션을 아예 열지 않는 성능상 이점)를 유지할 가치가 충분하므로 필수 수정으로 보지 않는다. 원한다면 트랜잭션 내부에서 `originalNodes.length === 0 && originalEdges.length === 0` 이고 별도로 workflow row 자체가 방금 삭제됐는지 재확인하는 가드를 추가하는 정도가 대안이나, 실익 대비 복잡도가 커 보류 권장.

- **[INFO]** `@BeforeInsert` 부재 가드 테스트가 `duplicate()`도 같은 전제에 기대고 있다는 사실을 제목에 반영하지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:263-264` (JSDoc: "manager.insert 는 @BeforeInsert hook·cascade 를 건너뛴다 — Node/Edge 엔티티에는 둘 다 없음(같은 전제를 고정하는 가드 테스트가 본 파일 하단에 있다).") ↔ 가드 테스트 자체는 `codebase/backend/src/modules/workflows/workflows.service.spec.ts:2222` (`describe('importWorkflow 전제 — Node/Edge 엔티티 @BeforeInsert 부재·cascade 메타데이터 가드 (W3c)', ...)`, 이번 diff 범위 밖의 기존 코드)
  - 상세: 실제로 이 가드 테스트는 `Node`/`Edge` 엔티티 자체를 검사하므로 `duplicate()`에도 그대로 유효하지만, describe 제목이 `importWorkflow` 만 언급해 신규 JSDoc 의 "본 파일 하단에 있다" 참조가 정확히 무엇을 가리키는지 찾기 번거롭다. 기능적 결함은 아니고 발견 가능성(discoverability) 문제일 뿐이다.
  - 제안: 필수는 아니지만, describe 제목을 "importWorkflow·duplicate 전제 — ..." 로 넓히면 참조가 명확해진다.

## 점검 관점별 확인 내역 (문제 없음 확인)

- **기능 완전성**: `duplicate()` 가 workflow 메타 + 전체 nodes/edges 를 한 트랜잭션으로 복제하도록 재구현됨. UUID 재발급(`randomUUID()`) → `idMap` → `containerId`/`toolOwnerId`/엣지 endpoint 재매핑까지 plan·spec 이 요구하는 전 범위를 구현.
- **엣지 케이스**: 빈 캔버스(0 노드) → insert 스킵(285·307행, 테스트로 확인), null `containerId`/`toolOwnerId` → `remap()` 이 `null` 유지, null `tags`/`settings` → `?? []`/`?? {}` 방어, 고아 엣지(FK CASCADE 상 이론상 불가능하지만) → `flatMap` 으로 skip. 전부 unit 테스트로 커버됨.
- **TODO/FIXME**: 이번 diff 전체(`git diff` 23개 파일)에 TODO/FIXME/HACK/XXX 신규 추가 없음(grep 확인).
- **의도-구현 일치**: `duplicate()` JSDoc·controller `@ApiOperation.description`·plan 서술·spec 서술 4곳이 모두 "노드·엣지 포함 캔버스 전체 복제, UUID 재발급/재매핑, 버전 이력/트리거/데이터셋/실행이력 제외, current_version=1 재시작" 을 동일하게 진술하고 실제 코드와 line-level 로 일치.
- **에러 시나리오**: 원본 미존재/타 워크스페이스 → `findById` 가 `NotFoundException({code:'RESOURCE_NOT_FOUND'})`, 트랜잭션 미오픈(unit 테스트로 확인: `mockDataSource.transaction` not called). 이 외 DB 제약 위반 등은 트랜잭션 내부 예외로 자동 rollback — 기존 `create()`/`importWorkflow()`/`saveCanvas()` 와 동일한 컨벤션.
- **데이터 유효성**: 이번 엔드포인트는 요청 바디가 없고(`id`/`workspaceId`/`userId` 만 파라미터), 신규 DTO 도입 없음 — 추가 검증 대상 없음.
- **비즈니스 로직**: "복제 범위 밖"(버전 이력·trigger·workflow_test_dataset·실행 이력)·"import 게이트(라벨 중복 409·reserved 변수명·`applyConfigDefaults`·기본 LLM 주입) 미적용" 두 규칙이 정확히 코드에 반영되고 각각 전용 unit 테스트(`import 전용 게이트를 적용하지 않는다`, `버전 이력을 승계하지 않는다`)로 고정됨.
- **반환값**: `Promise<Workflow>` 모든 경로에서 충족 — 미존재 시 예외(정상적 에러 경로), 존재 시 `savedCopy` 반환. 컨트롤러 `WorkflowDto` 래핑과 e2e 응답 필드(`id`/`name`/`isActive`/`currentVersion`) 일치 확인(`workflow-response.dto.ts:41`).
- **spec fidelity (line-level)**: `spec/data-flow/11-workflow.md` §1.5 표 행·§2.1 Postgres 표 3개 신규 행(`workflow`/`node`/`edge` 복제)·Rationale 2개 절과, `spec/2-navigation/1-workflow-list.md` §2.6/§3 API 표를 코드와 대조 — 컬럼 집합·기본값(`is_active=false`, `current_version=1`)·재매핑 대상(`container_id`/`tool_owner_id`/엣지 endpoint)·범위 제외 목록이 전부 일치. 두 spec 문서는 이번 변경과 **같은 커밋 계열**에서 함께 갱신됐고(코드가 spec 을 추월한 SPEC-DRIFT 상황이 아님), 사전에 2라운드 5-체커 consistency-check(BLOCK:NO, Critical/Warning 0→WARNING 1(즉시 반영))가 이미 이 정합성을 검증했다. 직접 재검증한 결과도 CRITICAL 급 불일치 없음.
- **기타 검증**: `npx eslint`(4개 변경 파일) 무경고, `npx jest workflows.service.spec.ts` 76/76 통과(신규 11건 포함), e2e 스펙은 로컬에 DB 컨테이너가 없어 `getaddrinfo ENOTFOUND postgres` 로 실패했으나 이는 TS 컴파일 이후 런타임 연결 실패이므로 타입/구문 오류 없음을 방증(`ts-jest` 가 기본으로 타입체크를 수행하는 설정임을 `jest.config.ts`/`tsconfig.json` 로 확인).

## 요약

`WorkflowsService.duplicate()` 를 트랜잭션 기반 "메타 + nodes/edges 전체 복제 + UUID 재매핑" 으로 재구현한 변경으로, 의도한 기능(캔버스 전체 복제)을 완전히 구현했고 엣지 케이스(빈 캔버스, null 참조, 고아 엣지 방어)·에러 시나리오(404/트랜잭션 미오픈)·비즈니스 규칙(import 게이트 미적용, 버전 이력 비승계)이 모두 코드·테스트·spec 3곳에서 일관되게 반영돼 있다. `spec/data-flow/11-workflow.md`·`spec/2-navigation/1-workflow-list.md` 와 line-level 대조에서 CRITICAL 급 불일치를 발견하지 못했으며(두 spec 문서가 코드와 같은 변경 묶음으로 갱신돼 SPEC-DRIFT 도 아님), TODO/FIXME 류 미완성 표식도 없다. eslint/jest 직접 재실행으로 타입·lint 통과를 재확인했다. 발견된 두 건은 모두 INFO 등급(존재확인-트랜잭션 분리로 인한 극저확률 레이스, 가드 테스트 제목의 discoverability)으로 기능적 결함이 아니며 수정을 막을 이유가 없다.

## 위험도

LOW
