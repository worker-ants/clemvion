# 보안(Security) 코드 리뷰

대상: `WorkflowsService.duplicate()` (nodes/edges 캔버스 전체 복제 재구현 + `REPEATABLE READ` 적용) +
`workflows.controller.ts`(Swagger 설명) + `workflows.service.spec.ts`/`workflow-crud.e2e-spec.ts`(테스트) +
CHANGELOG/ui-tour(ko/en) 문서 + `plan/in-progress/workflow-duplicate-nodes-edges.md` + spec 2건
(`spec/data-flow/11-workflow.md`, `spec/2-navigation/1-workflow-list.md`) + 이전 코드 리뷰/consistency-check
세션(`review/code/2026/07/30/17_54_27/**`, `review/consistency/2026/07/30/{16_45_59,17_03_26}/**`) 산출물이
저장소에 커밋되어 새로 추가된 것.

prompt 번들이 컨텍스트 예산으로 `workflows.service.ts`/`workflows.service.spec.ts`/
`workflow-crud.e2e-spec.ts`/`plan/**` 의 diff 를 생략했으므로, `git diff origin/main...HEAD` 와 `Read` 로
해당 파일들을 직접 열어 대조했다(아래 위치는 실제 소스 줄 번호).

## 발견사항

- **[INFO]** 인가(authorization) 확인과 트랜잭션 시작 사이 TOCTOU 데이터 일관성 갭 (권한 우회 아님)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:234`(`findById(id, workspaceId)`,
    트랜잭션 밖) ↔ `:245`(`this.dataSource.transaction('REPEATABLE READ', async (manager) => {...})`,
    트랜잭션 오픈)
  - 상세: `findById` 로 원본이 요청 워크스페이스 소속임을 확인한 뒤, 별도로 연 트랜잭션에서
    `manager.find(Node/Edge, { where: { workflowId: id } })`(`:263-268`)로 다시 조회한다. 확인 시점과
    트랜잭션 오픈 사이의 극히 좁은 창에서 원본이 동시 삭제되면(FK CASCADE) 조회가 빈 배열을 반환하고,
    `nodeRows.length > 0`/`edgeRows.length > 0` 가드(`:303`, `:327`)가 이를 정상적인 "빈 캔버스 복제"와
    동일하게 처리해 "메타만 있고 캔버스가 빈" 사본이 조용히 생성될 수 있다. 다만 `id` 는 이미
    `workspaceId` 스코프 검증(`findById`)을 통과한 뒤이므로 인가 우회나 교차 테넌트 데이터 접근으로
    이어지지 않는다 — 최악의 결과도 요청자 자신의 워크스페이스 안에서 벌어지는 극저확률 데이터
    일관성 저하일 뿐이다. `update()`(`:194-209`)·`remove()`(`:211-214`) 등 이 서비스의 다른 메서드도
    동일한 check-then-act 패턴을 쓰므로 이번 diff 가 새로 만든 위험 등급이 아니다. 이 창 자체는 이번
    diff 에서 이미 `REPEATABLE READ` 로 node/edge 두 SELECT 사이의 read skew(더 넓고 실질적인 문제)를
    닫았고, 남은 것은 그보다 훨씬 좁은 "존재확인 vs 트랜잭션 오픈" 사이 창이다.
  - 제안: 우선순위 낮음. 완전히 닫으려면 `findById` 를 같은 `REPEATABLE READ` 트랜잭션 내부에서 첫
    쿼리로 재실행하거나, 404 fast-path 이점을 유지하려면 현행대로 두고 트레이드오프를 주석에
    남기는 것으로 충분하다 — 필수 조치는 아니다.

- **[INFO]** `node.config`(JSONB) 를 검증·새니타이징 없이 그대로 복제 — 사용자가 노드에 직접 입력한
  시크릿 형태 값(예: HTTP 노드 커스텀 헤더에 수기 입력한 토큰)도 함께 복제됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:297`(`config: { ...node.config }`)
  - 상세: `http-request` 계열 노드는 `authentication: 'integration'` 참조 외에 `headers` 에 값을 직접
    입력하는 경로도 허용해, 자격증명이 `Integration` 엔티티 참조가 아니라 노드 `config` JSONB 안에
    리터럴로 존재할 수 있다. `duplicate()` 는 이를 그대로 사본에 복사한다. 다만 사본은
    `findById(id, workspaceId)` 로 이미 확인된 **동일 워크스페이스**에만 생성되고(`:255`
    `workspaceId,` — 요청 컨텍스트가 강제, 원본과 항상 일치), `createdBy`(`:256`)만 요청자로 바뀌므로
    테넌트 경계를 넘는 유출은 아니다 — "복제" 기능의 의도된 동작(캔버스 전체를 그대로 복사)과 일치.
    정보로만 기록.
  - 제안: 별도 조치 불필요. 다만 향후 "워크스페이스 간 템플릿 공유"·"다른 조직으로 복제" 같은 기능이
    추가될 경우, 이 무검증 config 복사 경로를 그대로 재사용하지 않도록 주의(그 시점엔 시크릿 redaction
    이 필요해짐).

