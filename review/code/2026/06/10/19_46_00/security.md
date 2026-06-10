# 보안(Security) Review

본 변경셋은 성능 백로그(perf #1·#2·#4·#5·#6·#7·#10·#14, frontend #3/#8) 리팩터링이다.
대부분 알고리즘·왕복 횟수 최적화이며 신뢰 경계나 인증 흐름을 변경하지 않는다.
프로덕션 코드 6파일(s3/dashboard/execution-engine/knowledge-base/system-prompt/
workflows + frontend 5파일)을 신규 인젝션 sink·시크릿·인가 변화·민감정보 노출
관점에서 점검했다.

## 발견사항

- **[INFO]** Dashboard 집계 쿼리의 `COUNT(*) FILTER (WHERE ...)` raw SQL 조각
  - 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts` `getSummary` (diff @@ -56,38)
  - 상세: 6쿼리를 2쿼리로 통합하며 `select`/`addSelect` 에 SQL 텍스트를 직접
    기술했다. 그러나 모든 동적 값(`:sevenDaysAgo`, `:fourteenDaysAgo`,
    `:completedStatus`, `:workspaceId`)은 TypeORM 파라미터 바인딩(`setParameters`
    /`where`)으로 전달되고, FILTER 절의 컬럼명·status enum 은 코드 상수다.
    문자열 보간된 사용자 입력이 없어 **SQL 인젝션 경로는 없다**. `workspaceId`
    는 호출 상위(컨트롤러/가드)에서 인가된 값으로 기존과 동일하게 사용된다.
  - 제안: 조치 불요. 향후 FILTER 절에 사용자 파생 컬럼/식을 넣게 되면 반드시
    파라미터화 유지.

- **[INFO]** S3 배치 삭제 `deleteMany` — 키를 SDK 명령에 직접 전달
  - 위치: `codebase/backend/src/common/services/s3.service.ts` `deleteMany`
  - 상세: `keys` 를 `DeleteObjectsCommand({ Delete: { Objects } })` 로 넘긴다.
    AWS SDK 가 키를 구조화 페이로드로 전송하므로 인젝션 표면이 아니며, 호출자
    (`knowledge-base.service.ts`)는 `kb.workspace_id` 로 스코프된 문서의 내부
    생성 `fileUrl`(`kb/<kbId>/<docId>/...`)만 전달한다 — 사용자 직접 제어 경로
    아님. 1000키/요청 청크 상한도 정상. 경로 탐색 위험 무관(S3 key 네임스페이스).
  - 제안: 조치 불요.

- **[INFO]** Workflow import 배치 insert — `randomUUID` 사전 생성 + `manager.insert`
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `importWorkflow`
  - 상세: `node:crypto`의 `randomUUID`(CSPRNG)로 노드 UUID 를 앱 측 사전 생성하고
    `manager.insert` 로 배치 삽입한다. (1) UUID 생성은 안전한 randomUUID 사용 —
    예측 가능 식별자 문제 없음. (2) `manager.insert` 가 `@BeforeInsert` hook·
    cascade 를 우회하는 점은 보안이 아닌 무결성 이슈인데, Node/Edge 엔티티에
    해당 hook 이 없음을 코드로 확인(grep 결과 0건) — 검증/새니타이징 hook 이
    우회되지 않는다. `containerIndex`/`toolOwnerIndex`/`sourceNodeIndex` remap 은
    범위 밖 인덱스를 기존과 동일하게 무시(undefined/skip)하므로 임의 노드 참조
    주입 불가. `workflowId` 는 트랜잭션 내 생성된 `savedWorkflow.id` 로 고정 —
    크로스 워크스페이스 참조 불가. config 는 기존과 동일한 `applyConfigDefaults`
    경유.
  - 제안: 주석에 명시된 대로 "향후 Node/Edge 에 검증 hook 추가 시 배열 save 로
    회귀" 규약을 지킬 것. 현 변경 자체는 안전.

- **[INFO]** Execution-engine rehydration 배치 조회 — `In(seenNodeIds)`
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  - 상세: per-node `findOne` N+1 을 `find({ where: { executionId, nodeId: In(...),
    status: COMPLETED } })` 단일 배치로 교체. `nodeId` 목록은 동일 execution 의
    로그에서 파생되고 `executionId` 로 스코프된다 — TypeORM 파라미터 바인딩이라
    인젝션 무관, 권한 경계(executionId) 불변. env 캐시(`resolveMaxNodeIterations`
    /`resolveParallelEngineFlag`)는 설정값 read-once 메모이즈로 시크릿·입력과 무관.
  - 제안: 조치 불요.

- **[INFO]** S3 명령 단위 실패 시 에러 메시지 warn 로깅
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`
    `remove` catch 블록
  - 상세: `Failed to batch-delete ... : ${err}` 로 에러 객체를 warn 로깅한다.
    S3 클라이언트 에러에는 엔드포인트/버킷명이 포함될 수 있으나 서버 로그 한정
    (클라이언트 응답으로 노출되지 않음)이고, best-effort 의미론상 KB 삭제는
    계속 진행된다. 자격증명·시크릿은 SDK 에러 메시지에 포함되지 않는다.
    기존 단건 catch-warn 과 동일 수준의 노출이라 회귀 아님.
  - 제안: 조치 불요. (서버 로그에 인프라 식별자가 남는 것은 기존 동작.)

- **[INFO]** 시크릿/자격증명 — 신규 하드코딩 없음
  - 위치: `s3.service.spec.ts`, `dashboard.service.spec.ts` 등 테스트
  - 상세: 테스트의 `accessKey: 'ak'`/`secretKey: 'sk'` 는 명백한 더미 mock 값이며
    프로덕션 코드는 `ConfigService.get('s3.accessKey'...)` 로 환경설정에서 읽는다
    (기존과 동일). 실제 시크릿 하드코딩 없음.
  - 제안: 조치 불요.

- **[INFO]** Frontend 정렬 메모이제이션 — 신규 sink 없음
  - 위치: `execution-store.ts` `selectSortedNodeResults`, `use-execution-events.ts`,
    `run-results-drawer.tsx`, `transform/preview.tsx`, `use-expression-context.ts`
  - 상세: WeakMap 캐시 기반 정렬 accessor 전환 + O(1) 인덱스 Map. `Date.parse`,
    배열 정렬/필터만 추가되고 `dangerouslySetInnerHTML`·`eval`·DOM 직접 주입은
    없다. `nodeExecutionId` 는 기존 `sanitizeUuid` 경유 유지. XSS 신규 표면 없음.
  - 제안: 조치 불요.

## 요약

본 변경셋은 성능 리팩터링으로, 새로운 사용자 입력 신뢰 경계·인증/인가 흐름·외부
명령 실행을 도입하지 않는다. Dashboard 의 raw SQL FILTER 조각, S3 배치 삭제, In()
배치 조회 모두 동적 값은 ORM/SDK 파라미터 바인딩으로 전달되어 인젝션 표면이 없다.
Workflow import 의 `manager.insert` hook 우회는 대상 엔티티에 검증 hook 이 부재함을
확인했고 UUID 는 CSPRNG(`randomUUID`)로 생성된다. 신규 하드코딩 시크릿·민감정보
응답 노출·암호화 약화는 발견되지 않았다. 모든 발견은 정보성(INFO)이며 차단 사유
없음. 단, `manager.insert` hook 우회는 향후 Node/Edge 에 보안 검증 hook 이 추가될
경우 회귀 위험이 있으므로 코드 주석의 규약 준수가 필요하다(비차단 후속).

## 위험도

NONE
