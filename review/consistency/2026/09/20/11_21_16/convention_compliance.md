# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 모드: 구현 착수 전 검토 (`--impl-prep`, scope=`spec/2-navigation/`)

## 검토 방법

번들에 전문이 실린 세 파일(`1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md`, 나머지
15개 파일은 컨텍스트 예산 초과로 절단됨)을 다음 정식 규약 원문과 직접 대조했다 — 번들에
같이 절단돼 있던 `error-codes.md`·`swagger.md`·`secret-store.md`·`redis-keys.md`·
`audit-actions.md`(전문 확보)·`frontend-layering.md`·`i18n-userguide.md`·`review-citations.md`·
`chat-channel-adapter.md`(목차만)는 저장소에서 직접 `Read` 했다. 카탈로그 SoT
(`spec/5-system/3-error-handling.md`)도 필요한 절만 직접 열어 대조했다 — 번들에 없다는 사실을
위반의 근거로 쓰지 않기 위함이다.

## 발견사항

### INFO — `spec/2-navigation/` 파일 번호 결번 (12번 없음)

- target 위치: `spec/2-navigation/` 디렉터리 전체 (파일 목록)
- 위반 규약: `.claude/skills/project-planner/SKILL.md` "명명 컨벤션" — `spec/<영역>/N-name.md`
  (정렬 보장된 상세 spec)
- 상세: 실제 파일이 `0,1,2,3,4,5,6,7,8,9,10,11` 다음 바로 `13`으로 건너뛴다 (`12-*.md` 부재,
  `git log --all -- 'spec/2-navigation/12-*'` 로도 이력 없음 확인). 정렬 순서 자체는 깨지지
  않으므로 이 결번이 규약을 직접 위반하지는 않지만(정렬 보장이라는 문언은 여전히 성립), 번호가
  화면 진입 순서를 겸하는 관례상 결번은 "삭제·병합된 화면이 있었는지" 를 다음 독자가 매번
  되묻게 만든다.
- 제안: 이 영역에 실제로 후속 작업이 예정돼 있다면 CRITICAL/WARNING 은 아니므로 급히 고칠
  필요는 없다. 다음에 이 영역의 파일을 추가·재배열할 일이 생기면 그때 12를 메우거나, 결번이
  의도(예약)임을 `_layout.md` 한 줄로 남기는 정도로 충분하다.

## 확인했으나 위반이 아닌 항목 (대조 기록)

검토 관점 1~5에 해당하는 아래 항목들을 정식 규약 원문과 직접 대조했고, 전부 규약과 일치했다
— 다음 리뷰가 같은 자리를 다시 재는 비용을 줄이기 위해 대조 결과를 남긴다.

- **에러 코드 명명 (`error-codes.md`)**: `VALIDATION_ERROR`·`RESOURCE_CONFLICT`·
  `DUPLICATE_NODE_LABEL`·`AUTH_CONFIG_NOT_FOUND`·`BOT_TOKEN_INVALID`·`INVALID_FIELD`
  전부 `UPPER_SNAKE_CASE`이고, `5-system/3-error-handling.md` §1.3/§1.10/§1.11/§1.12 카탈로그에
  동일 코드·동일 HTTP status·동일 `details.field` 형태로 등재돼 있어 target 문서의 서술과
  1:1 일치한다 (예: `TRIGGER_ENDPOINT_PATH_CONFLICT` + `details.field='endpoint_path'`,
  `AUTH_CONFIG_NOT_FOUND` + `details:{field:'authConfigId',code:'INVALID_FIELD'}`).
- **DTO 명명 (`swagger.md` §1-7)**: `UpdateWorkflowDto`·`UpdateTriggerDto` 는 top-level 요청
  바디이므로 `Update` 접두 규칙에 맞고, `WorkflowSettingsDto`(nested `settings` 필드)는 접두를
  달지 않는 로컬 패턴(`<Domain><Role>Dto`)에 맞아 신설된 `ChatChannelUpdateConfigDto` 선례와
  같은 원칙을 따른다. `ExportWorkflowDto`(응답)도 Update 접두 대상이 아니라 정상이다.
