# Cross-Spec 일관성 검토 — auth-guard-reflection-hardening

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- target: `spec/5-system/**`(본 PR 에서 spec 텍스트 자체는 변경되지 않음 — diff 는 `codebase/backend` 전용: `app.module.ts`·신규 `common/decorators/workspace-reflection-canary.{ts,spec.ts}`·`common/decorators/workspace.decorator.spec.ts`·`common/guards/roles.guard.spec.ts`·`common/utils/uuid.{ts,spec.ts}`·`common/utils/workspace-context.util.{ts,spec.ts}`·`main.ts`)
- 확인 위치: HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/auth-guard-reflection-hardening-9c31f2`) 절대경로로 코드 직접 대조. `spec/data-flow/12-workspace.md`(cross-spec 관련 근거 문서, 이번 번들엔 미포함이나 `spec/5-system/1-auth.md`·`2-api-convention.md`가 반복 참조) 도 별도로 직접 열어 대조함.

## 발견사항

- **[WARNING]** `X-Workspace-Id` 형식 검증 400 이 canonical 에러 카탈로그·엔드포인트별 "실패 응답" 표에 미등재
  - target 위치: `codebase/backend/src/common/utils/workspace-context.util.ts` (`resolveRequestWorkspaceContext` 가 헤더 값이 `isUuidShaped()` 를 통과 못 하면 `BadRequestException({ code:'VALIDATION_ERROR' })`을 새로 throw — `roles.guard.ts`·`workspace.decorator.ts` 양쪽 소비). 이 유틸이 근거하는 RBAC 흐름의 spec 표현은 `spec/5-system/1-auth.md` §3.3 "API 인가 흐름"·§5 API 엔드포인트.
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.3 (`WORKSPACE_ID_REQUIRED` 카탈로그 행), `spec/5-system/15-chat-channel.md` §5.4 `rotate-bot-token` "실패 응답" 표 + R-CC-18 (`3-error-handling.md §1.3` 을 명시적으로 "canonical" 이라 인용).
  - 상세: 개정 전에는 `X-Workspace-Id` 관련 400 이 "헤더·JWT claim 둘 다 없음"(`WORKSPACE_ID_REQUIRED`) 한 가지뿐이었다. 이번 하드닝은 "헤더는 있지만 UUID 형태가 아님" 이라는 **제3의 케이스**를 추가해 generic `VALIDATION_ERROR`(400)로 분기한다(종전엔 이 값이 그대로 DB 로 흘러가 22P02 → 500 로 마스킹되던 결함의 수정). 그런데 `3-error-handling.md §1.3` 은 여전히 "부재" 케이스만 `WORKSPACE_ID_REQUIRED` 로 정의하고, 형식-오류 케이스는 카탈로그 어디에도 등재돼 있지 않다. `15-chat-channel.md §5.4` 의 `rotate-bot-token` 실패 응답 표는 이 공용 `@WorkspaceId()` 데코레이터를 재사용하면서 "`3-error-handling.md §1.3` canonical" 이라고 명시 인용하는데, 그 canonical 문서 자체가 이제 실제 코드 동작보다 좁다. `@WorkspaceId()`/`RolesGuard` 를 재사용하는 대다수 워크스페이스-스코프 엔드포인트가 동일한 사각지대에 놓인다 — "카탈로그 표가 완전하다" 는 전제로 설계된 클라이언트 에러 분기(예: 코드별 안내 문구 매핑)가 이 신규 코드 경로를 놓칠 수 있다. 다만 `VALIDATION_ERROR` 자체는 API 규약 §5.3 의 기본(default) 400 코드라 프론트엔드 fallback 처리 경로는 이미 존재하며, 직접적 계약 위반(모순)은 아니다 — **누락(incompleteness)** 성격의 발견이다.
  - 제안: `spec/5-system/3-error-handling.md` §1.3 에 "`X-Workspace-Id` 헤더가 UUID 형태가 아님 → `VALIDATION_ERROR`(400) — `WORKSPACE_ID_REQUIRED`(부재)와 구분" 행을 추가하고, `15-chat-channel.md §5.4` 등 canonical 인용 표에도 각주로 파급 여부를 재확인. (spec 갱신은 `project-planner` 권한 — 본 발견은 devloper 워크트리에서 코드 변경만 있었으므로 후속 spec-sync 항목으로 기록 권고.)

- **[INFO]** reflection canary 방어층이 원 설계 Rationale 문서(`data-flow/12-workspace.md`)에 미반영 (단방향 참조)
  - target 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (신규), `main.ts` (`assertWorkspaceIdReflectionWorks(app)` 부팅 호출)
  - 충돌 대상: `spec/data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관" — 이 RolesGuard 무조건-검증 설계의 실제 SoT.
  - 상세: canary 코드 주석은 "라우트별 `@Roles('viewer')` opt-in 마커"를 채택하지 않은 근거로 `spec/data-flow/12-workspace.md §Rationale` 의 "기각된 대안" 절을 정확히 인용한다 — 대조 결과 그 절이 실제로 해당 대안을 기각한 이력이 존재해 인용 자체는 사실에 부합한다(허구 아님). 그러나 참조가 단방향이다: `data-flow/12-workspace.md` 본문·Rationale 어디에도 "reflection 이 깨지면 부팅을 멈추는 canary" 라는 새 방어층이 언급돼 있지 않다. 이 문서가 RolesGuard 설계의 단일 진실이므로, 향후 이 가드를 재검토하는 사람이 spec 만 읽으면 이 하드닝 계층의 존재를 알 수 없다.
  - 제안: `spec/data-flow/12-workspace.md §Rationale`(또는 `spec/5-system/1-auth.md §3.3` 인근)에 한 줄로 "부팅 시 reflection canary(`workspace-reflection-canary.ts`)가 `@WorkspaceId()` 소비 라우트 인식 실패를 fail-closed 로 차단한다"를 추가 — 필수는 아니며(코드 자체 동작엔 지장 없음), 문서 연속성(continuity) 차원의 권고.

