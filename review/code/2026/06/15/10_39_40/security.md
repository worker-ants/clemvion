# 보안(Security) 리뷰

## 발견사항

### 인젝션 취약점

- **[INFO]** `data JSONB` 컬럼에 저장되는 Mock Input JSON 의 크기 제한 없음
  - 위치: `codebase/backend/migrations/V097__workflow_test_dataset.sql` — `data JSONB NOT NULL DEFAULT '{}'`
  - 상세: JSONB 컬럼에 저장되는 `input` 페이로드의 최대 크기가 DB 스키마나 DTO 레이어에서 제한되지 않는다. `CreateWorkflowTestDatasetDto.input` 필드는 `@IsObject()` 만 적용돼 있어, 중첩 수준이 매우 깊거나 매우 큰 JSON 객체가 그대로 DB에 삽입될 수 있다. 대용량 JSON 은 PostgreSQL 에서 처리 비용이 높고, 디스크 낭비나 서비스 응답 지연을 유발할 수 있다.
  - 제안: DTO에서 `@MaxLength` 를 JSON 직렬화 문자열 크기에 적용하거나, 커스텀 파이프/인터셉터로 페이로드 크기(예: 64KB)를 제한한다. 또는 NestJS 글로벌 Body Size Limit 재확인.

### 인증/인가

- **[WARNING]** `workspace` 공유 데이터셋을 열람할 수 있는 워크스페이스 구성원 검증 누락 가능성
  - 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` — diff 가 omitted 처리돼 전체 코드 미열람. 그러나 `visibility='workspace'` 레코드를 반환할 때, 요청 유저가 실제로 해당 `workspace_id` 의 구성원인지 검증하는 쿼리가 존재하는지 확인 필요.
  - 상세: SQL 마이그레이션(파일 1)은 `(workspace_id, visibility)` 복합 인덱스만 선언하며, 워크스페이스 구성원 자격 체크 로직은 서비스 레이어에서 구현돼야 한다. 만약 서비스가 `visibility='workspace' AND workspace_id=:wid` 조건으로만 필터링하고 유저가 해당 워크스페이스 구성원인지 별도 검증하지 않는다면, `workspace_id` 를 알기만 해도 타 워크스페이스의 공유 데이터셋에 접근할 수 있다.
  - 제안: `list` / `findOne` 쿼리에서 `workspace_id` 가 요청 유저가 속한 워크스페이스와 일치하는지 또는 RLS/Guard 레이어에서 워크스페이스 멤버십을 검증하고 있는지 명시적으로 확인한다.

- **[WARNING]** `clone` 엔드포인트의 소스 데이터셋 접근 권한 검증
  - 위치: `codebase/frontend/src/lib/api/workflow-test-datasets.ts` — `POST /test-datasets/:datasetId/clone`
  - 상세: 클론 대상 데이터셋(`datasetId`)이 요청 유저가 조회 가능한(본인 소유 또는 `workspace` 공유) 데이터셋인지 서버에서 검증해야 한다. `datasetId` 를 추측하거나 Burp 등으로 인터셉트하여 권한 없는 `private` 데이터셋의 ID 를 직접 지정하는 경우, 서비스 레이어에 존재 확인 + 가시성 권한 체크가 없으면 IDOR(Insecure Direct Object Reference) 로 이어진다.
  - 제안: 클론 핸들러에서 소스 데이터셋을 조회할 때 `owner_id = requestUser OR (visibility = 'workspace' AND workspace_id = userWorkspace)` 조건을 강제한다.

- **[INFO]** `PATCH /test-datasets/:datasetId` 와 `DELETE /test-datasets/:datasetId` 의 소유자 검증
  - 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts` — diff omitted
  - 상세: spec 및 SQL 주석에서 "소유자만 수정/삭제" 라고 명시하고 있다. 수정·삭제 핸들러가 `owner_id = requestUser` 를 DB 쿼리 레벨에서 강제하거나, 오브젝트 조회 후 서비스 레이어에서 명시 비교하지 않으면 타인의 데이터셋을 수정할 수 있는 IDOR 가 된다. 컨트롤러/서비스 코드가 diff 미포함 상태라 직접 확인 불가.
  - 제안: 서비스의 `update`/`remove` 메서드에서 `WHERE id = :id AND owner_id = :userId` 조건을 반드시 포함하거나, 조회 후 `entity.ownerId !== userId` 면 `ForbiddenException` 을 던지는 패턴을 사용한다.

