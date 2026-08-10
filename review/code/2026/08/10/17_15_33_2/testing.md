# 테스트(Testing) 리뷰 결과

## 스코프에 대한 메모

`_prompts/testing.md` 의 diff 페이로드에는 `spec/7-channel-web-chat/3-auth-session.md`
(spec 문서, 코드 아님) 한 파일만 담겨 있다. 그러나 오케스트레이터의 호출 메시지가 직접
지목한 검증 대상은 **코드** 커밋 `5452df462`(`test(webchat): 고착 streaming 을 정상
streaming 과 가른다`)이 수정한
`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 다. 이 파일은
프롬프트 게이트에 없으므로, 아래 인용 줄 번호는 **해당 파일을 직접 `Read` 로 연 결과의
실제 소스 줄 번호**다(프롬프트 오프셋이 아니다). spec 문서(파일 1)는 이 커밋을 서술로
반영한 것이라 별도로 아래에서 짧게 다룬다.

## 검증 방법

리뷰 지시에 따라 워킹트리를 건드리지 않기 위해, `codebase/channel-web-chat`(`package.json`
·`tsconfig.json`·`vitest.config.ts`·`vitest.setup.ts`·`src/`)을 repo 밖 scratch 디렉터리로
복사하고 `node_modules` 만 원본 위치로 symlink 해 격리된 사본에서 vitest 를 직접 구동했다
(원본 워크트리 파일은 일절 수정하지 않음). 이 사본에서:

1. 베이스라인(무수정) 상태로 `§R4: refresh 가 **네트워크 오류**로 실패하면 종료로 확정하지
   않는다` 단일 테스트를 실행 → 통과.
2. `use-widget.ts` 의 `return "refresh_deferred";`(447번째 줄, `recoverFromExpiredToken`
   catch 블록의 `!terminal` 분기)를 `return "stale";` 로 뮤테이션한 뒤 같은 테스트를 재실행
   → **RED**(`expect(after).toBeGreaterThan(before)` 단언에서 `AssertionError: expected 1 to
   be greater than 1`로 실패). 오케스트레이터가 보고한 "뮤테이션 RED" 를 독립적으로 재현·확인함.
3. 같은 뮤테이션(아직 적용된 상태)에서 `§R4: refresh 가 \`500\` 으로 실패해도 종료로 확정하지
   않는다 — 상태 **필터** 축` 테스트를 실행 → **GREEN**(통과) — 즉 동일 결함이 이 테스트는
   전혀 못 잡는다.

## 발견사항

