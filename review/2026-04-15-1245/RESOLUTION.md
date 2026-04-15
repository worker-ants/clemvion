# RESOLUTION — Slack / PDF 노드 제거

작업 일자: 2026-04-15

## 제거된 항목

### 백엔드
- `backend/src/nodes/presentation/pdf/` 전체 디렉토리 (스키마/컴포넌트/인덱스)
- `backend/src/nodes/integration/slack/` 전체 디렉토리
- `backend/src/modules/execution-engine/handlers/presentation/pdf.handler.ts(.spec.ts)`
- `backend/src/modules/execution-engine/handlers/integration/slack.handler.ts(.spec.ts)`
- `SERVICE_REGISTRY`에서 `slack` 항목 제거 및 `oauthProvider` 유니온에서 `slack` 제거
- `IntegrationOAuthService`의 `slack` 프로바이더·URL·team_id 분기 제거
- `IntegrationHandlerBase`의 Slack 관련 `err.data.error → SLACK_<CODE>` 로직 및 `xox[abpers]-` 시크릿 패턴 제거
- `backend/package.json`에서 `@slack/web-api` 의존성 제거, lockfile 갱신
- import-workflow DTO의 `ALLOWED_NODE_TYPES`에서 `slack`·`pdf` 제거
- `migrate-node-output-refs.ts`의 `slack` 필드 매핑 제거

### 프론트엔드
- `override-registry.ts`에서 `SlackConfig` 매핑 및 pdf 주석 제거
- `integration-configs.tsx`에서 `SlackConfig` 컴포넌트 전체 삭제
- `presentation-configs.tsx`에서 `PdfConfig` 컴포넌트 전체 삭제
- `presentation-renderers.tsx`의 `PdfContent` 렌더러 및 `'pdf'` case 제거, `FileDown` 미사용 import 정리
- `node-config-summary.ts`의 `slackSummary`, `pdfSummary` 함수 및 FORMATTERS 엔트리 제거
- `service-icons.tsx`의 slack 매핑 및 `MessageSquare` import 제거
- 테스트 파일에서 slack/pdf 전용 테스트 제거, 일반 예시로 사용되던 `"slack"`은 `"http"`/`"google"`/`"http_request"`로 치환

### 스펙 / PRD
- `spec/4-nodes/4-integration-nodes.md`의 §4 Slack 섹션 및 §10.4 Slack 핸들러 계약 삭제
- `spec/4-nodes/6-presentation-nodes.md`의 §6 PDF 섹션 및 §8.6 PDF Run Results 항목 삭제
- `spec/4-nodes/0-overview.md`, `spec/1-data-model.md`, `spec/3-workflow-editor/0-canvas.md`, `spec/3-workflow-editor/1-node-common.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/5-webhook.md`, `spec/2-navigation/{0-dashboard,4-integration,6-execution-history,8-marketplace,9-user-profile}.md` 및 `prd/{0-overview,1-navigation,3-node-system,4-integration,8-webhook}.md`에서 Slack/PDF 관련 행·예시·참조 제거 또는 대체

## 유지된 항목 (의도적)

- `backend/src/modules/knowledge-base/parsers/pdf.parser.ts` 및 `pdf-parse` 의존성 — Knowledge Base 문서 업로드용
- DB 마이그레이션의 `file_type = 'pdf'` 제약 — KB 업로드 포맷
- `spec/5-system/8-embedding-pipeline.md`, `spec/2-navigation/5-knowledge-base.md`, `prd/6-phase2-ai.md`, `prd/4-integration.md` §3.1, `spec/5-system/2-api-convention.md`의 PDF 참조 (KB 문서 관련)
- `spec/4-nodes/6-presentation-nodes.md`의 `application/pdf` MIME 타입 (Form 노드 파일 업로드 허용 타입)
- `if-else.handler.spec.ts`의 `.pdf` 문자열 (endsWith 연산자 테스트 데이터)
- `template.handler.spec.ts`의 `outputFormat: 'pdf'` 테스트 — 이는 템플릿이 pdf를 **거부**하는 동작을 확인하는 유효성 테스트이므로 유지
- `packages/expression-engine`의 `endsWith("hello.pdf", ".pdf")` 테스트 — 순수 문자열 함수 테스트

## 이름만 변경된 참조

- `integration-expiry-scanner.service.spec.ts`: `My Slack`/`Team Slack` → `My Service`/`Team Integration`
- `integrations.service.spec.ts`: fixture `slack` → `google`, `node_type: slack-send/user` → `http-send/user`
- `integration-oauth.service.spec.ts`: `slack` → `google`, `SLACK_CLIENT_ID` → `GOOGLE_CLIENT_ID`, Slack scope → Google scope
- `integration-handler-base.spec.ts`: `serviceType: 'slack'` → `'http'`
- `send-email.handler.spec.ts`: 잘못된 타입 테스트의 `'slack'` → `'http'`
- `oauth-callback.template.spec.ts`: `provider: 'slack'` → `'google'`
- 프론트엔드 테스트의 일반 예시 `"slack"` → `"http"`/`"http_request"`
- 프론트엔드 `integration-selector.test.tsx`: `Slack` CTA → `HTTP` CTA
- DTO 예시 문자열: `Marketing Slack`/`Team Slack (renamed)` → `Marketing Google`/`Team Google (renamed)`
- 각종 Swagger 예시 설명에서 `Slack 알림 플로우` → `이메일 알림 플로우` 등

## 검증 결과

| 단계 | 결과 |
|------|------|
| backend lint | 통과 (488 issues: 79 pre-existing errors + 409 warnings; 변경으로 인한 신규 오류 없음. 기존 522건 대비 34건 감소) |
| backend unit test | ✅ 81 suites / 1125 tests 전부 통과 |
| backend build | ✅ nest build 성공 |
| frontend lint | ✅ 통과 (에러·경고 없음) |
| frontend test | ✅ 41 files / 560 tests 전부 통과 |
| frontend build | ✅ next build 성공 |

## 의사 결정 메모

- `spec/4-nodes/4-integration-nodes.md`의 §4.x, §5.x 하위 섹션 번호가 상위 섹션 번호 변경에 따라 비일관(예: `## 4. Google Sheets` 아래에 `### 5.1 Config`)이 되었으나 대량의 내부 참조를 손상시키지 않도록 하위 번호는 그대로 두었다. 필요 시 별도 정리 대상.
- 과거 상태 문서(`plan/stage9-status.md` 등)의 slack/pdf 언급은 당시 시점의 기록이므로 그대로 유지하고 별도 obsolete 표기는 하지 않았다.
- `template.handler.spec.ts`의 `outputFormat: 'pdf'` 라인은 템플릿 노드가 pdf 포맷을 거부하는 동작을 검증하는 테스트이므로 유지.
