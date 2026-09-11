# Plan 정합성 검토 — `plan/in-progress/spec-draft-details-code-landed.md`

## 검토 방법

자동 corpus 번들(`plan_in_progress`)은 이번 실행에서 **0개 로드 · 63개 생략**이었다(본 프롬프트
자체가 그렇게 도착했다 — 아래 발견 참조). 이를 신뢰하지 않고 target 이 직접 인용하는 근거
파일들을 수동으로 `Read`/`grep` 해 대조했다:

- `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커, 2850줄) — target 이
  종결/등재를 주장하는 4개 체크리스트 항목의 원문을 라인 단위로 대조
- `plan/complete/spec-draft-chat-channel-conventions.md` (`#1316`) — `DEC-*` 라벨·「형태와
  무관하다」 문구·§5.3 결정 내용의 출처 검증
- `plan/complete/impl-details-code-wiring.md` (`#1317`) — 배선 완료·4라운드 리뷰 이력·잔여
  planner 항목 이관 검증
- `spec/5-system/2-api-convention.md §5.3`, `spec/5-system/3-error-handling.md`,
  `spec/5-system/15-chat-channel.md`, `spec/2-navigation/2-trigger-list.md`,
  `spec/4-nodes/7-trigger/providers/{slack,discord}.md` 현재 본문
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`assertInboundSigningPlaintextByProvider`,
  `assertAuthConfigInWorkspace`) 실측
- `git log` (현재 워크트리 브랜치, `origin/main` 과 동기)로 `#1311`~`#1317` 커밋 순서 확인
- 나머지 in-progress plan 전수에 대해 `details[].code`·`AUTH_CONFIG_NOT_FOUND`·`§5.3`·
  `§5.4.1`·`botToken`·`15-chat-channel`·`2-api-convention`·`3-error-handling.md`·
  `2-trigger-list.md`·`providers/{slack,discord}.md` 키워드로 grep 후 히트한 파일을 개별 확인

## 발견사항

