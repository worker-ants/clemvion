STATUS=success cross_spec review complete — 0 CRITICAL, 1 WARNING, 2 INFO

===REPORT_MARKDOWN_BELOW===

### 발견사항

- **[WARNING]** `X-Workspace-Id` 헤더와 워크스페이스 `:id` 경로 파라미터의 UUID 검증 강도가 문서화 없이 갈라진다
  - target 위치: 코드 diff — `codebase/backend/src/common/utils/uuid.ts`(`isUuidShaped` 신설) · `codebase/backend/src/common/utils/workspace-context.util.ts`(`resolveRequestWorkspaceContext` 가 `isUuidShaped` 로 헤더를 검증)
  - 충돌 대상: `spec/5-system/1-auth.md` §5 API 엔드포인트 — `POST /api/auth/workspaces/:id/switch` 행이 `:id` 는 `ParseUUIDPipe`(RFC v1–v5, nil UUID·v6/v7·비-RFC variant 거부)로 검증된다고 명시. 같은 "워크스페이스 식별자" 개념이 `spec/5-system/2-api-convention.md` §2.3(워크스페이스 스코핑)·`spec/data-flow/12-workspace.md` §Overview/§1.5 에서는 `X-Workspace-Id` 헤더로도 동일하게 전달된다고 서술하며, 두 경로의 검증 규칙 차이는 어느 문서에도 없다.
  - 상세: 이번 diff 는 헤더 경로에 한해 `isUuidShaped`(canonical 8-4-4-4-12 hex 형태만 보고 버전·variant nibble 은 안 봄 — nil UUID·v6/v7·비-RFC variant 를 **허용**)를 붙였다. 반면 같은 워크스페이스 식별자를 받는 `:id` 경로 파라미터(예: `/api/auth/workspaces/:id/switch`)는 spec 상 여전히 `ParseUUIDPipe`(RFC variant 만 허용, nil UUID 거부)다. 즉 `nil UUID`(`00000000-0000-0000-0000-000000000000`)를 헤더로 보내면 통과(403 NOT_A_MEMBER 로 이어짐)하지만 같은 값을 경로 파라미터로 보내면 400 이 된다 — "워크스페이스 UUID" 라는 하나의 개념이 진입점에 따라 다른 형식 규칙을 갖는 셈이다. 코드 주석(Rationale)은 이 비대칭이 의도적(403↔400 응답 뒤바뀜 방지, `system-status.e2e-spec.ts` 의 nil-UUID 프로브 보호)이라고 밝히지만, 그 근거는 코드 주석에만 있고 `spec/5-system/1-auth.md` §3.3(API 인가 흐름)·§5, `spec/5-system/2-api-convention.md` §2.3, `spec/data-flow/12-workspace.md` 어디에도 반영되지 않았다.
  - 제안: `spec/5-system/1-auth.md` §3.3 또는 `spec/data-flow/12-workspace.md` §1.5 Rationale 에 "`X-Workspace-Id` 헤더는 `ParseUUIDPipe`(경로 파라미터)보다 느슨한 `isUuidShaped` 형태 검증만 적용한다 — Postgres 가 파싱 가능한 값을 400 으로 오분류해 403 을 가리는 것을 막기 위함" 한 줄을 추가해, 향후 누군가 "일관성"을 이유로 두 검증을 통일하는 회귀(nil UUID e2e 프로브가 400 으로 바뀌는 회귀)를 예방할 것을 권고. (CRITICAL 은 아님 — 현재 동작은 코드 Rationale 이 명시적으로 의도한 것이며 기능적으로 깨져 있지 않다.)

