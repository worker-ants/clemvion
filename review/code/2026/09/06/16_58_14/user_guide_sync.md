# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 전제 확인

- `.claude/config/doc-sync-matrix.json` (SSOT, `rows[]` 22개)을 Read 했다.
- 변경 파일을 `git diff origin/main...HEAD --stat`(경로별 분할: `codebase/`, `spec/`+`plan/`+`CHANGELOG.md`, `.claude/`)으로 재확인해 orchestrator prompt 목록(파일 1~27, `review/`·`consistency/` 산출물 제외)과 대조했다. 실 코드/spec/harness 변경 파일은 총 24개(`codebase/` 22 + `spec/`·`plan/`·`CHANGELOG.md` 3 + `.claude/` 2, 단 `codebase/backend/src/common/db/pg-error.spec.ts`·`fixtures/*.ts` 등 신규 파일 포함).
- 이 changeset 은 직전 라운드(`review/code/2026/09/06/16_28_58/user_guide_sync.md`)가 분석한 것과 실질적으로 동일한 파일 집합이다(추가된 것은 harness 전용 `.claude/hooks/_lib/review_guard.py`, `.claude/tests/test_review_guard.py` 뿐이며 둘 다 매트릭스 어떤 trigger glob/semantic 범주에도 해당하지 않는다). 아래는 그 결론을 이번 스냅샷 기준으로 재검증한 것이다.

## 발견사항

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가가 `backend-api-change` trigger 를 glob 매칭하지만, 실질 갭 없음 (재확인)
  - 변경 파일: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`@ApiProperty({ format: 'date-time', nullable: true, type: String })` + `joinedAt: string | null` 신규)
  - 매트릭스 항목: `backend-api-change` — trigger glob `codebase/backend/src/**/dto/**` 매칭. targets 원문: "controller·DTO 의 swagger jsdoc" / "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 상세: (1) swagger jsdoc target 은 diff 자체가 이미 충족 — 필드 JSDoc + `@ApiProperty` 완비, 내부 서사는 `//` 로 분리해 `introspectComments` 공개 오염을 피함. (2) "user-guide 페이지" target 실측: `joinedAt` 은 이 PR **이전부터** `WorkspacesService.listMembers`(`joinedAt: m.joinedAt`)가 실제로 실어 왔고, `codebase/frontend/src/lib/api/workspaces.ts:10` 도 이미 `joinedAt: string | null` 타입을 갖고 있었다 — 이번 diff 는 e2e(`assertMatchesContract`)로 처음 배선하며 드러난 **DTO 선언 누락**을 메운 것뿐이다. `codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx` 에 "가입일"/`joinedAt` 관련 서술 없음, frontend 컴포넌트에도 `joinedAt` 렌더링 지점 없음(grep 0건) — 신규 사용자-가시 UI 표면이 없으므로 갱신할 유저 가이드 문장 자체가 없다. CHANGELOG·DTO 주석·`plan/in-progress/spec-draft-nullable-notation-followups.md` 세 곳 모두 이 파생 발견을 "곁가지"로 투명하게 기록.
  - 제안: 조치 불요. 향후 `joinedAt` 이 실제 UI(예: 멤버 목록 "가입일" 컬럼)로 노출되는 시점에 `07-workspace-and-team/workspaces-and-members.mdx` + `.en.mdx` 동반 갱신 필요하다는 점만 팀 메모로 남긴다.

- **[INFO]** `triggers.service.ts` 의 `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 신규 warningCode/errorCode 발행이 아니다 — `backend-labels.ts` 매핑 불필요
  - 변경 파일: `codebase/backend/src/modules/triggers/triggers.service.ts` (`rethrowEndpointPathConflict`, `isEndpointPathUniqueViolation` 신설)
  - 매트릭스 항목: `new-warning-code`/`new-error-code` — trigger glob 은 각각 backend `warningRules`/`codebase/backend/src/nodes/core/error-codes.ts`. targets: `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 매핑
  - 상세: 이 값은 워크플로우 실행 엔진의 노드 warning/error 코드가 아니라 HTTP 409 `ConflictException` 의 `details.code` 다. 메시지 자체가 이미 한국어 하드코딩(`'같은 워크스페이스에 그 엔드포인트 경로를 쓰는 트리거가 이미 있어요.'`)이라 `backend-labels.ts` 경유 번역 대상이 아니고, `error-codes.ts`/`ErrorCode` enum 도 변경되지 않았다(grep 확인). `spec/2-navigation/2-trigger-list.md §3`/§7 에 이미 이 계약이 문서화돼 있고 이번 PR 은 "문서한 보장이 구현보다 넓었다"를 메운 구현 정합화다 — 신규 발행이 아니라 기존 문서 계약을 실현한 것.
  - 제안: 조치 불요.

