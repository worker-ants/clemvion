# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [WARNING] Discord 통합 docs MDX — 신규 `languageHints` 키 및 Form 필드 길이 제약 누락

- **변경 파일**: `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts`, `codebase/backend/src/modules/chat-channel/shared/form-mode.ts`, `codebase/backend/src/modules/chat-channel/types.ts`
- **매트릭스 항목**: `integration-provider-change` — `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키`
- **누락된 동반 갱신**:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx`
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx`
- **상세**: 이번 PR 은 Discord 어댑터에 다음 사용자-노출 기능을 추가했다.
  1. `§3.3` — `formConfig.title` 를 modal 제목으로 반영 (최대 45자 truncate). fallback 우선순위: `params.title` → `languageHints.formModalTitle` → `'양식'`.
     - `languageHints.formModalTitle` 은 기존 docs 어디에도 문서화되지 않은 새 key 다. 운영자가 이 key 를 모르면 default `'양식'` 을 바꿀 수 없어 사용자 경험이 제한된다.
  2. `§3.3` — `FormModalField.minLength` / `maxLength` 가 추가되어 `extractFormFields` 가 `field.validation.{minLength,maxLength}` 를 Discord TEXT_INPUT의 `min_length`/`max_length` 로 전달한다.
     - Form 노드에서 길이 제약을 설정한 경우 Discord modal 에서 입력 시점 제약이 적용됨을 사용자가 알아야 한다.
  3. `languageHints.replyModalTitle` / `replyModalLabel` — 코드에는 이미 존재하지만 docs 에 미문서화 (기존 debt, 본 PR 로 인해 관련 기능이 완성됨).
  현재 discord.mdx §7(안내 메시지 커스터마이즈)에는 `executionFailed*` 6종만 표기되어 있고, `formModalTitle` / `replyModalTitle` / `replyModalLabel` / `formOpenLabel` / `sessionExpired` 키는 미기재다.
- **제안**:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx` §7 의 `languageHints` 키 목록에 `formModalTitle`(form modal 제목 override, default `'양식'`) 추가
  - 동일 내용을 `discord.en.mdx` 에도 반영 (i18n parity — KO/EN 동시 필수)
  - Form 섹션(§4 Form)에 "필드 길이 제약" 설명 추가: `field.validation.minLength`/`maxLength` 설정 시 Discord modal TEXT_INPUT 에서 입력 시점 검증이 활성화됨을 명시

---

### [INFO] `spec/4-nodes/7-trigger/providers/discord.md` 변경 — `spec-major-change` 프론트매터 상태 검토

- **변경 파일**: `spec/4-nodes/7-trigger/providers/discord.md`
- **매트릭스 항목**: `spec-major-change` — `frontmatter code: / status: / pending_plans: 정합 갱신`
- **누락된 동반 갱신**: 없음 (이미 갱신됨)
- **상세**: `spec/4-nodes/7-trigger/providers/discord.md` 의 프론트매터를 확인한 결과:
  - `status: partial` 유지 — 이미지/embeds 등 보류 항목이 남아 있어 `partial` 이 올바름
  - `pending_plans: plan/in-progress/spec-sync-discord-gaps.md` 유지 — 보류 항목이 남아있어 plan 유지가 올바름
  - `code:` 블록에 `form-mode.ts` / `form-mode.spec.ts` / `types.ts` 가 추가되지 않았으나 이 파일들은 chat-channel 공통 모듈이라 discord 특화 code: 글로브 목록에 포함 의무가 있는지 모호함 — INFO 등급. 단, 본 PR 의 변경이 discord §3.3 spec 본문에서 직접 구현했으므로 code: 에 포함하면 traceability 가 높아짐.
- **제안**: 선택 사항 — `spec/4-nodes/7-trigger/providers/discord.md` 의 `code:` 목록에 `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` 를 추가해 §3.3 구현 traceability 보강 (가드 테스트 `spec-code-paths.test.ts` 매칭 여부 확인 필요).

---

## 요약

doc-sync-matrix 의 19개 trigger 중 변경 파일이 매칭된 trigger 는 2개(`integration-provider-change` — semantic, `spec-major-change` — glob). `spec-major-change` 프론트매터는 이미 정합하게 갱신되었다. `integration-provider-change` 에서 Discord docs MDX (`discord.mdx` + `discord.en.mdx`) 에 신규 `languageHints.formModalTitle` 키와 Form 필드 길이 제약(`minLength`/`maxLength`) 동반 갱신이 누락되어 1건 WARNING 이 발생했다. 나머지 trigger (`new-node`, `node-schema-change`, `new-ui-string`, `auth-session-flow-change`, `expression-language-change`, `new-warning-code`, `new-error-code` 등)는 변경 파일이 해당 trigger glob/semantic 조건에 매칭되지 않는다.

## 위험도

LOW