- **[INFO]** 신규 부팅 fail-closed 캐너리·헤더 400 하드닝이 관련 spec Rationale 에 후속 갱신되지 않음
  - target 위치: 코드 diff — `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`(신규) + `main.ts` 의 `assertWorkspaceIdReflectionWorks(app)` 호출
  - 충돌 대상: `spec/5-system/1-auth.md` §Rationale "Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP"(JWT_SECRET/ENCRYPTION_KEY/MCP_ALLOW_INSECURE_URL/OAUTH_STUB_MODE/LLM_STUB_MODE 만 열거) · `spec/data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관"(2026-08-08, `#1103` 결정)
  - 상세: 새 캐너리는 `data-flow/12-workspace.md` 의 "멤버십 검증은 가드 1곳에서" 결정이 의존하는 reflection 전제(`handlerConsumesWorkspaceId`)가 깨지면 그 결정 전체가 무력화된다는 점을 부팅 시 검증하는 직접적인 후속 조치다 — 코드 주석 자체가 "`#1103` 이 통째로 닫은 cross-tenant 결함 클래스가 그대로 되살아난다" 고 그 인과를 명시한다. 그런데 `data-flow/12-workspace.md` 의 해당 Rationale 은 "구현·전수 목록: `plan/complete/auth-workspace-membership-guard.md`" 로 끝나고 이 하드닝 후속을 가리키지 않으며, `1-auth.md` 의 fail-closed 가드 목록도 4번째(구조적, env-무관) 축인 이 캐너리를 아직 나열하지 않는다. 충돌은 아니다 — 코드 Rationale 이 "env 축과 무관한 구조 불변식이라 `assertProductionConfig` 에 합치지 않는다" 고 명시한 근거가 `1-auth.md` §Rationale 이 이미 세운 분리 기준("DI·요청 컨텍스트가 필요하거나 정당 용도가 있는 항목은 의도적으로 분리")과 정확히 부합해 오히려 일관적이다. 다만 두 Rationale 문서 모두 이 신규 안전장치를 아직 인지하지 못한 상태로 남아 있다.
  - 제안: spec 변경 권한은 `project-planner` 소관이라 본 검토 범위 밖이지만, 후속 spec 갱신 시 `data-flow/12-workspace.md` §Rationale 말미에 "2026-08-09: `assertWorkspaceIdReflectionWorks` 부팅 캐너리로 reflection 전제를 fail-closed 화" 한 줄 pointer 를, `1-auth.md` 의 fail-closed 가드 열거에는 "구조 불변식(비-env) 축" 각주를 덧붙이는 것을 권고.

- **[INFO]** `WORKSPACE_ID_REQUIRED`(400) 카탈로그 엔트리가 새 malformed-header 케이스를 포함하지 않음
  - target 위치: 코드 diff — `workspace-context.util.ts` 의 신규 `BadRequestException({code:'VALIDATION_ERROR', …})` 분기 (헤더 존재 + 형식 오류)
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.3 유효성 검증 에러의 `WORKSPACE_ID_REQUIRED` 행("`X-Workspace-Id` 헤더와 JWT `workspaceId` **둘 다 없음**") · `spec/5-system/15-chat-channel.md` §R-CC-18(같은 코드를 canonical 로 재확인)
  - 상세: 실제 충돌은 아니다 — 새 경로는 `WORKSPACE_ID_REQUIRED` 를 재사용하지 않고 §1.3 에 이미 등재된 범용 `VALIDATION_ERROR`(400)를 쓰므로 코드명 재사용 충돌은 없다. 다만 "헤더 부재"(`WORKSPACE_ID_REQUIRED`)와 "헤더 존재하나 형식 오류"(`VALIDATION_ERROR`)라는 인접한 두 케이스가 카탈로그 한쪽에만 등재돼, 카탈로그만 보는 독자는 후자의 존재를 알기 어렵다.
  - 제안: `3-error-handling.md` §1.3 의 `WORKSPACE_ID_REQUIRED` 행 옆에 각주로 "형식 오류(헤더 존재, UUID-shape 아님)는 별도로 `VALIDATION_ERROR` 를 사용한다" 를 추가하면 카탈로그 완결성이 개선됨 (차단 사유 아님).

### 요약

이번 diff(`auth-guard-reflection-hardening`)는 순수 코드 변경이며 `spec/**` 파일은 수정되지 않았다. 부팅 시 `@WorkspaceId()` reflection 무결성을 검증하는 fail-closed 캐너리, `X-Workspace-Id` 헤더의 UUID-shape 검증(400 `VALIDATION_ERROR`) 두 가지를 추가하는데, 둘 다 `spec/data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드 1곳에서"(2026-08-08, `#1103`)와 `spec/5-system/1-auth.md` §Rationale "Production fail-closed 가드"가 이미 세운 설계 원칙(무조건적 가드 검증, DI-의존 항목은 별도 부트 단계로 분리)과 실제로 부합하며 이를 직접 반박하는 다른 spec 영역은 발견되지 않았다. 유일하게 실질적인 지적은 `X-Workspace-Id`(신규 permissive `isUuidShaped`)와 경로 파라미터 `:id`(기존 strict `ParseUUIDPipe`, `1-auth.md` §5 문서화)가 "워크스페이스 UUID" 라는 같은 개념에 대해 서로 다른 형식 검증 규칙을 갖게 됐고 이 비대칭이 어떤 spec 문서에도 반영되지 않았다는 점이다 — 의도적 트레이드오프이고 기능 결함은 아니므로 WARNING 으로 등급을 매겼다. 나머지 두 건은 spec Rationale 이 이 후속 하드닝을 아직 인지하지 못해 발생하는 문서 지연(INFO)이며 차단 사유가 아니다.

### 위험도
LOW
