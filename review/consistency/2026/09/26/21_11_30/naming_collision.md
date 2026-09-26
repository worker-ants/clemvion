# 신규 식별자 충돌 검토 — `spec/2-navigation/` (impl-done, diff-base `origin/main`)

## 검토 배경

- 이 브랜치는 `spec/2-navigation/` 파일을 변경하지 않는다(scope 델타 0 — 코드 전용 PR 이며 정상 전제).
- 실제 구현 diff(4 파일 / 346줄)는 `codebase/backend/src/modules/integrations/` — `spec/2-navigation/4-integration.md`
  (해당 spec 본문은 이번 프롬프트에서 예산 절단됐으나, `plan/in-progress/integration-test-contract.md` 실측 섹션이
  §5.6/§9.1/§9.4 인용을 포함해 대체 근거로 충분함)가 문서화하는 `/api/integrations/:id/test` 응답 계약이다.
- 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/integration-test-contract`)를 절대경로로 직접
  `git diff origin/main...HEAD` / `Read` / `grep` 하여 실제 신규 식별자를 확인했다.

## 도입된 신규 식별자 전수

1. `TestConnectionResultDto.capabilities?: Record<string, unknown>` (신규 필드)
2. `TestConnectionResultDto.serverInfo?: { name: string; version: string }` (신규 필드)
3. `TestConnectionResultDto.preview?: McpConnectionPreviewDto` (신규 필드)
4. 신규 테스트 파일 `codebase/backend/src/modules/integrations/integrations.controller.wire.spec.ts`
5. CHANGELOG "Unreleased — OpenAPI 가 `POST /integrations/:id/test` 의 MCP 성공 응답 필드를 광고한다" 항목
6. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 트래커 항목(신규 식별자 아님 — 기존
   `INTEGRATION_TEST_FAILED` 코드·기존 endpoint 참조뿐)

신규 요구사항 ID, 신규 API endpoint(method+path), 신규 webhook/queue/SSE 이벤트명, 신규 ENV var·config key 는
이번 diff 에 없다.

## 발견사항

### [INFO] `capabilities`/`serverInfo`/`preview` 필드는 충돌이 아니라 기존 선언과의 의도적 동기화

- target 신규 식별자: `TestConnectionResultDto.capabilities` / `.serverInfo` / `.preview`
- 기존 사용처:
  - `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:264-281`
    (형제 `PreviewTestResultDto` — 동일 필드명·동일 타입·동일 `@ApiProperty` 옵션이 이미 선언돼 있음)
  - `codebase/backend/src/modules/integrations/integrations.service.ts:93-94, 1819-1821`
    (`IntegrationTestResult.capabilities` / `.serverInfo` — 서비스 레벨에서 이미 같은 이름으로 생산 중이었음, DTO 선언만 없었음)
  - `codebase/backend/src/modules/mcp/mcp-client.service.ts:53-54, 303-310, 514-515`,
    `codebase/backend/src/modules/mcp/mcp-test-connection.service.ts:23-24, 92-130`
    (MCP 도메인 전역에서 `capabilities`/`serverInfo` 가 동일 의미(`ServerCapabilities`/`ServerInfo`)로 일관 사용)
  - `spec/2-navigation/4-integration.md:562`, `spec/5-system/11-mcp-client.md:69,523,532`
    (spec 도 이미 동일 필드명으로 `{ capabilities, serverInfo, preview }` 를 문서화)
- 상세: 새 필드 3종은 이름·타입·설명이 형제 DTO(`PreviewTestResultDto`)·서비스 타입(`IntegrationTestResult`)·spec
  본문과 **완전히 동일**하다. 즉 "새 식별자가 다른 의미로 이미 쓰이고 있다"가 아니라, 이미 존재하던 동일 의미의
  식별자를 뒤늦게 DTO 계층에 선언한 것 — plan 의 실측(`integrations.service.ts` 가 이미 이 이름으로 값을 반환하고
  있었으나 DTO 선언이 없었다는 실측)과 정확히 일치한다. 다른 의미 충돌은 없다.
- 제안: 조치 불요. 오히려 이 동기화가 두 형제 endpoint(`:id/test` / `preview-test`)의 "같은 값을 다르게 광고"하던
  기존 비대칭을 해소한 방향이라 유지 권장.

### [INFO] 신규 테스트 파일명 `integrations.controller.wire.spec.ts` — 로컬 컨벤션과 정합, 백엔드 전역에서는 유일 사례

- target 신규 식별자: 파일 `codebase/backend/src/modules/integrations/integrations.controller.wire.spec.ts`
- 기존 사용처: 같은 모듈의 `integrations.controller.owner.spec.ts` (관점별 접미사 `.controller.<perspective>.spec.ts`
  컨벤션 기존 선례). `find codebase/backend/src -iname "*.wire.spec.ts"` 실행 결과 이 파일이 유일하며, 다른 모듈
  (예: 자매 `llm-model-config.controller.spec.ts`)은 별도 파일 분리 없이 단일 `controller.spec.ts` 에 describe 를
  더하는 패턴을 쓴다.
- 상세: 이름 충돌은 없다(동일 경로에 기존 파일 없음, 다른 파일과 오인될 유사명도 없음). `integrations` 모듈
  내부적으로는 `owner`/`wire` 두 접미사로 관점별 분리 컨벤션이 일관되지만, 이 컨벤션이 백엔드 전역 컨벤션은
  아니라는 점만 참고 — 향후 다른 모듈이 와이어 레벨 supertest 를 분리할 때 `.wire.spec.ts` 접미사를 재사용할지,
  아니면 자매 모듈처럼 기존 controller.spec.ts 에 describe 를 더할지는 선례가 하나뿐이라 아직 확정되지 않았다.
- 제안: 조치 불요(plan 의 `--impl-prep` INFO 5 처분에서 이미 "이 모듈은 관점별 파일이 관례" 로 정당화됨). 참고용
  기록으로만 남김.

### [정보] 검토 범위 내 그 외 축 — 충돌 없음

- 요구사항 ID: 신규 ID 부여 없음(트래커 항목 추가는 기존 `INTEGRATION_TEST_FAILED` 코드·기존 endpoint 재참조).
- API endpoint: 신규 endpoint 없음 — 기존 `POST /api/integrations/:id/test` 의 응답 스키마 보강뿐.
- 이벤트/메시지명: 변경 없음.
- 환경변수·설정키: 변경 없음.
- 파일 경로(spec): `spec/2-navigation/` 파일 변경 없음(0개) — 파일명 컨벤션 충돌 대상 자체가 없음.
- 타입명 `TestConnectionResultDto` 자체는 PR 이전부터 존재하던 클래스이며 이번 diff 로 신규 도입된 것이 아니다.
  전역에서 `TestConnectionResultDto` 문자열을 참조하는 다른 모듈(`llm-model-config.*`, `model-config-response.dto.ts`)을
  확인했으나 그쪽이 실제로 선언하는 클래스는 `ModelTestConnectionResultDto`(별도 이름)이고 주석에서 "형제"로만
  언급될 뿐 — 동명 클래스 충돌 없음.

## 요약

이번 diff 가 도입하는 유일한 "신규" 식별자는 `TestConnectionResultDto` 의 세 필드(`capabilities`/`serverInfo`/`preview`)와
와이어 레벨 테스트 파일 하나이며, 둘 다 기존 형제 선언·기존 서비스 타입·기존 spec 문서와 이름·의미가 정확히
일치하도록 맞춘 동기화 성격의 변경이다. 서로 다른 의미로 이미 쓰이고 있는 식별자와 충돌하는 사례, 신규 요구사항
ID·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 충돌은 발견되지 않았다. `spec/2-navigation/` 델타 0은 코드
전용 PR 의 정상 상태이며 이를 근거로 한 CRITICAL 판정 대상도 없다.

## 위험도

NONE
