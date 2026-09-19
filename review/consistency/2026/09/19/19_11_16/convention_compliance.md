# 정식 규약 준수 검토 — spec/2-navigation/

검토 모드: `--impl-prep` (scope=`spec/2-navigation/`). 최근 커밋(`c8dd613e0`, 웹훅 경로 영구 예약)이 이
영역에서 실제로 건드린 파일은 `spec/2-navigation/2-trigger-list.md` 하나이며, 본 문서는 그 파일 전문과
함께 `1-workflow-list.md`·`3-schedule.md` 전문을 읽고 `spec/conventions/**`(error-codes·audit-actions·
secret-store·chat-channel-adapter·swagger·i18n-userguide·frontend-layering·spec-impl-evidence·
migrations) 대조로 검토했다. 번들의 컨텍스트 예산 초과로 생략된 15개 파일(`4-integration.md` 등, 아래
"검토 범위 한계" 참고)은 이번 diff 의 변경 대상이 아니라는 것을 `git show --stat` 로 확인했다.

## 발견사항

- **[INFO]** 컨텍스트 예산으로 생략된 15개 파일은 이번 패스에서 미검증
  - target 위치: 번들의 "컨텍스트 예산 초과로 생략된 파일 15개" 목록 — `4-integration.md`·
    `5-knowledge-base.md`·`6-config.md`·`8-marketplace.md`·`9-user-profile.md`·`_product-overview.md`·
    `0-dashboard.md`·`7-statistics.md`·`10-auth-flow.md`·`11-error-empty-states.md`·`13-user-guide.md`·
    `14-execution-history.md`·`15-system-status.md`·`16-agent-memory.md`·`_layout.md`
  - 위반 규약: 해당 없음 (검증 불가 상태에 대한 고지)
  - 상세: `git show c8dd613e0 --stat -- spec/` 로 확인한 결과 이번 변경은 `spec/2-navigation/` 안에서
    `2-trigger-list.md` 하나만 건드렸다. 위 15개 파일은 이번 diff 와 무관하므로 이번 검토의 결론(아래
    "요약")은 그 15개 파일의 규약 준수 여부에 대해서는 아무것도 주장하지 않는다.
  - 제안: `spec/2-navigation/` 전체를 대상으로 한 정기 감사가 필요하면 각 파일을 `Read` 로 직접 열어
    별도 세션에서 수행할 것 — 이번 결과를 "전체 영역 검증 완료"로 인용하지 말 것.

- **[INFO]** `2-trigger-list.md` Rationale 하위 항목 번호가 문서 순서와 어긋남
  - target 위치: `spec/2-navigation/2-trigger-list.md` `## Rationale` (R-1~R-17)
  - 위반 규약: 없음 (CLAUDE.md/`project-planner` SKILL.md 는 Overview/본문/Rationale 3섹션만 권장할 뿐,
    Rationale 하위 항목의 번호·정렬 순서에 대한 규약은 `spec/conventions/**` 어디에도 없음)
  - 상세: 문서에 등장하는 순서가 R-1, R-2, R-3, R-4, R-5, R-6, **R-8**, **R-7**, R-12, R-13, R-14, R-15,
    R-16, R-17 이다 — R-8 이 R-7 보다 먼저 나오고 R-9~R-11 은 이 문서에 없다(다른 항목에 재배정됐을
    가능성). 규약 위반은 아니지만 다음에 이 절을 만지는 사람이 "번호가 빠졌다"고 오인해 불필요한
    조사를 반복할 수 있다.
  - 제안: 규약화할 사안은 아님 — 다음 편집 시 자연스럽게 정리되면 충분. 규약 갱신 불필요.

## 준수 확인 (근거를 남겨 둔다 — 반증 가능하도록)

