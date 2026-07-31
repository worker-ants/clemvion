# 요구사항(Requirement) 충족 검토 — workflow duplicate 캔버스 복제 재구현 (2차 라운드: RESOLUTION 검증)

대상: `WorkflowsService.duplicate()` 재구현(메타-only → 캔버스 전체 복제) 자체는 이전 라운드
(`review/code/2026/07/30/17_54_27`)에서 이미 검토됨(Critical 0 · requirement 관점 INFO 2건).
본 라운드는 그 SUMMARY 의 Warning 7건 + 요청 INFO 3건(#4/#5/#7)을 조치한 `RESOLUTION.md` 가
실제로 코드에 반영됐는지 **직접 재검증**하고, 새로 추가된 커밋·문서(CHANGELOG/ui-tour/plan
체크리스트/RESOLUTION 계열 산출물)가 요구사항 충족·spec 일치를 훼손하지 않는지 점검했다.

## 검증 방법

`git log`/`git show` 로 개별 fix 커밋(`a7ab2750a`, `0cb0ac86d`, `6d3595319`, `e782bb829`,
`d98acd850`, `8783c63d8`, `e66bbb9c1`, `0ab87ac3f`) 전부를 diff 로 직접 열어 RESOLUTION.md 의
서술과 대조했고, 현재 `workflows.service.ts`/`workflows.service.spec.ts`/
`workflow-crud.e2e-spec.ts` 를 Read 로 열어 실제 코드 상태를 확인했다. `npx jest
src/modules/workflows/workflows.service.spec.ts` 및 `npx jest --testPathPatterns='workflows'`
를 직접 실행해 테스트 통과 여부와 RESOLUTION.md 의 수치 주장을 실측 재현했다. `spec/data-flow/
11-workflow.md`·`spec/2-navigation/1-workflow-list.md`·`spec/2-navigation/_product-overview.md`
(NAV-WF-04) 를 Read 로 열어 spec 본문과 코드를 line-level 로 재대조했다.

## 발견사항

- **[WARNING]** `RESOLUTION.md` 의 테스트 검증 수치 주장이 실제 실행 결과와 불일치("단독" 표현 오류)
  - 위치: `review/code/2026/07/30/17_54_27/RESOLUTION.md:55`, `:74-76`
  - 상세: `:55` "반영 후 76/76(→137/137, WARNING #5 fixture 포함 후) 그대로 통과", `:74-76`
    "unit : 통과 — ... `workflows.service.spec.ts` 단독 137/137." 라고 명시적으로 "단독"(standalone,
    이 파일 하나만 실행한 결과)이라 주장한다. 직접 재현한 결과:
    - `npx jest src/modules/workflows/workflows.service.spec.ts` → **77/77** (파일 내 `it(` 개수도
      grep 으로 77개 확인 — 이 파일 "단독" 실행의 진짜 수치).
    - `npx jest --testPathPatterns='workflows'` (workflows 모듈 디렉토리의 5개 spec 파일:
      `workflow-channel-authorizer.spec.ts`/`workflow-ownership.util.spec.ts`/
      `workflows.controller.spec.ts`/`workflows.service.spec.ts`/
      `dto/workflow-dto-validation.spec.ts` 합산) → **137/137**.
    - 즉 "137" 은 실재하는 숫자이고 그 137건도 전부 통과하지만, 이는 `workflows.service.spec.ts`
      "단독" 이 아니라 **workflows 모듈 전체 5개 스펙 파일의 합산**이다. "단독" 표현이 정확했다면
      77 이어야 한다. 기능적으로는 두 실행 모두 GREEN 이라 실제 회귀는 없으나(오히려 더 넓은 범위를
      검증했다는 점에서 검증 자체는 더 엄격했다), 리뷰·resolution 감사 문서가 자신이 실행한 검증의
      **스코프를 스스로 잘못 기술**하고 있어 이후 이 문서를 근거로 "이 파일만 재실행해도 137 이
      나와야 한다"고 오인할 소지가 있다.
  - 제안: `:76` "`workflows.service.spec.ts` 단독 137/137" 을 "`workflows.service.spec.ts` 단독
    77/77(+ 인접 workflows 모듈 스펙 4개 포함 137/137)" 등으로 정정. 코드 수정은 불필요 — 감사
    문서의 수치 정확성만 바로잡으면 된다.

- **[INFO]** 존재확인(`findById`)이 트랜잭션 밖에서 수행되는 TOCTOU 레이스는 이번 라운드에도 미해결로 남음(의도된 트레이드오프, carry-over)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:233-236`
  - 상세: 1차 라운드 requirement.md(INFO #1)·concurrency.md·database.md·security.md 가 공통으로
    지적한 "확인과 트랜잭션 오픈 사이 동시 삭제 시 빈 캔버스 사본 생성" 레이스는 이번 RESOLUTION 의
    조치 대상(Warning 7건)에 포함되지 않았고 실제로도 그대로다. `RESOLUTION.md`(`:88-89`)가 "INFO
    #2(메타-트랜잭션 타이밍)... 별도 트레이드오프라 미반영"이라고 명시적으로 밝혀 의식적 보류이며,
    발생확률이 매우 낮고(밀리초 단위 동시 삭제) `update()`/`remove()` 등 기존 메서드도 같은 패턴이라
    이번 diff 가 새로 만든 위험이 아니다. 요구사항 충족을 막는 결함은 아니다.
  - 제안: 현행 유지 가능. 엄격성이 필요해지면 `findById` 를 트랜잭션 내부 첫 쿼리로 이동하는 방안을
    후속 검토.

- **[INFO]** 동시 편집 중 복제(read-skew) 시나리오를 재현하는 통합/e2e 회귀 테스트는 여전히 부재
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts` (`describe('duplicate', ...)`),
    `codebase/backend/test/workflow-crud.e2e-spec.ts` (`it('C. ...')`)
  - 상세: WARNING #1 의 코드 수정(`REPEATABLE READ` 명시, 아래 확인 참조)은 완료됐지만, "실제로 동시
    `saveCanvas` 커밋이 끼어들 때 사본이 일관된 스냅샷을 읽는지"를 직접 검증하는 테스트는 추가되지
    않았다(mock 기반 unit 은 이 클래스의 버그를 구조적으로 재현할 수 없고, e2e 도 순차 실행만 검증).
    concurrency.md 도 이를 INFO(필수 아님)로 남겼다.
  - 제안: 필수는 아님. 현재는 코드 수정 자체(REPEATABLE READ)와 그 근거(동일 파일 `executions.service.ts`
    선례 재사용)로 충분히 방어됐다고 판단.

## 점검 관점별 확인 내역 (RESOLUTION 반영 후 재검증 — 문제 없음)

- **기능 완전성**: `duplicate()`(`workflows.service.ts:228-333`)가 workflow 메타 + 전체 node/edge 를
  `REPEATABLE READ` 트랜잭션(`:245`)으로 복제. Node 엔티티의 실제 컬럼(`id/workflowId/type/category/
  label/positionX/positionY/config/isDisabled/description/containerId/toolOwnerId`, 12개) 전부와
  Edge 엔티티의 실제 컬럼(`workflowId/sourceNodeId/sourcePort/targetNodeId/targetPort/type/condition`,
  `id` 제외 7개)이 `nodeRows`(`:289-302`)/`edgeRows`(`:309-326`)에 빠짐없이 매핑됨을 `node.entity.ts`/
  `edge.entity.ts` 원본과 직접 대조해 확인 — 누락 필드 없음.
- **엣지 케이스**: 빈 캔버스(`nodeRows.length > 0`/`edgeRows.length > 0` 가드, `:303`/`:327`), null
  `containerId`/`toolOwnerId`(`remap()`, `:281-282`), 원본 workflow 의 null `tags`/`settings`(`?? []`/
  `?? {}`, `:252`/`:254`) 전부 코드·테스트 양쪽에서 확인. 이번 라운드에 **대칭 가드 테스트가 신규
  추가**됨(`e782bb829`) — 기존엔 "target 만 없음" 케이스만 있었는데 "source 만 없고 target 은 있음"
  케이스(`workflows.service.spec.ts:683-704`)를 추가해 `if (!sourceNodeId || !targetNodeId)
  return []` 의 두 피연산자를 대칭 검증. fixture(`origNodes[1]`=Loop, `origNodes[3]`=Agent 만 남김 →
  e-1(trig→loop) 의 source 매핑 실패, e-2(loop→agent) 만 유효)를 직접 계산해 테스트 기대값(`edges`
  길이 1, `targetNodeId` = Agent)이 정확함을 확인 — vacuous 아님.
- **TODO/FIXME**: `git diff 71ce6c12b...HEAD -- codebase/` 전체에 TODO/FIXME/HACK/XXX 신규 추가 없음
  (grep 재확인).
- **의도-구현 일치**: JSDoc(`:216-227`)·controller `@ApiOperation.description`(`workflows.
  controller.ts:214-215`)·`CHANGELOG.md`(`:3-18`)·`ui-tour.mdx`/`.en.mdx`(더보기 메뉴 항목)·
  `spec/data-flow/11-workflow.md` §1.5·`spec/2-navigation/1-workflow-list.md` §2.6 여섯 곳 모두
  "노드·엣지 포함 캔버스 전체 복제, UUID 재매핑, 버전 이력/트리거/데이터셋/실행이력 비승계"를 동일하게
  진술하고 실제 코드와 일치. 이번 라운드에 처리된 comment 정밀화(`6d3595319`)도 확인: "본 파일
  하단" → "`workflows.service.spec.ts` 의 W3c 가드"(`:272-274`)로 구체화, W3c describe 제목이
  `importWorkflow·duplicate 전제`(`workflows.service.spec.ts:2267`)로 확장돼 실제로 duplicate 도
  참조하는 전제임이 명확해짐, `remap()` null 반환 사유 주석(`:278-280`) 추가.
- **에러 시나리오**: 원본 미존재/타 워크스페이스 → `findById` 의 `NotFoundException`, 트랜잭션 미오픈
  (`mockDataSource.transaction` not called, `workflows.service.spec.ts:706-713`). `@Roles('editor')`
  (`workflows.controller.ts:211`)로 인가 경계 유지 — RBAC 매트릭스(`spec/2-navigation/9-user-profile.md`
  §4.2, cross_spec.md 인용)와 일치.
- **비즈니스 로직**: "import 전용 게이트(라벨 중복 409·reserved 변수명·`applyConfigDefaults`·기본 LLM
  주입) 미적용"과 "버전 이력·트리거·테스트 데이터셋·실행 이력 비승계"가 전용 unit 테스트로 고정돼
  있고, `spec/data-flow/11-workflow.md` §1.5/§2.1/Rationale 과 line-level 로 일치.
