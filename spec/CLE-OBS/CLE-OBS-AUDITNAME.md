---
id: "CLE-OBS-AUDITNAME"
title: "감사 action 명명"
type: "convention"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-OBS"
ancestors: ["CLE-VISION", "CLE-OBS"]
area: "CLE-OBS"
content_hash: "495b4ecebc4a288691b6ed2479995fc86f0fadeb65d83d6055ee941a7f79981f"
read_as: "approved"
task: null
source_paths: ["spec/5-system/1-auth.md", "spec/conventions/audit-actions.md"]
mirror_sha256: "0cf939023143f094045a5f586d940e7c8a15cf08877fc24437eabaec41c743b0"
etag: "sha256-84065e9d0916406d2f09aeef80e5a2c45194155b001c0256f1abab22d2ede9c7"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/audit-actions.md`, `spec/5-system/1-auth.md` (Rationale 4.1.A) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 감사 액션(audit action, `AuditLog.action`) 식별자를 짓는 규칙을 정한다. 감사 로그 한 행이 어떤 동작을 기록했는지 나타내는 문자열이 감사 액션이다(예: `integration.created`).

이 문서가 정하는 것은 세 가지다.

1. `<resource>.<verb>` 구조 규칙
2. 동사 시제를 고르는 세 갈래
3. resource 마다 어느 갈래를 쓰는지 정리한 분류표

범위 밖:

- 어떤 감사 액션이 있고 구현됐는지(카탈로그), 워크스페이스 귀속, 조회 응답을 읽는 쪽의 계약, 적재·조회·보존은 [감사 로그](CLE-OBS-AUDIT.md) 가 정한다.
- 구현의 단일 기준은 코드의 `AUDIT_ACTIONS` union(`audit-action.const.ts`)이다. 이 문서의 규칙을 어긴 이름은 그 union 에 들어갈 수 없다.

## 규칙

1. 모든 감사 액션은 `<resource>.<verb>` 형식이다. 점 앞의 resource 접두는 필수다. 조회 필터와 그룹이 이 접두를 기준으로 동작한다.
2. resource 접두가 없는 표기는 금지한다. 예전 `re_run_initiated` 가 이 규칙을 어겼고 cross-audit G-02 에서 `execution.re_run` 으로 고쳤다.
3. 새 감사 액션은 `AUDIT_ACTIONS` union 에 먼저 더한 뒤에 쓴다. 호출부에 문자열을 직접 쓰지 않는다. `AuditLogsService.record({ action })` 의 `action` 이 `AuditAction` 타입이라 union 에 없는 값은 컴파일되지 않는다.
4. resource 토큰과 verb 토큰 안의 여러 어절은 밑줄로 잇는다(`scope_changed`, `transfer_ownership`, `role_changed`, `re_run`, `password_changed`). 하이픈과 camelCase 는 쓰지 않는다.
5. verb 의 시제는 아래 세 갈래 중 하나를 따른다. 감사 로그는 "일어난 일" 의 기록이기 때문이다. 갈래를 가르는 기준은 resource 이름이 아니라 **verb 의 성격**이다. 그래서 같은 resource 안에서도 verb 에 따라 갈래가 다를 수 있다. 예를 들어 `workspace.transfer_ownership` 은 5-3 이고 `workspace.created`·`workspace.updated` 는 5-1 이다.
   - **5-1 과거분사(기본)**: 발생한 사건을 그대로 기록하는 도메인은 과거분사를 쓴다(`created`, `updated`, `deleted`, `changed`, `enabled`, `disabled` 등). 새 도메인은 특별한 사유가 없으면 이 갈래를 따른다. `scope_changed`·`reauthorized` 처럼 목적어나 부사에 과거분사를 붙인 합성 과거분사도 이 갈래다. 판단 기준은 verb 끝이 과거분사형인지다.
   - **5-2 resource 단위 현재형(CRUD 예외)**: 한 resource 의 감사 액션 가운데 과거분사로 바꾸면 어색한 동사(`reveal`, `regenerate`, `set_default` 등)가 섞일 수 있다. 그때는 그 resource 의 CRUD 감사 액션 전체를 현재형(`create`, `update`, `delete` …)으로 맞춘다. 한 resource 안에서 두 시제를 섞지 않기 위해서다.
   - **5-3 도메인 고유 동사(불규칙)**: 단순 CRUD 도 아니고 과거분사로 바꾸기도 어색한 도메인 고유의 단일 행위는 그 도메인 용어를 `<resource>.<verb>` 에 그대로 쓴다. 재실행(`re_run`)과 소유자 이양(`transfer_ownership`)이 여기에 든다. 앞의 두 갈래에 억지로 맞추면 뜻이 흐려진다.
6. 같은 성격의 CRUD 생애주기 verb 끼리는 한 resource 안에서 5-1 과 5-2 중 하나로만 쓴다. 5-3 도메인 고유 동사는 그와 별개로 함께 쓸 수 있다.

## resource 별 갈래

아래 표는 resource 마다 어느 갈래를 쓰는지 정리한 분류표다. 각 감사 액션의 구현 여부와 기록 위치는 [감사 로그](CLE-OBS-AUDIT.md) 의 카탈로그가 정한다.

| resource | 갈래 | 이 갈래로 쓰는 verb |
| --- | --- | --- |
| `integration` | 5-1 과거분사 | `created`, `updated`, `deleted`, `rotated`, `scope_changed`, `reauthorized` |
| `user` | 5-1 과거분사 | `password_changed`, `2fa_enabled`, `2fa_disabled`, `email_changed` |
| `auth_config` | 5-2 현재형 | `create`, `update`, `delete`, `regenerate`, `reveal` |
| `execution` | 5-3 도메인 동사 | `re_run` |
| `workspace` | 5-3 도메인 동사 | `transfer_ownership` |
| `workspace` | 5-1 과거분사 | `created`, `updated` |
| `member` | 5-1 과거분사 | `invited`, `role_changed`, `removed` |
| `workflow` | 5-1 과거분사 | `created`, `updated`, `deleted`, `executed` |
| `trigger` | 5-1 과거분사 | `created`, `updated`, `deleted` |
| `trigger` | 5-1 과거분사 | `notification_secret_rotated`, `chat_channel_bot_token_rotated`, `interaction_token_revoked` |
| `schedule` | 5-1 과거분사 | `created`, `updated`, `deleted` |
| `model_config` | 5-2 현재형 | `create`, `update`, `delete`, `set_default` |

- `workspace` 가 두 갈래에 걸치는 것은 규칙 5 의 결과다. 소유자 이양은 단일 트랜잭션 행위(5-3)이고 `created`·`updated` 는 일반 CRUD 생애주기(5-1)다.
- `model_config` 는 `set_default` 가 과거분사로 어색해 5-2 로 묶는다. 토큰 구분자는 규칙 4 대로 밑줄이다. `model_config` 에 `reveal` 이 없는 이유는 모델 설정에 평문 보기 엔드포인트가 없기 때문이다(`auth_config.reveal` 과 다르다).
- `trigger` 의 `interaction_token_revoked` 만 `revoked` 다. 나머지 둘은 24시간 유예 동안 옛 자격 증명과 새 자격 증명이 함께 유효하다. 트리거 단위 토큰 재발급은 이전 토큰을 곧바로 무효로 한다. 규칙 5 의 "verb 의 성격" 기준에 따라 교체와 무효화를 같은 동사로 적지 않는다.
- `workspace.deleted` 는 표에 없다. 이름으로는 `deleted`(5-1)가 자연스럽지만 감사 행이 워크스페이스와 함께 지워져 남길 수 없다. 이름 문제가 아니라 워크스페이스 단위 감사 모델의 구조적 제약이다. 근거는 [감사 로그](CLE-OBS-AUDIT.md) 에 있다.
- `workflow.executed` 는 이름만 정해 두었고 아직 기록하지 않는다. 유예 근거는 [감사 로그](CLE-OBS-AUDIT.md) 에 있다. 구현할 때는 위 표기 그대로 `AUDIT_ACTIONS` 에 더한다.

현재 구현은 도메인 서비스의 `recordAudit` 헬퍼가 `action` 인자를 `AuditActionFor<'<resource>'>` 타입으로 받는다. 헬퍼가 자기 resource 로 고정한 `resourceType` 과 다른 접두의 감사 액션을 넘기면 컴파일되지 않는다. 가드 테스트(`codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`)가 헬퍼마다 이 타입을 쓰는지 검사한다. 이 바인딩을 규칙으로 올릴지는 [미결 사항](#미결-사항) 을 본다.

## 미결 사항

- **resource 바인딩을 명명 규칙에 넣을지**: 원문 규약은 union 강제(규칙 3)만 적는다. 현재 구현은 여기에 더해 `recordAudit` 헬퍼의 감사 액션을 resource 접두로 좁히고 가드 테스트로 강제한다. 이 바인딩을 규칙으로 적어 새 도메인에도 요구할지, 구현 세부로 둘지 결정이 필요하다.

## 구현 위치

- `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (`AUDIT_ACTIONS`, `AuditAction`, `AuditActionFor`)

