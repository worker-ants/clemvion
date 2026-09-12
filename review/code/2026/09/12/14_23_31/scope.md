# 변경 범위(Scope) 리뷰 — impl-setup-error-code (14_23_31 라운드)

## 검증 방법

이 라운드의 diff(`origin/main...HEAD`, 25→59 파일로 확장)는 **직전 라운드**(`review/code/2026/09/12/13_41_55`)의
`/ai-review` 산출물 + `resolution-applier` 가 만든 SUMMARY#1~#7 조치 commit + SUMMARY#7 spec 위임
(`review/consistency/2026/09/12/14_11_58`)까지 포함한 **전체 브랜치 diff** 다. 개별 조치 커밋을
`git show --stat`/`git show <sha> -- <path>` 로 직접 열어 RESOLUTION.md/`_resolution_log.md` 의 서술과
실제 변경분이 1:1 대응하는지 대조했다(`8847b6736`·`eda10e051`·`a07c91b64`·`0adc3d577`·`15504662d`·
`8d1da07d9`·`3c47885a3`·`a9f626a9b`·`7339665c6`·`57fd180f2`). `chat-channel-input-rules.spec.ts`(프롬프트가
크기 제한으로 생략한 파일)는 `git diff origin/main...HEAD -- <path>` 로 직접 대조했다.

## 발견사항

