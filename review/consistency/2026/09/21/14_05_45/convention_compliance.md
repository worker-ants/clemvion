# 발견사항

### [INFO] 리뷰 예산 절단으로 인한 부분 검증 — 스코프 한계 명시
- target 위치: `spec/2-navigation/4-integration.md` · `6-config.md` · `9-user-profile.md` · `_product-overview.md` 등 다수 (bundle 상 `<!-- @bundle-file -->` 표시만 있고 본문 없음)
- 위반 규약: 해당 없음 (harness 한계 — `spec/conventions` 문서 대부분도 동일하게 본문이 잘림, 예: `chat-channel-adapter.md` 재인용분 제외 전부)
- 상세: `convention_compliance.md` 프롬프트가 `spec/2-navigation` 영역의 상당수 파일과 `spec/conventions/**` 대부분(특히 cafe24/makeshop API 카탈로그 전량)을 예산 초과로 빈 섹션으로 번들했다. 이는 이미 알려진 하네스 이슈(`feedback_consistency_spec_mode_budget.md`)와 같은 패턴이며 target 문서 자체의 결함이 아니다.
- 제안: target 수정 불필요. 다만 본 리포트는 **본문이 실제로 로드된 세 파일**(`1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md`)에 대해서만 확정적 판정을 내렸고, 나머지 `spec/2-navigation/*.md` 는 이번 라운드에서 실측 불가함을 명시한다.

### [INFO] Rationale 소제목 표기 방식이 형제 문서 간 다름
- target 위치: `spec/2-navigation/2-trigger-list.md` `## Rationale` (R-1~R-17 라벨) vs `1-workflow-list.md`/`3-schedule.md` `## Rationale` (라벨 없는 자유 제목)
- 위반 규약: 없음 — CLAUDE.md·`project-planner/SKILL.md` 는 "Overview/본문/Rationale 3섹션"만 요구할 뿐 Rationale 소제목 표기 형식(예: `R-N` prefix)을 규정하지 않는다.
- 상세: 같은 `spec/2-navigation` 폴더 안에서 `2-trigger-list.md`만 `### R-1.`, `### R-4.` 식 안정적 anchor id를 쓰고, `1-workflow-list.md`/`3-schedule.md`는 `### 1. "공유 워크플로우"...`, `### sort/order 쿼리 반영...` 식 자유 제목을 쓴다. 정식 규약 위반은 아니며 순수 스타일 제안이다.
- 제안: 강제 사항이 아니므로 조치 불요. 굳이 통일하려면 project-planner가 SKILL.md에 Rationale anchor 표기 규칙을 추가로 성문화하는 편이 향후 재지적을 막는다.

## 검증 결과 (준수 확인 — 문제 없음)

아래 항목은 명시적으로 대조해 **위반이 발견되지 않았음**을 확인했다(참고용으로 남긴다):

- **`audit-actions.md`**: `trigger.deleted`/`trigger.updated`/`trigger.notification_secret_rotated`/`trigger.chat_channel_bot_token_rotated`/`trigger.interaction_token_revoked`가 §3 도메인 레지스트리의 `trigger` 행과 정확히 일치 (과거분사 패턴, 언더스코어 구분자, sub-channel 접두 규칙 모두 부합).
- **`error-codes.md`**: `VALIDATION_ERROR`/`RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT`/`DUPLICATE_NODE_LABEL`/`BOT_TOKEN_INVALID`/`AUTH_CONFIG_NOT_FOUND`/`INVALID_FIELD` 모두 `UPPER_SNAKE_CASE`이며 의미 기반 명명 원칙에 부합.
- **`swagger.md` §1-5 (writeOnly/readOnly)**: `botToken`(write-only) + `hasBotToken`(readOnly, derived) 조합이 규약 예시와 사실상 동일한 패턴.
- **`swagger.md` §1-7 (Update 접두 범위)**: `UpdateTriggerDto`(top-level) vs `WorkflowSettingsDto`/`ChatChannelConfigDto`류(nested, 로컬 패턴) 구분이 정확히 지켜짐.
- **`secret-store.md` §1.1**: "AuthConfig `***<last4>` 마스킹은 write-only 필드에 차용하지 않는다"는 인용이 실제 §1.1 제목("비대상 필드도 응답 바디에는 나가지 않는다")과 정확히 대응.
- **`chat-channel-adapter.md`**: `uiMapping.formMode`(`multi_step`/`native_modal`/`auto`) · `visualNode`(`text`/`photo`/`auto`) · `buttonLayout`(`auto`/`vertical`/`horizontal`) enum 값이 SoT 코드 스니펫과 문자 그대로 일치.
- **문서 구조**: `spec/2-navigation`는 다중 파일 영역이라 `project-planner/SKILL.md`의 "다중 spec 파일을 가진 영역은 `_product-overview.md`로 Overview 분리" 규칙대로 개별 파일에 `## Overview` 헤더가 없는 것이 정상이며 위반이 아님. 세 파일 모두 본문(번호 섹션) + `## Rationale`로 끝나 3섹션 구조를 충족.
- **`review-citations.md`**: 세 문서 어디에도 bare `hh_mm_ss` 형태의 review 세션 인용이 없음 (날짜만 있는 결정 시점 표기는 이 규약의 규제 대상이 아님).
- **`i18n-userguide.md` §Principle 6-B**: `R-14`·`CCH-SE-01`·`WH-MG-09` 같은 내부 anchor id 노출 금지는 **사용자 가이드 MDX**(`codebase/frontend/src/content/docs/**`) 한정 규약이며, 지금 검토 대상은 내부 spec 문서라 적용 범위 밖 — 위반 아님.

# 요약

`spec/2-navigation/1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md`(이번 라운드에 본문이 로드된 유일한 대상, 나머지 동일 영역 파일들은 예산 절단으로 실측 불가)는 명명 규약(에러 코드, 감사 액션), 출력 포맷 규약(부재 표현 §5.4, writeOnly/readOnly, secret 마스킹), API 문서 규약(DTO 명명, enum 값)까지 폭넓게 대조했으나 CRITICAL·WARNING급 정식 규약 위반이 발견되지 않았다. 오히려 여러 항목이 conventions 문서가 인용하는 실제 SoT와 문자 그대로 일치할 만큼 정합적이다. 유일한 지적은 harness 예산 절단으로 인한 검증 범위 제한(INFO)과 형제 문서 간 Rationale 소제목 표기 스타일 차이(INFO, 강제 규약 없음)뿐이다. 이 PR 자체는 해당 spec 영역에 델타가 없으므로(코드 전용 변경) 이 결과는 baseline 현황 확인 성격이다.

# 위험도

NONE