## Rationale

### 시제 규칙을 한 규약으로 묶는다

감사 액션의 명명·시제 규칙은 처음에 인증 명세의 감사 절 본문에 산문으로 흩어져 있었다. 그 산문의 어느 시제 범주에도 `workspace.transfer_ownership`(verb_noun 형)이 들어가지 않은 채 남아 있었다(refactor 04 후속 일관성 검토 WARNING). 도메인이 늘수록(member·workflow·trigger·schedule·model_config …) 산문 규약은 빠뜨리거나 어긋나기 쉽다. 그래서 전 도메인의 시제 규칙을 한 규약 문서로 모으고 카탈로그(어떤 감사 액션이 있고 구현됐는지)는 [감사 로그](CLE-OBS-AUDIT.md) 가 맡도록 나눴다. 에러 코드가 명명 규약과 카탈로그를 나눈 것과 같은 방식이다([에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md)).

### 두 갈래가 아니라 세 갈래다

초안은 "과거분사 기본 / CRUD 현재형 예외" 두 갈래였다. 그런데 `execution.re_run` 과 `workspace.transfer_ownership` 은 어디에도 맞지 않는다. 생애주기 CRUD 가 아니라 현재형 예외가 맞지 않는다. 억지로 과거분사로 바꾸면(`re_run` → `re_ran`, `transfer_ownership` → `ownership_transferred`) 도메인 용어의 뜻이 흐려진다. 이미 쌓인 append-only 행과 `AUDIT_ACTIONS` 표기도 깨진다. 이 둘을 정상 범주로 받기 위해 5-3 도메인 고유 동사를 두었다. 결과로 분류 기준이 resource 가 아니라 verb 의 성격이 된다. 같은 `workspace` 가 5-1 과 5-3 에 동시에 나타나는 것은 이 기준의 자연스러운 결과이고 설계 의도다.