- **[INFO]** SUMMARY#1 fix 커밋에 "드라이브바이" 수정이 명시적으로 동반됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 커밋 `8847b6736`
  - 상세: `Logger.prototype.warn` spy 를 `try/finally` 로 원복하는 SUMMARY#1 fix 와 **같은 커밋**에
    "`caught as BadRequestException` → `BadGatewayException` 캐스팅 오타 정정"(INFO #6 동반 수정)이
    함께 들어갔다. 커밋 메시지가 "드라이브바이"라고 스스로 명명하며 이유(같은 블록, 실제로 502 를
    단언하는 자리인데 타입 캐스팅이 틀려 있었음)를 밝히고 있어 은폐된 스코프 이탈은 아니다. 다만
    "관계없는 수정을 리뷰 fix 커밋에 끼워 넣지 않는다"는 일반 원칙 관점에서는 별도 커밋으로 쪼갤 수도
    있었던 자리다.
  - 제안: 조치 불필요(이미 투명하게 기록됨). 재발 시 "드라이브바이" 표시 관례를 계속 유지할 것.

- **[INFO]** `spec/conventions/chat-channel-adapter.md` 수정(SPEC-DRIFT 정정)이 이 developer
  worktree 안에서 이뤄졌으나, 권한 경계는 커밋 attribution 으로 지켜지고 있음
  - 위치: `spec/conventions/chat-channel-adapter.md` — 커밋 `3c47885a3`
  - 상세: CLAUDE.md 는 `spec/` 변경을 `project-planner` 전속으로 규정한다. 이 세션(`8d1da07d9`,
    `Co-Authored-By: Claude Sonnet 5`)은 "자기-반증형 소정정 조건 1(작성자=developer) 불성립"을
    `git blame`(`8964a7114`, planner 커밋)으로 실측 확인하고 **spec 을 직접 고치지 않은 채** draft 만
    작성해 위임했다. 실제 spec 반영 커밋(`3c47885a3`)과 뒤이은 plan 자기서술 정정(`a9f626a9b`)은
    `Co-Authored-By: Claude Opus 5` — 이 developer 세션과 다른 모델/턴이 수행했다는 신호가 커밋
    trailer 에 남아 있다. 같은 worktree 를 공유하지만 **역할 경계 위반은 아니다** — 오히려 CLAUDE.md
    가 요구하는 "developer 는 멈추고 planner 위임" 절차를 정확히 따른 사례로 보인다.
  - 제안: 조치 불필요. 다만 이 판정은 attribution(Sonnet vs Opus) 이라는 상대적으로 약한 신호에
    의존한다 — 다음 세션에서 이 패턴을 재사용할 때는 RESOLUTION.md 처럼 "왜 위임했는지 실측 근거"를
    함께 남기는 관례를 유지할 것.

- **[INFO]** 리뷰/일관성 검사 산출물(`review/code/**`, `review/consistency/**`) 39개 파일이 코드
  변경과 같은 diff 에 섞여 있음
  - 위치: `review/code/2026/09/12/13_41_55/*`(12개), `review/consistency/2026/09/12/12_54_15/*`(6개),
    `review/consistency/2026/09/12/14_11_58/*`(8개) 등
  - 상세: CLAUDE.md 가 의무화한 `--impl-prep`/`/ai-review`/`--spec` 워크플로의 산출물이며, `review/`
    는 gitignore 대상이 아니라는 확립된 관례(메모 `feedback_plan_checkbox_actual_state`)와도 부합한다.
    "무관한 파일 수정"이 아니라 이번 작업이 거친 harness 절차의 증거물이다.
  - 제안: 조치 불요. 스코프 이탈로 보지 않음.

- **[INFO — 직전 라운드에서 이미 등재, 재확인만]** `codebase/frontend/src/lib/i18n/backend-labels.ts`
  문구 변경과 유저가이드 4개 mdx 파일 추가가 plan 의 원래 "작업 5건" 표에 없었음
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts`, `codebase/frontend/src/content/docs/06-integrations-and-config/{discord,slack}{,.en}.mdx`
  - 상세: 이번 라운드에서 `plan/in-progress/impl-setup-error-code.md` 를 다시 열어보니 "6행은
    착수 후에 추가됐다"·"리뷰 후속으로 더 붙은 것" 절이 신설되어, 직전 스코프 리뷰(`13_41_55/scope.md`)
    가 지적한 "표에 없는 파일" INFO 를 그대로 plan 에 반영해 두었다. 두 확장 모두 이번 PR 의 핵심
    계약 변경(transport 축 폐기)의 직접적·필연적 후속이라는 근거가 커밋 메시지·plan 양쪽에 있다.
  - 제안: 조치 불요 — 스코프 이탈이 아니라 plan 문서화 누락이었고, 그 누락 자체가 이미 이번
    라운드에서 정정됐다.

## 비대상으로 확인한 항목

- **포맷팅/공백**: 조치 커밋(`8847b6736`·`eda10e051`·`a07c91b64`·`0adc3d577`·`15504662d`) 전부를
  `git show`로 직접 열어 확인 — 순수 포맷팅만 바뀐 hunk 없음.
- **임포트 변경**: 신규 import(`BadGatewayException`, `Logger`, `credentialRejectedError` 등)는 모두
  같은 커밋에서 실제로 사용됨. 불필요한 정리성 import 변경 없음.
- **기능 확장(over-engineering)**: `DISCORD_CREDENTIAL_REJECTED_STATUSES` 추출(`a07c91b64`)은 동작
  변경 없이 스타일만 통일한 것으로 명시(커밋 메시지 "동작 변경 없음"), 코드 diff 대조로 확인 — 실제로
  `401`/`403` 리터럴 값 자체는 그대로.
- **설정 변경**: `.eslintrc`/`tsconfig`/`package.json` 등 diff 대상 아님.
- **주석 변경**: 신규 주석은 전부 이번 변경이 도입한 판별 로직·근거를 설명하며, 무관한 기존 주석
  삭제·수정 없음.

## 요약

이번 라운드는 직전 `/ai-review` 라운드(13_41_55)의 CRITICAL 0·WARNING 7 을 `resolution-applier` 가
SUMMARY#1~#7 로 전량 조치하고, SPEC-DRIFT 1건(SUMMARY#7)을 developer 권한 밖으로 판정해 draft →
planner 턴(Opus attribution) 위임 → `--spec` BLOCK:NO → 반영까지 마친 상태의 전체 diff 다. 각 조치
커밋을 개별적으로 열어 RESOLUTION.md 서술과 대조한 결과 모두 해당 SUMMARY 항목에 1:1 대응하며, 숨은
추가 변경이나 무관한 파일 수정은 발견되지 않았다. 유일하게 눈에 띄는 것은 SUMMARY#1 fix 커밋에 명시적으로
표시된 "드라이브바이" 타입 캐스팅 정정 1건이며, 이는 투명하게 기록되어 있고 같은 블록·같은 근본 원인이라
실질적 스코프 이탈로 보기 어렵다. spec 파일 변경은 developer 자신이 아니라 별도 attribution(Opus)의
planner 턴이 수행해 CLAUDE.md 의 역할 경계를 지킨 것으로 판단된다. review/consistency 산출물 다수가
diff 에 섞여 있는 것은 이 프로젝트가 강제하는 워크플로의 정상적인 부산물이다.

## 위험도

NONE
