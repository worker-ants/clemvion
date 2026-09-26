# Cross-Spec 일관성 검토 — spec-draft-swagger-request-body.md

## 검토 대상

- target: `plan/in-progress/spec-draft-swagger-request-body.md` (swagger.md §5-4 체크리스트 한 줄 · `code:` frontmatter 가드 등재 · Rationale 한 절)
- 대조: `spec/conventions/swagger.md`(§1-7·§5-4·Rationale 기존 절), `spec/5-system/15-chat-channel.md` §5.4, `spec/5-system/3-error-handling.md`(`INVALID_BOT_TOKEN` 행), `spec/5-system/2-api-convention.md` §5.4, 형제 가드(`forbidden-response-codes-guard.ts`·`http-status-advertised-guard.ts`), 선례 DTO(`execute-workflow.dto.ts`·`chat-channel-rotate-bot-token-request.dto.ts`), `common/pipes/validation.pipe.ts`, 트래커(`spec-draft-nullable-notation-followups.md`)

## 발견사항

- **[INFO]** `§5.4` 절 번호가 문서마다 다른 의미로 이미 쓰이고 있다
  - target 위치: Rationale 절 — `spec 이 약속한 INVALID_BOT_TOKEN(15-chat-channel.md §5.4)`
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.4(부재 표현 — `null` vs 키 생략), `spec/5-system/15-chat-channel.md` §5.4(bot-token rotation API 응답 계약), swagger.md 자신의 §5-4(새 엔드포인트 체크리스트, 하이픈 표기)
  - 상세: 세 문서가 각기 다른 의미로 "5.4"(또는 "5-4") 번호를 쓰고 있다. target 은 항상 문서명과 함께 인용해 실제로는 모호하지 않지만(`15-chat-channel.md §5.4`처럼), 저장소 전체에서 `§5.4` 만으로 grep 하면 세 서로 다른 규칙이 걸린다. 이는 target 이 새로 만든 충돌이 아니라 기존에 이미 존재하던 절 번호 우연 일치이며, swagger.md 자신도 이미 이 패턴(하이픈 `§5-4` vs 점 `§5.4`)으로 자기 절과 타 문서 절을 구분해 오고 있다(예: 기존 439줄 "API 규약 §5.4 검증 층" 인용).
  - 제안: target 자체는 수정 불필요(이미 문서명을 병기해 모호성을 해소함). 저장소 전반에서 절 번호만으로 인용하는 관행이 있다면 향후 `conventions/` 쪽에 "절 번호는 항상 문서명과 병기" 같은 메타 규칙을 고려할 수 있으나, 이번 draft 범위 밖.

## 교차 검증 결과 (충돌 없음, 근거)

- **API 계약 충돌 없음**: target 은 신규 엔드포인트·요청/응답 shape 을 정의하지 않는다. 오히려 Rationale 이 `rotate-bot-token` 을 DTO 클래스로 승격하면 `spec/5-system/15-chat-channel.md` §5.4(`INVALID_BOT_TOKEN`, `3-error-handling.md:283` 에도 동일 코드 등재)가 깨진다는 점을 근거로 **클래스 강제를 명시적으로 기각**했다. 실제 코드(`triggers.controller.ts` `rotateBotToken`, `chat-channel-rotate-bot-token-request.dto.ts` 헤더 주석)를 대조한 결과 이 인과관계 서술은 정확하다 — target 이 이 계약을 보호하는 방향으로 설계됐다.
- **RBAC/권한 충돌 없음**: 권한 모델을 건드리지 않는다.
- **요구사항 ID 충돌 없음**: 새로 부여하는 요구사항 ID 가 없다(가드 이름 `request-body-advertised` 는 저장소 전체에 선행 사용처 없음 — 병렬 리뷰어 `naming_collision.md` 결과와 일치).
- **계층 책임 충돌 없음**: 신설 가드는 `codebase/backend/src/repo-guards/__tests__/` 아래 형제 가드(`forbidden-response-codes-guard.ts`·`http-status-advertised-guard.ts`)와 같은 위치·같은 reflection 판정 축·같은 "소급 적용(baseline 0)" 정책을 따른다. §1-4·§3 이 쓰는 "신규 변경 한정" 정책과 §2-4·403 이 쓰는 "소급 적용" 정책 두 갈래 중 target 이 후자를 고른 근거(광고-실제 정합성 문제)도 스스로 명시해, 기존 두 정책 사이에서 임의로 고른 것이 아님을 보인다.
- **§1-7 범위 충돌 없음**: target 은 §1-7(`Update` 접두 명명)을 확장하지 않기로 명시적으로 결정했고, 그 사유(문서 전용 DTO 이름 정책은 `ExecuteWorkflowDto` 선례와 함께 별도 결정 필요)를 Rationale 에 남겼다. 구현 plan(`request-body-guard.md`)과 트래커(`spec-draft-nullable-notation-followups.md` 5141행)의 범위 설명과도 일치한다 — 세 문서 간 스코프 서술이 어긋나지 않는다.
- **웹훅 본문 규칙 충돌 없음**: "형태를 발신자가 정하는 본문은 `@ApiBody({ schema: {} })`" 서술은 기존 `hooks-webhook-body.spec.ts`(임의 스키마 `@ApiBody` 캐너리)·`spec/5-system/12-webhook.md`(요청 본문을 파싱해 그대로 전달)와 부합한다.

## 요약

target 은 신규 엔티티·API 계약·상태 전이·RBAC 을 도입하지 않는 순수 문서화 규칙(§5-4 체크리스트 한 줄)과 그 가드 등재이며, 유일한 실질 변경 지점(요청 DTO 클래스 강제 여부)에서 오히려 다른 영역 spec(`15-chat-channel.md` §5.4 의 `INVALID_BOT_TOKEN` 계약)과의 충돌을 피하도록 설계됐다는 점을 실제 코드(`triggers.controller.ts`·`validation.pipe.ts`)와 대조해 확인했다. §1-7 범위를 의도적으로 비워둔 스코프 결정도 구현 plan·트래커와 서술이 일치한다. 발견된 유일한 항목은 절 번호(`§5.4`/`§5-4`)가 문서마다 다른 의미로 쓰인다는 기존 상태에 대한 INFO 이며, target 이 유발하거나 악화시키지 않는다.

## 위험도

NONE
