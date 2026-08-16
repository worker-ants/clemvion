---
title: spec draft — EIA §R17 마스킹 카탈로그에 종결 `Execution.error` 등재 + §6.4 캐비엇
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-16
owner: project-planner
status: in-progress
priority: P2
pending_plans:
  - plan/in-progress/spec-sync-external-interaction-api-gaps.md
  - plan/in-progress/eia-terminal-error-sanitize.md
spec_impact:
  - spec/5-system/14-external-interaction-api.md
---

# EIA 마스킹 카탈로그에 종결 `Execution.error` 를 등재한다

## Overview

#1177 이 종결 이벤트(`execution.failed`)의 `error.message`·`details` 에 egress 값-마스킹을
넣었다(`toTerminalErrorPayload` → `redactTerminalError` → `deepRedactSecrets`). **구현은 끝났는데
spec 이 그 보안 불변식을 모른다** — §R17 "표면 제약(보안)" 마스킹 카탈로그에도, §6.4 페이로드
절에도 없다.

리뷰 5라운드(`09_51_00`~`11_26_51`)와 consistency 3라운드가 매번 이 한 건을 SPEC-DRIFT 로
올렸고, developer 권한 밖이라 planner 턴으로 넘어왔다.

## 핵심 — R17 3번째 불릿에 속으면 안 된다

그 불릿 제목이 `` **`nodeOutput.conversationConfig` + terminal `result`/`error`** `` 라서 **이미
포괄된 것처럼 보인다.** 본문을 읽으면 아니다:

> *"`getStatus` 는 세 출구(waiting `nodeOutput` · terminal `result`(COMPLETED) ·
> terminal `error`(FAILED)) **전부**에 값 마스킹 + 필드 삭제를 병행한다"*

즉 그 `error` 는 **`getStatus` 가 `execution.outputData` 로 조립하는 것**이다. 이번에 마스킹한
`Execution.error`(WS/SSE/webhook 종결 emit)와는 **다른 컬럼**이다.

> 이 함정은 이미 한 번 실현됐다 — `spec-sync-external-interaction-api-gaps.md` 의 등재 문구가
> *"REST 와 대칭"* 이라고 썼는데, 실측하면 REST `getStatus` 의 `error` 는 `outputData` 기반이라
> 애초에 같은 값이 아니었다. **이름이 같은 두 `error` 를 spec 이 구분해 주지 않으면 다음 사람도
> 같은 자리에서 미끄러진다.**

## 변경안

### ① §R17 — 불릿 신설 (`nodeOutput.conversationConfig` 불릿 **뒤**, `nodeOutput` 일반 키 allowlist 불릿 **앞** = 삽입 후 **4번째**)

> 서수를 실측했다 — R17 불릿은 현재 **4개**다. 초안에 "5번째" 라고 쓴 건 틀렸고, 삽입하면 신설이 4번째, 기존 allowlist 불릿이 5번째로 밀린다 (`14_15_45` INFO8).