- **에러 코드**: `RESOURCE_CONFLICT`·`VALIDATION_ERROR`·`BOT_TOKEN_INVALID`·`TRIGGER_ENDPOINT_PATH_CONFLICT`
  ·`INVALID_FIELD` 모두 `UPPER_SNAKE_CASE` — [`error-codes.md` §1](../../../../../../spec/conventions/error-codes.md)
  준수. `TRIGGER_ENDPOINT_PATH_CONFLICT` 의 "예약된 경로" 의미 확장은 `error-codes.md` §3 예외
  레지스트리 신규 행이 필요한 "이름이 부정확해진" 경우가 아니라(이름은 여전히 정확 — "endpoint path
  conflict"), `3-error-handling.md` §1.10 본문에 병합 근거(정보 노출 방지)가 이미 명시돼 있어 등재
  불요 — 직전 `--spec` 세션의 동일 지적(INFO #6)이 커밋에 반영된 상태를 재확인했다.
- **감사 액션 명명**: `trigger.deleted`·`trigger.updated`·`trigger.chat_channel_bot_token_rotated`·
  `trigger.notification_secret_rotated`·`trigger.interaction_token_revoked` 전부 `audit-actions.md` §3
  레지스트리의 `trigger` 행과 문자 그대로 일치 — 신규 액션 도입 없음.
- **Secret store URI**: `secret://triggers/<id>/...` 형태·`deleteByPrefix` 호출 서술이
  `secret-store.md` §1/§2.1 과 일치. §1.1(응답 바디 비노출) 인용도 정확한 절 앵커.
- **Chat Channel uiMapping enum**: `formMode`(`multi_step`/`native_modal`/`auto`, default `auto`) ·
  `visualNode`(`text`/`photo`/`auto`, default `auto`) · `buttonLayout`(`auto`/`vertical`/`horizontal`,
  default `auto`) 모두 `chat-channel-adapter.md` §2.3 원문 enum 과 1:1 일치.
- **에러 응답 `details` 형태**: `details.field='...'`, `details.code='INVALID_FIELD'` 객체 형태 서술이
  `5-system/2-api-convention.md` §5.3 "도메인 세부 사유를 어디에 싣는가" 표의 객체 형태
  (`TRIGGER_ENDPOINT_PATH_CONFLICT` 실례)와 정확히 같은 패턴.
  `details.field='endpoint_path'`(snake_case, DB 컬럼명)와 `details.field='chatChannel'`/`'provider'`
  (camelCase, wire 필드명)의 혼재는 각 필드가 가리키는 층(DB 제약 vs body 키)이 다른 데서 오는
  의도된 표기이며, api-convention.md 자신의 예시도 `endpoint_path` 를 snake_case 로 쓴다 — 위반 아님.
- **`botToken`/`inboundSigningPlaintext` write-only + `hasBotToken` read-only**: `swagger.md` §1-5 의
  의무(secret 입력 필드 `writeOnly` 동반, derived 응답 필드 `readOnly` 동반)를 spec 서술 수준에서 정확히
  반영.
- **문서 구조**: `_product-overview.md` 로 Overview 를 분리하고(다중 파일 영역의 정식 패턴 —
  `project-planner/SKILL.md` "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"), 본문
  (`## 1`~`## 4`) + `## Rationale` 로 끝나는 3섹션 구성을 세 파일(`2-trigger-list.md`·
  `1-workflow-list.md`·`3-schedule.md`) 모두 지킨다.
- **명명 컨벤션**: `N-name.md` 정렬 보장 파일명(`1-workflow-list.md`/`2-trigger-list.md`/
  `3-schedule.md`) 및 frontmatter `id:`(kebab-case, basename 기반) 준수.
- **`spec-impl-evidence.md` pending_plans 역참조**: `2-trigger-list.md` frontmatter 의
  `pending_plans: [spec-draft-nullable-notation-followups.md]` 는 이번 커밋이 추가한 "다른
  워크스페이스가 예약한 경로" 조항의 근거인 웹훅 예약 트래커 항목(해당 트래커 4644행, 2026-09-19
  등재, 아직 `[ ]`)을 이미 담고 있어 새 `pending_plans` 항목 추가가 필요 없다 — 신설된 전용 plan
  (`spec-draft-webhook-endpoint-reservation.md`)은 공유 트래커 항목을 닫는 후속 plan이고 그 자신의
  `spec_impact` 가 역방향을 이미 기록한다(R-11 의 공유 트래커 패턴과 동형). "약속했는데 아무 plan 도
  가리키지 않는" 누락 사례가 아님을 확인했다.

## 요약

이번 세션의 실질 변경 대상인 `spec/2-navigation/2-trigger-list.md`(및 교차 검증한 `1-workflow-list.md`·
`3-schedule.md`)는 명명 규약(에러 코드·감사 액션·secret ref·enum 값)·출력 포맷 규약(에러 봉투 `details`
형태·Swagger writeOnly/readOnly)·문서 구조 규약(Overview 분리·본문·Rationale)·frontmatter 규약
(`pending_plans` 역참조) 전 관점에서 `spec/conventions/**` 를 위반하는 지점을 찾지 못했다. 직전
`--spec` 세션의 convention_compliance INFO 2건(라벨 성격 명시, 에러 코드 통합 근거)도 이미 본문에
반영돼 있음을 재확인했다. 다만 컨텍스트 예산으로 생략된 `spec/2-navigation/` 하위 15개 파일은 이번
diff 의 변경 대상이 아니어서 검증하지 않았으며, 그 파일들에 대한 규약 준수 여부는 이번 결과에
포함되지 않는다.

## 위험도

NONE
