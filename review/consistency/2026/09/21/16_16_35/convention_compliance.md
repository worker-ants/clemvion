# 정식 규약 준수 검토 — spec/2-navigation (--impl-prep)

## 조사 방법 메모

전달된 `_prompts/convention_compliance.md` 번들은 **컨텍스트 예산 초과로 `spec/2-navigation` 18개 파일 중 15개**
(`4-integration.md`·`6-config.md`·`_product-overview.md`·`_layout.md` 등)와 **`spec/conventions/**` 사실상 전체**
(예외: `audit-actions.md` 전문, `cafe24-api-catalog/_overview.md` 일부)가 "본문 생략됨" 플레이스홀더로 대체돼 있었다.
번들 자신이 "여기 없다는 사실을 근거로 삼지 말고 Read 로 직접 열라" 고 명시했으므로, 아래 판정은 번들이 아니라
**저장소의 실제 파일**(`spec/2-navigation/1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` · `6-config.md`,
`spec/conventions/error-codes.md` · `swagger.md` · `secret-store.md` · `audit-actions.md` · `chat-channel-adapter.md` ·
`review-citations.md`, `.claude/skills/project-planner/SKILL.md`)를 직접 Read 해 대조한 결과다. 이 truncation 자체는
과거에도 지적된 `--spec`/`--impl-prep` 번들 예산 문제와 같은 성격이며, target 문서의 결함이 아니라 **검토 파이프라인의
한계**로 별도 기록한다.

현재 in-progress plan(`modelconfig-dup-delete.md`)은 `spec_impact: none` — 이번 검토는 spec 변경 제안이 아니라
`ModelConfigService.remove()` 코드 착수 전 스코프(`spec/2-navigation` 전체, `6-config.md` 의 `code:` 가
`modules/model-config/**` 를 문다는 이유로 지정)의 사전 컨벤션 점검이다.

## 발견사항

### [INFO] `14-execution-history.md` 에 날짜 없는 bare 리뷰 인용 1건

- target 위치: `spec/2-navigation/14-execution-history.md:479` — `` `10_53_52` security/architecture W2·W3 ``
- 위반 규약: [`spec/conventions/review-citations.md` §2·§3](../../../../../../spec/conventions/review-citations.md)
  — `spec/**` 문서의 리뷰 인용은 날짜 없는 bare `hh_mm_ss` 형태를 금지("날짜가 없으면 해소 불가").
- 상세: `10_53_52` 만으로는 어느 날짜의 세션인지 저장소 이력으로도 되짚을 수 없다. 다만 같은 규약 §4 가
  "기존 bare 인용은 소급 정리 대상이 아니다 — 다음에 그 자리를 건드릴 때 맞춘다" 고 명시적으로 유예하고
  있고(2026-09-05 실측 기준 `spec/**` 45건 중 36건이 이미 bare), 이번 plan 은 `14-execution-history.md`
  를 건드리지 않는다.
- 제안: 이번 PR 범위 밖이므로 지금 고칠 필요는 없다. 다음에 그 절 인근을 수정할 사람이 날짜를 채우도록
  등재만 해 둔다(§4 grandfather 조항이 요구하는 바로 그 절차).

### [INFO] `6-config.md` 만 인라인 `## Overview (제품 정의)` 헤딩을 갖는 구조적 비대칭

- target 위치: `spec/2-navigation/6-config.md:21` (`## Overview (제품 정의)`) vs
  `1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md` (해당 헤딩 없이 `> 관련 문서: …` 다음 바로 `## 1. …` 본문 시작)
- 위반 규약: [`.claude/skills/project-planner/SKILL.md` §Spec 문서 구조 (3섹션 권장)](../../../../../../.claude/skills/project-planner/SKILL.md) —
  "`## Overview (제품 정의)` … **다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일**"
- 상세: `spec/2-navigation` 은 다중 파일 영역이라 제품 정의는 `_product-overview.md`(§3.6/§3.7)에 있는 것이
  정칙이고, 실제로 `1-workflow-list.md`/`2-trigger-list.md`/`3-schedule.md` 는 그 원칙대로 로컬 Overview
  헤딩을 두지 않는다. `6-config.md` 만 짧은 화면 소개 문단을 `## Overview (제품 정의)` 로 명명해 두고 있어
  형제 문서와 헤딩 사용이 어긋난다. 다만 내용 자체는 `_product-overview.md` 의 요구사항 표를 반복하지 않고
  Part A/B 구성을 안내하는 1문단짜리 서문이라 실질적 중복·모순은 없다 — 순수 헤딩 관례 불일치다.
