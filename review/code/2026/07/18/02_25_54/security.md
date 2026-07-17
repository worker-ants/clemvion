# 보안(Security) 리뷰 — webchat-boot-single-flight (02_25_54, 이중 EventSource fix `77805bd32` 검증)

## 범위·방법

지시받은 핵심 검증 대상은 커밋 `77805bd32`(`fix(web-chat): 이중 EventSource 생성 — seed 게이트의
짝(openStream 직전 게이트) 추가`) — 직전 라운드(01_44_21)가 testing·side_effect·concurrency 3인 재현으로
관측한 "이중 EventSource 생성"(MEDIUM, 낭비성 create+close 이나 idempotent 수렴)에 대한 fix다.

- `prompt_file`(2467줄)을 확인한 결과, 이번 라운드 payload 15개 파일은 전부 **직전 라운드(01_44_21)의
  review 산출물**(`meta.json`·`requirement.md`·`scope.md`·`security.md`·`side_effect.md`·`testing.md`)과
  **consistency-checker 산출물**(`review/consistency/2026/07/17/19_46_54/**` 8개)·`spec/7-channel-web-chat/
  2-sdk.md` 뿐이었다 — 지시받은 실제 검증 대상 `77805bd32`(`use-widget.ts` + `use-widget-eager-start.test.ts`)의
  코드 diff는 payload 안에 없다(payload 안의 `use-widget.ts` 언급은 전부 01_44_21 라운드가 **이전** 커밋
  `cffee0d28`를 논하는 인용문일 뿐). 과거(01_44_21 scope.md WARNING, `ai-review Workflow router empty` 메모리)와
  동일한 payload truncation/선별 패턴이다 — WARNING 으로 아래 기록하되, 지시대로 `git show 77805bd32` 로
  직접 보완했다.
- `git log --oneline -15` 로 라운드 경계 확정: `77805bd32`(코드 fix) → `0020f9106`(주석 정리, docs) →
  `262ef8e5b`(01_44_21 SUMMARY+RESOLUTION, review 산출물뿐) = 현재 HEAD. `git merge-base origin/main HEAD`
  = `29aa918a6` = `origin/main` 자체(드리프트 없음).
- `git show 77805bd32`(전체 diff, 2파일: `use-widget.ts` +23/-3, `use-widget-eager-start.test.ts` +84)를
  직접 확인 — 코드 변경분 전문 대조.
- 현재 `use-widget.ts`(1102행) 를 grep+Read 로 대조해 `sessionEstablished`(:325)·`start()`(:630-685)·
  `sendCommand`(:687-)·`applyConfig`(:964-1022)·`establishConfig`(:937)·`openStream`(:450-472) 의 함수
  경계와 새 게이트(:673, :1018) 위치를 실측 확인.
- `git diff $(git merge-base origin/main HEAD)..HEAD --stat -- codebase/` 로 이번 PR 전체가 건드린
  codebase 파일이 **4개뿐**(`widget-state.ts`·`widget-state.test.ts`·`use-widget.ts`·
  `use-widget-eager-start.test.ts`)임을 재확인 — `session-store.ts`·`use-token-refresh.ts`·
  `eia-client.ts`·`host-bridge.ts`는 이번 PR 전체에서 단 한 번도 diff stat 에 등장하지 않는다.
- 표준 체크리스트(인젝션·하드코딩 시크릿·암호화·에러 노출·의존성)를 (a) `77805bd32` 커밋 diff 단독,
  (b) `merge-base..HEAD` 전체 diff 양쪽에 대해 grep 재실행.
- `npx vitest run src/widget/use-widget-eager-start.test.ts` → **59 passed**(신규 double-stream 테스트
  포함), `npx tsc --noEmit` → 클린(무출력) — 실측 재현.

---

## 발견사항

