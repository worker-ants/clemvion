# Rationale 연속성 검토 — webchat-boot-single-flight (impl-done)

검토 모드: `--impl-done`, scope=`spec/7-channel-web-chat/`, diff-base=`origin/main`.
worktree(SoT): `/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4`

특별 지시(호출자): 이번 라운드가 같은 PR 안에서 앞서 내린 결정("A-6": `sendCommand` 비-410
에러 경로의 `teardownSession()` 호출 + 리듀서 `RESTORED`/`BOOTED` `ended` 가드)을 의도적으로
되돌렸다. 되돌림의 근거로 제시된 것은 `spec/7-channel-web-chat/3-auth-session.md` §3.1-3(storage
정리 조건 열거: SSE terminal / 복원 시 200+terminal·404·복구불가 401 / 명령 응답 410 Gone —
비-410 명령 실패는 미포함)과 §3.1-2("200+running → 복원" 명시)다. 이 되돌림이 어떤 spec 의
`## Rationale` 이 이미 기각한 대안을 재도입하는 것은 아닌지, 추론이 건전한지를 검증한다.

## 조사 방법

1. git 이력으로 실제 도입·되돌림 커밋을 확정: `b1bef8633`(A-6 확대 + C2: `sendCommand` 비-410
   경로 `teardownSession()` 추가) → `79e9876cd`("A-6 되돌림" — 두 변경 모두 제거).
2. `plan/in-progress/webchat-boot-single-flight.md` 전문 대조 — "진행 기록 — A-6 완료"(180-197행,
   최초 가드 도입 근거) → "C2"(218-225행, teardown 추가 근거) → "후속(18_39_11 처리) §1"(306-329행,
   되돌림 근거·재현표)까지 3단 논증을 추적.
3. 현재 코드(`widget-state.ts` `RESTORED`/`BOOTED`/`WAITING` case, `use-widget.ts` `sendCommand`/
   `start`/`endConversation`/`newChat`)를 직접 Read 해 "ERROR 가 teardown 을 안 거치는 유일
   경로"라는 주장과 "`sendCommand` 와 `endConversation`/`newChat` 은 구조적으로 분리된 경로"라는
   주장을 코드 대조로 검증.
4. `spec/7-channel-web-chat/3-auth-session.md §3.1`(66-79행)·`1-widget-app.md`(R6/R7/R9)·
   `0-architecture.md`(R1/R5)·`4-security.md`(R1-R6)·`spec/5-system/14-external-interaction-api.md`
   (EIA-IN-02/EIA-IN-12/R-replay-unavailable) 의 `## Rationale` 을 대조해 이번 되돌림과 충돌하는
   과거 결정이 있는지 확인.
5. 독립 사전 검증으로 `review/code/2026/07/17/18_39_11/requirement.md`(이 되돌림을 유발한 원래
   CRITICAL 발견)와 `RESOLUTION.md` 를 대조해 동일 spec 조항 인용·동일 결론인지 확인.
6. `origin/main` 스냅샷과 대조해 "이월된 pre-existing gap"이 이번 PR 신규 도입이 아님을 확인.
   `CHANGELOG.md` 에 되돌려진(순변경 0) 메커니즘의 잔재가 없는지 확인.

## 발견사항

