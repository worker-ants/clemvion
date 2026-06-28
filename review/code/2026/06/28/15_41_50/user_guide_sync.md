# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재 결과

`.claude/config/doc-sync-matrix.json` 의 `rows[]` 18개 항목 적재 완료.

## 변경 파일 식별

이번 변경 set 의 핵심 파일:

- `CHANGELOG.md`
- `codebase/backend/src/bootstrap/hooks-body-parser.ts` (신규)
- `codebase/backend/src/bootstrap/hooks-body-parser.spec.ts` (신규)
- `codebase/backend/src/common/filters/http-exception.filter.ts`
- `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (신규)
- `codebase/backend/src/main.ts`
- `codebase/backend/src/modules/hooks/hooks.controller.ts`
- `codebase/backend/src/modules/hooks/hooks.service.ts`
- `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts`
- `codebase/backend/test/webhook-trigger.e2e-spec.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`
- `plan/in-progress/spec-sync-webhook-gaps.md`
- `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`
- `review/code/2026/06/28/15_00_36/` 하위 리뷰 산출물

## 매트릭스 trigger 매칭 결과

| 매트릭스 id | 트리거 파일 | 매칭 여부 | 판정 |
|---|---|---|---|
| `new-node` | `codebase/backend/src/nodes/**` | 미매칭 | 해당 없음 |
| `node-schema-change` | `codebase/backend/src/nodes/**` | 미매칭 | 해당 없음 |
| `new-ui-string` | `codebase/frontend/src/**/*.tsx` (semantic) | 미매칭 | 해당 없음 |
| `integration-provider-change` | semantic | 미매칭 | 해당 없음 |
| `new-userguide-section-dir` | `codebase/frontend/src/content/docs/*/` | 미매칭 | 해당 없음 |
| `backend-api-change` | `codebase/backend/src/**/*.controller.ts` + semantic | 매칭(`hooks.controller.ts`) | swagger jsdoc 체크 → `main.ts` 에 `PAYLOAD_TOO_LARGE` 추가됨. 충족. |
| `new-warning-code` | semantic | 미매칭 | 해당 없음 |
| `new-error-code` | `codebase/backend/src/nodes/core/error-codes.ts` | 미매칭 (해당 파일 변경 없음) | 해당 없음 |
| `auth-session-flow-change` | `codebase/backend/src/modules/auth/**` (semantic) | 미매칭 | 해당 없음 |
| `expression-language-change` | `codebase/packages/expression-engine/**` | 미매칭 | 해당 없음 |
| `run-debug-flow-change` | semantic | 미매칭 | 해당 없음 |
| **`env-runtime-change`** | semantic — 환경 변수·기동 방법·런타임 변경 | **매칭** | 신규 env `HOOKS_MAX_BODY_BYTES` + bootstrap 변경 → `README.md` 갱신 대상 |
| `spec-major-change` | `spec/5-*/**` | 매칭 (`spec/5-system/12-webhook.md` 등) | frontmatter 정합 (spec frontmatter 갱신은 spec review 영역 — user-guide-sync 스코프 밖) |

## 발견사항

### [WARNING] 신규 `HOOKS_MAX_BODY_BYTES` 환경 변수가 `README.md` 환경 변수 섹션에 미등재

- 변경 파일: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/bootstrap/hooks-body-parser.ts` (신규)
- 매트릭스 항목: `env-runtime-change` — "환경 변수·기동 방법·런타임 변경 (제품 최종 상태)" → target: `README.md`
- 누락된 동반 갱신: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/README.md` — `## 환경 변수` 섹션 (현재 183–254행)
- 상세: `hooks-body-parser.ts` 가 `HOOKS_MAX_BODY_BYTES` env var 를 신규 도입하고(`resolveHooksMaxBodyBytes` 참조), `main.ts` 가 `bodyParser: false` 로 Nest 기본 파서를 끄고 hooks/전역 파서를 직접 등록하는 기동 방식 변경이 포함됐다. `README.md` 의 `## 환경 변수` 섹션은 다른 backend 런타임 변수들(`EXECUTION_MAX_ACTIVE_RUNNING_MS`, `TRUST_CF_CONNECTING_IP` 등)을 문서화하고 있는데, `HOOKS_MAX_BODY_BYTES` 는 이 목록에 없다. 운영자가 webhook 본문 크기를 조정하려 할 때 이 env var 를 알 수 없어 기본값(1MB)을 그대로 사용하거나 설정이 있는지 모를 수 있다.
- 제안: `README.md` 의 `## 환경 변수` > `Backend` 섹션에 아래 항목 추가:
  ```
  # Webhook Body Parser
  # /api/hooks/* 라우트 body-parser 크기 상한(기본 1MiB = 1048576). 양의 정수만 허용,
  # 16MiB(16777216) 초과 시 상한으로 클램핑. 공개 webhook 의 32KB 제한은 별도 Guard 가 관리.
  # HOOKS_MAX_BODY_BYTES=1048576
  ```

## 요약

매트릭스 18개 trigger 를 검토한 결과, 이번 변경은 `env-runtime-change` 1개 trigger 에 매칭됐다. 핵심 변경 내용(webhook body-parser 분리, 공개 webhook 보호 버그 수정)은 노드 추가/스키마 변경·i18n·UI 문자열·통합 제공자·인증 흐름·표현식 언어·실행 디버깅 흐름 관련 매트릭스 trigger 에 해당하지 않는다. 매칭된 `env-runtime-change` 에 대해 `README.md` 의 환경 변수 섹션에 `HOOKS_MAX_BODY_BYTES` 등재가 누락돼 WARNING 1건이 검출됐다. backend-labels.ts 및 유저 가이드 MDX 갱신 누락은 없다. i18n parity 이슈 없음.

## 위험도

LOW

STATUS=success ISSUES=1
