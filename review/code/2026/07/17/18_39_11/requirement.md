# 요구사항(Requirement) 리뷰 — webchat-boot-single-flight (§106 마지막 wc:boot 적용 + A-6)

## 페이로드 무결성 확인

`git diff --stat 14bc86a53fc95f73703ee2fe50968c4f0d73238d..HEAD` 로 직접 재계산한 결과 payload 와 동일한
7파일(`CHANGELOG.md`, `widget-state.test.ts`, `widget-state.ts`, `use-widget-eager-start.test.ts`, `use-widget.ts`,
`plan/in-progress/webchat-boot-single-flight.md`, `spec/7-channel-web-chat/2-sdk.md`)만 잡혔다. 오염 없음 — 이번
라운드의 고정 merge-base 3-dot 전환은 유효했다.

## 질문별 답변

### 1. 구현이 §106 을 충족하는가 (checkpoint 1 boot 축 전용 · 복원 스킵 · unmountedRef 분리)

**충족한다.** `beginBootAttempt`(world+boot 토큰 발급) → checkpoint 1 `cannotApplyConfig`(boot 축만, `use-widget.ts:874`)
→ `establishConfig`(동기 구간, `:845-861`) → 복원 분기 checkpoint 2 `isAttemptStale`(boot+world 둘 다, `:916`) 구조를
코드 레벨로 직접 트레이스했고, resolve 순서를 역전시키는 신규 회귀 테스트(`§106: resolve 순서가 역전돼도 마지막
wc:boot 의 config 가 적용된다`)와 겹친 부팅 중 대체된 형제의 정당한 종료 확정이 살아있는 부팅을 죽이지 않는 테스트
(`§106: 대체된 시도의 종료 확정이 마지막 부팅을 죽이지 않는다`)로 고정돼 있다. 아래 "실측 검증"에서 mutation 으로
직접 재현·확인했다.

나머지 §106 문장과도 모순되지 않는다:
- **"동일 endpoint 재부팅은 execution 을 중복 시작하지 않는다"**: `applyConfig` 는 재전송 시 `start()` 를 전혀
  호출하지 않는다(그 경로는 `open()` 전용, `startedRef` 가드도 이 diff 가 건드리지 않음) — 자명하게 충족.
- **"`locale` 은 boot 1회 해석"**: `establishConfig` 가 매 재전송마다 `setConfig(cfg)` 를 호출해 `config.locale`
  자체는 갱신되지만, 실제 렌더 locale 을 고정하는 로직(`widget-app.tsx` 의 `localeFrozen` state)은 **이 diff 가
  건드리지 않았다**(`git diff --stat` 로 0줄 확인) — `if (!localeFrozen && config) { setLocaleFrozen(true); ... }`
  가 여전히 최초 1회만 반영해 재전송으로 언어가 바뀌지 않는다. 모순 없음.
- **"origin 핀"**: `host-bridge.ts` 도 이 diff 에서 0줄 변경 — 첫 origin 핀 로직(`hostOrigin` 1회 설정 후 이후
  불일치 origin drop) 그대로 유지. 모순 없음.

### 2. "재전송은 config 만 갱신, 세션은 건드리지 않는다" 해석의 spec 상 타당성

**해석 자체는 타당하다** — `applyConfig` 의 `const saved = streamRef.current ? null : loadSession(...)`(`:896`)이
정확히 "살아있는 스트림이 있으면 복원 분기 전체를 스킵"을 구현하고, `1-widget-app.md` §3.1 "닫기(collapse)" 행의
"SSE 연결도 유지"·"패널만 숨김" 원칙과도 정합적이다(재전송이 활성 대화의 SSE/getStatus/토큰갱신을 재실행하지
않는 것은 오히려 그 원칙의 연장). §106 신규 통합 테스트(`활성 대화 중 재전송은 입력창을 되감지 않는다`)로
`statusCalls`·`getEs()` 불변까지 확인했다.

**단, 반증이 있다** — 정확히 "세션을 건드리지 않는다"는 이 fix 의 파트너 커밋(C2, `sendCommand` 비-410 에러
경로의 `teardownSession()` 추가)이 `3-auth-session.md` §3.1 의 명시 조항과 충돌한다. 아래 CRITICAL 발견사항 참조 —
§106 checkpoint 설계 자체가 아니라 A-6/C2 의 "에러도 종료" 전제가 문제다.