- **반환값**: `Promise<Workflow>` 모든 경로에서 충족 — 미존재 시 예외, 존재 시 `savedCopy` 반환.
- **spec fidelity**: `spec/data-flow/11-workflow.md` §1.5(:137)·§2.1 표(:150,154,158)·Rationale
  (:240-282), `spec/2-navigation/1-workflow-list.md` §2.6(:105)/§3(:125), `spec/2-navigation/
  _product-overview.md:51`(`NAV-WF-04`, 실측 확인) 를 코드와 대조 — 컬럼 집합·기본값(`is_active=false`,
  `current_version=1`)·재매핑 대상·범위 제외 목록 전부 일치. `pending_plans:` 에도 본 plan 이 등재됨
  (`spec/2-navigation/1-workflow-list.md:13`, 직전 라운드 impl-prep WARNING 조치 확인). 코드가 spec 을
  추월한 SPEC-DRIFT 상황 아님 — 같은 changeset 안에서 spec 과 코드가 함께 갱신됨.
- **WARNING #1(동시성) 코드 반영 재확인**: `workflows.service.ts:245`
  `this.dataSource.transaction('REPEATABLE READ', async (manager) => {` 로 실제 적용됨을 직접 확인.
  판단 근거(`executions.service.ts:538-539` 의 동일 선례 — "단순 read 라 deadlock 위험 없음" 주석,
  재시도 로직 없음)도 `executions.service.ts` 원본을 직접 열어 사실임을 확인 — RESOLUTION 의 판단이
  근거 있는 결정임.

