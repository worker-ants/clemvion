# 보안(Security) 리뷰 결과

**대상**: execution §1.3 single-node execution (FRESH review — post-resolution)
**리뷰 일시**: 2026-06-15 15:29:28

---

## 발견사항

### [INFO] 인증/인가 — `@Roles('editor')` + 워크스페이스 스코핑 정상 적용
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `@Post(':id/nodes/:nodeId/execute')` 핸들러
- 상세: 신규 엔드포인트에 `@Roles('editor')` 가드가 적용되어 editor 이상 권한을 강제한다. `workflowsService.findById(id, workspaceId)` 로 워크플로우가 현재 워크스페이스에 속하는지 먼저 검증(없으면 404)하므로 IDOR 방지가 구조적으로 이루어진다. `@WorkspaceId()` + `@CurrentUser()` 데코레이터를 통한 JWT 파생 식별자를 사용하며 클라이언트가 임의로 주입할 수 없다. 기존 `execute` 엔드포인트와 동일 수준의 인가 체계를 유지하고 있다.
- 제안: 이상 없음.

### [INFO] 입력 검증 — UUID 파이프 + class-validator DTO 완비
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` (`@Param('id', ParseUUIDPipe)`, `@Param('nodeId', ParseUUIDPipe)`), `codebase/backend/src/modules/workflows/dto/execute-node.dto.ts`
- 상세: 경로 파라미터 `:id` 및 `:nodeId` 양쪽에 `ParseUUIDPipe` 를 적용하여 UUID 형식이 아닌 값은 파이프 단계에서 400 을 반환한다. 요청 본문 `ExecuteNodeDto` 는 `@IsOptional() @IsUUID()` (previousExecutionId), `@IsOptional() @IsObject()` (input) 로 class-validator 검증을 갖춘다. 빈 body 전송 시 두 필드 모두 optional 이라 정상 통과하며 이는 의도된 동작이다.
- 제안: 이상 없음.

### [INFO] IDOR 방지 — 노드·이전 실행의 워크플로우 소속 2중 검증
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `executeNode` 메서드 (노드 소속 검증 및 `previousExecutionId` 검증 블록)
- 상세: (1) 대상 노드가 해당 워크플로우에 속하는지 `nodeRepository.findOneBy({ id: nodeId, workflowId: id })` 로 검증한다. (2) `previousExecutionId` 가 제공된 경우 해당 실행이 동일 워크플로우에 속하는지 `executionRepository.findOneBy({ id: previousExecutionId, workflowId: id })` 로 추가 검증한다. 두 검증 모두 실패 시 `BadRequestException` 을 반환하며 타 워크플로우의 노드 출력 seed를 허용하지 않는다. 이는 타 워크스페이스 데이터를 seed 출처로 지정하는 Cross-resource seed 공격을 차단한다.
- 제안: 이상 없음.

### [INFO] SQL 인젝션 — ORM 파라미터 바인딩 사용, 직접 문자열 조합 없음
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: 모든 DB 조회는 TypeORM 의 `findOneBy`, `find` API 를 통해 파라미터 바인딩으로 처리된다. 마이그레이션 V098 은 DDL(ALTER TABLE ADD COLUMN) 만 포함하며 사용자 입력을 SQL 에 직접 삽입하는 코드는 존재하지 않는다. `getLatestPredecessorOutputs` 에서 `In(predecessorNodeIds)` 를 사용하는데, 이 역시 TypeORM ORM 방식이므로 SQL 인젝션 위험이 없다.
- 제안: 이상 없음.

### [INFO] XSS — 프론트엔드 노드 결과 렌더링
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` — `InfoTab` 결과 표시 블록
- 상세: 노드 실행 결과(`latestResult.outputData`, `latestResult.error`)를 `<pre>` 태그 내에 `JSON.stringify(latestResult.outputData, null, 2)` 및 `{latestResult.error}` (문자열) 형태로 렌더한다. React 는 JSX 표현식(`{}`)에서 자동으로 HTML 이스케이프를 수행하므로 XSS 위험이 없다. `dangerouslySetInnerHTML` 사용 없음.
- 제안: 이상 없음.

