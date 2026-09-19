# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 모드: `--impl-done` (scope=`spec/2-navigation/`, diff-base=`origin/main`). 대조 규약: `spec/conventions/**`
전체(cafe24/makeshop API 카탈로그 계열은 도메인이 겹치지 않아 확인 결과 해당 없음).

## 검토 범위에 대한 참고

이번 구현(`plan/in-progress/entity-schema-declaration-drift.md`)은 `codebase/backend/src/modules/**/entities/*.entity.ts`
6개의 인덱스·제약·`onDelete` 선언 정정이며 `spec_impact: none` — `spec/2-navigation/` 문서 자체를 변경하지
않는다(`git diff --stat origin/main...HEAD -- spec/2-navigation/` 델타 0, 실측 확인). 다만 변경된 엔티티 중
`workspace.entity.ts`·`integration-expiry-dispatch.entity.ts` 는 이 scope 의 `9-user-profile.md`(workspaces)·
`4-integration.md`(integrations) 가 `code:` frontmatter 로 소유한다. 두 파일에서 이번 diff 대상(owner_id 부분
유니크 인덱스, `integration_expiry_dispatch` UNIQUE)을 직접 서술하는 대목을 찾았으나 없음(해당 서술은
`data-flow/12-workspace.md`·`1-data-model.md` 등 scope 밖 문서가 SoT) — 이 diff 로 인해 이 scope 문서가
conventions 와 새로 어긋나는 지점은 없다. 따라서 본 검토는 신규 편집분에 대한 위반 탐지가 아니라, 이번
`--impl-done` 게이트가 요구하는 **현재 spec 텍스트의 정식 규약 준수 상태**에 대한 standing 점검이며, 실제로
본문이 상세히 확인 가능했던 `2-trigger-list.md`·`3-schedule.md` (Chat Channel·Secret Store·에러 코드·감사
액션·Swagger DTO 규약을 조밀하게 인용하는 두 문서)를 중심으로 수행했다.

## 발견사항

### [INFO] `2-trigger-list.md` Rationale 소절 번호가 문서 순서와 어긋나고 R-9~R-11 이 비어 있다

- target 위치: `spec/2-navigation/2-trigger-list.md` — `### R-6`(L382) → `### R-8`(L389) → `### R-7`(L397) → `### R-12`(L407) 순으로 등장(R-9·R-10·R-11 미존재)
- 위반 규약: 명시적인 단일 조항 없음 — `spec/conventions/**` 안에 spec 문서 내부 Rationale 소절의 `R-N` 번호를 문서 등장 순서와 일치시키거나 연속 번호를 요구하는 규칙은 없다(project-planner SKILL.md `## Rationale` 요구는 섹션 존재만 명시).
- 상세: `R-6` 본문이 "Recall Calls 는 본 drawer 에 포함되지 않음 (Rationale R-7)"이라고 R-7 을 앞서 인용하는데, 실제 R-7 소절은 R-8 **뒤**에 나온다. 또한 R-8 다음 번호가 R-12 로 건너뛴다(R-9/10/11 은 이 파일에 없고, 동일 이름 R-9~R-11 은 전혀 다른 문서 `spec/conventions/spec-impl-evidence.md` 에 독립적으로 존재해 이름 충돌은 아니다 — `R-N` 은 파일 로컬 네임스페이스). 이 저장소가 `error-codes.md`(§2 "이름 정확성 향상만을 위한 rename 은 하지 않는다")·`audit-actions.md`(과거 표기 보존)에서 보이듯 **식별자를 시간순으로 부여하고 재배치하지 않는 관행**을 갖고 있다는 점에서, 이 번호도 문서 내 위치가 아니라 **결정이 기록된 시점 순서**를 반영하는 의도된 형태일 가능성이 높다 — 그렇다면 위반이 아니라 자연스러운 append-only 이력이다.
- 제안: 위반으로 단정하지 않는다. 다만 R-9~R-11 이 왜 없는지(예: 다른 소절에 흡수됐는지, 애초에 할당되지 않았는지)를 한 줄이라도 남기면 다음 편집자가 "번호가 빠졌다"는 오인으로 재조사하는 비용을 줄일 수 있다. 이번 PR 스코프(엔티티 인덱스 정정)와 무관하므로 즉시 조치 불필요.

## 확인했으나 위반 없음 (양성 결과, 참고용)

