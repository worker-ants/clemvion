# 문서화(Documentation) Review

지시 사항 두 가지를 독립 실측으로 확인했다.

1. **전수 grep**: 이 저장소 문서(CHANGELOG·spec·plan·JSDoc) 어디에도 이 PR이 고친 것을
   여전히 미해결/미구현으로 말하는 문장이 남아 있지 않은가.
2. **코드 대조**: 새로 분리 등재한 잔여 서술("주기 갱신이 terminal에 storage를 안 지운다")이
   실제 코드 상태와 일치하는가.

## 사전 확인 — 요청받은 수정 자체는 정확히 반영됨

- `plan/in-progress/webchat-auth-session-status-reconcile.md:196` `## 해소됨 — refresh_deferred
  의 나머지 절반` 절이 실제로 존재하고, 진단(`### 진단(당시)`)은 보존한 채 처분을 명시한다.
  `### 남은 것 — 없음(이 축에서는)` (`:237-241`)이 부수 잔여를 별도 축으로 정확히 분리했고,
  `## 주기 갱신이 terminal 을 만나도 세션을 정리하지 않는다 (2026-08-10, 범위 밖)` (`:243-256`)
  로 실제로 옮겨져 있다.
- 형제 절 `## 비-terminal refresh 실패 뒤 만료 토큰 재연결` 의 `### 처리 — (a) 로 종결됨`
  (`:172-180`) 세 항목 모두 `[x]` — 미체크 항목 2건이 실제로 종결됐다.
- `codebase/channel-web-chat/src/widget/use-token-refresh.ts:176-190` 를 직접 열어 확인:
  `.catch()` 에서 `isTerminalAuthError(err)` 가 참이면 `return` 만 하고 `finalizeEnded`/
  `clearSession` 어느 쪽도 호출하지 않는다 — **"주기 갱신이 terminal 에 storage 를 안 지운다"
  는 서술은 실제 코드와 일치한다.**
- `CHANGELOG.md:172`(refresh_deferred 도입 서술)·`:200`(3-state→4-state 각주)·
  `spec/7-channel-web-chat/3-auth-session.md:66,89,104-115`(§3.1-2·§R4)·`spec/0-overview.md:82`
  (6문서 모두 `implemented`)·frontmatter(`status: implemented`, `pending_plans:` 없음) 모두
  현재 상태와 정합했다.

여기까지는 요청받은 수정이 정확했다는 확인이다. 그러나 **더 넓게(코드 JSDoc·인접 plan 문서)
전수를 확대하자, 같은 클래스의 잔재 2건을 새로 발견했다** — 이번 라운드가 요청받은 검증의
핵심이 바로 이 "전수" 였으므로 아래에 기록한다.

## 발견사항