- **[INFO] (핵심 확인) `77805bd32` 는 신규 인증/토큰/네트워크 표면을 만들지 않는다 — `openStream` 직전에
  이미 존재하는 boolean ref 를 재확인하는 순수 동시성 가드 2줄**
  - 위치: `use-widget.ts:325`(`const sessionEstablished = useCallback(() => streamRef.current !== null, [])`),
    `:673`(`start()` 안, `openStream(session, "0")` 직전), `:1018`(`applyConfig` 복원 분기 안,
    `openStream(saved, "0")` 직전).
  - 상세: `git show 77805bd32`로 diff 전문을 직접 대조한 결과 실제 코드 변경은 (1) JSDoc 절 하나 교체(이전
    "openStream 이 seed 반환 직후 동기 실행이라 이중 스트림 원천 차단"이라는 **오판**을 "microtask 경계 때문에
    안 막힌다"로 정정하는 순수 주석), (2) `start()`·`applyConfig` 두 곳에 각각 `if (sessionEstablished())
    return;` 한 줄씩 추가뿐이다. `sessionEstablished`는 `streamRef.current !== null`(`useRef<EventSourceLike
    | null>` 대상)만 읽는 `useCallback`으로, 인자도 없고 반환 타입도 `boolean`이다 — 세션 객체·토큰·
    엔드포인트·사용자 입력 어느 것도 참조·전달하지 않는다. 이 두 게이트가 가로막는 호출(`openStream(session,
    "0")`/`openStream(saved, "0")`)은 이 커밋으로 전혀 수정되지 않았다 — `openStream` 함수 정의(:450-472,
    `client.openStream(session.endpoints, session.token, {...}, lastEventId)`) 자체가 이번 diff hunk 범위
    밖임을 `git show 77805bd32 -- use-widget.ts`의 hunk 좌표로 확인했다. 즉 새 엔드포인트·새 쿼리 파라미터·
    새 헤더·새 인증 로직 없음 — 기존에 이미 호출되던 것과 동일한 `openStream` 호출을, **호출 여부**만
    조건부로 만드는 순수 클라이언트측 concurrency 가드다.
  - 제안: 없음(확인 목적).

- **[INFO] 이 fix 는 오히려 노출 표면을 줄인다 — 낭비성 두 번째 SSE 연결 생성 자체를 없앤다**
  - 위치: `use-widget.ts:454`(`openStream` 내부 `closeStream()` → `streamRef.current = client.openStream(...)`
    — 이번 diff 로 변경되지 않음), `:669-673`(`start()` 게이트 JSDoc), `:1014-1018`(`applyConfig` 게이트
    JSDoc).
  - 상세: 01_44_21 라운드(concurrency·side_effect·testing 3인 재현)가 관측한 결함은 "겹친 두 `getStatus`
    seed 가 같은 microtask flush 에서 resolve 하면 둘 다 스트림 미확립을 보고 통과해 **각자 `openStream`을
    호출**(`esCount=2`)"이다. `openStream` 자신이 `closeStream()`→`set` 구조라 **최종 상태는 항상 단일
    스트림**으로 수렴하므로(둘째가 열 때 첫째가 자동으로 닫힘) 이 창은 correctness 결함이 아니라 순수
    리소스 낭비(불필요한 EventSource 생성+즉시 폐기 1회)였다 — 두 스트림 모두 **동일 세션의 동일 토큰**을
    쓰므로 자격증명 유출이나 cross-session 노출은 애초에 성립하지 않았다(01_44_21 requirement 가 이미
    "harmless, idempotent"로 분류). 이번 fix는 그 낭비성 생성 자체를 `openStream` 호출 이전에 차단해 —
    최악의 경우에도 생성되는 EventSource 연결 수를 2→1로 줄인다. 순수하게 노출을 줄이는 방향의 변경이며,
    새 리스크를 만들지 않는다.
  - 제안: 없음.

- **[INFO] (직전 라운드 결론 재확인 1) "A-6 되돌림 stale 토큰 4겹 경계" — `77805bd32` 로 바뀌지 않는다**
  - 위치: `use-widget.ts:687-`(`sendCommand`, A-6 되돌림이 위치한 비-410 catch 분기 — `77805bd32` diff
    hunk 범위 밖), `codebase/channel-web-chat/src/lib/widget-state.ts`(`RESTORED`/`BOOTED`/`WAITING` 리듀서
    분기 — 이번 커밋 diff stat 에 파일명 자체가 없음).
  - 상세: 23_58_23/00_51_53/01_44_21 세 라운드가 누적 확립한 4겹 경계(① per_execution 토큰 scope,
    ② `loadSession`의 `expiresAt` 자동 TTL 폐기, ③ sessionStorage 탭종료 자동소거, ④ 서버측
    `WebChatIdleReaperService` idle 회수)는 `sendCommand`의 catch 분기 구조와 `widget-state.ts`의 가드
    부재/존재 패턴에 근거한다. `77805bd32`는 `use-widget.ts` 안에서도 `start()`·`applyConfig` 두 함수의
    `openStream` 직전 두 줄과 JSDoc 만 건드리고, `sendCommand`는 호출·참조조차 없다(`git show 77805bd32`
    hunk 좌표로 확인) — `sendCommand`가 시작하는 :687 은 `start()`의 마지막 게이트(:673)보다 뒤에 있어
    같은 함수 안도 아니다. `widget-state.ts`는 이번 커밋의 diff stat 에 전혀 등장하지 않는다(같은 PR 안의
    더 이른 커밋 `18_39_11` 계열 변경이며, 그마저도 이번 라운드 이전에 이미 검증됨). 따라서 4겹 경계
    결론은 그대로 유효하다.
  - 제안: 없음(재확인만).

- **[INFO] (직전 라운드 결론 재확인 2) `apiBase` 축 이월(선행 결함) — `77805bd32` 로도, 이번 PR 전체로도
  악화되지 않는다**
  - 위치: `use-widget.ts:937`(`establishConfig` — `apiBase`로 `clientRef` 재구성, 이번 커밋 diff hunk
    범위 밖) · `session-store.ts`(`PersistedSession` shape) · `use-token-refresh.ts`(타이머 재조합) ·
    `eia-client.ts` · `host-bridge.ts`.
  - 상세: `git diff $(git merge-base origin/main HEAD)..HEAD --stat -- codebase/` 로 이번 PR 전체
    (`77805bd32` 포함, 그 이전 모든 라운드 누적)가 건드린 codebase 파일이 정확히 4개(`widget-state.ts`·
    `widget-state.test.ts`·`use-widget.ts`·`use-widget-eager-start.test.ts`)임을 재확인했다 —
    `session-store.ts`·`use-token-refresh.ts`·`eia-client.ts`·`host-bridge.ts`는 파일명 자체가 diff stat
    에 없다. `establishConfig`(:937, `applyConfig` 안에서 호출되는 별도 함수)도 `77805bd32`의 diff hunk
    좌표 밖이다. 재전송 시 옛 세션 토큰이 새 `apiBase`로 전송될 수 있는 이 구조적 갭은 이번 라운드가
    다루는 축(seed 표면 되감기·이중 스트림 방지)과 완전히 직교하며, 이전 라운드들이 "별도 트랙, 활성
    충돌 아님"으로 이월 처리한 상태 그대로다.
  - 제안: 없음(별도 트랙, 이번 fix 와 무관).

- **[INFO] `execution.replay_unavailable` opt-in 경로(`allowWhileStreaming`) — 이번 커밋으로 변경되지
  않았고, 새 게이트도 이 경로를 막지 않는다**
  - 위치: `use-widget.ts:424-437`(`handleEiaEvent` 의 `replay_unavailable` 분기, 이번 diff hunk 범위 밖 —
    `seedWaitingFromStatus(client, session, { allowWhileStreaming: true })` 호출 유지).
  - 상세: 이번 커밋이 추가한 두 게이트(`start()`·`applyConfig` 안의 `openStream` 직전 재확인)는
    `replay_unavailable` 폴백의 호출부가 아니다 — 그 폴백은 애초에 `openStream`을 호출하지 않는 경로
    (이미 열린 자기 스트림을 재동기화만 함)이므로 이 fix 의 영향 범위 밖이다. 01_44_21/00_51_53 라운드가
    확립한 "서버 발신 SSE 이벤트에만 반응, host postMessage 로 트리거 불가, 참조 세션·클라이언트가
    이미 확립된 자기 스트림과 동일 객체" 결론은 이번 diff 로 재검토가 필요한 부분이 아니다(관련 코드
    라인 자체가 변경되지 않음).
  - 제안: 없음.

- **[INFO] 표준 체크리스트(인젝션·하드코딩 시크릿·암호화·에러 노출·의존성) — `77805bd32` 단독 diff 및
  전체 PR diff 양쪽에서 이상 없음**
  - 위치: `git show 77805bd32`(전체) 및 `git diff $(git merge-base origin/main HEAD)..HEAD -- codebase/`
    (전체 PR, codebase 4파일).
  - 상세: (1) 인젝션 — `dangerouslySetInnerHTML|innerHTML|eval\(|new Function\(|child_process|exec\(|
    document\.write` 패턴 grep 결과 두 범위 모두 0건(추가된 코드는 boolean ref 검사와 early-return
    뿐, DOM/커맨드 실행 경로 없음). (2) 하드코딩 시크릿 —
    `password|secret|api[_-]?key|authorization|bearer|private[_-]?key|BEGIN (RSA|PRIVATE)` 패턴 grep
    결과 두 범위 모두 0건. 신규 테스트가 재사용한 `"iext_x"` 토큰 리터럴은 기존 스위트 전반에 24회
    등장하는 기존 관용구(가짜 토큰, 00_51_53/01_44_21 라운드가 이미 확인)로 신규 도입이 아니다.
    (3) 암호화 — 해시/암호화 로직 변경 없음. (4) 에러 처리 — `openStream`의 `onError` 핸들러(`:462-466`,
    이번 diff 로 미변경)는 `console.warn`으로 진단 메시지만 남기고 원본 이벤트 객체를 UI 에 노출하지
    않는 기존 계약 유지. (5) 의존성 — `git diff --stat -- '**/package.json' '**/*.lock' pnpm-lock.yaml`
    결과 공백(변경 없음), `channel-web-chat/package.json`의 `dompurify`/`marked`(sanitize 경로 고정 핀)도
    이번 PR 전체에서 미변경.
  - 제안: 없음.

- **[WARNING] payload 대표성 — 이번 라운드 prompt 가 실제 검증 대상(`77805bd32`)의 코드 diff 를 포함하지
  않음 (프로세스 이슈, 코드 이슈 아님)**
  - 위치: `_prompts/security.md` 전체(2467줄, 15개 파일 섹션) — 전부 `review/code/2026/07/18/01_44_21/**`
    (직전 라운드 산출물 6개) + `review/consistency/2026/07/17/19_46_54/**`(8개) + `spec/7-channel-web-chat/
    2-sdk.md`(frontmatter) 뿐, `use-widget.ts`/`use-widget-eager-start.test.ts` 의 `77805bd32` 실제 diff
    는 어디에도 없음.
  - 상세: 01_44_21 라운드의 scope.md 가 동일 패턴(payload 3파일뿐, 실제 코드 diff 누락)을 WARNING 으로
    이미 기록한 바 있고, 이번 라운드에서도 재발했다 — 다만 이번엔 orchestrator 가 호출 시 "payload 코드
    diff 가 일부면 `git show 77805bd32` 로 직접 확인"이라고 명시적으로 선제 지시해 사각지대를 스스로
    인지하고 있었다. 이번 리뷰는 그 지시에 따라 git 실측으로 전부 보완했으므로 결론에 영향은 없으나,
    이 payload 구성 로직(review 산출물 커밋이 diff 범위에 들어오면 그것들이 실제 코드 변경보다 payload
    를 먼저 채우는 것으로 보이는 패턴)의 근본 개선은 여전히 미해결이다.
  - 제안: (기존 01_44_21 WARNING 제안과 동일, 반복 관측이므로 우선순위 재확인) payload 생성 로직이 대상
    커밋 범위의 실제 코드 파일(`codebase/**`)을 review 산출물보다 우선 포함하도록 정렬 검토. 즉각 조치는
    불필요(이번 라운드는 호출자 사전 지시로 커버됨).

---

## 요약

지시받은 핵심 검증 대상 `77805bd32`(이중 EventSource 생성 MEDIUM 에 대한 fix)는 `git show`로 diff 전문을
직접 대조한 결과 **순수 클라이언트 동시성 가드 2줄**(`start()`·`applyConfig`의 `openStream` 호출 직전에
`if (sessionEstablished()) return;`)과 JSDoc 정정뿐임을 확인했다. `sessionEstablished()`는 인자도 부작용도
없이 in-memory `streamRef.current !== null` 만 읽는 boolean predicate라 신규 인증·토큰·네트워크 표면을
전혀 추가하지 않으며, 이 게이트가 가로막는 `openStream` 호출 자체(엔드포인트·토큰·헤더)는 이번 커밋으로
한 글자도 바뀌지 않았다. 오히려 이 fix 는 겹친 두 seed 가 같은 microtask flush 에서 resolve 할 때 발생하던
낭비성 두 번째 `EventSource` 생성(같은 세션·같은 토큰이라 애초에 자격증명 노출은 아니었음)을 원천 차단해
연결 수를 2→1 로 줄인다 — 노출을 늘리는 방향이 아니라 줄이는 방향이다. 직전 라운드들이 확립한 두 핵심
결론도 이번 커밋으로 무효화되지 않았다: (1) "A-6 되돌림 stale 토큰 4겹 경계"는 그 근거 파일(`sendCommand`
비-410 catch 분기, `widget-state.ts` 리듀서 가드 패턴)이 `77805bd32`의 diff hunk 범위 밖이라 유효하고,
(2) "`apiBase` 축 이월(선행 결함)"도 그 근거 파일(`establishConfig`·`session-store.ts`·
`use-token-refresh.ts`·`eia-client.ts`·`host-bridge.ts`)이 이번 PR 전체(`merge-base..HEAD`, codebase 4개
파일만 변경)에서 단 한 번도 diff stat 에 등장하지 않아 그대로 이월 상태로 유지된다. 표준 OWASP 체크리스트
(인젝션·하드코딩 시크릿·암호화·에러 노출·의존성)도 커밋 단독 diff·전체 PR diff 양쪽에서 이상 없음을
확인했고, `npx vitest run` 59/59 통과 + `tsc --noEmit` 클린으로 실측 재확인했다. 유일한 지적은 이번
라운드의 prompt payload 가 실제 검증 대상 코드 diff 를 포함하지 않은 절차적 결함(WARNING)인데, 이는
orchestrator 의 사전 경고와 명시적 git 실측 지시로 이미 완전히 커버됐다. 신규 CRITICAL·WARNING(코드
관점) 없음.

## 위험도

LOW

STATUS=success security PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/02_25_54/security.md risk=LOW
