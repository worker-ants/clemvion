# Rationale 연속성 검토 결과 (재검증 라운드)

검토 대상: `spec/7-channel-web-chat/`(impl-done, diff-base=`origin/main`)
본 라운드 목적: 직전 세션(`15_37_22`)에서 본 checker 가 낸 WARNING("`3-auth-session.md` §3.1 콜아웃이
'200+종료 REST 분기 미구현'으로 stale")에 대한 조치(commit `2a789a645`)를 검증.

## 조치 검증 절차

1. `git -C <worktree> show 2a789a645 -- spec/7-channel-web-chat/3-auth-session.md` 로 실제 diff 확인 —
   변경 범위는 §3.1 콜아웃 한 문단뿐(`0-architecture.md`/`1-widget-app.md`/`2-sdk.md`/`4-security.md`/
   `5-admin-console.md` 무변경).
2. 코드 직접 대조(worktree 절대경로):
   - `codebase/channel-web-chat/src/widget/use-widget.ts` — `seedWaitingFromStatus`(L394-448),
     `handleEiaEvent`(L294-337), `applyConfig` 복원 분기(L741-793).
   - `codebase/channel-web-chat/src/lib/eia-client.ts` — `getStatus`(L94-99, 404/401 무구분 `EiaError` throw).
   - `codebase/channel-web-chat/src/widget/use-token-refresh.ts` — `refreshToken` 사용처(예약 refresh 전용).
   - `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L240 회귀 테스트.
3. spec 원본 직접 대조: `spec/5-system/14-external-interaction-api.md` §5.3(getStatus 응답)·
   `R-replay-unavailable`(L1247-1255)·에러 코드 표(L332-345)·`1-widget-app.md` §3.1(L341-353).

## 발견사항

- **[INFO]** 직전 라운드의 INFO 제안(§3.1-3 storage 정리 트리거 열거 최신화 + `1-widget-app.md` cross-reference)은 이번 조치에 포함되지 않음 — 잔존
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1-3(L78, "storage 정리 책임" 열거) ·
    `spec/7-channel-web-chat/1-widget-app.md` §3.1 "SSE 재연결" blockquote(L104 부근)
  - 과거 결정 출처: 직전 라운드(`review/consistency/2026/07/17/15_37_22/rationale_continuity.md`) 자신의 INFO 항목.
  - 상세: 이번 commit(`2a789a645`)은 §3.1 콜아웃(WARNING 대상)만 정정했다. §3.1-3 "storage 정리 책임" 열거
    ("…200+terminal status·404·복구불가 401 확인 시, 그리고 명령 응답 410 Gone 수신 시…")는 여전히
    `execution.replay_unavailable` 수신 후 `getStatus` 가 terminal 로 확인되는 다섯 번째 트리거를 명시하지
    않고, `1-widget-app.md` §3.1 blockquote 도 "세션 정리 + `[ended]` 전이" 문장에서 `3-auth-session.md`
    §3.1-3(SoT 라고 자임한 절)를 cross-reference 하지 않는다. 두 문서가 같은 동작(`finalizeEnded`→
    `teardownSession` 공유 경로, 코드 확인)을 독립 산문으로 설명하는 상태가 지속된다 — 즉시 위험은 아니나
    향후 한쪽만 갱신되는 drift 여지가 여전히 열려 있다.
  - 제안: WARNING 이 아니므로 이번 라운드에서 재차단하지 않되, 후속 spec 정리 시 함께 처리 권고 — 이번 라운드
    조치 자체를 막을 사유는 아니다.

이 외 CRITICAL/WARNING 신규 발견 없음. 아래는 확인 근거 상세.

### 검증 1 — 정정된 콜아웃과 실제 코드의 정합 (과대/과소 flip 여부)

`3-auth-session.md` §3.1(L62)의 정정 문구를 항목별로 코드와 대조:

| 콜아웃 주장 | 코드 근거 | 판정 |
|---|---|---|
| `200`+종료(terminal) REST 분기 = **구현됨**(세션 정리+`[ended]`+host 통지, SSE 재오픈·refresh 예약 스킵) | `seedWaitingFromStatus`(L413-416)이 `status` 를 `TERMINAL_EVENTS`(completed/failed/cancelled)와 대조해 `finalizeEnded()`(L282-292: `teardownSession`+`dispatch ENDED`+`sendEvent conversationEnded`) 호출 후 `"ended"` 반환. 호출부 `applyConfig`(L784) `if (outcome !== "continue") return;` 로 `openStream`/`scheduleRefresh`(L791-792) 를 **건너뜀**. 회귀 테스트 `use-widget-eager-start.test.ts:240` "복원된 세션이 이미 terminal → ENDED 전이 + SSE 미오픈 + storage 부활 없음" 이 정확히 이 시나리오를 고정 | **일치** |
| `404` REST 분기(EXECUTION_NOT_FOUND) = **여전히 미구현(Planned)** | `eia-client.ts:98-99` `getStatus` 는 `!res.ok` 를 전부 무구분 `EiaError` throw. `seedWaitingFromStatus` 의 `catch`(L432-445)는 404/401/네트워크 오류를 구분 없이 `console.warn` 후 `"continue"` 반환 — `applyConfig` 는 이 경우 `openStream(saved,"0")` 을 **그대로 진행**(무효 executionId 로 SSE 오픈 시도), storage 정리·`[ended]` 전이 없음. 회귀 테스트에도 404 케이스 없음 | **일치**(과대 flip 아님) |
| `401` 낙관적 refresh 1회 분기 = **여전히 미구현(Planned)** | 위와 동일 catch 경로로 처리(구분 없음). `refreshToken` 은 `use-token-refresh.ts` 의 예약(scheduled, 만료 전 lead-time) refresh 전용이며, 재로드-시점 401 트리거형 낙관적 refresh 로직은 `use-widget.ts`/`use-token-refresh.ts` 어디에도 없음(grep 확인, `401` 문자열은 주석 2곳뿐) | **일치**(과대 flip 아님) |

→ "구현됨"으로 flip 한 범위는 `200`+terminal 하나로 정확히 국한되고, 남긴 Planned 항목(404·401)은 실제로 아직
소비되지 않는 catch-all soft-fail 경로에 뭉쳐 있음을 코드로 재확인. flip 범위·잔존 Planned 항목 모두 실제와 일치.

### 검증 2 — 인접 spec 문서와의 정합 (`1-widget-app.md` §3.1, EIA §5.3·`R-replay-unavailable`)

- **`1-widget-app.md` §3.1**(L341-353, 이번 diff 이전에 이미 존재 — `15_37_22` 라운드에서 검토된 원본): "**단, 스냅샷이
  이미 terminal 이면 종료로 확정한다**" blockquote 가 동일한 동작(세션 정리+`[ended]`+host `conversationEnded`
  통지, SSE 재오픈·토큰 갱신 예약 스킵)을 **독립적으로 이미 "구현됨" 전제로 서술**하고, 심지어 "**같은 판정은
  세션 복원 시점(§3.1 재open 복원)에도 적용되며**"라고 `3-auth-session.md` §3.1 재로드 복원 경로를 명시적으로
  가리킨다. 정정 전에는 `1-widget-app.md`(구현됨 전제) ↔ `3-auth-session.md`(Planned 서술)가 **같은 동작에 대해
  두 문서가 어긋난 상태**였다 — 이번 flip 은 이 잠재 모순을 해소하는 방향으로 작동했다(단순 정확성 교정을 넘어
  cross-doc 정합 개선).
- **EIA §5.3**(`14-external-interaction-api.md` L429-480): `GET /api/external/executions/:id` 가 종료된
  execution 도 `200 OK`+`status` 로 응답함을 확인(콜아웃·numbered step 2 서술과 일치). 에러 코드 표(L332-345)에
  `404 EXECUTION_NOT_FOUND`("executionId 없음")·`401 TOKEN_REVOKED`("execution 종료로 인한 jti blacklist,
  refresh 로 복구 불가")가 실제로 정의돼 있어, 콜아웃이 "Planned"로 남긴 두 분기가 서버측에 실재하는 조건임을
  뒷받침(클라이언트 미대응만 남은 상태라는 서술이 정확함).
- **EIA `R-replay-unavailable`**(동 파일 L1247-1255): "신호 후 연결 유지 — 신호를 push 한 뒤에도 SSE 연결은 닫지
  않고 subscriber 를 유지, 클라이언트는 REST `getStatus` 로 현재 상태만 병행 보정하고 **이후 이벤트만** 열린
  스트림으로 수신"이라는 원문을 확인 — "gap 안에 종료된 경우 그 terminal 이벤트도 버퍼와 함께 유실돼 다시 오지
  않는다"는 콜아웃의 추론과 정합(신호 이후 이벤트만 수신되므로 gap 내부에서 이미 지나간 terminal 전이는 재전송
  대상이 아님). 링크는 앵커 없이 파일 top 을 가리키지만, 이는 문서 전체에서 이미 쓰이는 기존 인용 스타일(예:
  `[EIA §5.2·EIA-NF-03]`도 동일 무앵커)과 동일해 이번 diff 가 새로 만든 편차가 아님.
- 두 표에서 참조하는 `[1-widget-app §3.1]` 링크도 대상 섹션이 실존하며 서술이 상호 보강 관계임을 확인. 모순 없음.

### 검증 3 — 기각된 대안 재도입·원칙 위반 여부

- 이번 변경은 설계 결정이 아니라 **이미 구현된 코드 상태를 반영한 "구현 현황" 라벨 정정**이다. 대안 비교·트레이드
  오프 판단이 개입하지 않으므로 R1~R10 계열의 어떤 기각 대안도 재도입하지 않았고, 새로 도입한 설계 원칙도 없다.
- 이런 유형의 정정("코드가 문서를 추월했는데 Planned 라벨이 안 지워짐")은 이 프로젝트 자신이 이미 `1-widget-app.md`
  §R8("한때 기록됐던 제약은 사실이 아니었다… 존재하지 않는 제약을 Planned 로 남기면 후속 작업자가 중복 구현한다")과
  `0-overview.md` Rationale 서문("code-sync 근거 기록 — 대안 비교형 ADR 아님")에서 이미 선례로 확립한 정정 패턴과
  동일 계열이다. 새 Rationale 항목 신설 없이 콜아웃 문구만 갱신한 처리 방식도 그 선례와 일치하므로 "결정의 무근거
  번복"(관점 3)에 해당하지 않는다 — 번복된 "결정"이 애초에 없다.
- `4-execution-engine §7.4/§7.5` 의 execution 무기한 보존 불변식, EIA-RL-07 idle-wait backstop, EIA §R10 단일
  sink 정책 등 인접 invariant 와도 충돌 없음(이번 변경은 클라이언트 REST 소비 상태 서술만 다루고 서버측 보존·회수
  정책을 건드리지 않음).

## 요약

직전 라운드에서 낸 WARNING("`200`+종료 REST 분기가 이미 구현됐는데 콜아웃이 여전히 'Planned'로 서술")은 commit
`2a789a645` 로 정확하게 해소됐다. flip 범위를 코드(`seedWaitingFromStatus`/`eia-client.getStatus`/회귀 테스트)로
대조한 결과 `200`+terminal 만 정밀하게 "구현됨"으로 전환됐고 `404`·복구불가 `401`·낙관적 refresh 는 실제로 아직
catch-all soft-fail 경로에 뭉쳐 있어 "Planned" 라벨이 여전히 정확하다 — 과대·과소 flip 모두 없음. 이 정정은
`1-widget-app.md` §3.1 의 기존 서술(같은 동작을 이미 "구현됨" 전제로 명시하고 `3-auth-session.md` 재로드 복원
경로까지 가리킴)과의 잠재 모순도 함께 해소해 cross-doc 정합을 오히려 개선했으며, EIA §5.3·`R-replay-unavailable`
원문과도 정확히 부합한다. 대안 비교·설계 변경이 아닌 순수 구현-현황 라벨 정정이라 기각 대안 재도입이나 원칙 위반의
여지가 없다. 유일한 잔존 항목은 직전 라운드 INFO(§3.1-3 storage 정리 트리거 열거 최신화 + `1-widget-app.md`
cross-reference 누락)로, 이번 조치에 포함되지 않았으나 이는 애초에 WARNING 이 아니었고 이번 조치를 막을 사유도
아니다.

## 위험도

NONE