- **[CRITICAL]** `seedWaitingFromStatus` JSDoc이 이미 고친 CRITICAL의 구 동작("continue")을
  바로 다음 줄과 모순되게 여전히 서술한다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:588-589`
  - 상세: 해당 JSDoc 블록(`:580-594`, "REST 오류 분기")은 다음처럼 되어 있다.
    ```
    588: * - 재차 `401`·`410` → `"ended"`(복구 불가 확정, §R4). 그 **외** 실패(네트워크 등)는
    589: *   `"continue"` — 일시적 장애가 대화를 끝내지 않게 하는 경계다.
    590: * - **refresh 가 그 외 이유로 실패**(네트워크·5xx) → `"refresh_deferred"`. 스트림은 안 열되
    591: *   `scheduleRefresh` 는 건다 — 둘 다 안 하면 고착, 둘 다 하면 죽은 토큰으로 SSE 를 연다.
    ```
    588-589번째 줄은 "refresh 가 401/410 이 아닌 이유(네트워크 등)로 실패하면 `"continue"` 를
    반환한다"고 적는데, 바로 다음(590-591번째 줄)은 **같은 경우**(refresh 가 401/410 아닌
    이유로 실패)를 `"refresh_deferred"` 로 서술한다 — 정면 모순이다. 실제 코드
    (`recoverFromExpiredToken`, `:528-541`)를 직접 확인한 결과 `isTerminalAuthError(err)` 가
    거짓이면 실제로 `"refresh_deferred"` 를 반환한다(`:541`) — **588-589번째 줄이 stale**이다.
    `git blame` 으로 확인하면 588-589는 커밋 `08bd668a52`(2026-08-10 16:51:48, "재차 401 →
    401·410" 확장 커밋)가 쓴 것이고, 590-591은 그보다 15분 뒤인 `5693e42ad9`(17:06:24,
    `refresh_deferred` 갈래 도입 커밋)가 추가한 것이다 — 즉 `refresh_deferred` 를 새 갈래로
    추가하면서 그 직전에 있던 "그 외 실패는 continue" 문장을 지우지 않고 **그대로 둔 채 바로
    아래에 상충하는 새 문장을 이어 붙였다.** 이 588-589번째 줄이 서술하는 값(`"continue"`)은
    정확히 `16_42_07` 라운드에서 CRITICAL로 잡혔던 "거부된 토큰으로 SSE 를 여는" 그 버그의
    반환값이다 — 이 PR 전체가 두 라운드(`16_42_07`→`16_56_39`)를 들여 없앤 바로 그 문장이
    함수 자신의 계약 문서 안에 되살아나 있는 셈이다. 이 JSDoc은 `seedWaitingFromStatus` 의
    유일한 계약 문서이고 여러 라운드(`16_09_40` §6~8, `16_26_09` §5~6)에 걸쳐 "새 분기
    반영"으로 정확성이 반복 검증된 자리라 신뢰도가 높은데, 그 신뢰가 이번엔 무너진다. 부수로
    581번째 줄 "세 갈래를 상태코드로 가른다"도 실제로는 아래 5개 불릿(404 / 401-성공 /
    401-재차실패 / refresh-그외실패 / getStatus-그외오류)을 열거해 숫자가 맞지 않는다.
  - 제안: 588-589번째 줄의 "그 **외** 실패(네트워크 등)는 `"continue"` — 일시적 장애가
    대화를 끝내지 않게 하는 경계다." 문장을 삭제하고 "재차 `401`·`410` → `"ended"`(복구 불가
    확정, §R4)."만 남긴다. "세 갈래"도 실제 갈래 수(또는 "다음과 같이 가른다")로 정정.

- **[WARNING]** plan 문서 자신의 요약표가 방금 리네임된 절("§미해결"→"§해소됨")을 옛 이름으로
  가리킨다
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md:18`
  - 상세: 문서 최상단 완료조건 표(`:9-20`)의 마지막 행이 "| §비-terminal refresh 실패 후
    **스트림 부재** | **실측 완료 — 결함 확정.** 아래 §미해결 참조 |" 로 되어 있다. 그런데
    본문의 해당 절은 이번 PR(커밋 `410705910`)로 `## 미해결` → `## 해소됨 — refresh_deferred
    의 나머지 절반`(`:196`)으로 리네임·처분됐다 — 저장소 전체에 `## 미해결` 이라는 제목은
    이제 존재하지 않는다(`grep -n "## 미해결" plan/in-progress/webchat-auth-session-status-reconcile.md`
    결과 0건). 즉 이 표 행은 (a) 더 이상 존재하지 않는 앵커를 가리키고, (b) "결함 확정"
    이라는 프레이밍이 그대로 남아 그 결함이 **같은 PR 안에서 이미 닫혔다**는 사실을 반영하지
    않는다. 정확히 오케스트레이터가 이번에 검증을 요청한 "PR이 고친 결함을 미해결로 서술"
    패턴이 이 문서 자신의 색인 표 안에 남아 있는 경우다 — 본문 절은 고쳤지만 그 절을
    가리키는 상단 색인을 갱신하지 않은 것.
  - 제안: `아래 §미해결 참조` → `아래 §해소됨 참조(결함은 이 PR에서 닫혔고, 잔여는 별도
    §주기 갱신이 terminal 을 만나도... 축으로 분리)` 로 정정.

- **[WARNING]** `plan/complete/` 의 정정 각주가 스스로도 재정정 대상이 됐다
  - 위치: `plan/complete/web-chat-quality-backlog.md:23-27`
  - 상세: 이번 PR의 diff(파일 8)가 이 블록쿼트의 링크 경로 한 줄(`../in-progress/...` →
    `./...`)만 고쳤는데, 같은 블록쿼트의 나머지 문장은 손대지 않았다. 그 문장은:
    > _(2026-08-10 정정)_ 위 "spec 6문서 전부 `implemented`" 는 **더 이상 참이 아니다.**
    > `3-auth-session.md` 는 본문이 자인한 미구현(...)과 frontmatter 가 어긋나 있던 것이
    > 발견돼 `partial` + `pending_plans:` 로 정정됐다(...). 원문은 작성 시점 기록으로 남긴다.

    직접 확인한 현재 `spec/7-channel-web-chat/3-auth-session.md` frontmatter는
    `status: implemented` 이고 `pending_plans:` 필드가 없다(`spec/0-overview.md:82` 도 "영역
    spec 6문서가 모두 `implemented` 다"라고 명시). 즉 이 PR이 잔여(404·401·410 분기)를 마저
    구현하면서 상태가 `partial` → 다시 `implemented` 로 되돌아갔는데, 이 각주는 그 두 번째
    되돌림을 반영하지 않은 채 "spec 6문서 전부 `implemented` 는 더 이상 참이 아니다"라는
    **이제는 다시 거짓이 된 문장**을 현재형으로 단정하고 있다. "원문은 작성 시점 기록으로
    남긴다"는 캐비엇은 위쪽 원문(2026-06-27 작성)에는 적용되지만, 이 각주 자신(2026-08-10
    작성, 이번 PR이 직접 편집한 바로 그 블록)에는 같은 보호가 없다 — 이 각주도 이제는
    "작성 시점" 기록일 뿐이라는 점을 스스로 명시하지 않는다.
  - 제안: 각주 끝에 한 문장 추가 — 예: "(2026-08-10, 같은 날 재정정) 위 `partial` 전환의
    원인이던 잔여가 `webchat-reload-rest-error-branches.md` 로 구현 완료돼 frontmatter 는
    다시 `implemented` 로 복귀했다." 최소한 "원문은 작성 시점 기록"과 같은 수준으로 이
    각주도 시점 고정 문구임을 명시.