검토했으나 충돌 없음으로 확인한 항목 (기록):
- RBAC 권한 매트릭스(`1-auth.md §3.1/§3.2`)·역할 정의는 변경 없음 — 코드 변경은 검증 **경로**(guard 내 fail-fast) 만 추가했고 역할·권한 의미는 그대로.
- `app.module.ts` 의 `DiscoveryModule` 추가는 `main.ts` 의 기존 문서화된 부팅 순서(`assertProductionConfig`(env-only, app 생성 전) → app 생성 → hooks body-parser → CORS → Swagger → graceful shutdown 훅)와 충돌하지 않음 — 신규 `assertWorkspaceIdReflectionWorks(app)` 은 app 생성 직후, 기존 어떤 단계보다도 앞서 삽입되어 순서 문서와 어긋나지 않는다.
- WS 채널 구독 인가의 "비-UUID 선차단"(`6-websocket-protocol.md §3.3`)은 별개 검증 지점(`executionId`/`workflowId` path, WS 게이트웨이)이라 이번 `isUuidShaped`(X-Workspace-Id 헤더 전용)와 대상이 달라 충돌 없음.
- System Status API 의 "X-Workspace-Id 스코핑 예외(헤더 와도 무시)"(`16-system-status-api.md`)는 애초 `@WorkspaceId()` 데코레이터를 쓰지 않는 엔드포인트라 신규 형식 검증의 영향권 밖.
- `system-status.e2e-spec.ts` 가 nil UUID(`00000000-…`)를 타 워크스페이스 프로브로 쓴다는 코드 주석의 주장은 실제 파일 존재로 확인됨(파일명 대조, 내용까지는 미검증) — 근거 조작 아님.

## 요약

이번 PR 은 spec 텍스트 변경 없이 코드(RBAC 가드·데코레이터·유틸)만 하드닝했다. 데이터 모델·API 엔드포인트 shape·요구사항 ID·상태 머신·RBAC 권한 매트릭스·계층 책임 분할 등 6개 관점에서 다른 spec 영역과의 **직접 모순**은 발견되지 않았고, `workspace-reflection-canary` 가 인용하는 `data-flow/12-workspace.md` 의 "기각된 대안" 근거도 실제 이력과 일치했다. 다만 신규로 추가된 "`X-Workspace-Id` 형식 오류 → `VALIDATION_ERROR`" 400 분기가 `3-error-handling.md §1.3` 및 이를 canonical 로 인용하는 `15-chat-channel.md §5.4` 실패 응답 표에 등재되지 않아, "카탈로그가 완전하다"는 전제로 그 문서들을 읽는 후속 작업(spec 갱신·클라이언트 에러 매핑)에 사각지대를 남긴다(WARNING). reflection canary 라는 새 방어층이 원 설계 문서에 역참조되지 않은 점(INFO)도 문서 연속성 차원에서 가벼운 후속 조치 대상이다. 둘 다 즉시 배포를 막을 모순은 아니다.

## 위험도

LOW