- **[INFO]** 반복 회귀 이력을 고려한 spec-level Rationale 승격 제안 (필수 아님)
  - target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:660-693`(`sendCommand` 비-410
    에러 분기 — 커밋 `79e9876cd`), `codebase/channel-web-chat/src/lib/widget-state.ts` `RESTORED`
    (123-138행)·`BOOTED`(140-142행) case.
  - 과거 결정 출처: `spec/7-channel-web-chat/3-auth-session.md` §3.1 본문 2·3번 항목(66-79행) —
    storage 정리 조건 열거 + "200+running→복원" 규정. 단 해당 문서 `## Rationale`(R3-R6, 122행
    근방)에는 "왜 비-410 명령 실패가 정리 트리거 목록에서 제외됐는가"에 대한 명시적 산문 근거는
    없다(본문에서 논리적으로 도출은 가능하나 별도 명문화는 아직 없음).
  - 상세: 이번 되돌림은 spec 본문 §3.1-2·§3.1-3 과 정확히 일치하고(아래 "요약" 참조) 별도 spec
    변경을 요구하지 않는 순수 코드 conformance 회복이다. 다만 `plan/in-progress/
    webchat-boot-single-flight.md`(329행)가 스스로 "이 클래스의 8번째 거울상"이라 부를 만큼, 정확히
    이 지점(리듀서 `ended` 가드 범위·`teardownSession` 호출 시점)이 같은 PR 안에서만 3단으로
    뒤집혔다(가드 도입 → teardown 추가 → 둘 다 제거). "왜"의 상세는 지금 커밋 메시지·plan 진행기록·
    인라인 JSDoc 에만 있고, 이 plan 이 추후 `plan/complete/`(관례상 archive 이동)로 옮겨지면
    접근성이 낮아진다.
  - 제안: `3-auth-session.md` §Rationale(R6 인접) 또는 `1-widget-app.md` §Rationale(R9 인접)에
    "명령 실패의 세분류(410 vs 그 외)에 따라 storage 정리 여부가 갈리는 이유 — EIA-IN-12 는 410 을
    '종료된 execution 에 대한 명령'에만 결부하므로 그 외 실패(5xx·409·네트워크 순단)를 서버 확인
    종료와 동일시하지 않는다"를 1문단으로 승격 기재할 것을 권고. 필수는 아니나(spec 본문 자체가
    이미 결정을 충분히 규정하므로 CRITICAL/WARNING 은 아님) 이 코드 영역의 반복 회귀 이력을
    감안하면 인접 spec Rationale 승격이 9번째 재발을 막는 값싼 보험이다.