- **[INFO]** 이 검토 자체의 자동 corpus 가 0건 로드됐다 — `harness-review-gate-followups.md` 의
  기지 갭이 이 실행에서도 재현
  - target 위치: 해당 없음 (target 문서 내용과 무관, 검토 프로세스 자체의 한계)
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` (`plan_coherence`/`corpus`
    예산 트렁케이션 — target_doc 60% · corpus 40% 을 checker 별로 나누는데, `plan_in_progress`
    corpus 가 이번 실행에서 최상단 파일도 못 실을 만큼 작았다)
  - 상세: 본 프롬프트의 "`plan/in-progress/` 진행 중 문서" 절이 실제로는 **빈 목록**이고 63개
    파일 전부가 "컨텍스트 예산 초과로 생략" 됐다. 즉 자동 번들만 신뢰했다면 이 checker 는
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(2850줄, target 이 직접
    의존하는 유일한 살아있는 트래커)를 **한 글자도 못 보고** `BLOCK: NO` 를 냈을 것이다. 이번
    검토는 그 파일을 직접 `Read`/`grep` 해 우회했지만, 다음에 이 checker 가 자동 실행될 때도
    같은 방식으로 우회한다는 보장은 없다.
  - 제안: 새 결정 사안 아님(이미 알려진 harness 갭). target 의 체크리스트 1번(`/consistency-check
    --spec BLOCK: NO`)이 이 gap 의 영향을 받을 수 있음을 인지하고, 실행 시 `_prompts/plan_coherence.md`
    의 로드 여부를 확인할 것을 권장. target 자체를 바꿀 필요는 없다.

- **[INFO]** `providers/slack.md`·`providers/discord.md` 두 경로 표기가 developer 트래커
  항목 (f)의 "providers/{slack,discord,telegram} 6파일" 과 이름이 겹쳐 보이지만 실제로는
  다른 파일 집합이다
  - target 위치: 변경안 4a·4b (`spec/4-nodes/7-trigger/providers/{slack,discord}.md`)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` :2421-2422 (developer, "잔여 개선
    9건" (f) — `providers/{slack,discord,telegram}` **6파일**)
  - 상세: 실측 결과 트래커 (f)의 "6파일" 은
    `codebase/frontend/src/content/docs/06-integrations-and-config/{slack,discord,telegram}{,.en}.mdx`
    (ko/en 각 3개, **`codebase/**`**, developer 몫)이고, target 의 변경안 4a·4b 는
    `spec/4-nodes/7-trigger/providers/{slack,discord}.md` (**`spec/**`**, planner 몫)다. 완전히
    다른 파일 집합이라 실제 충돌·중복은 없으나, 두 항목이 "provider 문서의 `details.code`
    표기" 라는 같은 표현을 쓰고 있어 다음 편집자가 "이미 처리됐다" 고 오판할 여지가 있다.
  - 제안: target 은 그대로 두되, target 체크리스트의 트래커 종결 항목 옆에 "developer 트래커
    (f)의 user-guide MDX 6파일과는 별개(spec/ vs codebase/frontend/content)" 한 줄을 덧붙이면
    다음 편집자의 혼동을 막을 수 있다 (선택적, 비차단).

## 정합성이 확인된 부분 (참고용 — 발견사항 아님)

아래는 위 두 발견을 제외하면 target 의 결정 5건이 진행 중 plan·완료 plan·현재 코드와 정확히
합치함을 실측으로 확인한 결과다:

- `#1317`(`71feabeea`)이 이 브랜치의 `origin/main` 이력에 실제로 랜딩돼 있고, target 의 "왜 이
  턴인가" 전제(배선 완료)가 참이다.
- `spec-draft-nullable-notation-followups.md` 의 4개 체크리스트 항목(:2363, :2378, :2399,
  :2441)이 target 의 결정 1·2·3·4와 문장 단위로 일치하며, target 의 "이 턴에 하지 않는 것"이
  트래커의 항목 잔존 범위(developer 갈래만 존속)와도 일치한다.
- `2-api-convention.md:220` 의 「field 를 실으면 code 도 싣는다 — 형태와 무관하다」 문구가
  실재하며, 결정 2 가 이를 좁히지 않고 판별 기준만 더한다는 서술이 실제 본문과 합치한다.
  `#1316`(`plan/complete/spec-draft-chat-channel-conventions.md`)이 `DEC-1`~`DEC-4` 를 이미
  쓰고 있어 target 이 `DEC-*` 를 피한 이유도 실측과 합치한다.
- `assertAuthConfigInWorkspace` 소스에 정확히 target 이 인용하는 앵커 주석("이 자리만
  top-level 이 도메인 특화 코드다 — §5.3 판정 미해결")과 트래커 경로가 박혀 있다.
- `2-trigger-list.md` 에서 `details.field='...'` 인용은 정확히 8곳이고, `endpoint_path`
  (:179, 결정 4c 제외 대상)를 뺀 **7곳**이 target 의 "§2.3.1 표 2 · §3 PATCH 註 4 · R-12 1"
  분해와 정확히 일치한다.
- `providers/slack.md:275`·`discord.md:297` 는 실제로 `details.field='inboundSigningPlaintext'`
  만 있고 `code` 가 없으며, 해당 서비스 가드(`assertInboundSigningPlaintextByProvider`)는
  코드 상 이미 `code: ErrorCode.INVALID_FIELD` 를 던진다 — 결정 4a·4b 의 전제와 정확히 합치.
  `botToken` 형식 정규식(`^\d{6,}:[A-Za-z0-9_-]{30,}$`)은 `15-chat-channel.md` 전역에 0건이고
  §5.4 는 실제로 "Bot Token Rotation API 응답 계약" 절이다 — 결정 5 의 인용 오류 지적이 실측과
  합치한다.
- `3-error-handling.md` 의 마지막 `§1.x` 항목은 §1.10 이고 신규 §1.11 은 다른 in-progress
  plan 과 번호 충돌이 없다. `TRIGGER_ENDPOINT_PATH_CONFLICT`(§1.10 의 선례)도
  `conventions/error-codes.md` 에 없어, 결정 3 이 그 문서에 손대지 않는 것도 선례와 합치한다.
- 다른 in-progress plan(63개, harness-review-gate-followups·spec-sync-auth-gaps·
  auth-guard-reflection-hardening·spec-sync-external-interaction-api-gaps·
  spec-conventions-engine-error-code-surface 등)의 `§5.3`·`details[].code`·`3-error-handling.md`
  관련 언급은 전부 이미 종결(`[x]`)됐거나 다른 축(감사 로그 액션명, WsErrorCode 등)을 다뤄
  target 과 충돌하지 않는다.

## 요약

target 이 인용하는 모든 실측·근거(배선 PR 랜딩 여부, 트래커 항목 문구, `#1316` 결정 원문,
현재 spec/코드 상태, 다른 in-progress plan 의 관련 축)를 직접 대조한 결과 **미해결 결정의
일방적 우회, 선행 plan 미해소, 후속 항목 누락 어느 것도 발견되지 않았다.** target 의 5개
결정은 `spec-draft-nullable-notation-followups.md` 에 이미 등재된 4개 항목을 그대로 승계해
닫는 정규 후속 turn 이며, developer 몫으로 명시적으로 남긴 항목(user-guide MDX 4곳, provider별
형식 검증 구현 여부)도 트래커 존속 상태와 정확히 일치한다. 유일하게 새로 짚을 것은 이 검토
자체의 자동 corpus 번들이 0건 로드된 기지 harness 갭(다른 in-progress plan 이 이미 추적 중)과,
provider 문서 명명이 developer 트래커 항목과 시각적으로 겹쳐 보일 수 있다는 비차단 INFO 둘뿐이다.

## 위험도

NONE
