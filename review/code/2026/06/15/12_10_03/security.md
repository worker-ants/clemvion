# 보안(Security) Review

## 발견사항

- **[WARNING]** `data` JSONB 컬럼에 크기 제한 없음 — 대용량 페이로드 저장 가능
  - 위치: `codebase/backend/src/modules/workflow-test-datasets/dto/create-workflow-test-dataset.dto.ts` L21–25 (`input` 필드), `codebase/backend/migrations/V097__workflow_test_dataset.sql` L15 (`data JSONB`)
  - 상세: `input` 필드에 `@IsObject()` 만 선언되어 있고 JSONB 컬럼에 최대 바이트 크기 제한이 없다. 악의적 사용자가 수십~수백 MB의 JSON을 저장하는 DoS 공격이 가능하다. `list()` 의 `.take(200)` 은 행 수만 제한하며, 단일 행의 payload 크기는 무제한이다.
  - 제안: DTO에 `@MaxLength` 대신 직렬화 크기를 체크하는 커스텀 데코레이터(예: `@MaxJsonBytes(1_048_576)`)를 추가하거나, NestJS global `ValidationPipe`의 `transform`과 함께 애플리케이션 레벨 크기 상한을 적용한다. DB 레이어에서도 PostgreSQL check constraint(`pg_column_size(data) < 1048576`)를 마이그레이션에 추가하는 것을 권장한다.

- **[WARNING]** 프론트엔드 오류 핸들러에서 `console.error`로 에러 객체 전체 출력
  - 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `handleSaveDataset` L573, `handleCloneDataset` L597, `handleDeleteDataset` L612
  - 상세: `console.error("Save dataset failed:", error)` 구문이 error 객체를 그대로 출력한다. 서버에서 반환된 에러 응답에 내부 메시지(DB 제약 이름, 스택 트레이스 등)가 포함될 경우 브라우저 콘솔에 노출된다. 프로덕션 빌드에서도 DevTools로 확인 가능하다.
  - 제안: 프로덕션 환경에서는 `console.error` 대신 구조화된 로거(sentry 등)를 사용하거나, 에러 로깅 시 `error instanceof Error ? error.message : String(error)` 로 최소한의 정보만 남긴다.

- **[INFO]** `findAccessible` 내 비소유 private 데이터셋 접근 시 404 응답 — 정보 은닉 패턴은 올바르나 workspace 격리가 `findOne({ where: { id, workspaceId } })` 조건에만 의존
  - 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` L658–L686
  - 상세: `PATCH /test-datasets/:id` 와 `DELETE /test-datasets/:id` 엔드포인트는 `workspaceId` 를 URL path 에 포함하지 않고 헤더(`X-Workspace-Id`)에서 받는다. `findOne({ where: { id, workspaceId } })` 조건으로 교차 workspace IDOR를 방어하는 것은 적절하다. e2e invariant E 도 이를 검증한다. 다만, `workspaceId` 헤더가 변조되어 다른 workspace 의 값이 들어올 경우 서버가 신뢰하는 `workspaceId` 출처(JWT vs 헤더)에 따라 방어 효과가 달라진다. 헤더 기반이라면 미들웨어/가드에서 검증하는지 확인이 필요하다.
  - 제안: `@WorkspaceId()` 데코레이터가 JWT claim 기반인지 확인하고, 헤더 값을 그대로 신뢰하는 경우 JWT의 workspace 멤버십 claim 과 교차 검증하는 가드를 추가한다.

- **[INFO]** `copyName` 에서 `slice` 로 이름을 자를 때 다국어(멀티바이트) 문자 경계 미고려
  - 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` L1753–L1757
  - 상세: `base.slice(0, max)` 는 JavaScript string index(UTF-16 code unit) 기반으로 자른다. 한글·이모지 등 멀티바이트 문자가 포함된 이름을 잘라 저장하면 VARCHAR(255) byte 한도 내에 들어오더라도 의미가 잘린 이름이 생성된다. 보안 취약점은 아니지만 UNIQUE 제약 충돌 처리 오류로 이어질 수 있다.
  - 제안: 이름 자르기는 `Intl.Segmenter` 또는 문자(grapheme) 단위로 처리하거나, PostgreSQL VARCHAR(255)가 바이트가 아닌 문자 수 기준임을 감안해 `MaxLength(255)` 데코레이터로 DB 제약과 일치시킨 검증에 의존하는 것으로 충분하다.

- **[INFO]** SQL 인젝션 — TypeORM QueryBuilder의 파라미터 바인딩으로 올바르게 처리됨
  - 위치: `workflow-test-datasets.service.ts` L1617–L1627
  - 상세: `.where('d.workflow_id = :workflowId', { workflowId })` 등 모든 동적 값이 파라미터 바인딩을 사용하고 있어 SQL 인젝션 위험 없음. 확인용 기록.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 전체 변경 파일
  - 상세: API 키, 비밀번호, 토큰 등 하드코딩된 시크릿 없음. 테스트 파일의 `WS`, `WF`, `OWNER` 등은 모두 단위 테스트용 픽스처 식별자이며 실제 인증 정보 아님.

## 요약

이번 변경은 워크플로우 테스트 데이터셋의 저장·공유·복제 기능을 신규 도입한다. 권한 모델(소유자 전용 수정/삭제, 비소유 private 데이터셋에 404 반환, workspace 격리 필터)은 전반적으로 안전하게 설계되어 있으며 SQL 인젝션·XSS·IDOR 등 주요 취약점은 확인되지 않는다. 다만 `data` JSONB 컬럼에 크기 제한이 없어 대용량 페이로드 DoS 가능성이 존재하고, 프론트엔드에서 에러 객체를 콘솔에 그대로 출력하는 패턴이 내부 오류 메시지를 노출할 수 있다. `X-Workspace-Id` 헤더의 신뢰 출처가 JWT claim 인지 헤더 값인지에 따라 IDOR 방어 완결성이 달라지므로 미들웨어 구현을 확인하는 것이 권장된다.

## 위험도

LOW
