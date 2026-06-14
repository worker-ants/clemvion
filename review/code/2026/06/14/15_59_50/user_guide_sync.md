# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

해당 없음.

## 매트릭스 적재 결과

`.claude/config/doc-sync-matrix.json` 에서 18개 row 적재 완료.

## 변경 파일 목록 (trigger 분석 대상)

```
codebase/backend/src/modules/external-interaction/external-interaction.module.ts
codebase/backend/src/modules/external-interaction/interaction-token.service.ts
codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts
codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts
codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.spec.ts
codebase/backend/src/modules/external-interaction/interaction.service.ts
codebase/backend/src/modules/external-interaction/interaction.service.spec.ts
codebase/backend/src/modules/execution-engine/* (여러 파일)
codebase/backend/src/modules/llm/*, codebase/backend/src/modules/metrics/*
codebase/backend/test/external-interaction.e2e-spec.ts
plan/complete/spec-fix-eia-token-error-codes.md
spec/5-system/14-external-interaction-api.md (+ 기타 spec 파일)
```

## trigger 매칭 결과

| 매트릭스 row | trigger glob/semantic | 매칭 여부 | 근거 |
|---|---|---|---|
| new-node | `codebase/backend/src/nodes/**` | 불일치 | 변경 파일 경로가 `nodes/` 하위가 아닌 `modules/external-interaction/` |
| node-schema-change | `codebase/backend/src/nodes/**` | 불일치 | 동일 |
| new-ui-string | TSX semantic | 불일치 | TSX 파일 변경 없음 |
| integration-provider-change | semantic | 불일치 | 신규 provider 없음 |
| new-userguide-section-dir | `codebase/frontend/src/content/docs/*/` | 불일치 | frontend docs 디렉토리 변경 없음 |
| backend-api-change | `*.controller.ts`, `dto/**` | 불일치 | controller/DTO 변경 없음 |
| new-warning-code | semantic (warningRules) | 불일치 | warningRules 변경 없음 |
| new-error-code | `src/nodes/core/error-codes.ts` | 불일치 | 해당 파일 변경 없음 |
| new-cross-cutting-enum | semantic | 불일치 | cross-cutting enum 추가 없음 |
| new-backend-ui-zod-value | semantic | 불일치 | zod ui.label/hint/group 값 추가 없음 |
| new-handler-output-field | semantic | 불일치 | output.result.* 신규 키 없음 |
| auth-session-flow-change | `codebase/backend/src/modules/auth/**` semantic | 불일치 | 변경 위치가 `auth/` 가 아닌 `external-interaction/`. 토큰 revoke reconciler는 EIA 내부 인프라이며 `07-workspace-and-team/` 사용자 안내 대상 인증·세션 흐름 변경 아님 |
| auth-config-type-enum-change | semantic | 불일치 | AuthConfig type enum 변경 없음 |
| expression-language-change | `codebase/packages/expression-engine/**` semantic | 불일치 | expression-engine 변경 없음 |
| run-debug-flow-change | semantic | 불일치 | BullMQ 백그라운드 reconciler는 내부 인프라 — 사용자 가시 실행·디버깅 흐름 변경 아님 |
| env-runtime-change | semantic | 불일치 | `TERMINAL_REVOKE_RECONCILE_QUEUE` 는 내부 상수이며 사용자 설정 env var 아님 |
| spec-major-change | `spec/2-*/**`, `spec/5-*/**`, `spec/conventions/**` | 글로브 매칭되나 본 reviewer 범위 外 | spec 파일(`spec/5-system/14-external-interaction-api.md`, `spec/conventions/error-codes.md` 등)이 변경됐으나, 이 row 의 target 은 spec frontmatter `code:/status:/pending_plans:` 정합이며 user-guide docs MDX·i18n·backend-labels 동반 갱신과 무관. spec 내부 일관성 검증은 consistency-checker 영역 |
| userguide-gui-flow-section | `codebase/frontend/src/content/docs/02-nodes/**`, `06-integrations-and-config/**` semantic | 불일치 | frontend docs MDX 변경 없음 |

## 요약

매트릭스 18개 trigger 전수 검토 결과 이번 변경 set(`TerminalRevokeReconcilerService` 신설, `InteractionTokenService.reconcileTerminalRevocations()` 추가, BullMQ 큐 등록, unit/e2e 테스트)은 어떤 user-guide 동반 갱신 trigger 에도 해당하지 않는다. 변경은 backend 내부 인프라(durable 토큰 revoke 스케줄러)이며, 노드 추가·UI 문자열·통합 provider·에러 코드 enum·표현식 언어·실행 흐름 등 docs MDX/i18n/backend-labels 갱신을 요구하는 어떤 표면도 건드리지 않는다. 매칭 0건 / 누락 0건.

## 위험도

NONE
