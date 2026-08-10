# 요구사항(Requirement) Review

대상: 웹채팅 위젯 재로드 REST 오류 분기(§3.1-2·§R4) — 이번 라운드 델타는 (a) `applyRefreshedToken`
공유 헬퍼 추출(`session-store.ts`/`use-token-refresh.ts`), (b) §3.1-2 를 §R4 와 맞춰 `410` 을
포함하도록 넓힘(SPEC-DRIFT 반영), (c) **401-refresh 자체가 non-terminal 사유로 실패했을 때의
반환값을 `"continue"` → `"stale"` 로 변경**. 오케스트레이터 지시대로 (b)·(c) 를 spec 원문과
line-level 대조로 재판정했다.

## 발견사항

- **[CRITICAL]** `"continue"` → `"stale"` 전환이 이전 CRITICAL(무효 토큰으로 SSE 재오픈)을
  없앴지만, 그 대가로 **더 나쁜 새 결함**을 만들었다 — non-terminal refresh 실패 시 SSE 도
  안 열리고 `scheduleRefresh()` 도 결코 예약되지 않아, 위젯이 이 PR 이 고치려던 바로 그
  "`streaming` 무기한 고착" 을 **영구히, 아무 자동 복구 경로 없이** 재현한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:421-435`(`recoverFromExpiredToken`
    의 `if (!terminal) { ...; return "stale"; }`), 호출부 게이팅
    `codebase/channel-web-chat/src/widget/use-widget.ts:683`(`start()`: `if (outcome !== "continue") return;`)
    /`:699`(`scheduleRefresh();` — 이 줄에 도달 못 함) 및
    `codebase/channel-web-chat/src/widget/use-widget.ts:1035`(`applyConfig()`: 동형 게이트)/`:1051`
    (`scheduleRefresh(); // 복원된 세션도 갱신 예약.` — 마찬가지로 도달 못 함).
  - 상세: `scheduleRefresh`(`use-token-refresh.ts`)는 **스스로 최초 1회 실행되지 않는다** — JSDoc
    자체가 "시작/세션복원 직후 1회 호출해 예약 개시" 라고 명시하고, 실제 호출 지점은 코드 전체에서
    `start()`/`applyConfig()` 안 저 두 줄(699/1051)뿐이며 둘 다 `outcome === "continue"` 게이트
    뒤에 있다. `"stale"` 을 반환하면 두 호출부 모두 `openStream`/`scheduleRefresh` 이전에 조기
    `return` 하므로(683/1035), **SSE 도 안 열리고 주기 갱신 타이머도 결코 시작되지 않는다.**
    UI 는 이미 `dispatch({type:"BOOTED"|"RESTORED"})`(위젯-리듀서에서 `phase:"streaming"`)를
    지난 상태라 스피너에 고정되고, 이후 어떤 이벤트도 이 상태를 흔들지 않는다 — 사용자는 입력창도
    없고(phase 가 `awaiting_user_message` 가 아님) 에러 메시지도 못 본다. 유일한 탈출구는 전체
    페이지 새로고침뿐이다. 이는 CHANGELOG 이 이 PR 의 존재 이유로 든 바로 그 증상
    ("그 스트림은 아무것도 주지 않아 위젯이 `streaming` 에 무기한 고착됐다", `CHANGELOG.md:168`)을,
    이번 diff 가 새로 만든 하위 경로(401 후 refresh 자체의 일시적 네트워크/5xx 실패)에서
    재현한다 — §3.1-2 배너·CHANGELOG 항목 3("그 외 오류는 여전히 soft-fail — 일시적 장애가 대화를
    끝내지 않게 하는 경계")이 천명한 "soft-fail 은 계속 진행" 원칙과도 어긋난다: 여기서는 계속
    진행하지도, 종료되지도 않고 **그냥 멈춘다.**
  - 자기모순 증거: 이 변경 자신의 코드 주석(`use-widget.ts:434`)이 "**다음 복구는 `use-token-refresh`
    의 주기 갱신이 맡는다**" 라고 적고, `review/code/2026/08/10/16_42_07/RESOLUTION.md:16-18`("조치:
    `"stale"` 반환... 다음 복구는 주기 갱신이 맡는다")도 같은 근거로 이 설계를 정당화했다 — 그러나
    위에서 추적한 대로 이 주장은 **코드상 성립하지 않는다**(주기 갱신은 `scheduleRefresh()` 최초
    호출 없이는 존재하지 않는다). 이 근거를 검증하는 테스트도 없다(아래 항목).
  - 회귀 테스트 갭: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:448-485`
    (`"§R4: refresh 가 네트워크 오류로 실패하면 종료로 확정하지 않는다"`)는 `phase !== "ended"`·
    `getEs()===null`·storage 보존만 단언하고, **"이후 실제로 복구되는가"(scheduleRefresh 가 예약됐는가,
    또는 재시도가 일어나는가)는 검증하지 않는다** — 이 CRITICAL 이 회귀 스위트를 그대로 통과한다.
  - 제안: (a) 이 서브케이스 전용으로 새 outcome 을 두거나(예: `"retry-scheduled"`), 최소한
    `recoverFromExpiredToken` 의 이 분기에서 직접 `scheduleRefresh()`(짧은 지연으로, 예:
    `TOKEN_REFRESH_MIN_DELAY_MS`)를 호출해 SSE 는 안 열더라도 주기 갱신만은 실제로 예약할 것.
    (b) `SeedOutcome` 을 확장하기 부담스러우면 적어도 이 경로에서 `dispatch({type:"ERROR", ...})`
    로 사용자가 관측·재시도 가능한 상태(예: "새로고침" 안내)로라도 전이시킬 것 — 지금처럼 아무
    신호 없이 멈추는 것보다는 낫다. (c) 회귀 테스트에 `scheduleRefresh` 예약 여부(fake timer 로
    `refresh-token` 재호출 관측)를 추가해 "다음 복구는 주기 갱신이 맡는다" 는 주장을 실제로 검증할 것.

- **[WARNING]** 위 CRITICAL 과 짝을 이루는 문서 불일치 — 함수 JSDoc 이 여전히 이 분기가
  `"continue"` 를 반환한다고 서술한다(코드는 `"stale"`).
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:482-483`
    (`* - 재차 \`401\`·\`410\` → \`"ended"\`(복구 불가 확정, §R4). 그 **외** 실패(네트워크 등)는`
    ` * \`"continue"\` — 일시적 장애가 대화를 끝내지 않게 하는 경계다.`), 같은 함수 상단
    `SeedOutcome` 타입 독스트링 `:90-91`(`"stale"` = "await 사이 세션이 교체·초기화됨 → 응답을
    폐기함" — 이번 재사용 사유인 "refresh 자체가 실패했다" 와는 다른 의미).
  - 상세: 이번 uncommitted 델타는 코드 반환값만 `"continue"`→`"stale"` 로 바꿨고(`git diff` 확인,
    한 hunk), 몇 줄 위의 함수 JSDoc "REST 오류 분기" 목록과 `SeedOutcome` 타입 자체의 독스트링은
    갱신하지 않았다. 결과적으로 JSDoc 을 읽는 사람은 "네트워크 등 그 외 실패는 `continue`" 로
    믿게 되는데 실제 반환값은 `stale` 이다 — 바로 위 CRITICAL 이 이 간극에서 나왔다. `"stale"`
    의 타입 독스트링도 "세션이 교체·초기화됨" 만 설명해 이번 신규 용법(리프레시 자체 실패, 세션
    불변)을 포괄하지 못한다.
  - 제안: `:482-483` 을 `"stale"` 로 정정하고, `SeedOutcome` 의 `"stale"` 독스트링에 "또는 401
    refresh 자체가 (401/410 외 사유로) 실패해 이번 왕복만 포기하는 경우" 를 추가.

- **[WARNING]** 같은 diff 로 신설된 plan 문서가 **이미 이번 델타로 대체된 낡은 전제**를 서술한다
  — 추적 중인 위험이 실제로 출하된 위험과 다르다.
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md:144-166`
    (`## 비-terminal refresh 실패 뒤 만료 토큰 재연결`).
  - 상세: 이 섹션은 "refresh 가 네트워크 오류로 실패하면 `"continue"` 를 돌려주는데... 그 옛(만료된)
    토큰으로 `openStream` 하고... 재연결이 반복될 수 있다" 고 적는다(`:146-149`) — 이는 이번
    라운드 **이전**(16_42_07 시점, 커밋 `31b14aa22`)의 코드 상태에 대한 서술이다. 이번 uncommitted
    델타가 그 반환값을 `"stale"` 로 바꾼 지금은 "SSE 를 열어 반복 재연결" 위험이 아니라(SSE 자체가
    안 열림) 위 CRITICAL(영구 고착·재시도 전무) 이 실제 위험이다. 같은 diff 안에서 plan 이 코드보다
    한 단계 뒤처진 채로 커밋되는 것이므로, 이 항목이 추적하는 위험과 실제로 출하되는 위험이
    어긋난 상태로 `in-progress/` 에 남는다.
  - 제안: `:144-166` 섹션을 "SSE 재연결 반복" 대신 "scheduleRefresh 미예약으로 인한 영구 고착"으로
    갱신하거나, 위 CRITICAL 이 코드로 해결되면 이 섹션을 닫을 것.

- **[INFO]** §3.1-2 를 §R4 와 맞춰 `410` 을 포함하도록 넓힌 것은 spec 원문과 line-level 로 정합함
  (직전 라운드 SPEC-DRIFT 반영 확인).
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:89`(본문 §3.1-2: `"...재차 \`401\`·\`410\` 이면
    종료로 간주(§R4 와 동일 — 종전 이 줄만 \`401\` 로 좁게 적혀 있었다..."`) vs
    `spec/7-channel-web-chat/3-auth-session.md:104-108`(§R4: `"...재차 실패(\`401\`/\`410\`)면
    종료로 확정한다..."`), 코드 `codebase/channel-web-chat/src/widget/use-widget.ts:418-420`
    (`const terminal = refreshErr instanceof EiaError && (refreshErr.status === 401 ||
    refreshErr.status === 410);`).
  - 상세: 두 spec 절이 이제 정확히 같은 조건(`401`/`410`)을 서술하고, 코드의 `terminal` 판정도
    동일 조건이다 — 세 지점(§3.1-2 본문·§R4 Rationale·구현) 이 line-level 로 일치한다. 이전
    라운드가 낸 SPEC-DRIFT(§3.1-2 가 §R4 보다 좁았음) 지적이 spec 쪽 수정으로 올바르게 닫혔다.
    `CHANGELOG.md:171`("2. `401` → 낙관적 refresh 1회: ... 재차 `401`·`410` 이면 종료로 확정한다")
    도 같은 조건으로 갱신돼 있어 3자리 일치.
  - 제안: 없음(정합 확인용).

- **[INFO]** `applyRefreshedToken` 공유 헬퍼 추출(`session-store.ts:110-133`) 자체는 순수 함수
  이동이고, 두 호출부(`use-widget.ts:404-408`, `use-token-refresh.ts:93-97`) 모두 헬퍼 호출
  **직전**에 각자의 staleness 재검사(`isStale(gen)`/`worldGenRef.current !== gen`)를 유지한다 —
  세대 검사 책임을 흐리지 않았다. 새로운 회귀 없음.

## 점검 관점별 요약

- **기능 완전성**: §3.1-2/§R4 의 404·401-성공·401/410-재차실패 3갈래는 정확히 구현되고 회귀로
  고정됐다. 그러나 "401-refresh 자체의 일시적 실패" 라는 4번째(암묵적) 갈래가 소리 없이
  영구 고착으로 귀결돼 **기능이 완전하지 않다**(위 CRITICAL).
- **엣지 케이스**: `configRef.current` 부재·`isStale(gen)` 재검사 등은 잘 처리됨. 그러나
  "refresh 요청 자체의 실패" 라는 엣지가 soft-fail 도 terminal 도 아닌 제3의 미정의 상태로
  떨어진다.
- **TODO/FIXME**: 없음. 다만 plan 문서에 미해결 체크리스트 다수(§`start()` 401 도달 가능성·
  §동시 발화 경합 등, 4개 정식 등재) — 이 리뷰에서 재론하지 않음(이미 추적 중).
- **의도-구현 괴리**: `use-widget.ts:482-483`(JSDoc) vs `:435`(코드) — "continue" 문서화 vs
  "stale" 구현. `:434` 주석과 `16_42_07/RESOLUTION.md` 의 "주기 갱신이 다음 복구를 맡는다" 주장도
  코드 추적 결과 성립하지 않는다.
- **에러 시나리오**: 404·401(성공/재차실패)·기타 4갈래는 각각 정의돼 있으나, "401→refresh
  자체 실패(non-401/410)" 시나리오의 사후 동작(무한 고착)이 사실상 미정의·미검증 상태로 출하된다.
- **데이터 유효성**: 해당 없음(REST status 코드 분기가 전부).
- **비즈니스 로직**: §R4("낙관적 refresh 1회") 는 정확히 1회로 유지, §3.1-2/§R4 종료 조건도 이제
  `401`/`410` 로 정확히 일치. 다만 "그 외는 soft-fail" 원칙이 이 신규 하위경로에서 지켜지지 않는다.
- **반환값**: `SeedOutcome` 세 값 모두 코드상 모든 경로에서 반환되나(누락 없음), `"stale"` 반환이
  이 특정 호출 경로에서 실질적으로 "영구 정지" 를 뜻하게 돼 타입 설계 의도("아무 상태도 안
  건드리고 다음 시도가 복구")와 실제 결과(다음 시도가 없음)가 어긋난다.
- **spec fidelity**: §3.1-2·§R4 의 명시 문언(404/401-성공/401·410-재차실패)과는 line-level 로
  정합. 이번 non-terminal-refresh-실패 서브케이스는 spec 문언이 침묵하는 회색지대이나, spec 배너·
  CHANGELOG 가 명시한 "soft-fail 은 진행을 뜻한다" 는 설계 원칙과는 실질적으로 배치된다 — spec
  자체를 고칠 사안이라기보다(spec 이 이 세부까지 규정할 필요는 없음) 구현이 스스로 세운 원칙을
  못 지킨 CRITICAL 버그로 판단한다.

## 요약

오케스트레이터가 지목한 두 변경 중, **(b) §3.1-2 를 §R4 와 맞춰 `410` 을 포함하도록 넓힌 것은
spec 원문과 정확히 정합**하며 직전 SPEC-DRIFT 지적이 올바르게 해소됐다. 그러나 **(c) non-terminal
refresh 실패의 반환값을 `"continue"`→`"stale"` 로 바꾼 것은 spec 문언 위반은 아니지만 실질적으로
더 심각한 새 결함**을 만든다 — `scheduleRefresh()` 가 `openStream` 성공 이후에만 최초 예약되는
구조라서, `"stale"` 을 반환하면 SSE 도 안 열리고 주기 갱신도 결코 시작되지 않아 위젯이 아무
자동 복구 경로 없이 영구히 "streaming" 에 고착된다 — 이 PR 이 존재하는 이유였던 바로 그 증상의
재현이다. 코드 자신의 주석과 직전 RESOLUTION 이 "주기 갱신이 다음 복구를 맡는다" 고 주장하지만
코드 추적 결과 이는 성립하지 않으며, 신규 회귀 테스트도 이 주장을 검증하지 않는다. 부수적으로
같은 diff 가 남긴 JSDoc 두 곳과 신설 plan 문서 한 섹션이 이 최신 반환값 변경을 반영하지 못해
"continue" 시절 서술을 그대로 담고 있다.

## 위험도

CRITICAL