### 입력 검증

- **[INFO]** `name` 필드의 XSS 잠재 가능성 — 렌더 경로 확인 필요
  - 위치: `codebase/backend/src/modules/workflow-test-datasets/dto/create-workflow-test-dataset.dto.ts` — `@MaxLength(255) name`
  - 상세: `name` 은 `@IsString() @IsNotEmpty() @MaxLength(255)` 로 검증되지만, HTML 특수문자(`<script>` 등)를 허용한다. 이 값이 프론트엔드에서 이스케이프 없이 `innerHTML` 또는 `dangerouslySetInnerHTML` 에 삽입될 경우 XSS 위험이 있다. 프론트엔드 코드(`editor-toolbar.tsx`, diff omitted) 의 렌더 경로를 확인해야 한다.
  - 제안: React 는 기본적으로 JSX 에서 자동 이스케이프를 제공하므로, 별도 HTML 삽입 경로가 없다면 위험도 낮음. 단, `{name}` 을 `dangerouslySetInnerHTML` 로 삽입하는 코드가 있다면 DOMPurify 처리 필요.

- **[INFO]** `visibility` 열거형 외 값 삽입 방어 — DB CHECK 제약 vs DTO 레이어
  - 위치: `codebase/backend/migrations/V097__workflow_test_dataset.sql` — `CHECK (visibility IN ('private', 'workspace'))`
  - 상세: DB 스키마에 CHECK 제약이 있고 DTO 에도 `@IsEnum(TestDatasetVisibility)` 가 적용돼 있어 이중 방어 구조다. 이 부분은 적절하게 구현되어 있다.
  - 제안: 현 구현 유지. 추가 조치 불필요.

### 하드코딩된 시크릿

- **[INFO]** 해당 없음. 신규 코드 범위 내 하드코딩된 API 키, 비밀번호, 토큰, 인증서 없음.

### 암호화

- **[INFO]** 해당 없음. Mock Input JSON 은 암호화 대상이 아니며, 평문 저장이 적절하다. DB 레벨 암호화는 인프라 레이어 책임.

### 에러 처리

- **[INFO]** 에러 메시지에 민감 정보 노출 여부 — 컨트롤러/서비스 코드 미열람
  - 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` — diff omitted
  - 상세: NestJS 의 기본 `HttpException` 및 `ForbiddenException`/`NotFoundException` 은 표준화된 에러 응답을 반환하므로 DB 스택 트레이스나 내부 ID 가 누출될 위험은 낮다. 단, 커스텀 에러 메시지에 DB 오류 상세(`unique constraint violation` 메시지 등)가 그대로 포함되면 정보 노출이 된다.
  - 제안: UNIQUE 제약 위반(`(workflow_id, owner_id, name)` 중복) 시 PostgreSQL `23505` 오류를 잡아 "이미 같은 이름의 데이터셋이 존재합니다" 같은 사용자 친화적 메시지로 변환하고, DB 레이어 메시지는 서버 로그에만 기록한다.

### 의존성 보안

- **[INFO]** 신규 외부 의존성 없음. NestJS TypeORM 기존 모듈 패턴 내에서 신규 엔티티/모듈/DTO 를 등록하는 수준이며, 신규 라이브러리 추가 없음.

---

## 요약

이번 변경은 워크플로우 Mock Input 저장 데이터셋(`WorkflowTestDataset`) 신규 엔티티·모듈·CRUD 엔드포인트 추가, 프론트엔드 API 클라이언트, 일부 form validation 타입/docstring 정리로 구성된다. 보안 측면에서 가장 중요한 우려 사항은 인가(Authorization) 계층이다: `visibility='workspace'` 데이터셋을 필터링할 때 요청 유저의 워크스페이스 멤버십 검증 여부, `clone`·`update`·`remove` 엔드포인트의 소스 데이터셋 접근 권한(IDOR) 방어 여부가 서비스 레이어 코드(diff omitted)에서 구현됐는지 확인이 필요하다. 하드코딩된 시크릿·인젝션 취약점·암호화 문제는 발견되지 않았다. `input` JSONB 페이로드의 크기 제한 부재는 DoS 위험이 있는 INFO 수준 항목이다. 컨트롤러와 서비스 코드 diff 가 prompt size limit 으로 생략됐으므로, 인가 로직 구현 여부를 직접 확인할 수 없었음을 명시한다.

---

## 위험도

MEDIUM