### 3. plan 문서 주장의 표본 검증 (거울상 이력 · mutation 결과)

**정량 주장은 이번 라운드 기준 신뢰 가능** — 격리 detached worktree(`git worktree add --detach`, 종료 후 제거)에서
3건을 직접 재현했고 전부 정확히 일치했다:

| 검증 대상 | plan 의 주장 | 직접 재현 결과 |
|---|---|---|
| 최종 테스트 스위트 | `385 passed`(22 파일) | `npx vitest run` → **385 passed, 22 files** 일치 |
| A-5 매트릭스 "둘째 지점만 제거(비대칭)" | 1건 실패("직전엔 0 무방비") | `isAttemptStale` 호출부(`:916`)를 `if (false && ...)` 로 무력화 → **정확히 1건**(`§106: 복원 seed 중 재전송으로...`) 실패 |
| A-5 매트릭스 "boot 축 무력화(supersede 제거)" | 4건 실패 | `cannotApplyConfig` 를 `unmountedRef.current` 만 보게(boot 비교 제거) → **정확히 4건** 실패 |
| B "async 없이 컴파일 차단(`TS1308`)" | `error TS1308` 로 빌드 막힘 | `establishConfig` 내부에 `await` 삽입 → `npx tsc --noEmit` 이 **정확히 `TS1308`** 보고 |