- **[INFO]** 완료조건 표 도입 문장의 항목 수가 표 자체와 어긋난다
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md:9`
  - 상세: "이 문서는 완료 조건이 **독립인 두 항목**을 담는다"라고 적는데, 바로 아래 표
    (`:12-18`)는 5행이다(§frontmatter 재판정 / §start() 401 갭 / §refresh 동시 발화 경합 /
    §catch 분기 세대 재검사 / §비-terminal refresh 실패 후 스트림 부재). `16_26_09` scope
    INFO가 이 문장을 쓴 시점엔 표가 2행이었고 이후 세 행이 추가되며 갱신되지 않았다. 위
    CRITICAL·WARNING만큼 오도력은 크지 않지만(문서 성격이 "독립 조건이면 in-progress에
    남는 게 정상"이라는 취지 설명이라 항목 수 자체는 핵심이 아님) 숫자가 실제와 다르다.
  - 제안: "두 항목" → "다섯 항목"(또는 "여러 항목")으로 정정.

- **[INFO]** 오래된 cross-audit 아카이브 문서 2건이 "미구현" 문구를 여전히 담고 있음(조치
  불요, 참고용)
  - 위치: `plan/complete/spec-draft-cross-audit-doc-batch.md:45,50`,
    `plan/complete/spec-code-cross-audit-2026-06-10.md:125,201,204`
  - 상세: 둘 다 2026-06 시점 V-18 결정 기록(cross-audit)이고, 문맥 자체가 "그 시점 재검증
    결과"임을 명시한다(예: "초기 '정합' 판단은 getStatus 호출만 보고 내린 오판 — plan_coherence
    CRITICAL 로 정정"). `webchat-reload-rest-error-branches.md`가 이미 명시적으로 "원문은
    작성 시점 기록으로 남긴다" 캐비엇을 붙인 것과 같은 성격의 완료 아카이브라, CLAUDE.md의
    `plan/complete/` 관례(작성 시점 기록 보존)상 갱신 의무는 없다고 판단한다. 다만 grep
    결과에 나타나므로 "전수 확인" 요청에 대한 완전성을 위해 기록해 둔다 — 실제로 오해를
    유발할 위험은 낮다(스스로 "V-18 종결", "재검증(정정)" 등 과거 시제 프레이밍을 이미
    갖추고 있고, `spec/0-overview.md`·`3-auth-session.md` 등 더 권위 있는 최신 문서가 이미
    올바른 현재 상태를 서술한다).

## 요약

요청받은 두 검증(전수 grep, 잔여 서술의 코드 일치)의 1차 스코프 — 이번 라운드가 직접 고친
`webchat-auth-session-status-reconcile.md` §해소됨/§잔여 분리, 형제 절 체크리스트,
CHANGELOG·spec·frontmatter — 는 전부 정확했다. `use-token-refresh.ts`를 직접 열어 "주기
갱신이 terminal에 storage를 안 지운다"는 새 잔여 서술도 실제 코드와 정확히 일치함을
확인했다. 그러나 검증 범위를 인접 문서(JSDoc·같은 plan의 색인 표·인접 plan/complete/ 각주)로
넓히자 **같은 "고친 결함을 옛 서술로 남김" 패턴 2건을 새로 발견했다** — 특히
`use-widget.ts:588-589`는 이 PR이 두 라운드에 걸쳐 없앤 정확히 그 버그의 반환값을 함수
자신의 계약 JSDoc 안에서 바로 다음 줄과 모순되게 되살리고 있어 CRITICAL로 분류한다. 이
브랜치가 반복해 겪은 "고친 값·범위가 인접 표면(이번엔 인접 JSDoc 줄)을 보는지 확인하지
않았다"는 패턴이 문서 영역에서도 재현된 사례다.

## 위험도

CRITICAL (1건 — `use-widget.ts:588-589` 자기모순 JSDoc이 이미 고친 버그의 옛 반환값을
현재 계약처럼 서술)
