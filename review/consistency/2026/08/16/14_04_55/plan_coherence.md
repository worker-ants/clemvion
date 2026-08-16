# Plan 정합성 검토 — spec-draft-eia-error-masking-catalog.md

## 발견사항

- **[WARNING]** I1 결정의 근거로 인용한 R17 불릿이 실제로는 반대 내용을 말한다
  - target 위치: `plan/in-progress/spec-draft-eia-error-masking-catalog.md` §R17 5번째 불릿의
    "내부 REST 는 마스킹하지 않는다(비대칭 — 의도)" 하위 항목 — *"위 `ai_message` 불릿이
    문서화한 '내부 표면은 원문 유지' 방향과 같은 판단이다"*
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` I1
    ("내부 REST 와 WS 가 같은 `Execution.error` 에 다른 값을 말한다" — *"의도된 비대칭이면
    R17 의 `llmCalls` 선례처럼 caveat 로 명시하고 ... **둘 중 하나를 고르는 것이 이 항목이다**"*)
  - 상세: target 은 이 미해결 결정(I1)을 "내부 관찰자 표면은 원문 유지" 로 택일하면서, 근거로
    현재 spec `§R17` 의 `execution.ai_message` 불릿을 인용한다. 그런데 그 불릿의 실제 문구는
    **정반대**다 — `spec/5-system/14-external-interaction-api.md:1436` "**내부 WS·Chat Channel
    도 마스킹됨(수용된 trade-off)**: 이 마스킹은 emit-site 라 내부 WS(에디터) wire envelope ...
    에도 적용된다" 이고, 같은 불릿이 "participant-vs-observer 분리 egress ... 는 **후속 개선
    여지**" 라고 명시해 "내부는 원문 유지" 가 **아직 존재하지 않는 미래 항목**임을 스스로
    밝힌다. 반대로 I1 항목 자신이 이미 지목한 정확한 선례는 `llmCalls` strip 이다 —
    같은 R17 "`nodeOutput.conversationConfig` + terminal `result`/`error`" 불릿이
    `stripExternalOnlyFields`(외부만 제거, 에디터는 원문 `llmCalls` 유지)로 "내부는 원문,
    외부만 제거" 패턴의 실제 선례다. target 은 I1 이 지정한 선례를 쓰지 않고 반대 내용의
    다른 불릿을 인용했다. (결정 자체— 워크스페이스 인증 내부 관찰자는 원문, 외부 EIA 표면만
    마스킹 — 은 `llmCalls`·`conversationThread`("**egress-only(의도)**: 내부 소비처는 faithful
    텍스트를 유지한다", `:1427`) 두 선례로 뒷받침 가능해 보이지만, target 이 실제로 쓴 인용은
    틀렸다.)
  - 제안: target §R17 신설 불릿의 해당 인용을 `ai_message` 불릿 대신 `llmCalls`
    strip(`stripExternalOnlyFields`) 또는 `conversationThread` 의 "egress-only(의도)" 문구로
    교체. 인용 오류를 그대로 spec 에 반영하면 영구 문서에 자기모순 근거가 남는다.

- **[WARNING]** 후속 tracker 체크박스 동기화 계획 누락
  - target 위치: `plan/in-progress/spec-draft-eia-error-masking-catalog.md` frontmatter
    `pending_plans` + 본문 전체(변경안 ①②, 범위 밖, Rationale)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W1(§6.4 필드 표 +
    §R17 카탈로그 등재, `303`행)·I1(내부 REST/WS 비대칭, `311`행) / 및 원 출처
    `plan/in-progress/eia-terminal-error-sanitize.md` "후속 (이 PR 범위 밖)" 첫 항목(`151`행,
    "planner 턴 — EIA §R17 ... 5번째 항목 등재")
  - 상세: target 문서가 하는 일 자체가 바로 이 두 tracker 의 열린 체크박스(W1·I1)를 정확히
    이행하는 것인데, target 안 어디에도 "spec 반영 후 두 plan 의 해당 `- [ ]` 를 `[x]` 로
    갱신한다" 는 조치 항목이 없다. frontmatter `pending_plans` 도
    `spec-sync-external-interaction-api-gaps.md` 만 열거하고, 같은 항목의 **원 출처**인
    `eia-terminal-error-sanitize.md` 는 누락돼 있다 — 두 파일 모두 같은 followup 을 각자
    (`10_19_31`·`11_36_45`) 독립 등재해 둔 상태라 하나만 닫으면 다른 하나가 stale 로 남는다.
    이 저장소가 이미 여러 차례 기록한 패턴(체크박스 이동 시 자매 자리 누락, "등재했다"만 하고
    실제 등재/동기화를 안 함)과 같은 형태다.
  - 제안: target 의 조치/체크리스트 절에 "spec 반영 후
    `spec-sync-external-interaction-api-gaps.md` W1·I1 과 `eia-terminal-error-sanitize.md`
    해당 후속 항목을 `[x]` 로 갱신 + 본 plan 상호 참조" 를 명시적으로 추가. `eia-terminal-error-sanitize.md`
    도 `pending_plans` 에 추가.

## 확인했으나 문제 없음 (참고)

- §R17 5번째 불릿 삽입 위치("3번째 불릿 뒤, `nodeOutput` allowlist 불릿 앞")는 현재 spec
  실측(`14-external-interaction-api.md:1441~1457`)과 정확히 일치하고, 앞선
  `spec-draft-eia-62-waiting-payload.md` W9 가 요구한 "allowlist 불릿 보존" 제약도 지킨다 —
  충돌 없음.
- §6.4 캐비엇 삽입 대상인 "두 인용 블록"(`code` nullable / `error` object 화)도 현재 spec
  실측(`:791~806`)과 일치한다. 같은 worktree 의 `spec-draft-eia-notification-payload-contract.md`
  가 §6 을 재구조화했지만(§6 도입부에 필드 집합 SoT 신설) §6.4 자체의 두 블록은 그대로
  남아 있어 target 의 삽입 지점은 stale 하지 않다.
- `execution.cancelled`(§6.5)의 `error` 는 코드 실측(`emitCancellationEvent` 호출부 전수 —
  `markWebChatIdleTimeout`/`RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`)상 항상 고정 문자열이라
  `toTerminalErrorPayload`/마스킹 대상이 아니다 — target 이 §6.4(`execution.failed`)에만
  캐비엇을 넣고 §6.5 를 건드리지 않은 것은 누락이 아니라 정확한 스코핑이다.

## 요약

target 은 `eia-terminal-error-sanitize.md`(및 그 미러 `spec-sync-external-interaction-api-gaps.md`
W1)이 등재해 둔 "planner 턴 — R17/§6.4 마스킹 카탈로그 등재" 후속 항목을 정확한 위치에 이행하며,
같은 tracker 의 미해결 결정 I1(내부 REST vs WS 비대칭)도 택일해 닫으려 시도한다 — 방향 자체는
두 tracker 의 지시와 정합한다. 다만 (1) I1 을 닫는 근거로 인용한 R17 `ai_message` 불릿이 실제로는
정반대 내용(내부도 마스킹됨)이라 인용 오류이고, (2) target 이 이행을 완료했을 때 두 tracker
(및 원 출처 plan)의 해당 체크박스를 `[x]` 로 되돌려 갱신하는 절차가 target 안에 명시돼 있지 않다.
둘 다 이 프로젝트가 반복적으로 겪어 온 "체크박스/인용 동기화 누락" 클래스이며, spec 본문에
반영되기 전에 고치는 편이 싸다.

## 위험도
MEDIUM