## 요약

`WorkflowsService.duplicate()` 는 캔버스 전체 복제라는 의도한 기능을 완전히 구현하며, 이전 라운드
Warning 7건(동시성 read-skew, 테스트 오염, Node/Edge 3중 중복 주석, e2e 과대 `it()`, OR 가드 mutation
사각지대, CHANGELOG 누락, user-guide 미동기화)과 요청받은 INFO 3건(#4/#5/#7)이 모두 실제 커밋에
반영됐음을 코드·테스트 직접 실행으로 재검증했다. 특히 요구사항 핵심인 REPEATABLE READ 격리 수준
적용(`:245`)과 엣지 OR 가드 대칭 테스트(`e782bb829`)를 직접 열어 판단 근거·비-vacuous 여부까지
확인했다. spec(`data-flow/11-workflow.md`, `2-navigation/1-workflow-list.md`) 과 line-level 불일치
없음, TODO/FIXME 없음, 반환값·에러 경로 전부 정의됨. 유일한 신규 발견은 `RESOLUTION.md` 자체의
테스트 검증 수치 서술 오류(`workflows.service.spec.ts` "단독 137/137" 주장 — 실측 재현 결과 파일
단독은 77/77, 137 은 workflows 모듈 5개 스펙 파일 합산)로, 코드 결함이 아니라 감사 문서의 표현
정확도 문제이며 실제 테스트는 (더 넓은 범위로) 전부 GREEN 이었다. 나머지 두 INFO(존재확인-트랜잭션
분리 레이스, read-skew 통합 테스트 부재)는 1차 라운드에서 이미 의도적 보류로 결정된 항목의
carry-over 이며 이번 라운드가 새로 만든 갭이 아니다.

## 위험도

LOW
