# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

해당 없음. 변경 파일 집합이 doc-sync-matrix.json 의 어떤 trigger 에도 매칭되지 않습니다.

**매트릭스 적재**: `.claude/config/doc-sync-matrix.json` 19개 rows 정상 적재.

**변경 파일 집합 (git diff main..HEAD)**:

- `codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts`
- `codebase/backend/src/modules/chat-channel/shared/form-mode.ts`
- `codebase/backend/src/modules/chat-channel/types.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `plan/in-progress/form-validation-minmax-pattern.md`
- `plan/in-progress/spec-sync-form-gaps.md`
- `review/consistency/2026/06/14/22_22_50/` (consistency review 산출물)
- `spec/2-navigation/2-trigger-list.md`
- `spec/4-nodes/6-presentation/4-form.md`
- `spec/5-system/14-external-interaction-api.md`

**trigger 매칭 결과**:

| 매트릭스 행 (id) | 매칭 여부 | 근거 |
|---|---|---|
| new-node (glob: `codebase/backend/src/nodes/**`) | 불일치 | 변경 파일은 `src/modules/chat-channel/` — `src/nodes/` 하위 아님 |
| node-schema-change (glob: `codebase/backend/src/nodes/**`) | 불일치 | 동일 이유. `FormModalField` 변경은 `src/modules/chat-channel/types.ts` |
| new-ui-string (semantic: TSX 신규 한국어 리터럴) | 불일치 | TSX 파일 변경 없음 |
| integration-provider-change (semantic) | 불일치 | 통합/제공자 변경 없음 |
| new-userguide-section-dir (glob: `codebase/frontend/src/content/docs/*/`) | 불일치 | frontend docs 변경 없음 |
| backend-api-change (glob: `*.controller.ts`, `**/dto/**`) | 불일치 | 컨트롤러·DTO 파일 변경 없음 |
| new-warning-code (semantic) | 불일치 | 신규 warningRule 추가 없음 (I15 확인: 기존 에러 코드 체계 재사용) |
| new-error-code (glob: `error-codes.ts`) | 불일치 | `error-codes.ts` 변경 없음 |
| new-backend-ui-zod-value (semantic) | 불일치 | 신규 zod ui.label/hint/group/itemLabel 값 없음 |
| new-handler-output-field (semantic) | 불일치 | 신규 `output.result.*` 키 없음 |
| auth-session-flow-change (semantic) | 불일치 | 인증·세션 흐름 변경 없음 |
| expression-language-change (glob: `codebase/packages/expression-engine/**`) | 불일치 | 해당 경로 변경 없음 |
| run-debug-flow-change (semantic) | 불일치 | `execution-engine.service.ts` 변경은 docstring 수정 한정 — 실행 흐름 변경 아님 |
| spec-major-change (glob: `spec/4-*/**, spec/5-*/**`) | 매칭됨 | `spec/4-nodes/6-presentation/4-form.md`, `spec/5-system/14-external-interaction-api.md` 변경 |
| new-cross-cutting-enum (semantic) | 불일치 | cross-cutting enum 변경 없음 |
| env-runtime-change (semantic) | 불일치 | 환경 변수·기동 방법 변경 없음 |
| userguide-gui-flow-section (semantic) | 불일치 | 이 trigger 는 docs MDX 파일 변경 시 ImplAnchor 동반 의무 — 본 PR 은 docs MDX 변경 없음 |
| auth-config-type-enum-change (semantic) | 불일치 | AuthConfig type enum 변경 없음 |
| spec-defect-found (semantic) | 불일치 | spec 자체 결함 발견 케이스 아님 |

**spec-major-change 행 상세 분석**:

`spec-major-change` trigger (`spec/2-*/**, spec/4-*/**, spec/5-*/**` glob) 에 `spec/4-nodes/6-presentation/4-form.md` 및 `spec/5-system/14-external-interaction-api.md` 가 매칭됩니다. 이 행의 targets 는 유저 가이드 docs MDX 가 아니라 "frontmatter `code:` / `status:` / `pending_plans:` 정합 갱신" — spec 내부 메타데이터 정합입니다. 본 PR 은 `4-form.md` 의 `§6.2` Planned→구현 동기화와 Rationale 갱신을 수행했으며, 이는 spec frontmatter status 정합에 해당합니다. 이 검토는 spec-coverage/spec-frontmatter 영역이며 유저 가이드 동반 갱신 reviewer 의 판정 범위 밖입니다.

**FormModalField 타입 변경 관련**:

`types.ts` 의 `FormModalField` 에 `min?`/`max?`/`pattern?` 필드가 추가됐지만 이 필드들은 JSDoc 에 명시된 것처럼 "서버측 검증 전용 — chat-channel modal UI hint 미사용"입니다. Form 노드의 사용자 설정 스키마(`src/nodes/presentation/form/form.schema.ts` `validationRuleSchema`)는 이미 이 필드들을 보유하고 있었으며, 본 PR 은 runtime 검증 로직만 구현합니다. 노드 사용자 가이드(`02-nodes/`)의 FieldTable 에 net-new 필드가 추가된 것이 아닙니다.

## 요약

매트릭스 19개 trigger 중 glob 매칭되는 행(`spec-major-change`)이 1건 있으나, 그 행의 target 은 유저 가이드 docs MDX/i18n dict/backend-labels 가 아닌 spec frontmatter 정합입니다. 나머지 trigger 와는 모두 불일치. 변경 집합은 `src/modules/chat-channel/` 내부 서버측 검증 로직 확장이며, `src/nodes/**` 노드 schema 변경·신규 UI 문자열·신규 warningCode/errorCode·신규 통합 제공자 등 유저 가이드 동반 갱신을 요구하는 trigger 에 해당하지 않습니다. 동반 갱신 누락 0건.

## 위험도

NONE