- **[INFO]** `spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md` 변경은 `spec-major-change` trigger 를 glob 매칭하나 본 reviewer 관할 밖
  - 매트릭스 항목: `spec-major-change` — targets 는 frontmatter `code:`/`status:`/`pending_plans:` 정합이며 유저 가이드(docs MDX)·i18n dict·backend-labels 와 무관. 해당 정합은 `spec-frontmatter.test.ts` 계열 가드·consistency-checker 소관(이미 이 세션에서 `naming_collision.md`/`convention_compliance.md`/`cross_spec.md`/`plan_coherence.md` 등으로 15+ 라운드 반복 검토됨).
  - 제안: 조치 불요(정보 제공용).

## 매칭되지 않은 trigger (해당 없음 확인)

전체 22개 행 중 이번 changeset 은 위 3건 외 나머지에 매칭되지 않는다:

- `new-node`/`node-schema-change` — `codebase/backend/src/nodes/**` 변경 없음
- `new-ui-string`/`new-widget-chrome-string` — `codebase/frontend/**/*.tsx`, `codebase/channel-web-chat/**/*.tsx` 변경 없음(frontend 변경은 `codebase/frontend/src/lib/api/workflows.ts` JSDoc 주석 추가 1건뿐, `.tsx` 아님)
- `integration-provider-change` — provider 관련 backend 변경 없음
- `new-userguide-section-dir` — `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음
- `new-bullmq-queue` — `system-status.constants.ts` 변경 없음
- `new-cross-cutting-enum`/`new-backend-ui-zod-value`/`new-handler-output-field` — 해당 없음
- `auth-session-flow-change` — `codebase/backend/src/modules/auth/**` 변경 없음(workspaces 모듈 변경은 있으나 auth 모듈 자체 아님, 신규/변경 production 인가 로직도 없음 — 이번 workspaces 관련 변경은 DTO 선언 누락 보정 + e2e 테스트 추가뿐)
- `auth-config-type-enum-change` — 해당 없음
- `expression-language-change` — `codebase/packages/expression-engine/**` 변경 없음
- `run-debug-flow-change` — 실행/디버그 로깅 흐름 변경 없음
- `env-runtime-change` — 해당 없음
- `userguide-gui-flow-section` — `docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx` 변경 없음
- `spec-defect-found` — 해당 없음
- `.claude/hooks/_lib/review_guard.py`, `.claude/tests/test_review_guard.py` — 매트릭스 어떤 glob/semantic 범주에도 속하지 않는 harness 전용 파일(리뷰 게이트 로직 자체)

## 요약

매트릭스 22개 행 중 glob 로 직접 매칭된 것은 `backend-api-change`(DTO 필드 추가) 1건과 `spec-major-change`(spec/conventions 변경) 1건뿐이며, `new-warning-code`/`new-error-code` 는 신규 발행이 아니라 기존 문서 계약(`spec/2-navigation/2-trigger-list.md`)의 뒤늦은 구현 정합화로 판정했다. 나머지 19개 행(신규 노드·UI 문자열·통합·섹션 디렉토리·auth 흐름·표현식·실행-디버깅 등)은 이번 changeset 에 전혀 매칭되지 않는다 — 이 PR 은 `User` 엔티티 민감 컬럼 노출 방어(검출 가드 2축) + `pg-error` 헬퍼 SoT 통합 + trigger 엔드포인트 충돌 계약 정합화 + harness 리뷰 게이트 보강이 핵심이며, frontend `.tsx`/docs/dict/i18n 파일은 changeset 에 사실상 부재하다. 매칭된 2건 모두 실측상 동반 갱신 갭이 없다(DTO 필드는 신규 UI 표면 없음, spec/conventions 는 본 reviewer 관할 밖). 동반 갱신 누락 CRITICAL/WARNING 은 0건.

## 위험도

NONE
