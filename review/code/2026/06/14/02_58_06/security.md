# 보안(Security) 리뷰

## 발견사항

### [INFO] SQL 인젝션 방어 — getSortColumn whitelist 패턴 확인
- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts`, `getSortColumn` 메서드 (라인 2011-2018)
- 상세: `sort` 파라미터를 allowed 딕셔너리에서 룩업 후 `w.${sortColumn}` 형태로 QueryBuilder 에 주입한다. whitelist 에 없는 값은 `'created_at'` 로 폴백해 SQL 인젝션 경로가 차단된다. `last_run` 분기는 완전 고정 리터럴 subquery 를 사용하므로 사용자 입력이 SQL 문자열에 전혀 반영되지 않는다.
- 제안: 현 구조 유지. `w.${sortColumn}` 패턴 자체가 whitelist 통과 후 사용되므로 injection 위험 없음. 향후 컬럼이 추가될 때 `allowed` 딕셔너리에만 추가하도록 가이드 주석을 유지할 것.

### [INFO] order 방향 파라미터 — 이진 강제 처리
- 위치: `workflows.service.ts` 라인 1439-1440
- 상세: `order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'` 패턴으로 사용자가 임의 문자열을 `order` 에 넣어도 `'ASC'` 또는 `'DESC'` 두 값 중 하나로만 강제된다. SQL 인젝션 위험 없음.
- 제안: 현 구조 유지.

### [INFO] correlated subquery — 고정 리터럴 확인
- 위치: `workflows.service.ts` 라인 1445-1448
- 상세: `(SELECT MAX(e.started_at) FROM execution e WHERE e.workflow_id = w.id)` 는 완전한 고정 SQL 리터럴로, 사용자 입력(`sort === 'last_run'` 판단 후 조건 진입)이 쿼리 본문에 포함되지 않는다. TypeORM 이 해당 문자열을 ORDER BY 절에 그대로 삽입할 때 사용자 제공 데이터는 없다.
- 제안: 현 상태로 안전. 테이블/컬럼명이 바뀔 경우 이 고정 문자열을 상수로 분리하면 가독성·유지보수 개선.

### [INFO] 프론트엔드 정렬 파라미터 — 클라이언트 측 whitelist 확인
- 위치: `codebase/frontend/src/app/(main)/workflows/page.tsx`, `SORT_OPTIONS` 배열 및 queryFn 라인
- 상세: `SORT_OPTIONS` 상수 배열에서 `sort`/`order` 값을 추출해 서버로 전송한다. 사용자가 `<select>` 값을 임의로 조작해도 프론트엔드 `SORT_OPTIONS.find(o => o.key === sortKey)` 가 매핑 실패 시 파라미터를 전송하지 않는다. 최종 방어는 서버 `getSortColumn` whitelist 가 담당해 중복 방어 구조를 갖는다.
- 제안: 현 구조 유지.

### [INFO] 워크플로우 import — JSON.parse 비검증 처리
- 위치: `codebase/frontend/src/app/(main)/workflows/page.tsx`, `importMutation` 라인 2394-2398
- 상세: 클라이언트에서 파일 텍스트를 `JSON.parse(text)` 후 바로 `workflowsApi.importWorkflow(json)` 으로 전달한다. 클라이언트 측에서 파싱 결과의 구조를 검증하지 않지만, 서버 DTO 검증(노드 타입 whitelist, label unique 등)이 최종 방어선이다. 악의적인 JSON 파일을 로드해도 서버 검증을 우회할 수 없다. 단, 파싱 실패 시 unhandled rejection 이 `onError` toast 로 처리되어 에러 세부 내용이 노출되지 않는다.
- 제안: 현 구조로 보안상 문제 없음. UX 개선 목적으로 클라이언트 측 스키마 사전검증(zod 등)을 추가하면 서버 왕복 전에 명확한 에러 안내 가능.

