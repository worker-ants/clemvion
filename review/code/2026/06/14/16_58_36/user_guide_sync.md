# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

해당 없음.

## 매트릭스 적재 결과

`.claude/config/doc-sync-matrix.json` 을 적재했다. `rows[]` 총 19개 항목 확인.

## 변경 파일 및 trigger 매칭 결과

변경된 codebase 파일:

- `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — 내부 상수 이름 변경(`TERMINAL_STATUSES` → `RECONCILE_TERMINAL_STATUSES`) + JSDoc 보강. 신규 필드·라벨·에러코드·UI 문자열 없음.
- `codebase/backend/src/modules/system-status/system-status.constants.ts` — `MONITORED_QUEUES` 배열에 `TERMINAL_REVOKE_RECONCILE_QUEUE` 등록.
- `codebase/backend/test/system-status.e2e-spec.ts` — 기대 큐 이름 배열에 `'terminal-revoke-reconcile'` 추가.
- `review/code/2026/06/14/16_17_36/` 하위 파일들 — 리뷰 산출물 (matrix 대상 아님).

각 매트릭스 trigger 매칭 결과:

| 매트릭스 행 ID | trigger | 매칭 여부 | 근거 |
|---|---|---|---|
| new-node | `codebase/backend/src/nodes/**` glob | 불일치 | 변경 파일이 nodes/ 경로 아님 |
| node-schema-change | `codebase/backend/src/nodes/**` glob | 불일치 | 동일 |
| new-ui-string | semantic (TSX 신규 한국어 리터럴) | 불일치 | TSX 변경 없음 |
| integration-provider-change | semantic (신규/변경 provider) | 불일치 | provider 변경 없음 |
| new-userguide-section-dir | `codebase/frontend/src/content/docs/*/` glob | 불일치 | frontend docs 변경 없음 |
| backend-api-change | semantic (controller / DTO 변경) | 불일치 | HTTP 엔드포인트·DTO 변경 없음. system-status 큐 등록은 내부 모니터링 배열 추가로 API 표면 아님 |
| new-warning-code | semantic (warningRules 변경) | 불일치 | warningRules 변경 없음 |
| new-error-code | `codebase/backend/src/nodes/core/error-codes.ts` glob | 불일치 | 해당 파일 변경 없음 |
| new-cross-cutting-enum | semantic (cross-cutting enum 값 추가) | 불일치 | ExecutionStatus 등 cross-cutting enum 변경 없음 |
| new-backend-ui-zod-value | semantic (zod ui.label/hint 등) | 불일치 | 노출 UI label 변경 없음 |
| new-handler-output-field | semantic (output.result.* 신규 키) | 불일치 | handler output 필드 변경 없음 |
| auth-session-flow-change | semantic (`codebase/backend/src/modules/auth/**`) | 불일치 | auth 모듈 변경 없음 |
| auth-config-type-enum-change | semantic (AuthConfig type enum) | 불일치 | AuthConfig 변경 없음 |
| expression-language-change | semantic (`codebase/packages/expression-engine/**`) | 불일치 | expression-engine 변경 없음 |
| run-debug-flow-change | semantic (실행 엔진·디버그 로깅) | 불일치 | 변경은 BullMQ background reconciler 내부 상수 정리이며 사용자 가시 실행·디버깅 흐름 아님 |
| env-runtime-change | semantic (환경변수·기동방법) | 불일치 | 제품 최종 상태 기동 변경 없음 |
| spec-major-change | `spec/2-*/**` 등 glob | 불일치 | spec/ 변경 없음 |
| userguide-gui-flow-section | semantic (docs MDX 신규/변경) | 불일치 | MDX 변경 없음 |
| spec-defect-found | semantic | 불일치 | 해당 없음 |

## 요약

매트릭스 19개 trigger 전부 확인했으며 변경 파일(내부 BullMQ reconciler 상수 이름 변경, system-status 모니터링 큐 등록, e2e 큐 이름 추가, review 산출물)은 어떤 trigger 에도 매칭되지 않는다. 노드·UI·auth·표현식·통합·에러코드 등 유저 가이드 동반 갱신이 필요한 표면 변경이 없으므로 동반 갱신 누락 0건.

## 위험도

NONE