> - **종결 이벤트 `execution.failed` payload 의 `error.message`/`error.details`
>   (DB `Execution.error` 원문 — 위 3번째 불릿의 `outputData` 기반 `error` 와 다른 컬럼)
>   (강제됨 — 2026-08-16)**: `execution.failed` 의 `error.message`·
>   `error.details` 는 **DB `Execution.error` 원문**에서 오고, 이 payload 는 내부 WS 뿐 아니라
>   SSE 스트림(§5.2)·아웃바운드 webhook(§3.1)으로 **외부 제3자**에게 나간다. WS 경로의
>   `sanitizePayloadForWs` 는 **credential 키 이름** 기반이라 자유 텍스트 *안*에 박힌 토큰
>   (`Bearer …`, 자격증명 포함 URI)을 잡지 못하고, `stripExternalOnlyFields` 는 `llmCalls` 만
>   지운다 — 이 필드엔 값-패턴 방어가 없었다.
>   `shared/utils/terminal-error-payload.ts` 의 `toTerminalErrorPayload` 가 **egress
>   초크포인트**에서 `deepRedactSecrets` 로 `message`·`details` 를 마스킹한다. 종결 emit 4곳과
>   chat-channel 재정규화 1곳이 **모두 이 함수를 거치므로**(DB write 경로는 0) 새 emit 경로가
>   생겨도 마스킹이 구조적으로 빠지지 않는다.
>   - **`code`·`nodeId` 는 대상이 아니다** — enum 문자열과 uuid 로 값 공간이 닫혀 있다.
>   - **egress-only(§R17 원칙 준수)**: DB `Execution.error` 는 **원문을 보존**한다. 서버 로그·
>     사후 디버깅의 진실이고, write-time redaction 은 위 `conversationThread` 불릿이 기각한
>     것과 같은 이유로 채택하지 않았다.
>   - **위 3번째 불릿의 `error` 와 다른 컬럼이다** — 거기 `terminal error(FAILED)` 는
>     `getStatus` 가 `Execution.outputData` 로 조립하는 값이다. 이름이 같아 혼동하기 쉽다.
>   - **잔여 갭(의도)**: `SECRET_LEAK_PATTERNS` 는 자격증명을 겨냥하므로 **자격증명 없는 연결
>     문자열·내부 호스트명·사설 IP·스택 프래그먼트는 통과**한다. 알림 경로 전용
>     `CONNECTION_STRING_PATTERN`/`STACK_TRACE_PATTERN` 을 공유 SoT 로 올리면
>     `deepRedactSecrets` 의 다른 소비자 전부가 영향받으므로 별건으로 분리했다
>     (`spec-sync-external-interaction-api-gaps.md` 등재).
>   - **내부 REST 와의 비대칭은 아직 미결이다**: `GET /api/executions/:id` 는 `Execution.error`
>     **원문**을 반환하므로 같은 컬럼을 두 표면이 다른 값으로 말한다. 이 문서는 그 사실만
>     기록하고 **어느 쪽이 옳은지는 정하지 않는다** —
>     [`spec-sync-external-interaction-api-gaps.md`](../../plan/in-progress/spec-sync-external-interaction-api-gaps.md)
>     의 미결 항목이다. (`14-execution-history.md` R-5 는 그 엔드포인트의 안전성이 *"롤 게이팅이
>     아니라 서버 boundary masking parity 에 의존"* 한다고 규정하므로, "내부라서 원문이어도
>     된다" 는 결론은 **성립하지 않는다**.)

### ② §6.4 — 페이로드 절에 캐비엇 추가

기존 두 인용 블록(`code` 는 null 가능 / `error` 는 전 경로 object) **뒤에** 한 블록 추가:

> **`message`·`details` 는 egress 마스킹을 거친다** (2026-08-16). 자격증명 패턴(`Bearer …`,
> 자격증명 포함 URI 등)이 `***` 로 치환된다 — 근거·범위·잔여 갭은 §R17 의 "종결 이벤트
> `error`" 불릿. **`code`·`nodeId` 는 원문 그대로**다. JSON 형태 `message` 는 마스킹 후
> 재직렬화되므로 공백 등 포맷이 정규화될 수 있다(파싱 가능성은 유지).

**왜 §6.4 에도 쓰나**: 외부 통합사가 보는 정본은 CHANGELOG 가 아니라 이 필드 표다
(`10_19_30` api_contract W2).

## 체크리스트

- [x] `--spec` — `14_04_55` **BLOCK: YES**(내 근거 오인용 + 앵커 placeholder) → 정정 후 `14_15_45` **BLOCK: NO**
- [x] §R17 불릿(삽입 후 4번째) + §6.4 캐비엇 반영 — 문서 가드 20파일·2,958 tests PASS
- [x] **spec 반영 후 트래커 동기화** — W1 체크, **I1 은 의도적으로 열어 둠**
      `spec-sync-external-interaction-api-gaps.md` 의 **W1 은 체크**하고 **I1 은 열어 둔다**
      (이 PR 이 결정하지 않는다), `eia-terminal-error-sanitize.md` 후속 첫 항목도 체크
- [ ] push 게이트 통과 → PR

## 범위 밖

- 잔여 갭(연결 문자열 등) 실제 확대 — 별건, 트래커 등재됨
- `interaction.triggerToken` SecretResolver — 별건, 트래커 등재됨
- `codebase/**` 일체 — planner 턴이다

## Rationale

**왜 카탈로그에 넣나.** §R17 의 마스킹 불릿들은 "이 표면은 이렇게 방어된다" 를 열거하는 **인벤토리**다
(같은 문서가 `"이 표가 전부다"` 를 자기 선언한다). 인벤토리에 없는 방어는 다음 사람에게 **없는
것과 같다** — 리팩터하다 조용히 걷어내도 아무도 모른다.

**왜 `spec_impact: none` 이 아니었나.** #1177 은 `none` 으로 갔고 그 근거는 *"§6.4 가 새니타이즈를
요구하지 않으므로 계약 위반이 아니다"* 였다. 맞는 말이지만 **카탈로그 완전성은 별개 문제**다 —
`10_19_31` plan_coherence 가 이 구분을 짚었고 옳다.

**내가 미결 결정을 조용히 확정할 뻔했다** (`14_04_55` rationale CRITICAL). 첫 draft 는
*"내부 REST 는 마스킹하지 않는다(비대칭 — 의도)"* 라고 썼다. 두 가지가 틀렸다:

- 근거로 인용한 `execution.ai_message` 불릿은 **정반대**를 말한다 — *"내부 WS·Chat Channel 도
  마스킹됨(수용된 trade-off)"*. 그 불릿이 "후속 개선 여지" 로 남긴 participant-vs-observer 분리를
  **이미 확정된 판단인 양** 끌어 썼다.
- `2-navigation/14-execution-history.md` R-5 는 같은 엔드포인트의 안전성이 *"롤 게이팅이 아니라
  서버 boundary masking parity 에 의존"* 한다고 규정한다. "내부라서 원문이어도 된다" 는 그 원칙과
  정면으로 어긋난다.

무엇보다 그 질문은 **내가 직전 PR 에서 트래커에 미결(I1)로 등재한 것**이다 — 스스로 "택일해야
한다" 고 적어 놓고 다음 턴에 근거도 없이 한쪽으로 닫고 있었다. 사실만 기록하고 결정은 열어 뒀다.

**기각한 대안 — §6.4 에만 쓰고 R17 은 두기.** §6.4 는 필드 *형태*를 규정하는 자리고, R17 은 보안
불변식을 모으는 자리다. 형태 절에만 적으면 다음에 "마스킹 표면 전수" 를 물었을 때 안 걸린다.