### [INFO] 에러 메시지 — 민감 정보 노출 없음
- 위치: `workflows.service.ts` 전체
- 상세: `NotFoundException`, `BadRequestException`, `ConflictException` 에 포함되는 메시지는 코드(`RESOURCE_NOT_FOUND`, `DUPLICATE_NODE_LABEL`, `INVALID_VERSION_SNAPSHOT`, `GRAPH_VALIDATION_FAILED`)와 고정 문자열만 포함한다. 스택 트레이스, DB 오류 원문, 내부 쿼리 구조 등이 응답에 포함되지 않는다.
- 제안: 프로덕션 환경에서 NestJS 글로벌 예외 필터가 스택 트레이스를 억제하는지 확인 필요 (코드 범위 밖이지만 운영 설정 확인 권장).

### [INFO] 하드코딩된 시크릿 — 없음
- 위치: 리뷰 대상 파일 전체
- 상세: API 키, 비밀번호, 토큰, 인증서 등이 코드에 직접 포함된 사례 없음.

### [INFO] 인증/인가 — 컨트롤러 레이어 의존
- 위치: `workflows.service.ts` — `findAll`, `findById`, `saveCanvas`, `restoreVersion` 등
- 상세: 서비스 레이어는 `workspaceId`/`userId` 를 파라미터로 받아 처리하며, 인증·인가 가드는 컨트롤러·미들웨어 레이어에서 담당하는 구조다. 서비스 내에서 직접 권한 검사를 수행하지 않지만 이는 NestJS 의 일반적인 아키텍처 패턴이다. 리뷰 범위에 컨트롤러가 포함되지 않아 가드 적용 여부를 직접 확인할 수 없다.
- 제안: 컨트롤러에서 `@UseGuards(JwtAuthGuard)` 및 워크스페이스 멤버십 검증이 적용되어 있는지 별도 확인 권장.

### [INFO] 버전 복원 — 스냅샷 역직렬화 검증
- 위치: `workflows.service.ts` 라인 1767-1781, `restoreVersion` 메서드
- 상세: DB 에서 읽어온 `snapshot` 객체를 `saveCanvas` 로 넘기기 전에 `Array.isArray(snapshot.nodes)`, `Array.isArray(snapshot.edges)`, `typeof snapshot.name !== 'string'` 을 명시적으로 검증해 malformed snapshot 을 `BadRequestException` 으로 거부한다. 그러나 노드 배열 내 각 요소의 구조 검증(`SaveCanvasDto` 의 DTO 검증)은 `saveCanvas` 의 `validateManualTrigger`/`validateUniqueLabels` 에서만 이루어지며, 깊은 구조 검증은 TypeORM 저장 시점까지 지연된다. 관리 콘솔 등에서 DB 스냅샷이 직접 조작될 경우 이 경로가 우회될 수 있으나 이는 DB 접근 통제 영역이다.
- 제안: 현 구조에서 보안 위험 낮음. DB 스냅샷 컬럼에 대한 JSON schema 검증을 추가하면 방어 심도가 높아진다.

---

## 요약

이번 변경은 워크플로우 목록의 정렬 기능을 풀스택으로 추가한 것이다. 보안 측면에서 핵심 위험인 SQL 인젝션은 서버 `getSortColumn` whitelist + `order` 이진 강제 + `last_run` 완전 고정 subquery 세 겹으로 차단되어 있으며, 프론트엔드 `SORT_OPTIONS` 매핑이 추가적인 방어층을 구성한다. 하드코딩된 시크릿, XSS, 커맨드 인젝션, 경로 탐색 취약점은 발견되지 않았다. 에러 메시지에 민감 정보가 포함되지 않고, 인증/인가는 컨트롤러 레이어 의존 아키텍처로 서비스 내부는 정상 패턴이다. 전반적으로 보안 구현이 적절하며 주요 취약점은 발견되지 않았다.

---

## 위험도

NONE