- **에러 코드 명명** (`error-codes.md` §1): `2-trigger-list.md` §3~§4 가 쓰는 `RESOURCE_CONFLICT`/`VALIDATION_ERROR`/`RESOURCE_NOT_FOUND`/`INTERNAL_ERROR`/`AUTH_CONFIG_NOT_FOUND`/`BOT_TOKEN_INVALID`, `details[].code` 의 `TRIGGER_ENDPOINT_PATH_CONFLICT`/`INVALID_FIELD` 모두 `UPPER_SNAKE_CASE` + 의미 기반 명명 준수. `INVALID_FIELD` 는 `error-codes.md` §4.2 가 다루는 trigger-parameter 사유 코드(`MISSING_REQUIRED_FIELD` 등)와 다른 레이어(§2.1 제네릭 `details[].code`)임을 `5-system/3-error-handling.md:205` 가 명시적으로 구분하고, 같은 문서 L252 가 정확히 `2-trigger-list.md §3` 을 SoT 로 인용해 cross-reference 가 착지함을 확인.
- **Secret Store 규약** (`secret-store.md` §1.1, §2.1): `botToken`/`inboundSigningPlaintext` write-only 정책, `secret://triggers/{id}/` prefix 삭제(`deleteByPrefix`) 시점(행 삭제 커밋 뒤) 서술이 규약 §1.1(응답 비노출)·§2.1(호출 규약 표)과 정확히 일치. AuthConfig `***<last4>` 마스킹을 write-only 필드에 차용하지 않는다는 서술도 §1.1 취지와 부합.
- **Chat Channel Adapter 규약** (`chat-channel-adapter.md` §2.3): `uiMapping.formMode`(`multi_step`/`native_modal`/`auto`)·`visualNode`(`text`/`photo`/`auto`)·`buttonLayout`(`auto`/`vertical`/`horizontal`) enum 값이 컨벤션의 `ChatChannelConfig` 타입 선언과 1:1 일치.
- **감사 액션 명명** (`audit-actions.md` §3 레지스트리): `trigger.deleted`·`trigger.updated`·`trigger.chat_channel_bot_token_rotated`·`trigger.notification_secret_rotated`·`trigger.interaction_token_revoked` 전부 레지스트리 행과 정확히 일치(언더스코어 토큰 구분자 포함).
- **Redis/advisory-lock 키 규약** (`redis-keys.md` §4 인접 네임스페이스): `pg_advisory_xact_lock(hashtext('trigger-config:<triggerId>'))` 서술이 `redis-keys.md` §4 표가 지목하는 SoT(`2-trigger-list.md#3-api`)와 정확히 짝을 이룸.
- **Swagger DTO 규약** (`swagger.md` §1-5, §1-7, §5-1): 응답 DTO `TriggerDto`/`ScheduleDto` 언급은 `Update` 접두 오남용 없음. 실제 코드 확인 결과 `trigger-response.dto.ts` 가 `dto/responses/` 하위에 위치(§5-1 준수), `update-trigger.dto.ts` 가 top-level PATCH 바디(§1-7 `Update<Entity>Dto` 패턴) 규칙과 일치. `botToken`(writeOnly)/`hasBotToken`(readOnly derived) 서술도 §1-5 의무 패턴과 부합.
- **문서 구조 규약** (CLAUDE.md·project-planner SKILL.md "Spec 문서 구조 3섹션"): `2-trigger-list.md`·`3-schedule.md` 모두 별도 `## Overview` 헤더가 없으나, 이 영역은 다중 spec 파일을 가진 영역(`spec/2-navigation/`)이라 규약이 명시한 대로 Overview 는 `_product-overview.md` 로 위임되어 있고 두 문서 모두 상단에서 그 파일을 링크한다 — 규약 준수. `## Rationale` 섹션도 두 파일 모두 보유.
- **마이그레이션 규약과의 접점** (`migrations.md`): 이번 diff 는 신규 마이그레이션 파일을 추가하지 않았다(`git diff --stat origin/main...HEAD -- codebase/backend/migrations/` 델타 0) — 기존 V009/V109 마이그레이션에 엔티티 데코레이터를 사후 정합시킨 것뿐이라 append-only 원칙(§3)·V번호 정책(§2) 대상 자체가 아님을 확인.

## 요약

`spec/2-navigation/` 영역, 특히 conventions 를 조밀하게 인용하는 `2-trigger-list.md`·`3-schedule.md` 를
`spec/conventions/**` 전 항목(에러 코드·secret-store·chat-channel-adapter·audit-actions·redis-keys·swagger·
migrations)과 대조한 결과 CRITICAL·WARNING 급 위반은 발견되지 않았다. 인용된 규약 항목은 실제 규약 문서의
현재 서술과 자구·enum 값·명명 패턴까지 정확히 일치했고, 교차 참조(SoT 포인터)도 대상 문서에 정확히 착지했다.
발견된 유일한 항목은 INFO 수준 — `2-trigger-list.md` Rationale 소절 번호(R-6→R-8→R-7→R-12)가 문서 등장 순서와
어긋나고 R-9~R-11 이 비어 있는데, 이는 명시적 규약 위반이 아니라 이 저장소의 "식별자는 시간순 부여·재배치
금지" 관행에 부합하는 형태로 보인다. 이번 PR(엔티티 인덱스/제약 선언 정정, `spec_impact: none`)이 이 scope
문서를 변경하지 않으므로 `--impl-done` 게이트를 차단할 사유는 없다.

## 위험도

LOW