- **[CRITICAL]** `500` 케이스 테스트는 네트워크-오류 테스트와 **동일한 코드 경로**
  (`recoverFromExpiredToken` 의 `!terminal` → `"refresh_deferred"`)를 겨냥하지만, 이번
  커밋이 추가한 "타이머가 실제로 걸렸는가(고착 판별)" 보강이 이 테스트에는 적용되지
  않았다 — 실측 결과 동일 CRITICAL 급 뮤테이션(`"refresh_deferred"` → `"stale"`, 즉
  `scheduleRefresh` 소실 → 영구 고착)이 이 테스트에서는 GREEN 으로 생존한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` —
    `it("§R4: refresh 가 \`500\` 으로 실패해도 종료로 확정하지 않는다 — 상태 **필터** 축", ...)`
    (실 소스 501번째 줄부터, 최종 단언은 532번째 줄 `expect(result.current.state.phase).not.toBe("ended")`).
    비교 대상(이미 보강됨): 같은 파일 448~499번째 줄
    `it("§R4: refresh 가 **네트워크 오류**로 실패하면 종료로 확정하지 않는다", ...)`.
  - 상세: 두 테스트 모두 `getStatus` → `401` → `refreshToken` 재시도 실패라는 동일 시퀀스를
    거치고, 실패 원인만 다르다(네트워크 reject vs HTTP 500). `recoverFromExpiredToken` 안에서
    `terminal = refreshErr instanceof EiaError && (status===401||status===410)` 계산 후
    `!terminal` 분기에서 **똑같이** `return "refresh_deferred"` (line 447)에 도달한다. 이
    반환값이 `"stale"` 로 퇴행하면(과거 실제로 있었던 결함, 커밋 메시지가 인용하는
    `16_56_39` CRITICAL) 호출부(`start()`/`applyConfig`)의
    `if (outcome !== "continue" && outcome !== "refresh_deferred") return;` 게이트에 걸려
    `scheduleRefresh()` 호출 자체가 스킵되고, 세션이 갱신 수단 없이 영구히 스피너(`streaming`)
    에 고착된다. 그런데 `phase` 는 어차피 `BOOTED`/`RESTORED` 디스패치로 이미 `"streaming"`
    이 돼 있고 `WAITING`/`ENDED` 어느 쪽도 재도달하지 않으므로, `500` 테스트의 현재 단언
    (`phase !== "ended"`, `getEs() === null`, storage 잔존)은 "정상적으로 refresh 를 예약해 둔
    채 대기 중"인 케이스와 "영구 고착"인 케이스를 **구분하지 못한다** — 위 3단계 실측이 이를
    직접 확인했다. `plan/in-progress/webchat-auth-session-status-reconcile.md` 의 추적
    테이블(§frontmatter 재판정·§start() 401 갭·§refresh 동시 발화·§catch 세대 재검사·
    §비-terminal 재연결) 어디에도 이 gap 은 등재돼 있지 않다 — 알려진 defer 항목이 아니라
    순수한 커버리지 누락이다.
  - 제안: `500` 테스트에도 네트워크-오류 테스트와 동일한 패턴을 적용한다 — (a)
    `vi.useFakeTimers({ shouldAdvanceTime: true })` 로 전환, (b) fixture `expiresAt` 을
    `NINETY_MIN_MS`(현재 line 508) 대신 `TOKEN_REFRESH_LEAD_MS + 6_000` 로 당겨 타이머가
    테스트 시간 내에 발화하게 하고, (c) 첫 `/refresh-token` 호출 확인 뒤
    `vi.advanceTimersByTimeAsync(20_000)` 로 만료 시점을 넘겨 `/refresh-token` 호출이 다시
    나가는지(`after > before`)를 단언한다. 두 테스트가 겨냥하는 축(`instanceof EiaError`
    여부 vs 상태코드 필터)은 이미 분리돼 있으므로, 이 보강을 더한다고 두 테스트가 중복이
    되지는 않는다 — 오히려 "고착 판별" 축이 이제 한쪽에만 있는 비대칭을 없앤다.

- **[INFO]** (검증 완료, 결함 아님) 네트워크-오류 테스트(448~499번째 줄)의 신규 단언은
  실제로 "정상 streaming"과 "영구 고착된 streaming"을 가른다 — 오케스트레이터가 보고한
  뮤테이션 RED 를 위 방법으로 독립 재현했고, `phase !== "ended"` 단독으로는 두 상태가
  구분되지 않는다는 점(둘 다 `BOOTED` 디스패치로 이미 `"streaming"`이고 이후 어떤
  액션도 재도달하지 않음)도 코드 추적으로 확인했다. fixture 만료를 `TOKEN_REFRESH_LEAD_MS +
  6_000` 로 당긴 것(line 458)도 `TOKEN_REFRESH_MIN_DELAY_MS`(5초) 보다 커 `refreshDelayMs`
  가 실제로 ~6초로 계산되고, `advanceTimersByTimeAsync(20_000)`(line 495)이 그보다 넉넉해
  결정적으로 발화한다 — 타이밍 여유값도 적절하다.

- **[INFO]** 테스트 격리: `vi.useFakeTimers`/`vi.useRealTimers` 를 테스트 본문에서
  쌍으로 열고 닫지만, 전역 `afterEach`(line 203~209 부근, `vi.useRealTimers(); vi.restoreAllMocks();`)
  가 안전망으로 이미 존재해 단언 실패로 본문의 `vi.useRealTimers()`(line 498)에 못 미쳐도
  다음 테스트로 fake timer 상태가 새지 않는다. 신규 코드가 이 컨벤션을 어기지 않는다.

- **[INFO]** (파일 1, spec 문서) `3-auth-session.md` 의 새 서술 — "그 외 status·오류는
  **여전히** `catch` soft-fail 후 SSE 로 진행한다 ... 회귀 테스트가 그 경계를 고정한다"
  (프롬프트 게이트 66번째 줄) — 는 실제로 `it("그 외 오류는 여전히 soft-fail — 500 은
  종료로 오판하지 않는다", ...)`(소스 537번째 줄부터)로 뒷받침된다. 이 테스트는
  `getEs()).not.toBeNull()` 로 SSE 가 실제로 열렸음을 직접 단언하므로(위 500-refresh
  테스트와 달리 `openStream` 이 스킵되지 않는 경로), 여기서는 `phase !== "ended"` 만으로도
  고착 여부를 가릴 수 있는 구조라 위와 같은 갭이 없다.

## 요약

이번 커밋(`5452df462`)이 낸 네트워크-오류 케이스의 신규 단언은 실측(뮤테이션 재현)으로
확인한 바 실제로 "정상 streaming"과 "복구 수단 없이 영구 고착된 streaming"을 가른다 —
CRITICAL 은 해당 테스트에 한해 유효하게 해소됐다. 그러나 같은 라운드에서 나란히 존재하는
`500` 케이스 테스트는 동일한 `recoverFromExpiredToken` 코드 경로(`"refresh_deferred"`
반환)를 검증하면서도 이번 보강을 받지 않아, 동일한 뮤테이션(`"refresh_deferred"` →
`"stale"`)이 그 테스트에서는 검출되지 않는다는 것을 스크래치 사본에서 직접 재현·확인했다.
plan 추적 문서에도 이 잔여는 등재돼 있지 않아, "보강했다"는 커밋 서술이 실제로는 형제
테스트 한쪽에만 적용된 비대칭 상태다. 나머지(mock 적절성·테스트 격리·가독성)는 이 파일의
기존 컨벤션(전역 `afterEach` 안전망, 타이밍 상수 추출, 축별 테스트 분리)을 그대로 따르고
있어 이견 없다.

## 위험도

CRITICAL