## 검증한 항목 (문제 없음)

- **인가/IDOR**: `duplicate(id, workspaceId, userId)` 는 트랜잭션 진입 전 `findById(id, workspaceId)`
  (`workflows.service.ts:151-162`)로 원본이 요청 워크스페이스 소속인지 확인하고, 아니면
  `NotFoundException`을 던져 트랜잭션 자체를 열지 않는다. 새 워크플로우는 항상
  `workspaceId = original.workspaceId`(`:255`, 호출부에서 강제)로 생성되어 타 워크스페이스로
  유출되거나 교차 테넌트 자원을 참조할 수 없다. 컨트롤러(`workflows.controller.ts:209-229`)는
  `@Post(':id/duplicate')` + `@Roles('editor')`(`:211`) + `@Param('id', ParseUUIDPipe)`(`:225`, UUID
  형식 강제) + `@WorkspaceId()`(`:226`, 서버측 파생값·사용자 조작 불가)로 구성되어 다른 CRUD
  엔드포인트(`create`/`update`/`remove`)와 동일한 인가 패턴을 그대로 따른다. viewer 이하 권한으로는
  호출 불가.
- **SQL 인젝션**: 모든 DB 접근이 TypeORM `manager.find`/`manager.insert`/`manager.save` 파라미터
  바인딩을 사용한다(`workflows.service.ts:246-329`). 원시 SQL 문자열 보간 없음. 신규 e2e 검증 쿼리
  (`workflow-crud.e2e-spec.ts` `db.query('SELECT id FROM node WHERE workflow_id = $1', [dupId])`,
  `SELECT COUNT(*)::text ... WHERE workflow_id = $1`)도 `$1` 플레이스홀더로 파라미터화되어 문자열
  결합이 없음을 직접 확인했다.
- **ID 예측 가능성**: 신규 노드/엣지 ID 는 `node:crypto` 의 `randomUUID()`(`:7` import,
  `:276` 사용 — CSPRNG 기반 UUID v4)로 발급. 순차 ID·예측 가능한 값 없음.
- **참조 무결성/유령 참조 방지**: `remap()`(`:281-282`)이 `idMap` 에 없는 참조를
  `null`로 떨어뜨리고(`containerId`/`toolOwnerId`), 매핑 불가 엣지는
  `if (!sourceNodeId || !targetNodeId) return [];`(`:314`)로 insert 대상에서 아예 제외 — 원본의 내부
  UUID 가 사본에 잘못 노출되거나 존재하지 않는 노드를 참조하는 상태로 남지 않는다.
- **트랜잭션 원자성**: workflow row 생성부터 node/edge 배치 insert 까지 단일
  `dataSource.transaction('REPEATABLE READ', ...)`(`:245-332`) 안에서 처리되어 실패 시 부분 생성된
  사본이 남지 않는다(권한 확인만 트랜잭션 밖 — 위 INFO 참고). 이번 diff 로 두 SELECT(`originalNodes`/
  `originalEdges`) 사이의 read skew(동시 `saveCanvas()` 커밋과 겹치는 문제, 이전 라운드
  `concurrency.md` WARNING)도 `REPEATABLE READ` 명시로 해소됨을 확인했다 — 원본에 대한
  UPDATE/DELETE 는 수행하지 않아(`update`/`remove` mock 미호출을 unit 테스트로 확인) write-write
  충돌·데드락 가능성도 낮다.
- **`manager.insert` 의 hook/cascade 우회**: 주석(`:272-274`)과
  `workflows.service.spec.ts:2262` 의 `@BeforeInsert 리스너가 없다` 가드 테스트(원래 `importWorkflow`
  전용이었으나 이번 diff 로 "importWorkflow·duplicate 전제" 로 제목이 확장돼 `duplicate()` 도 명시적으로
  커버)로 Node/Edge 엔티티에 우회되는 보안 관련 lifecycle hook 이 없음을 확인.