- **[INFO]** 기존 known-gap(`ERROR`→`ended` 무조건 전이가 `1-widget-app.md §2` Form "실패 시
  재제출" 약속과 불일치)은 이번 PR 이전부터 존재 — 신규 이슈 아님, 처리 적절함을 확인
  - target 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:689-691` 주석("남은 gap(이
    PR 범위 밖)").
  - 과거 결정 출처: `spec/7-channel-web-chat/1-widget-app.md §2` Form 행("실패 시
    `error.details[{field,message,code}]` 표시·재제출").
  - 상세: `git show origin/main:codebase/channel-web-chat/src/lib/widget-state.ts` 로 직접 확인한
    결과 `case "ERROR": return { ...state, phase: "ended", ... }` 무조건 전이는 이 PR 시작 전부터
    (origin/main 에도) 존재했다. 이번 A-6 되돌림은 이 gap 을 새로 만들거나 넓히지 않았다 — 오히려
    A-6 시절 "재제출 불가"였던 것이 "대화 영구 소실"로 격상됐던 것을 원상복구했을 뿐이다(plan
    356행 "이월 (신규)" 절이 이를 명시). `plan/in-progress/webchat-boot-single-flight.md` 가 이
    gap 을 project-planner 트랙으로 명시적으로 이월해 뒀다 — CLAUDE.md 의 "구현 중 spec 변경
    필요 시 developer 는 멈추고 project-planner 위임" 원칙을 정확히 따른 처리다.
  - 제안: 조치 불필요(이미 올바르게 추적됨). 후속 project-planner 착수 시 이 항목이 §3.1-3 관련
    작업과 한 트랙으로 묶일 수 있음을 참고만 할 것.

### 검토했으나 충돌 없음으로 확인된 항목 (기록용)

- **`1-widget-app.md` R7·R9 "낙관적 로컬 우선 종료, 명령 실패해도 되돌리지 않는다" 원칙과의 충돌
  여부**: R7/R9 는 사용자가 명시적으로 "대화 종료"/"새 대화"를 누른 경우(`endConversation`/
  `newChat`)에, 로컬을 **먼저** `ended`/새 세션으로 전이한 뒤 서버 명령을 best-effort 로 쏘고
  실패해도 되돌리지 않는다는 원칙이다. 코드 확인 결과 `endConversation`(823-858행)·`newChat`
  (786-809행)은 `client.interact()` 를 **직접** 호출하며 자체 `try/catch`(`console.warn` 만, 리듀서
  dispatch 없음)를 쓰고, 이번 되돌림이 건드린 `sendCommand`(submit_message/click_button/
  submit_form 전용, 720·731·738행에서만 호출)와는 완전히 분리된 코드 경로다. 따라서 이번 변경은
  R7/R9 의 낙관적-종료 원칙을 위반하지 않으며 그 원칙이 적용되는 범위 자체가 아니다.
- **`3-auth-session.md` R6 "defense-in-depth·stale 토큰 잔존 금지"와의 충돌 여부**: R6 은 "종료/
  복구불가 확정 시" storage 를 즉시 비워 노출 시간을 최소화하라는 것이며, 비-410 실패는 토큰이
  실제로 무효화(EIA §8.3 jti blacklist)되지 않은 **여전히 유효한** 세션이므로 이 invariant 의
  적용 대상이 아니다(재현 로그 상 `getStatus` 가 내내 `200 {status:"running"}`).
- **EIA 스펙과의 정합**: `EIA-IN-02`/`EIA-IN-12`(`spec/5-system/14-external-interaction-api.md`
  72·82행)는 `410 Gone` 을 "**종료된 execution 에 대한** 명령"에만 결부한다. `interact()` 구현이
  5xx·409·네트워크 순단을 410 과 구분 없이 같은 예외로 던지는 것(client-side)과, "그 예외들을
  서버 확인 종료로 취급한다"(A-6 시절 코드)는 **서로 다른 층위**다 — 이번 되돌림은 후자를
  걷어내 EIA 의 410 의미론과 클라이언트 동작을 재정합시켰다.
- **CHANGELOG 잔재 여부**: `CHANGELOG.md`(1-23행)에는 되돌려진 A-6/teardown 메커니즘에 대한
  언급이 없다 — 순변경 0 이라 CHANGELOG 에서도 제외했다는 커밋 메시지·RESOLUTION.md(18_39_11)
  주장과 일치.
- **독립 사전 검증과의 일치**: `review/code/2026/07/17/18_39_11/requirement.md`(86-113행)가 이번
  되돌림을 유발한 CRITICAL 을 `3-auth-session.md §3.1` 동일 조항으로 이미 지적했고, 두 가지 처방
  ((a) 코드를 좁힌다 vs (b) spec 을 명문화해 정책을 넓힌다)을 제시했다. 개발자는 `RESOLUTION.md`
  에서 (a)를 명시적으로 선택하며 "(b) 는 spec 변경이라 developer 트랙 밖(CLAUDE.md)"이라고
  근거를 남겼다 — skill 경계(project-planner vs developer)를 올바르게 지켰다.

## 요약

이번 라운드가 되돌린 A-6(및 그 근본조치였던 `sendCommand` 비-410 경로 `teardownSession()` 호출·
리듀서 `RESTORED`/`BOOTED` `ended` 가드)은 spec 이 기각한 결정을 재도입한 것이 아니라,
`3-auth-session.md §3.1-2`("200+running → SSE 재연결 → 복원")·`§3.1-3`(storage 정리 조건 명시
열거 — 비-410 명령 실패는 그 목록에 없음)이라는, **이번 PR 에서 한 번도 변경되지 않은 기존
spec 본문**과 코드를 재정합시키는 조치다. git 이력(도입 `b1bef8633` → 되돌림 `79e9876cd` diff
전문 대조)과 plan 진행기록을 직접 확인한 결과 재현 근거(저장세션·phase·executionId 대조표)·
단일라인 mutation 귀속·독립 AI 코드리뷰(동일 spec 조항 인용, 동일 결론 CRITICAL)가 모두 정합
했다. `sendCommand`(submit_message/click_button/submit_form)와 `endConversation`/`newChat`(헤더
"대화 종료"/"새 대화")는 코드상 완전히 분리된 경로이므로, 이번 변경은 `1-widget-app.md` R7/R9 의
낙관적-로컬-우선 종료 원칙과도 무관하며 그 원칙을 위반하지 않는다. 개발자는 스펙을 임의로
재해석하거나 새 정책을 코드로 침묵 확장하지 않았고(리뷰어가 제시한 "spec 명문화 후 코드 유지"
대안을 근거와 함께 명시적으로 기각), 남은 진짜 gap(`ERROR`→`ended` 자체가 Form 재제출 약속과
어긋나는 pre-existing 문제, `origin/main` 에도 이미 존재함을 확인)은 project-planner 트랙으로
정확히 이월했다. Rationale 연속성 관점에서 이 되돌림은 건전하다. 유일한 개선 여지는 이 반복
회귀 클래스의 "왜"를 spec 자체의 `## Rationale` 절에도 승격 기재해 두는 것(INFO, 필수 아님)이다.

## 위험도

NONE