- 제안: 규약 위반이라기보다 표기 일관성 문제이므로 차단 사유는 아니다. `6-config.md` 를 다음에 편집할 때
  헤딩을 `## 소개` 등 비-Overview 명칭으로 바꾸거나, 혹은 SKILL.md 쪽에 "다중 파일 영역이라도 화면별 1문단
  소개는 로컬에 둘 수 있다" 는 예외를 명문화하는 쪽을 검토.

## 준수 확인 (위반 없음 — 근거 기록)

아래는 이번 스코프에서 대조한 정식 규약과 target 문서가 실제로 정확히 일치한 항목이다(추후 재검토 시 중복 조사
방지용으로 남긴다).

- **에러 코드 명명** ([`error-codes.md`](../../../../../../spec/conventions/error-codes.md) §1): `1-workflow-list.md`/
  `2-trigger-list.md`/`6-config.md` 가 쓰는 `VALIDATION_ERROR`·`RESOURCE_CONFLICT`·`TRIGGER_ENDPOINT_PATH_CONFLICT`·
  `DUPLICATE_NODE_LABEL`·`AUTH_CONFIG_NOT_FOUND`·`INVALID_FIELD`·`BOT_TOKEN_INVALID`·`MODEL_CONFIG_INVALID` 모두
  `UPPER_SNAKE_CASE` + 의미 기반 명명으로 §1 을 따른다.
- **감사 액션 명명** ([`audit-actions.md`](../../../../../../spec/conventions/audit-actions.md) §2.2·§3): 현재
  착수 대상인 `model_config.delete` 는 레지스트리의 `model_config` 행(현재형 `create`/`update`/`delete`/
  `set_default`, §2.2 CRUD 예외 분류)과 정확히 일치한다.
- **Secret 마스킹/노출 정책** ([`secret-store.md`](../../../../../../spec/conventions/secret-store.md) §1.1):
  `2-trigger-list.md` §2.3.1 의 "AuthConfig 의 `***<last4>` 마스킹은 Reveal 가능한 자격증명용이라 write-only
  `botToken` 에는 차용하지 않는다" 는 서술이 §1.1 원문(ref·평문 모두 응답 바디에 나가면 안 된다)과 정확히
  일치한다.
- **Swagger DTO 패턴** ([`swagger.md`](../../../../../../spec/conventions/swagger.md) §1-5·§1-7):
  `botToken`(write-only 입력)/`hasBotToken`(readOnly derived) 서술이 §1-5 예시와 1:1 대응하고,
  `update-trigger.dto.ts` 로 지칭되는 top-level PATCH 바디는 `Update<Entity>Dto` 접두 대상 범주(§1-7)에
  정확히 속한다(신설 nested 변형 오분류 없음).
- **Chat Channel 필드 계약** ([`chat-channel-adapter.md`](../../../../../../spec/conventions/chat-channel-adapter.md) §2.3):
  `2-trigger-list.md` §2.3.1 이 인용하는 `uiMapping.formMode`/`visualNode`/`buttonLayout`·`rateLimitPerMinute`·
  `languageHints` 필드명·enum 값이 컨벤션 원문과 정확히 일치한다.

## 요약

번들 프롬프트 자체는 예산 truncation 으로 사실상 무의미했으나, 대상 문서(`spec/2-navigation` 의 workflow-list·
trigger-list·schedule·config 스펙)를 저장소에서 직접 읽어 관련 정식 규약(`error-codes.md`·`audit-actions.md`·
`secret-store.md`·`swagger.md`·`chat-channel-adapter.md`·`review-citations.md`)과 대조한 결과, **명명·출력 포맷·
Swagger DTO 패턴·시크릿 마스킹 어느 축에서도 CRITICAL/WARNING 급 위반은 발견되지 않았다.** 발견된 두 건(다른 파일의
날짜 없는 bare 리뷰 인용 1건, `6-config.md` 의 Overview 헤딩 단독 사용)은 모두 이번 변경 스코프 밖의 기존 상태이고
관련 규약 스스로가 소급 정리를 요구하지 않으므로 INFO 로만 기록한다. `spec_impact: none` 인 이번 plan 은 이 검토
결과로 차단되지 않는다.

## 위험도

LOW
