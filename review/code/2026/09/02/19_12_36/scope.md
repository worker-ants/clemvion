# 변경 범위(Scope) 리뷰 — WS 소켓 수명을 토큰 수명에 종속 (`auth.token_expired`), 4R

## 검토 범위와 방법

`origin/main`(`6ffadb1f4`) 대비 현재 브랜치 HEAD(`e5b683d75`)의 전체 78개 파일 diff
(`git diff --stat origin/main...HEAD` 로 프롬프트의 파일 30 목록과 정확히 일치 확인). 4개 커밋:

- `b019d7de3` feat — 핵심 구현
- `a9316a0a6` fix — 1R 리뷰(`17_38_12/`) 반영
- `1bd2000d5` fix — 2R 리뷰(`18_18_53/`) 반영
- `e5b683d75` fix — 3R 리뷰(`18_45_43/`) 반영 (**이번 라운드에 처음 diff 에 등장**)

이전 세 라운드(`17_38_12/scope.md`, `18_18_53/scope.md`, `18_45_43/scope.md`)가 이미 핵심 코드
5~9파일과 plan/`review/**` 아티팩트 구성 전체를 상세히 검증해 매번 **NONE** 판정을 냈다. 이번
라운드는 그 결론을 재확인하는 대신, 지금까지 아무도 검증할 수 없었던 부분 — **3R fix 커밋
(`e5b683d75`) 자체의 diff, 그리고 3R RESOLUTION.md 가 "조치했다"고 적은 항목이 실제 diff 와
일치하는지** — 를 `git show e5b683d75`, `Read` 로 직접 대조했다(저장소 파일은 읽기만 함,
`git status --short` 로 변경 없음 확인 완료).

## 발견사항