- **import 전용 게이트 미적용의 의도**: `applyConfigDefaults`/기본 LLM 자동 주입/label 중복 409/
  reserved 변수명 검증을 duplicate 경로에 적용하지 않는 것은 "이미 저장 시점에 검증을 통과한 신뢰
  데이터의 재검증 불필요" 라는 명시적 근거(JSDoc `:219-223` + `spec/data-flow/11-workflow.md` 신설
  Rationale)가 있고, 유닛 테스트(`import 전용 게이트를 적용하지 않는다 — config defaults 재적용·기본
  LLM 주입 없음`)로 고정됨 — 기본 LLM 주입을 적용하면 원본이 의도적으로 비워둔 `llmConfigId` 를
  사본이 임의로 채우는 설정 변조가 되므로 오히려 이 설계가 타당하다.
- **에러 처리**: `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Workflow not found' })`
  (`workflows.service.ts:156-159`)는 워크스페이스 소속 여부와 무관하게 동일 메시지를 반환 — 리소스
  존재 자체를 다른 워크스페이스 사용자에게 노출하지 않는다(워크스페이스 열거 공격 방지). 스택
  트레이스·내부 쿼리·DB 에러 원문 등 민감 정보 노출 없음.
- **하드코딩된 시크릿**: `git diff origin/main...HEAD`(코드 diff 전체) 와 리뷰/문서 산출물 전체를
  `password|secret|api[_-]?key|BEGIN (RSA|PRIVATE|OPENSSH)` 패턴으로 grep — 매치 0건. 테스트
  픽스처의 `'wf-uuid-1'`, `'n-trig'`, `'user-uuid-2'` 등은 목(mock) 식별자이며, e2e 의 `ownerToken`
  은 테스트 헬퍼(`registerAndLogin`)가 매 실행 시 동적으로 발급한다.
- **의존성 보안**: 이번 diff 는 신규 npm 패키지를 추가하지 않는다(`node:crypto` 내장 모듈만 사용,
  `randomUUID` import 는 e2e 스펙에도 신규 추가되었으나 동일하게 내장 모듈).
- **비-코드 산출물(review/consistency 리포트, plan, spec, CHANGELOG, ui-tour MDX)**: 전부 실행되지 않는
  마크다운/JSON 설명 텍스트로, 시크릿·실행 가능 코드·사용자 입력 처리 로직을 포함하지 않는다. 이전
  코드 리뷰 세션(`17_54_27`) 자신의 `security.md` 산출물이 이번 diff 로 커밋되는데, 그 내용도 마찬가지로
  일반 서술뿐이며 민감정보 유출이 없다.

## 요약

이번 변경은 `WorkflowsService.duplicate()` 가 workflow 메타만 복제하던 결함을 고쳐 node/edge 그래프
전체를 `REPEATABLE READ` 트랜잭션으로 원자적으로 복제하도록 재구현한 것이다. 인가 경계(워크스페이스
스코프 `findById` + `@Roles('editor')` + `ParseUUIDPipe`)를 그대로 유지하면서 새 워크플로우를 항상
원본과 동일한 워크스페이스에만 생성하도록 강제해 IDOR·교차 테넌트 유출 가능성이 없고, 모든 DB
접근이 TypeORM 파라미터 바인딩(신규 e2e 검증 쿼리 포함)을 사용해 인젝션 벡터가 없으며, 신규 ID 는
CSPRNG(`randomUUID`)로 발급되고, 참조 재매핑 로직이 유령 참조·원본 UUID 유출을 방어적으로 차단한다.
import 전용 검증 게이트(기본 LLM 주입 등)를 의도적으로 건너뛰는 설계도 "이미 검증된 신뢰 데이터의
재검증 불필요 + 설정 변조 방지" 라는 타당한 근거가 있고 전용 유닛 테스트로 고정돼 있다. 하드코딩된
시크릿이나 새로운 의존성도 없으며, 함께 커밋되는 대량의 review/consistency 산출물·plan·spec·문서
파일은 비실행 텍스트라 보안 표면에 해당하지 않는다. 발견된 2건은 모두 정보성(INFO) — 존재확인과
트랜잭션 오픈 사이의 극히 드문 TOCTOU 데이터 일관성 갭(권한 우회 아님, 이미 `REPEATABLE READ` 적용
후 남은 더 좁은 창), 그리고 사용자가 노드에 직접 입력한 시크릿 형태 값이 (같은 워크스페이스 내에서만)
함께 복제된다는 점(의도된 "복제" 동작과 일치)이다. 두 항목 모두 즉시 조치가 필요한 취약점이 아니며,
이전 코드 리뷰 라운드(`17_54_27/security.md`)의 판정과 독립적인 직접 소스 대조로도 동일한 결론에
도달했다.

## 위험도

LOW
