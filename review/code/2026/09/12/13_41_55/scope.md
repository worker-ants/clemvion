# 변경 범위(Scope) 리뷰

## 검증 방법

프롬프트가 "컨텍스트 예산 초과로 생략"이라고 표시한 파일 8개(discord.adapter.{ts,spec.ts}, slack.adapter.{ts,spec.ts}, telegram.adapter.{ts,spec.ts}, chat-channel-input-rules.spec.ts, triggers.controller.ts, triggers.service.{ts,spec.ts}, backend-labels.ts, chat-channel/types.ts)에 대해 `git diff origin/main...HEAD -- <file>` 로 실제 저장소 diff 를 직접 대조했다. 프롬프트에 실린 unified diff 와 실제 diff 가 hunk 단위로 정확히 일치함을 확인했다 — 숨겨진 추가 변경은 없다. `git diff origin/main...HEAD --stat` 결과(25 files changed, 1197 insertions, 70 deletions)도 프롬프트의 파일 목록·개수와 일치한다.

또한 `plan/in-progress/impl-setup-error-code.md`(이 턴의 작업 계획서)를 대조 기준으로 사용했다 — "작업 5건" 표, 설계 판단 (a)~(e), "인접 백로그 (d)" 명시 등 계획에 미리 선언된 항목인지 여부로 각 diff 를 판정했다.

## 발견사항

- **[INFO]** `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `BOT_TOKEN_INVALID` 메시지 문구 변경이 plan 의 "작업 5건" 표에 명시적으로 나열되지 않았다
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (diff 게이트 618)
  - 상세: plan 표는 5개 파일(`chat-channel-input-rules.ts`/`slack.adapter.ts`/`discord.adapter.ts`/`telegram.adapter.ts`/`triggers.controller.ts`)만 명시하지만, 실제 diff 는 이 프론트엔드 라벨 파일도 함께 바꿨다. 다만 변경 내용 자체는 "분류 기준이 transport(401/403)에서 원인(자격 증명 거부)으로 바뀐다"는 이번 PR 의 핵심 결정과 직접 연동된 필연적 후속 수정이다 — 백엔드 메시지에서 "401/403"이라는 transport 숫자를 뺀 것과 대칭으로, 사용자 노출 문구도 같은 숫자를 빼는 것이 계약 일관성상 맞다. 범위 이탈이라기보다 plan 표의 열거 누락에 가깝다.
  - 제안: 실질적 문제는 아니나, 이런 "표에 없는 5+1번째 파일" 패턴이 재발하면 plan 표를 갱신하는 습관을 들일 것.

- **[INFO]** `chat-channel-input-rules.spec.ts` 의 캐너리 테스트 구조가 대규모로 재작성됨(단일 `describe` → 중첩 `describe`, 캐너리 제거·대체)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (diff 게이트 230~327 부근)
  - 상세: 겉보기엔 "불필요한 리팩토링"으로 보일 수 있으나, plan 문서의 "증거 — 이 PR 은 동작을 바꾼다. 캐너리가 뒤집히는 것이 의도다" 절과 체크리스트 "캐너리 뒤집기 + `getStatus()` 단언 + `details.reason` 부재 + 인접 백로그 (d)" 항목에 정확히 사전 선언돼 있다. 옛 캐너리(discord verify_key → 502 고정)가 이번 변경으로 의도적으로 깨지는 대상이었고, 인접 백로그 (d)(non-Error 입력 분기 + `details.reason` 단언)를 같은 커밋에서 처리하는 것도 plan 에 "인접 백로그 (d) 를 같은 커밋에서 처리한다"로 명시돼 있다. 범위 이탈 아님.

- **[INFO]** `review/consistency/2026/09/12/12_54_15/**` 8개 파일(SUMMARY.md 등 consistency-check 산출물)이 코드 변경과 같은 diff 에 포함됨
  - 위치: `review/consistency/2026/09/12/12_54_15/*`
  - 상세: 이는 CLAUDE.md 가 의무화한 "`developer` 는 구현 착수 직전 `consistency-check --impl-prep` 의무"의 산출물이며, `review/` 폴더가 gitignore 대상이 아니라는 프로젝트 관례(코드베이스 메모 `feedback_plan_checkbox_actual_state`)와도 부합한다. 코드 변경과 워크플로 산출물이 섞인 것이지 "무관한 수정"은 아니다.

- **[INFO]** `credentialRejectedError`/`isCredentialRejectedError`/`CREDENTIAL_REJECTED_CODE` 신규 export 가 `chat-channel/types.ts` 한 곳에 집중되고 provider 3종(discord/slack/telegram) adapter 가 이를 import — 파일 수는 늘었지만 plan 의 설계 판단 (b) "작은 헬퍼 하나를 `chat-channel/types.ts`(이미 adapter 3종이 공유)에 둔다"에 정확히 부합. 기능 확장(over-engineering) 소견 없음 — 서브클래스 대신 프로퍼티 방식을 택한 근거(plan (b))도 결합도 최소화 쪽으로 타당.

- 그 외 discord-client.ts/spec.ts, discord.types.ts, triggers.service.ts/spec.ts, triggers.controller.ts 의 변경은 모두 plan 의 작업 항목·설계 판단((a) 호출자 로깅, (c) Slack 열거, (d) discord 기존 code 필드 구분, (e) 502 필터 실측)에 1:1 대응되며 범위 밖 수정이 없다.

## 비대상으로 확인한 항목

- **포맷팅/공백 변경**: diff 전 구간에서 순수 포맷팅만 바뀐 줄 없음 (수작업 diff 대조 결과, 각 hunk 가 실질 변경을 동반).
- **임포트 변경**: 신규 import(`credentialRejectedError`, `isCredentialRejectedError`, `CREDENTIAL_REJECTED_CODE`, `ApiBadGatewayResponse`, `BadGatewayException`, `TelegramApiResponse` type, `Logger`)는 모두 새로 추가된 코드가 실제로 사용한다. 미사용 import 나 정리성 import 변경 없음.
- **주석 변경**: 추가된 JSDoc/인라인 주석은 모두 이번 PR 이 바꾸는 판별 로직(§1.1.2 네임스페이스 구분, 401/403 fallback 한시성, Slack 열거 근거 등)을 설명하는 신규 주석이며, 기존 로직과 무관한 주석 삭제·수정은 없음(옛 주석은 대체된 로직 설명이 바뀌었으므로 함께 갱신된 것).
- **설정 변경**: `.eslintrc`, `tsconfig`, `package.json` 등 설정 파일은 diff 대상에 없음.

## 요약

16개 코드/프론트엔드 파일 + 1개 plan 파일 + 8개 consistency-check 산출물, 총 25개 파일 변경 전부가 `plan/in-progress/impl-setup-error-code.md` 에 사전 선언된 "작업 5건"과 설계 판단 (a)~(e), 그리고 "캐너리 뒤집기"·"인접 백로그 (d) 동시 처리" 결정과 1:1 대응된다. 프롬프트가 예산 초과로 생략 표시한 8개 파일도 `git diff origin/main...HEAD` 로 직접 대조해 프롬프트에 실린 hunk 와 완전히 일치함을 확인했다 — 숨겨진 스코프 이탈은 없다. 프론트엔드 라벨 문구 변경 1건이 plan 표에 명시적으로 열거되지 않았으나 내용상 이번 PR 의 핵심 결정(transport 기준 폐기)과 직접 연동된 필연적 후속 수정이라 INFO 로 처리했다. 전반적으로 스코프 이탈·불필요한 리팩토링·과잉 기능·무관한 파일 수정 없음.

## 위험도

NONE