### [INFO] 하드코딩된 시크릿 — 없음
- 위치: 변경된 모든 파일 전체
- 상세: API 키, 비밀번호, 토큰, 인증서 등의 하드코딩된 시크릿이 변경된 파일 어디에도 존재하지 않는다. 테스트 파일의 `ownerToken` 은 e2e 테스트 환경의 동적 발급 토큰(변수 참조)이며 하드코딩된 credential 이 아니다.
- 제안: 이상 없음.

### [INFO] 커맨드 인젝션 / 경로 탐색 — 해당 없음
- 위치: 변경된 모든 파일 전체
- 상세: 변경된 코드에서 OS 커맨드 실행(`exec`, `spawn`, `child_process`)이나 파일 시스템 경로를 구성하는 코드가 없다. 신규 기능은 DB 조회 및 실행 엔진 호출에 한정된다.
- 제안: 해당 없음.

### [INFO] 에러 처리 — 민감 정보 노출 없음
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `BadRequestException` 응답 객체
- 상세: 400 에러 응답은 `{ code: 'NODE_NOT_IN_WORKFLOW', message: '...' }` 형태로 정해진 코드 및 비기술적 메시지만 포함한다. 스택 트레이스, DB 오류 세부 내용, 내부 ID 체계가 응답에 노출되지 않는다. 프론트엔드 `handleRunThisNode` 의 catch 블록은 `console.error` 로만 기록하고 사용자에게는 silent 처리한다(v1 정책 — 의도 주석 명시됨).
- 제안: 이상 없음.

### [INFO] 암호화 — 신규 코드에서 암호화/해시 알고리즘 사용 없음
- 위치: 변경된 모든 파일 전체
- 상세: 신규 기능은 암호화 또는 해싱을 직접 수행하지 않는다. 인증은 기존 JWT 미들웨어에 위임한다. UUID 컬럼(`single_node_id`, `previous_execution_id`)은 DB 고유 식별자로 PostgreSQL 의 UUID 타입을 사용하며 암호화 관련 로직이 없다.
- 제안: 해당 없음.

### [INFO] 의존성 보안 — 신규 패키지 추가 없음
- 위치: `codebase/backend/package.json`, `codebase/frontend/package.json` (변경 없음)
- 상세: 이번 변경에서 `package.json` 또는 `package-lock.json` 의 수정이 없다. 신규 외부 라이브러리 의존성이 추가되지 않았으므로 알려진 취약점이 있는 패키지가 도입될 위험이 없다.
- 제안: 해당 없음.

### [INFO] Graceful Shutdown gate 적용 — 서비스 가용성 보호
- 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `executeNode` 메서드 첫 번째 블록
- 상세: 신규 엔드포인트도 기존 `execute` 엔드포인트와 동일하게 `this.shutdownState.isShuttingDown` 체크 후 503 + `Retry-After` 헤더를 반환하는 패턴을 구현한다. 서버 종료 중 새 실행이 enqueue 되어 orphan 상태로 남는 것을 방지한다.
- 제안: 이상 없음.

---

## 요약

execution §1.3 단일 노드 실행 기능의 보안 관점 리뷰 결과 Critical 및 Warning 발견사항이 없다. 이전 리뷰(2026-06-15 15:05:56) 에서 보안 관련 I-1~I-7 로 분류된 항목들(IDOR 방지, 인가, 입력 검증, XSS, SQLi 정상 여부)은 fresh 리뷰에서도 동일하게 정상으로 확인된다. 주요 보안 통제 사항으로는 (1) `@Roles('editor')` 인가 가드, (2) `workflowsService.findById` 를 통한 워크스페이스 스코핑 IDOR 방지, (3) `ParseUUIDPipe` + class-validator DTO 를 통한 입력 형식 검증, (4) 노드·이전 실행의 워크플로우 소속 2중 검증으로 Cross-resource seed 차단이 모두 구현되어 있다. 이전 리뷰의 W-5(engine 레이어 2차 검증 부재)는 controller 레이어 검증 + `getLatestPredecessorOutputs` 가 워크플로우 소속 노드 ID 범위로만 조회하는 구조적 방어로 실질적 데이터 누출 경로가 없어 DEFER 결정이 유효하다. 하드코딩된 시크릿, 커맨드 인젝션, 경로 탐색, 안전하지 않은 암호화, 민감 정보 에러 노출, 신규 취약 의존성은 모두 해당 없음.

---

## 위험도

NONE