- **감사 액션 명명 (`audit-actions.md`)**: `trigger.deleted`·`trigger.updated`·
  `trigger.notification_secret_rotated`·`trigger.chat_channel_bot_token_rotated`·
  `trigger.interaction_token_revoked`가 §3 레지스트리의 trigger 행(과거분사 + 2026-08-11 3종)과
  정확히 일치한다.
- **Redis/advisory-lock 키 (`redis-keys.md` §4)**: `pg_advisory_xact_lock(hashtext('trigger-config:<triggerId>'))`
  는 레지스트리의 "인접 네임스페이스"(Postgres advisory lock, Redis 아님) 항목에 정확히
  등재돼 있고 SoT 포인터도 target 문서 자신(`2-trigger-list.md §3`)을 정확히 가리킨다.
- **Secret 마스킹 (`secret-store.md` §1.1)**: `botToken`을 write-only로 두고 마스킹값·last4도
  응답에 싣지 않는다는 서술은 §1.1 "비대상 필드도 응답 바디에는 나가지 않는다" 규정과
  정확히 부합하며 anchor(`#11-비대상-필드도-응답-바디에는-나가지-않는다`)도 실재한다.
- **i18n 키 (`i18n-userguide.md` Principle 1/2)**: `workflows.executionHistory`(ko/en 명시),
  `triggers.delete.confirm.*` 모두 dict-key 경유 패턴과 ko/en 병기 요구에 맞는 서술이다.
- **문서 3섹션 구조**: 세 파일 모두 `## Overview` 섹션을 자체적으로 갖지 않지만, 이는
  project-planner SKILL.md가 "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"
  이라 명시한 예외에 해당한다 — 세 파일 모두 상단에 `_product-overview.md`의 해당 절로
  링크하고 있어 위반이 아니다. `## Rationale` 섹션은 세 파일 모두 말미에 존재.
- **review-citations.md**: 대상 세 파일에서 bare `hh_mm_ss` 형태의 리뷰 세션 인용은
  발견되지 않았다(§2 위반 없음).
- **에러 코드 대문자 규칙 위반 후보 전수 스캔**: 세 파일의 백틱 lower_snake 토큰은 전부
  DB 컬럼명(`created_at`/`endpoint_path` 등)이거나 enum 값(`api_key`/`basic_auth`/
  `multi_step` 등)이며 에러 코드가 아니어서 규칙 대상이 아니다.

## 검토 범위의 한계

- 번들이 컨텍스트 예산으로 절단해 `4-integration.md`·`6-config.md`·`9-user-profile.md`·
  `10-auth-flow.md` 등 12개 파일은 전문을 보지 못했다. 이 보고서의 "위반 없음" 결론은
  전수 확보한 3개 파일(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)과, 직접 읽은
  정식 규약 원문 대조에 한정된다 — 나머지 12개 파일에 규약 위반이 없다고 단정하지 않는다.
- `spec/5-system/15-chat-channel.md`(R-CC-10/11/18/21/23 등 target이 반복 인용하는 SoT)는
  본 리뷰의 anchor 실재성 확인 대상에서 표본만 확인했다(`CCA §1.1.2`, `chat-channel-adapter.md
  §2.3`). 나머지 인용의 anchor 정합은 cross-reference/consistency 검토의 영역으로 남긴다.

## 요약

`spec/2-navigation/1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`는 정식 규약 준수
관점에서 매우 높은 수준으로 정합적이다. 에러 코드 명명·HTTP status·`details` 형태, DTO 명명
(`Update` 접두 범위), 감사 액션 명명, secret 마스킹 정책, advisory-lock 키 네임스페이스, i18n
dict-key 패턴, 문서 3섹션 구조(다중-파일 영역의 `_product-overview.md` 예외 포함) 등 검토
관점 1~5에 해당하는 모든 항목을 정식 규약 원문과 직접 대조했으나 CRITICAL·WARNING 급 위반은
발견하지 못했다. 유일한 지적은 디렉터리 파일 번호의 결번(12) INFO 1건이며, 이는 규약을
직접 위반하지 않는 경미한 위생 사항이다. 다만 컨텍스트 예산으로 절단된 12개 파일은 전문을
확인하지 못했으므로 이 결론은 확보한 3개 파일 범위에 한정된다.

## 위험도

NONE
