# 신규 식별자 충돌 검토 — `spec/conventions/audit-actions.md`

## 발견사항

### [WARNING] `§2` 규칙과 `§3` 레지스트리의 `workspace` 이중 패턴 표기 간 내부 긴장

- **target 신규 식별자**: `workspace` resource 가 §3 레지스트리에서 §2.3(도메인 고유 동사: `transfer_ownership`)과 §2.1(과거분사: `created`/`updated`/`deleted`) **두 행으로 동시 등록**됨
- **기존 사용처**: `spec/conventions/audit-actions.md` §2 본문 — "verb 시제는 아래 세 패턴 중 하나를 **도메인(resource) 단위로 일관** 적용한다. **한 resource 안에서 패턴을 혼용하지 않는다.**"
- **상세**: §2 규칙은 resource 단위로 하나의 패턴만 선택한다고 명시한다. §3 레지스트리의 `workspace` 두 행은 §3 내 각주로 "분류 기준은 resource 이름이 아니라 그 verb 가 어느 패턴에 속하는가" 라고 해명하지만, §2 본문 규칙(한 resource 안에서 혼용 금지)을 **수정·예외화하는 문장이 §2 본문에는 없다**. 신규 action 을 추가하는 개발자가 §2 만 읽으면 `workspace` 에 §2.3 패턴 verb 를 추가하면 안 된다고 오해할 수 있고, §3 각주만 읽으면 혼용을 자유롭게 허용하는 것으로 읽힐 수 있다.
- **제안**: §2 본문에 "단, §2.3 예외 verb(도메인 고유 단일 행위)는 같은 resource 에 §2.1/§2.2 패턴이 이미 있어도 공존 가능 — 분류 기준은 resource 이름이 아니라 verb 의 성격이다(§3 레지스트리 `workspace` 참조)" 한 줄을 추가해 §2 규칙과 §3 각주의 긴장을 §2 단계에서 해소한다.

---

### [INFO] `spec/conventions/audit-actions.md` 의 spec ID `audit-actions` — 기존 충돌 없음

- **target 신규 식별자**: frontmatter `id: audit-actions`
- **기존 사용처**: `spec/conventions/` 내 다른 파일들의 `id:` 값 목록(cafe24-restricted-scopes, interaction-type-registry, rag-evaluation, migrations, execution-context, makeshop-api-metadata, cafe24-api-metadata, node-output, spec-impl-evidence, cross-node-warning-rules, secret-store, data-hydration-surfaces, node-cancellation, i18n-userguide, conversation-thread, user-guide-evidence, swagger, chat-channel-adapter, error-codes 등) 중 `audit-actions` 와 동일한 값은 없음.
- **상세**: 충돌 없음. 파일명(`audit-actions.md`)과 `id` 가 일치하며 kebab-case 규약 준수.
- **제안**: 없음.

---

### [INFO] `§3` 레지스트리의 `auth_config` 상태 표기(`구현`) — 기존 spec 과 정합

- **target 신규 식별자**: `auth_config` resource 의 `create`, `update`, `delete`, `regenerate`, `reveal` 5종을 모두 "구현" 으로 표기
- **기존 사용처**: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 의 `AUDIT_ACTIONS` — `AUTH_CONFIG_CREATE`/`AUTH_CONFIG_UPDATE`/`AUTH_CONFIG_DELETE`/`AUTH_CONFIG_REGENERATE`/`AUTH_CONFIG_REVEAL` 5종 모두 존재. `spec/data-flow/1-audit.md` §1.1 구현 표에도 5종 모두 등재.
- **상세**: `plan/in-progress/auth-config-webhook-followups.md` 에서 CREATE/UPDATE/DELETE/REGENERATE 4종 추가가 완료 체크됨(`[x]`). target 표기와 실제 구현 현황 일치. 충돌 없음.
- **제안**: 없음.

---

### [INFO] `§3` 레지스트리의 `user` 상태 표기(`구현`) — 기존 spec 과 정합

- **target 신규 식별자**: `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 를 "구현" 으로 표기
- **기존 사용처**: `spec/5-system/1-auth.md §4.1` 및 `spec/data-flow/1-audit.md §1.1`, `audit-action.const.ts`(`USER_PASSWORD_CHANGED`/`USER_2FA_ENABLED`/`USER_2FA_DISABLED`) — 모두 일치.
- **상세**: 충돌 없음.
- **제안**: 없음.

---

### [INFO] `model_config.set-default` — 하이픈 표기 기존 사용처와 일관

- **target 신규 식별자**: `model_config.set-default` (verb 에 하이픈 포함)
- **기존 사용처**: `spec/2-navigation/6-config.md` line 277 (`PATCH /api/model-configs/:id/set-default`), `spec/5-system/1-auth.md` line 376, `spec/data-flow/7-llm-usage.md` line 49 — 모두 `set-default` (하이픈) 표기 일관.
- **상세**: 충돌 없음. API 경로의 `set-default` 세그먼트와 동일 표기. `set_default`(언더스코어) 혼용 없음.
- **제안**: 없음.

---

## 요약

`spec/conventions/audit-actions.md` 가 도입하는 `id: audit-actions` 식별자는 기존 conventions 파일 IDs 와 충돌하지 않는다. 레지스트리에 등록된 action 식별자들(`user.*`, `auth_config.*`, `integration.*`, `execution.*`, `workspace.*`, `member.*`, `workflow.*`, `trigger.*`, `schedule.*`, `model_config.*`)은 모두 기존 spec(`1-auth.md §4.1`, `data-flow/1-auth.md §1.1`) 및 구현 코드(`audit-action.const.ts`)와 값·상태 표기가 일치한다. 주요 긴장 지점은 §2 본문의 "한 resource 안에서 패턴 혼용 금지" 규칙과 `workspace` 가 §3 레지스트리에서 두 패턴에 걸쳐 등록된 사이의 불일치다 — §3 각주로 설명됐으나 §2 본문에 예외가 명시되지 않아 미래 기여자가 규칙만 읽을 때 혼선이 생길 수 있다. API endpoint·파일 경로·환경변수·이벤트명 신규 도입은 없다.

## 위험도

LOW
