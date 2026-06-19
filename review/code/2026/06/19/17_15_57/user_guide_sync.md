# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 매트릭스 적재

- SSOT: `/Volumes/project/private/clemvion/.claude/config/doc-sync-matrix.json` — 총 18개 row 적재 완료.
- 변경 파일 2개:
  1. `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
  2. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`

## Trigger 매칭 결과

| 매트릭스 row | glob/semantic | 매칭 여부 | 근거 |
|---|---|---|---|
| `new-node` | glob `codebase/backend/src/nodes/**` | 불일치 | 변경 파일은 `execution-engine/` 경로, `nodes/` 아님 |
| `node-schema-change` | glob `codebase/backend/src/nodes/**` | 불일치 | 동상 |
| `new-error-code` | glob `codebase/backend/src/nodes/core/error-codes.ts` | 불일치 | `error-codes.ts` 미변경. `WORKFLOW_FORBIDDEN_WORKSPACE` 는 `ErrorCode` enum 이 아닌 `new Error(...)` 메시지 문자열로 throw 됨 |
| `new-warning-code` | semantic | 불일치 | `warningRules` 변경 없음 |
| `auth-session-flow-change` | semantic | 불일치(INFO) | 변경 파일은 `auth/` 경로 아님. `assertSameWorkspace` 는 execution-engine 내부 workspace 격리 가드이며 사용자가 직접 조작하는 인증·세션 흐름이 아님 |
| `run-debug-flow-change` | semantic | 불일치(INFO) | 실행 엔진 내부 보안 가드(fail-closed 전환)로, `05-run-and-debug/` 가 다루는 사용자 대면 실행·디버그 흐름과 직접 연관 없음 |
| `new-backend-ui-zod-value` | semantic | 불일치 | 신규 `ui.label`/`hint`/`group` 값 없음 |
| `new-cross-cutting-enum` | semantic | 불일치 | 신규 enum 값 없음 |
| 나머지 10개 row | — | 불일치 | 해당 파일/변경 유형과 무관 |

## 발견사항

해당 없음.

변경 내용은 아래 두 가지로 구성된다.

1. `execution-engine.service.ts` — `assertSameWorkspace` private 메서드가 fail-open(경고 로그 후 통과)에서 fail-closed(`WORKFLOW_FORBIDDEN_WORKSPACE: ...` 메시지로 `throw new Error(...)`)로 전환됨. 이 문자열은 `ErrorCode` enum(`error-codes.ts`)에 등록된 코드 값이 아니므로 `new-error-code` 매트릭스 row 의 glob trigger 에 해당하지 않음. `backend-labels.ts` 의 `ERROR_KO` 는 `ErrorCode` enum 키 → 한국어 매핑 테이블로, 임의 `Error.message` 문자열을 룩업하지 않음. 이 오류는 sub-workflow 핸들러(`workflow.handler.ts`)를 거쳐 노드 실행 실패(내부 인프라 오류)로 처리되며 사용자에게 직접 노출되는 i18n 라벨 경로를 타지 않음.

2. `execution-engine.service.spec.ts` — 위 fail-closed 전환에 대한 단위 테스트 보강(W-6 케이스: 호출자 workspace 컨텍스트 누락·불일치·일치 세 케이스). 테스트 파일만의 변경은 docs/i18n 동반 갱신 대상이 아님.

18개 matrix row 전부 검토 → 매칭 trigger 0건, 누락된 동반 갱신 0건.

## 요약

doc-sync 매트릭스 18개 row 전부를 검토한 결과 변경 파일 2개(`execution-engine.service.spec.ts`, `execution-engine.service.ts`)는 어떤 trigger 에도 매칭되지 않는다. `WORKFLOW_FORBIDDEN_WORKSPACE` 는 `ErrorCode` enum 등록 코드가 아닌 plain Error 메시지 문자열로, `new-error-code` row 의 glob(`error-codes.ts`)에 해당하지 않으며 `backend-labels.ts` 매핑 대상도 아니다. 동반 갱신 누락 0건.

## 위험도

NONE

STATUS=success ISSUES=0
