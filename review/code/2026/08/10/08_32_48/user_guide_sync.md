# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` 의 `rows[]` 22건 (id: `new-node`, `node-schema-change`,
`new-ui-string`, `new-widget-chrome-string`, `integration-provider-change`,
`new-userguide-section-dir`, `backend-api-change`, `new-bullmq-queue`, `new-warning-code`,
`new-error-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`,
`new-handler-output-field`, `auth-session-flow-change`, `auth-config-type-enum-change`,
`expression-language-change`, `run-debug-flow-change`, `env-runtime-change`,
`spec-major-change`, `userguide-gui-flow-section`, `spec-defect-found`) 를 Read.
PROJECT.md §변경 유형 → 갱신 위치 매핑 본문은 nuance 보조로 확인.

## 변경 파일 식별

리뷰 대상 9개 파일 전부:

1. `.claude/_shared/git_probe.py`
2. `.claude/skills/code-review-agents/lib/session.py`
3. `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
4. `.claude/tests/test_consistency_bundle_priority.py`
5. `.claude/tests/test_consistency_context_budget.py`
6. `.claude/tests/test_review_session_dir_collision.py`
7. `codebase/frontend/src/lib/docs/__tests__/plan-link-integrity.test.ts`
8. `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
9. `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`

## trigger 매칭

파일 1~6은 `.claude/` 하위 — harness/orchestrator 내부 도구(git probe 공용화, 세션 디렉토리
충돌 수정, consistency orchestrator 우선순위/예산 로직)와 그 테스트다. 매트릭스의 모든 glob
trigger (`codebase/backend/src/nodes/**`, `codebase/frontend/src/**/*.tsx`,
`codebase/channel-web-chat/src/**/*.tsx`, `codebase/backend/src/modules/auth/**`,
`codebase/packages/expression-engine/**`, `codebase/backend/src/nodes/core/error-codes.ts`,
`codebase/backend/src/modules/system-status/system-status.constants.ts`,
`codebase/frontend/src/content/docs/*/`, `codebase/frontend/src/content/docs/02-nodes/**.mdx`,
`codebase/frontend/src/content/docs/06-integrations-and-config/**.mdx`,
`spec/2-*/**`~`spec/5-*/**`, `spec/conventions/**`) 어디에도 매칭되지 않는다. semantic 행들
(통합/제공자 변경, 인증·권한·세션 흐름 변경, 표현식 언어 변경, 실행·디버깅 흐름 변경,
신규 warning/error code, cross-cutting enum, handler output field 등) 도 의미상 전혀 해당하지
않는다 — 이 파일들은 어떤 사용자 가시 기능도 추가·변경하지 않는다.

파일 7~9는 `codebase/frontend/src/lib/docs/__tests__/` 하위지만, `content/docs/` (유저 가이드
MDX 본문) 가 아니라 **plan/spec 마크다운 문서 자체의 무결성을 검증하는 개발 도구 테스트**다:

- `plan-link-integrity.test.ts` — `plan/**` 내부 마크다운 링크가 깨졌는지 검사하는 ratchet 가드
- `spec-links.ts` — 위 가드와 `spec-link-integrity` 가 공유하는 링크/앵커 검증 헬퍼
- `spec-plan-completion.test.ts` — `plan/complete/**` 의 `spec_impact` frontmatter 선언 및
  `status:` 필드가 완료 상태와 모순되지 않는지 검사하는 Gate C

세 파일 모두 `lib/docs/locale.ts` 의 `SECTION_LABELS_BY_LOCALE`, `content/docs/` 의 MDX, i18n
dict, `backend-labels.ts` 어느 것도 건드리지 않으며, 매트릭스의 `new-userguide-section-dir`
(`content/docs/*/` 신규 디렉토리) trigger 도 이 파일들과 무관하다 — 신규 디렉토리를 만드는 것도
아니고, `content/docs/` 트리 자체를 다루지도 않는다.

## 결론

9개 파일 전부 harness 도구·개발 프로세스 가드(plan/spec 문서 위생 검사)이며, 사용자에게 노출되는
제품 코드(노드, UI 문자열, 통합 provider, 인증 흐름, 표현식 언어, 실행/디버깅, warning/error
code)를 전혀 변경하지 않는다. 매트릭스 22개 행 중 어느 trigger 에도 매칭되지 않는다.

## 위험도

NONE — 해당 없음 (User Guide Sync 영역과 무관).