3/3 + 1(TS1308)까지 전부 일치 — 이 저장소에서 과거 지적된 "정량 주장 과대" 패턴이 **이번 라운드에는 나타나지
않았다**. `widget-state.test.ts` 의 A-6 `it.each` 중복도 실제 파일 grep 으로 1회만 존재함을 확인(diff 뷰의 "hunk +
전체 컨텍스트" 이중 표시가 payload 상 중복처럼 보였을 뿐).

**거울상 이력(6번째 `startedRef` 오판 등)은 커밋에 없는 세션 내 시행착오라 직접검증 불가** — 다만 최종 코드가
서술과 일치(`streamRef.current` 기반 판정, `startedRef` 아님, `:896` 및 JSDoc `:891-895`)하므로 서술과 산출물 간
불일치는 없다.

### 4. A-6(ERROR 종료 대화 부활)이 위반한 spec 조항이 있는가

**A-6 리듀서 가드(`widget-state.ts` RESTORED/BOOTED 의 `if (state.phase === "ended") return state;`) 자체는 명시
위반이 아니다** — 앞선 라운드 결론(명시 조항 없음, `1-widget-app.md` §3.1 표 커버리지 갭)에 동의한다. 이 가드는
방어적 조치이고 "종료된 대화가 복원돼야 한다"는 조항이 spec 에 없다.

**그러나 그 근본 fix(C2, `sendCommand` 의 `teardownSession()` 확대)는 다르다** — `3-auth-session.md` §3.1 의
명시 조항과 충돌한다(아래 CRITICAL). 이 PR 에서 spec 을 반드시 손대야 하는가에 대한 답: **코드부터 재검토가
우선**이다. "비-410 명령 실패 = 즉시 영구 종료(storage 소거)"가 의도된 제품 정책이라면 `3-auth-session.md` §3.1-3·
`1-widget-app.md` §3.1 표에 그 조건을 명문화해야 하고(그러면 project-planner 트랙), 의도치 않은 과확대라면 코드를
좁히는 쪽이 맞다 — 현재 plan/CHANGELOG 어디에도 "네트워크 일시 실패에도 영구 종료" 를 의식적으로 검토한 흔적이
없어 후자(과확대/미검토)일 가능성이 높다고 판단한다.

### 5. CHANGELOG 항목이 실제 변경과 일치하는가

**Overview 문단·항목 1·항목 2 는 최종 코드와 일치.** **항목 3 은 stale(불일치)** — 아래 WARNING 참조. `git show
--stat` 로 `CHANGELOG.md` 를 건드린 커밋이 `b1bef8633` 하나뿐임을 확인했고, 그 커밋이 도입한 메커니즘이 이후
`8c79b68ea` 에서 명시적으로 되돌려졌는데 CHANGELOG 는 갱신되지 않았다.

---

## 발견사항

- **[CRITICAL]** `sendCommand` 의 비-410 에러 경로가 **모든** interact 실패(네트워크 순단·5xx·409
  STATE_MISMATCH·form 검증 4xx 포함)를 서버 확인된 종료와 동일하게 취급해 `teardownSession()` 으로 storage 를
  즉시 파괴한다 — spec 의 명시적 "storage 정리 조건" 목록보다 넓다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:604-640`(`sendCommand`), 특히 `:634`
    `teardownSession();` 호출. 실패 유입 경로: `codebase/channel-web-chat/src/lib/eia-client.ts:82-86`
    (`interact()` 는 410 만 특수 처리하고 그 외 `!res.ok` 전부와, `fetch` 자체가 reject 하는 순수 네트워크
    실패까지 동일한 `EiaError`/원본 예외로 던진다).
  - 상세: `spec/7-channel-web-chat/3-auth-session.md` §3.1 은 storage 를 정리하는 조건을 **명시적으로 열거**한다
    (`:65-79`) — SSE terminal(completed/failed/cancelled), 복원 시 200+terminal status·404·복구불가 401, 그리고
    명령 응답 **410 Gone**. "그 외 명령 실패"는 이 열거에 없다. 오히려 같은 절이 "200 + status ∈
    {running/waiting_for_input 등 진행 중} → SSE 재연결 → 복원"(`:68-70`)을 명시해, 서버가 여전히 살아있다고
    답하면 **복원해야 한다**고 규정한다. 이번 PR 이전에는 `ERROR` 가 UI 만 `[ended]` 로 바꾸고 storage 는
    보존했으므로, 예컨대 `submit_message` 전송 중 일시적 네트워크 순단(또는 500)이 나도 **새로고침하면
    `getStatus` 가 여전히 `waiting_for_input`/`running` 임을 확인해 정상 복원**됐다(spec 이 보장하는 그대로).
    이 PR 이후에는 같은 상황에서 `teardownSession()` 이 즉시 storage 를 지우므로, 서버 execution 이 실제로는
    멀쩡히 살아있어도 **사용자는 대화를 영구히 잃는다** — 새로고침도, `wc:boot` 재전송도 복구시키지 못한다.
    `1-widget-app.md` §2 "Form" 행이 약속한 "실패 시 `error.details` 표시·재제출"(`:47`) 도 이 경로를 타므로
    (panel.tsx 가 `submitForm` 을 별도 처리 없이 그대로 `sendCommand` 에 위임 — `codebase/channel-web-chat/src/
    widget/components/panel.tsx:158`) 이번 fix 로 그 재시도 여지까지 함께 사라진다(그 gap 자체는 이 PR 이전부터
    있었지만, 이 PR 이 "재시도 불가능"을 "영구 소실"로 격상시켰다). 코드 내 주석("에러도 종료다")은 spec 인용
    없는 단정이며, 신규 테스트(`ERROR 로 종료된 대화는 wc:boot 재전송으로 부활하지 않는다`)의 mock 조차 GET
    status 를 처음부터 끝까지 `{status:"running"}`(생존)으로 고정해 두고도 storage 소거를 단언한다 — 실제로는
    살아있는 세션을 죽이는 결과를 스스로 증명하는 셈이다.
  - 제안: `teardownSession()` 을 무조건 호출하지 말고, (a) 410 만 하드 종료로 유지하고 그 외 실패는 storage 를
    보존해 다음 `getStatus`(재open/재전송/새로고침)가 실제 서버 상태로 자연 수렴하게 하거나, (b) "비-410 명령
    실패도 영구 종료"가 실제 제품 의도라면 이는 침묵이 아니라 **명시적 정책 결정**이므로 `3-auth-session.md`
    §3.1-3·`1-widget-app.md` §3.1 표에 그 조건을 추가하는 project-planner 트랙을 밟은 뒤 코드를 유지한다. 현재
    상태(spec 침묵 + 코드가 조용히 확대)로 머지하는 것은 권장하지 않는다.

- **[WARNING]** `CHANGELOG.md` 항목 3 이 최종 코드에 없는 메커니즘을 서술한다(stale).
  - 위치: `CHANGELOG.md:9`.
  - 상세: "대체된 시도가 복원 중 '이미 종료된 세션'을 발견해도 종료를 **확정하지 않는다** ... 살아있는 시도가
    같은 스냅샷을 보고 확정한다(주체만 바뀐다)"는, 커밋 `b1bef8633` 에서 `seedWaitingFromStatus` 에 추가됐던
    `attempt?: {world, boot}` 파라미터(주석: "대체된 시도는 종료를 확정하지 못한다" — `git show
    b1bef8633:codebase/channel-web-chat/src/widget/use-widget.ts` 로 직접 확인)를 서술한다. 그런데 그 특례는
    바로 다음 커밋 `8c79b68ea`("flicker fix + 설계 재편")에서 **명시적으로 되돌려졌다** — plan 문서 자신도
    "그래서 `seedWaitingFromStatus` 의 '대체된 시도는 종료를 확정하지 않는다' 특례를 되돌렸다(불필요해졌다)"
    라고 적어 뒀다. 실제 최종 `seedWaitingFromStatus`(`use-widget.ts:467-471`)는 `attempt` 파라미터가 전혀
    없고 world 축(`isStale(gen)`)만 본다 — 대체된 형제도 자기 종료를 그대로 확정한다(`finalizeEnded` 호출).
    §106 이 지켜지는 실제 이유는 "확정을 미룬다"가 아니라 "checkpoint 1(`cannotApplyConfig`)이 world 축을
    아예 보지 않아, 형제의 정당한 world bump 에 영향받지 않는다"는 **다른 메커니즘**이다. `git show --stat`
    으로 `CHANGELOG.md` 를 건드린 커밋이 `b1bef8633` 하나뿐임을 확인했다 — 이후 재편 때 갱신되지 않았다.
    결과(대체된 시도가 살아있는 부팅을 안 죽인다)는 참이지만 메커니즘 서술이 틀렸다.
  - 제안: 항목 3을 "checkpoint 1(`cannotApplyConfig`)이 world 축을 보지 않으므로, 형제의 정당한 종료 확정
    (world 증가)이 아직 대체되지 않은 살아있는 부팅에 영향을 주지 않는다 — 대체된 시도도 자기 종료는 그대로
    확정한다"로 정정 권고.

- **[INFO]** `establishConfig` 가 재전송마다 `clientRef.current` 를 새 `EiaClient` 로 교체한다(`use-widget.ts:848`).
  - 위치: `use-widget.ts:845-861`.
  - 상세: 오늘은 무해하다 — 유일한 재전송 경로(관리자 라이브 미리보기)가 `apiBase` 를 바꾸지 않고, 바뀌면
    iframe 을 리마운트하는 불변식이 `pendingResetRef` JSDoc(`:208-215`)에 이미 문서화돼 있다. 다만 그 불변식이
    깨지는 경우(리마운트 없이 `apiBase` 변경) 살아있는 SSE 스트림은 옛 `apiBase` 에 열려 있는데 이후 REST 호출
    (`sendCommand`/`refreshToken`)은 새 client 로 나가는 불일치가 생길 수 있다 — `pendingResetRef` 의 "불변식
    의존 주의" 절과 같은 성격의 리스크이므로, 그 절이 갱신될 때 함께 재검토 대상에 포함하는 것을 권고(지금
    당장 조치 불필요).

---

## 요약

이번 PR 의 핵심 요구사항 — §106 "위젯은 마지막 `wc:boot` 의 config 를 적용한다" — 은 `bootGenRef`/
`beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale` 로 구성된 2-checkpoint 설계로 실제로 충족되며, 코드
트레이스·신규 회귀 테스트·직접 mutation 재현(3/3 일치) 전부가 이를 뒷받침한다. plan 문서의 정량 주장(테스트
수·mutation 실패 건수·TS1308 컴파일 차단)도 이번 라운드는 표본 검증 전부 정확했다. 다만 §106 fix 에 편승해
같은 PR 에 포함된 A-6 의 근본 수정(C2: `sendCommand` 비-410 에러 시 `teardownSession()` 호출)이 문제다 — 이는
`3-auth-session.md` §3.1 이 명시한 storage 정리 조건·복원 보장 범위를 넘어서며, 네트워크 순단이나 서버 일시
오류처럼 실제로는 세션이 살아있는 상황에서도 대화를 영구 소실시킬 수 있다. §106 자체의 구현 품질과는 별개로,
이 CRITICAL 은 머지 전에 코드 축소 또는 명시적 spec 정책화 중 하나로 해소돼야 한다. 부가적으로 CHANGELOG 항목
3은 이번 PR 내에서 도입 후 되돌려진 중간 설계를 서술하는 stale 상태다(기능적 영향 없음, 문서 정확성 문제).

## 위험도

HIGH
