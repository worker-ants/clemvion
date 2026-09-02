# 변경 범위(Scope) 리뷰 — WS 소켓 수명을 토큰 수명에 종속 (`auth.token_expired`), 3R

## 검토 범위와 방법

`origin/main`(`6ffadb1f4`) 대비 현재 브랜치(`1bd2000d5`)의 전체 62개 파일 diff. 3개 커밋으로 구성:

- `b019d7de3` feat — 핵심 구현
- `a9316a0a6` fix — 1R 리뷰(`review/code/.../17_38_12/`) 반영
- `1bd2000d5` fix — 2R 리뷰(`review/code/.../18_18_53/`) 반영

이전 두 라운드(`17_38_12/scope.md`, `18_18_53/scope.md`)가 이미 상세히 분석했으나, `18_18_53` 라운드는
2R fix(`1bd2000d5`, `inFlight` 가드 추가분) **이전** 시점의 diff만 봤다. 이번 라운드는 그 사각을
포함해 전체를 `git diff origin/main...HEAD`, `git show 1bd2000d5`, `Read` 로 직접 재검증했다
(저장소 파일은 읽기만 함, 뮤테이션 없음 — `git status --short` 로 변경 없음 확인 완료).

## 발견사항

- **[INFO]** 실패/빈 `--impl-prep` 재시도 consistency 세션 6개(10개 파일)가 diff 에 그대로 남아 있음 — 3라운드 연속 동일 지적, 여전히 미정리
  - 위치: `review/consistency/2026/09/02/17_08_55/`, `17_09_30/`, `17_11_15/`, `17_11_16/`,
    `17_11_33/`, `17_11_34/` — 각 `_retry_state.json`·`meta.json`만 존재(직접 `ls` 로 재확인,
    `SUMMARY.md`/checker 산출물 없음). 성공한 최종 런은 `17_13_02/`(`SUMMARY.md`+checker 5개 전문).
  - 상세: `review/consistency/**` 저장 자체는 `CLAUDE.md` 규약대로 정상이고, `--impl-prep` 의무화
    과정에서 생긴 재시도 잔재로 기능 변경과 무관하다. `1R scope.md`·`2R scope.md` 가 이미 각각
    같은 항목을 INFO 로 지적했는데 3R 인 지금도 정리되지 않고 그대로 diff 에 남아 62개 파일 중
    10개(약 16%)를 차지한다. 차단 사유는 아니지만 세 번째 반복 지적이라는 점은 기록해 둔다.
  - 제안: 이전 두 라운드와 동일 — 차단 아님. 다음엔 성공한 최종 세션만 커밋하거나 재시도 사유를
    커밋 메시지에 남기는 관례를 고려.

- **[INFO]** `ws-client.ts` 신규 핸들러 등록부에 의미 없는 이중 빈 줄 — 2R 이후에도 미정리
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:116-117` (직접 Read 로 재확인 — "이 두
    경로가 없으면 사용자는 조용히 연결을 잃는다." 주석 다음 줄과 "정상 경로 —" 주석 사이에 빈
    줄 2개)
  - 상세: 순수 포맷팅 잔여물, 동작 영향 없음. `1R`·`2R` scope 리뷰 모두 같은 항목을 INFO 로
    지적했고 2R fix 커밋(`1bd2000d5`)이 이 파일을 수정했음에도 반영되지 않았다.
  - 제안: 빈 줄 하나 제거. 차단 사유 아님.

## 검토했으나 이상 없음으로 판단한 항목

- **2R fix 커밋(`1bd2000d5`) 자체의 범위** — `git show` 로 diff 를 직접 대조한 결과, 변경분은
  `2R RESOLUTION.md`(파일 27)가 명시한 항목에 정확히 1:1 대응한다: `ws-client.ts` 의 `inFlight`
  Promise 가드(W2), `ws-client.test.ts` 신규 테스트 4건(W2/W3/W4 — 겹친 트리거·`connect_error`
  위임·재발급 실패 두 갈래), `password-and-sessions.{mdx,en.mdx}` Callout(W5), `ws-token-expired-
  socket-lifetime-impl.md` 체크리스트 갱신(W1 지터 등재·W5 e2e 유예 근거 이관·유저가이드 체크).
  요청 이상의 리팩토링·기능 확장은 없다.
- **핵심 코드 5파일(1~9)** — `AuthEventType`/`AuthTokenExpiredPayload` 신설, `armExpiryTimers`
  arm/disarm, `refreshAndReconnect` 통합 헬퍼, 대응 backend/frontend 테스트, `EXPECTED_EXPORTS`
  갱신, `CHANGELOG.md` 항목 모두 plan(`ws-token-expired-socket-lifetime-impl.md`)과 spec
  Rationale `R-ws-socket-lifetime-binds-token` 이 정의한 "backend 타이머 둘 + frontend 구독·
  재연결" 범위와 1:1 대응한다(`git diff --stat` 로 전체 62파일 목록을 재확인, 프롬프트에 없는
  파일은 없음).
- **`plan/in-progress/**` 2건(파일 10·11)** — developer 쓰기 권한 범위, PLAN 라이프사이클 규약
  준수. `spec/` 자체는 이번 diff 에서 건드리지 않았다(`git diff --stat` 로 확인 — `spec/` 경로
  없음).
- **`review/code/17_38_12/**`·`review/code/18_18_53/**`(파일 12~42)** — `/ai-review` 실행 결과
  자체이며 `CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 조항에 따라 정상
  워크플로 산출물. 각 RESOLUTION.md 의 조치 주장이 실제 코드에 반영됐는지 소스 대조로 확인했고
  어긋나지 않는다.
- **포맷팅/주석/임포트** — `websocket.gateway.ts` import 변경은 신규 심볼(`AuthEventType`,
  `AuthTokenExpiredPayload`) 추가뿐, 미사용 임포트나 무관한 정리는 없다. 신규 주석은 전부 이번
  기능의 설계 근거·범위 경계·기각 대안을 설명하며 무관한 주석 변경은 없다.
- **설정 변경** — `.github/workflows/**`, `package.json`, `tsconfig*.json` 등 설정 파일은 이번
  diff 에 없음(`git diff --stat` 로 확인).

## 요약

3라운드 누적 diff(feat + 1R fix + 2R fix) 전체를 `git diff`/`git show`/`Read` 로 직접 재검증한
결과, 핵심 기능 변경은 plan·spec Rationale 이 정의한 범위와 정확히 일치하고, 각 fix 커밋도 직전
라운드 RESOLUTION.md 가 명시한 항목에만 국한돼 요청 이상의 추가 수정·리팩토링·기능 확장은
발견되지 않았다. 특히 `18_18_53` 라운드가 아직 보지 못했던 2R fix 커밋(`inFlight` 가드·신규
테스트 4건·유저가이드 Callout·plan 체크리스트)도 해당 라운드 RESOLUTION 이 승인한 조치와 1:1
대응함을 `git show` 로 확인했다. 유일한 관찰 사항 둘 — 정보 가치 없는 `--impl-prep` 빈 재시도
세션 6개(10파일)와 `ws-client.ts` 의 이중 빈 줄 — 은 3라운드 연속 반복 지적이지만 기능에 영향이
없는 절차적/서식 잔여물로 차단 사유가 아니다.

## 위험도

NONE