- **[WARNING]** 3R RESOLUTION.md·커밋 메시지가 "정리했다"고 주장한 이중 빈 줄이 실제로는 그대로 남아 있다 — 4라운드 연속 미해결, 이번엔 허위 조치 기록까지 겹쳤다
  - 위치: 실제 잔존 위치 — `codebase/frontend/src/lib/websocket/ws-client.ts:131-132`(Read 로 직접
    확인, "이 두 경로가 없으면 사용자는 조용히 연결을 잃는다." 줄과 "정상 경로 —" 주석 줄 사이에
    빈 줄 2개). 허위 주장 — `review/code/2026/09/02/18_45_43/RESOLUTION.md:60`("**#11 이중 빈 줄은
    이번에 정리했다** — 세 번 지적됐으면 고치는 게 싸다") 및 커밋 `e5b683d75` 메시지("세 번 지적된
    이중 빈 줄도 정리했다").
  - 상세: 이 항목은 2R scope 리뷰(`18_18_53/scope.md`, 당시 위치 `ws-client.ts:101-102`)에서 처음
    INFO 로 지적됐고, 3R scope 리뷰(`18_45_43/scope.md`, 당시 위치 `:116-117`)가 "2R 이후에도
    미정리"라고 재확인했다. 3R RESOLUTION.md 는 이를 조치 항목(#11)으로 명시하며 "이번에 정리했다"
    고 적었고, 뒤이은 fix 커밋 `e5b683d75` 의 메시지도 동일하게 주장한다. 그런데 `git show e5b683d75
    -- codebase/frontend/src/lib/websocket/ws-client.ts` 로 실제 diff 를 직접 열어 보면, 그 커밋이
    `ws-client.ts` 에 낸 5개 hunk 중 어느 것도 이 빈 줄 구간(`§1.2/§9.2` 주석 블록과 "정상 경로 —"
    주석 사이)을 건드리지 않는다 — 유일하게 인접한 hunk(`@@ -117,7 +132,7 @@`)는 `void` →
    `return` 한 줄만 바꿨다. 그 결과 현재 HEAD 의 `ws-client.ts:131-132` 에 이중 빈 줄이 여전히
    그대로 존재함을 `Read` 로 재확인했다. 즉 **커밋 메시지와 review 아티팩트(RESOLUTION.md, 둘 다
    이번 diff 에 포함된 파일)가 실제로 일어나지 않은 수정을 "했다"고 기록**하고 있다. 기능적 영향은
    0(순수 포맷팅)이지만, 리뷰 프로세스의 "조치함" 기록을 그대로 신뢰할 수 없다는 뜻이라 scope 관점
    (점검 관점 5: 실질 변경과 섞인 포맷팅 잔여물)에서 지나칠 수 없다 — 다음 라운드가 "3R 에서 이미
    정리됨"이라는 RESOLUTION 문구만 믿고 재확인을 건너뛰면 계속 재발한다.
  - 제안: 빈 줄 하나를 지금 제거한다(트리비얼). 더 중요하게는, RESOLUTION.md 작성 시 "조치했다"고
    적기 전에 해당 hunk 가 실제로 diff 에 포함됐는지 `git show`/`git diff` 로 재확인하는 습관을
    권장한다 — 이번 건은 사소하지만 같은 패턴이 기능적 항목에서 재발하면 위험도가 다르다.

- **[INFO]** 실패/빈 `--impl-prep` 재시도 consistency 세션 6개(10개 파일)가 diff 에 그대로 남아 있음 — 4라운드 연속 동일 지적, 여전히 미정리
  - 위치: `review/consistency/2026/09/02/17_08_55/`, `17_09_30/`, `17_11_15/`, `17_11_16/`,
    `17_11_33/`, `17_11_34/` — 각 `_retry_state.json`·`meta.json`만 존재(`ls` 로 직접 재확인).
    성공한 최종 런은 `17_13_02/`(`SUMMARY.md`+checker 5개 전문).
  - 상세: 1R/2R/3R scope 리뷰가 모두 동일 항목을 INFO 로 지적했고 이번(4R)까지 정리되지 않았다.
    `review/consistency/**` 저장 자체는 규약대로 정상이고 기능 변경과 무관해 차단 사유는 아니다.
    새 사실 없음 — 반복 기록만.
  - 제안: 이전 세 라운드와 동일. 차단 아님.

## 검토했으나 이상 없음으로 판단한 항목

- **3R fix 커밋(`e5b683d75`)의 실질 변경 범위** — `cross-generation race` 가드(`mySocket` 스냅샷 +
  `socket !== mySocket` 비교), `inFlight` 핸들러 3곳이 promise 를 `void` 대신 `return`, 재인덴트,
  주석 갱신, 대응 테스트(`ws-client.test.ts`) — 전부 `18_45_43/RESOLUTION.md` W1~W4 가 명시한
  항목에 1:1 대응한다(이중 빈 줄 #11 만 예외 — 위 WARNING). 요청 이상의 리팩토링·기능 확장은 없다.
- **핵심 코드 9파일** — 이전 세 라운드가 이미 상세 검증했고 이번 라운드에서 재확인한 `git diff
  --stat` 결과도 파일 목록·변경 성격에 차이가 없다. `spec/` 은 여전히 건드리지 않았다.
- **`review/code/17_38_12/**`·`18_18_53/**`·`18_45_43/**`(리뷰 산출물)** — `/ai-review` 실행 결과이며
  `CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 조항에 따라 정상 워크플로
  산출물. 3R RESOLUTION 의 이중 빈 줄 항목을 제외하면 나머지 서술은 실제 diff 와 대조해 어긋나지
  않는다.
- **plan 문서 2건** — `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 를 다시 열어
  체크리스트 상태를 재확인했다. 유저가이드·backend/frontend TDD·ratchet 항목은 실제로 체크됐고,
  `/ai-review`·PR·planner 턴 항목은 미체크 상태로 정확히 남아 있다 — plan 서술이 실제 진행 상태와
  어긋나지 않는다.
- **설정 변경** — `.github/workflows/**`, `package.json`, `tsconfig*.json` 등은 이번 diff 에 없음
  (`git diff --stat` 로 확인).

## 요약

핵심 기능 변경(WS 소켓 수명을 토큰 수명에 종속)은 4라운드 누적 diff 전체에 걸쳐 plan·spec
Rationale 이 정의한 범위와 일관되게 일치하며, 각 fix 커밋도 직전 라운드 RESOLUTION.md 가 명시한
항목에만 국한돼 요청 이상의 추가 수정·리팩토링·기능 확장은 이번 라운드에서도 발견되지 않았다.
다만 이번 라운드에서 처음 검증 가능해진 3R fix 커밋(`e5b683d75`)을 실제 diff 로 직접 대조한 결과,
그 RESOLUTION.md 와 커밋 메시지가 "정리했다"고 명시적으로 주장한 이중 빈 줄(`ws-client.ts`)이
실제로는 어느 hunk 에도 포함되지 않아 현재 HEAD 에도 그대로 남아 있음을 확인했다 — 기능 영향은
없는 순수 포맷팅이지만, 커밋된 review 아티팩트의 "조치함" 서술이 실제 diff 와 어긋난다는 점에서
WARNING 으로 올려 기록한다. 그 외 관찰 사항인 정보 가치 없는 `--impl-prep` 빈 재시도 세션 6개는
4라운드 연속 동일하게 비차단 INFO 로 유지된다.

## 위험도

LOW
