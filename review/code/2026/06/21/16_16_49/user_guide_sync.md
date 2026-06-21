# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

해당 없음. 매트릭스의 모든 trigger 를 대상으로 변경 파일 목록을 검토한 결과 매칭되는 trigger 가 없다.

## 매트릭스 적재 및 검토 내역

`.claude/config/doc-sync-matrix.json` 의 `rows[]` 19개 항목 전체를 검토했다.

변경 파일 목록 (18개):
- `codebase/backend/src/common/utils/uuid.ts` / `uuid.spec.ts` — UUID 공통 유틸 신설
- `codebase/backend/src/modules/executions/execution-channel-authorizer.ts` / `.spec.ts`
- `codebase/backend/src/modules/executions/background-runs/background-run-channel-authorizer.ts` / `.spec.ts`
- `codebase/backend/src/modules/executions/executions.module.ts`
- `codebase/backend/src/modules/knowledge-base/kb-channel-authorizer.ts` / `.spec.ts`
- `codebase/backend/src/modules/knowledge-base/knowledge-base.module.ts`
- `codebase/backend/src/modules/websocket/channel-authorizer.ts`
- `codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts` / `.spec.ts`
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` / `.spec.ts`
- `codebase/backend/src/modules/websocket/websocket.module.ts`
- `codebase/backend/src/modules/workflows/workflow-channel-authorizer.ts` / `.spec.ts`

**trigger 별 매칭 결과:**

| id | 판정 | 근거 |
|---|---|---|
| new-node | 불일치 | `codebase/backend/src/nodes/**` 에 해당하는 변경 없음 |
| node-schema-change | 불일치 | 동상 |
| new-ui-string | 불일치 | TSX 파일 변경 없음 |
| integration-provider-change | 불일치 | 신규/변경 provider 없음 |
| new-userguide-section-dir | 불일치 | 프론트엔드 docs 디렉토리 변경 없음 |
| backend-api-change | 불일치 | controller / DTO 변경 없음 |
| new-warning-code | 불일치 | warningRules 변경 없음 |
| new-error-code | 불일치 | `error-codes.ts` 변경 없음 |
| new-cross-cutting-enum | 불일치 | CHANNEL_AUTHORIZER 는 Symbol DI 토큰이며 cross-cutting enum registry 대상 아님 |
| new-backend-ui-zod-value | 불일치 | Zod ui.label/hint/group 변경 없음 |
| new-handler-output-field | 불일치 | handler output field 변경 없음 |
| auth-session-flow-change | 불일치 | `codebase/backend/src/modules/auth/**` 변경 없음. WebSocket 채널 인가 DI 리팩터링으로, handleSubscribe 로직·구독 실패 ack 계약은 명시적으로 무변(커밋 메시지). 사용자에게 노출되는 인증·세션 흐름 변경 아님 |
| expression-language-change | 불일치 | `codebase/packages/expression-engine/**` 변경 없음 |
| run-debug-flow-change | 불일치 | 실행·디버깅 흐름(사용자 가시)은 변경 없음. 내부 DI 리팩터링만 |
| env-runtime-change | 불일치 | 환경변수·기동 방법 변경 없음 |
| spec-major-change | 불일치 | spec/ 파일 변경 없음 |
| userguide-gui-flow-section | 불일치 | MDX 변경 없음 |
| spec-defect-found | 해당없음 | spec 결함 판단 없음 |

## 요약

매트릭스 trigger 19개 중 매칭된 항목 0개, 누락된 동반 갱신 0개. 본 변경(M-7 채널 authorizer 도메인 역전)은 백엔드 NestJS DI 구조 리팩터링으로, `src/nodes/**` / `auth/**` / 프론트엔드 / expression-engine 에 해당하지 않으며 사용자 가시 동작(handleSubscribe 로직·구독 실패 ack 계약) 변경도 없으므로 유저 가이드 동반 갱신 의무가 발생하지 않는다.

## 위험도

NONE