기각한 대안:

- **`workspace.transfer_ownership` 을 `workspace.ownership_transferred` 로 바꾸기**: 표기는 일관되지만 이미 구현·적재된 감사 액션이다. `re_run_initiated` → `execution.re_run`(cross-audit G-02)과 달리 고쳐서 얻는 것이 없고 append-only 행과 어긋나기만 한다. 도메인 고유 동사로 분류해 지금 표기를 지킨다.
- **시제 규칙을 인증 명세 본문에 두고 workspace 예외만 더하기**: 당장 비용은 낮다. 하지만 도메인이 늘면 산문 규약이 어긋나는 문제(이번 검토가 드러낸 문제)가 다시 생긴다. 한 규약 문서로 올리는 편이 길게 보면 싸다.

### 사용자 보안 감사 액션은 `user.*` 접두와 과거분사로 정한다

인증 감사 액션은 예정 단계에서 `password_change`, `2fa_enable`, `2fa_disable` 처럼 접두 없이 적혀 있었다. 이를 `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 로 확정했다. 근거는 다음과 같다.

- 접두는 규칙 1 상 필수다. 접두 없는 표기는 예전 `re_run_initiated` 와 같은 이탈이다. 그 선례를 이미 고쳤으니 예정 표가 같은 위반을 되풀이하면 안 된다. 예정 단계라 코드 의존이 없어 지금 고치는 비용이 가장 낮았다.
- resource 토큰은 `user` 다. 비밀번호 변경과 2단계 인증 토글은 행위자 자신의 계정 보안 속성을 바꾸는 일이다. `auth_config`(웹훅 인증 설정이라는 다른 리소스)나 `auth`(너무 추상적)보다 `user` 가 자연스럽다. 이후의 `user.email_changed` 같은 프로필 계열 감사도 같은 이름 공간에 묶인다.
- verb 는 과거분사다. `integration.created` 처럼 "일어난 일" 을 기록하는 도메인 관례를 따른다(`changed`, `enabled`, `disabled`).

같은 근거로 다른 예정 감사 액션의 시제도 정리했다. `workspace`·`member`·`workflow`·`trigger`·`schedule` 은 동사가 모두 과거분사로 자연스러워 기본 갈래를 따른다(`created`, `updated`, `deleted`, `invited`, `role_changed`, `removed`, `executed`). 현재형 `create`·`invite` 로 적혀 있던 이탈을 이때 고쳤다. `model_config` 만 `set_default` 가 과거분사로 어색해 `auth_config` 와 같이 resource 단위 현재형을 유지한다(규칙 5-2). 이 감사 액션들은 2026-08-01 에 그 표기 그대로 구현됐다(`workflow.executed` 제외).

### 소유자 이양은 도메인 고유 동사로 분류한다

이미 구현된 `workspace.transfer_ownership` 은 과거분사 기본형에도 CRUD 현재형 예외에도 깔끔히 맞지 않는다. 소유자 이양은 생애주기 CRUD 가 아니라 단일 트랜잭션 행위다. 과거분사로 바꾸면(`ownership_transferred`) 이미 적재된 행과 `AUDIT_ACTIONS` 표기가 깨지는데 얻는 것이 없다(append-only 원칙). 그래서 `execution.re_run` 과 같은 도메인 고유 동사로 분류했다(refactor 04 후속 A-2). 이 분류가 세 갈래 체계를 만든 계기다.

### 트리거 시크릿·토큰 교체를 세 감사 액션으로 나눈다 (2026-08-11)

선례는 양쪽에 다 있다. 한 감사 액션에 `details` 하위 필드로 담은 쪽(`integration.rotated`, `integration.reauthorized` + `details.mode`)과 대상별로 나눈 쪽(`user.password_changed`·`email_changed`·`2fa_enabled`·`2fa_disabled`)이다. 규약은 어느 쪽도 강제하지 않으므로 선택 근거를 남긴다.

셋으로 가른 기준은 무효화 범위다. 세 자격 증명은 무효가 되는 대상이 서로 다르다. 알림 서명 시크릿은 EIA 알림 웹훅 수신자만, 봇 토큰은 그 채팅 채널의 봇 세션 전체, 트리거 단위 토큰은 그 트리거로 열린 모든 외부 대화에 영향을 준다. "무엇이 교체됐나" 를 `details` 를 열어야 알 수 있으면 그 질문이 조회 필터와 경보 규칙에서 사라진다. `integration` 은 자격 증명이 하나뿐이라 한 액션에 담는 것이 자연스러웠다. 여기서는 `user` 쪽 선례(대상별 개별 액션)가 맞다.

감사 액션 이름에는 하위 채널 접두(`notification_*`, `chat_channel_*`, `interaction_*`)를 담는다. HTTP 경로(`/notification/rotate-secret`, `/chat-channel/rotate-bot-token`, `/interaction/revoke-token`), 엔티티 컬럼(`chat_channel_token_v2`), 스케줄러(`ChatChannelTokenRotatorService`)가 모두 그 접두를 쓴다. 감사만 다르게 적으면 같은 사실이 두 가지 표기로 갈린다.
