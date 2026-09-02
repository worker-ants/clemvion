# 변경 범위(Scope) 리뷰 — WS 소켓 수명을 토큰 수명에 종속 (`auth.token_expired`)

## 검토 범위

전체 44개 파일. 핵심 기능 diff(파일 1~9: `CHANGELOG.md`, `websocket-events.types.{ts,spec.ts}`,
`websocket.gateway.{ts,spec.ts}`, `ws-client.{ts,test.ts}`, plan 문서 2건)와, 프로세스 산출물
(파일 10~24: `review/code/2026/09/02/17_38_12/**` 1라운드 리뷰 결과, 파일 25~44:
`review/consistency/2026/09/02/**` `--impl-prep` 세션들)로 구성된다. 후자는
`git status --short` 로 저장소를 건드리지 않고 `Read`/`ls` 로만 대조했다.

## 발견사항

- **[INFO]** 실패/빈 `--impl-prep` 재시도 세션 6개(10개 파일)가 diff 에 함께 포함됨
  - 위치: `review/consistency/2026/09/02/17_08_55/`, `17_09_30/`, `17_11_15/`, `17_11_16/`,
    `17_11_33/`, `17_11_34/` — 각각 `_retry_state.json`·`meta.json` 만 존재(`ls` 로 직접 확인,
    checker 산출물 없음). 성공한 최종 런은 `17_13_02/`(`SUMMARY.md` + checker 5개 전문)뿐이다.
  - 상세: `review/consistency/**` 저장은 `CLAUDE.md` "일관성 검토 산출물" 표가 지정한 정본
    위치이고, 이 프로젝트는 developer 구현 직전 `--impl-prep` 를 의무화한다 — 즉 이 세션들
    존재 자체는 규약 위반이 아니다. 다만 정보 가치가 0인 재시도 잔재(레이트리밋/세션 문제로
    추정) 10개 파일이 44개 파일 diff 의 약 23%를 차지해, 리뷰어가 "왜 6번 돌았나"를 매번
    추적해야 하는 노이즈를 남긴다. 이미 1라운드 scope 리뷰(`review/code/2026/09/02/17_38_12/scope.md`)
    에서 동일 항목이 INFO 로 지적됐고, 이번 라운드까지 정리되지 않은 채 그대로 diff 에 남아
    있다.
  - 제안: 차단 사유 아님. 다음에는 성공한 최종 세션만 커밋하거나, 재시도 사유를 커밋 메시지에
    한 줄 남기는 관례를 고려할 것(1라운드 지적과 동일 — 반복 지적).

- **[INFO]** `ws-client.ts` 신규 핸들러 등록부에 의미 없는 이중 빈 줄
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:101-102` (Read 로 직접 확인 — `// §6.1
    예외). 이 두 경로가 없으면 사용자는 조용히 연결을 잃는다.` 다음 줄(100)과 `// 정상 경로 —
    통지 창(60초) 안에 갈아탄다.` 줄(103) 사이에 빈 줄이 두 번 들어감)
  - 상세: 실질 영향 없는 순수 포맷팅 잔여물. 같은 파일 나머지 구간은 주석 블록 사이 빈 줄이
    한 줄로 일관됨.
  - 제안: 빈 줄 하나 제거. 차단 사유 아님.

## 검토했으나 이상 없음으로 판단한 항목

- **핵심 코드 5파일(1~7)** — `AuthEventType`/`AuthTokenExpiredPayload` 신설, `armExpiryTimers`
  타이머 arm/disarm, 대응 backend/frontend 테스트, `EXPECTED_EXPORTS` 갱신, `CHANGELOG.md` 항목
  모두 plan(`ws-token-expired-socket-lifetime-impl.md`)과 spec Rationale
  `R-ws-socket-lifetime-binds-token` 이 명시한 "backend 타이머 둘 + frontend 구독·재연결" 범위와
  1:1로 대응한다. 요청 이상의 기능 확장·무관한 파일 수정은 없다.
- **`ws-client.ts` 의 `refreshAndReconnect` 추출(파일 7)** — 겉보기엔 기존 `connect_error`
  핸들러(비 관련 코드)를 건드리는 리팩터링으로 보이지만, `RESOLUTION.md`(파일 10) W1 이 문서화한
  대로 이번 PR 이 신설한 두 신규 트리거(`auth.token_expired`, `disconnect`)가 기존 `connect_error`
  와 정확히 동일한 "재발급→`auth.token`교체→재연결" 몸통을 요구해서 생긴 필연적 통합이다.
  통합하지 않았으면 새 트리거만 고치고 기존 경로엔 no-op 결함(C1)이 남았을 것 — 이 PR 자체의
  버그를 이 PR 안에서 고친 것이므로 "현재 작업과 무관한 리팩토링" 이 아니다.
  `connect_error` 콜백이 `async` → 동기 화살표 함수로 바뀐 것도 같은 통합의 부수 효과다.
- **`websocket-events.types.spec.ts` `EXPECTED_EXPORTS` 갱신** — 이번 diff 가 같은 파일에 신설한
  export 2개를 완전성 가드에 반영하는 필수 동반 수정이며 무관한 정리가 아니다.
- **plan 문서 2건(파일 8·9)** — `plan/in-progress/**` 는 developer 쓰기 권한 범위이고, 형제
  draft 의 체크리스트 갱신 + 신규 impl plan 파일 생성 모두 `CLAUDE.md` PLAN 라이프사이클 규약
  그대로다. `spec/` 자체는 이번 diff 에서 건드리지 않아 developer/spec 쓰기 경계도 지켜졌다.
  W5(spec `Planned` 배지 flip)를 developer 가 직접 고치지 않고 "머지 후 planner 턴" 으로만
  등재한 것도 자기-반증형 소정정 예외 요건(원저자 아님)에 맞는 올바른 판단이다.
- **`review/code/17_38_12/**`(파일 10~24)** — `/ai-review` 실행 결과 자체이며,
  `CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 조항에 따라 이 PR 의
  일부로 커밋되는 것이 정상 워크플로다. 리뷰 발견사항에 대한 fix 가 실제 코드(파일 1~7)에
  반영됐는지도 `RESOLUTION.md` 서술과 대조해 확인했고 어긋나지 않는다.
- **포맷팅/주석/임포트** — `websocket.gateway.ts` import 문 변경은 신규 심볼
  (`AuthEventType`, `AuthTokenExpiredPayload`)을 추가하기 위한 것뿐이고 미사용 임포트나 불필요한
  정리는 없다. 신규 JSDoc/인라인 주석은 전부 이번 기능의 설계 근거·범위 경계를 설명하며 무관한
  주석 추가/삭제는 발견되지 않았다.
- **설정 변경** — `.github/workflows/**`, `package.json`, `tsconfig*.json` 등 설정 파일은 이번
  diff 에 없다.

## 요약

핵심 기능 변경(WS 소켓 수명을 토큰 수명에 종속)은 plan·spec Rationale 이 정의한 범위와 정확히
일치하며, 겉보기 "리팩토링"(`refreshAndReconnect` 추출)도 이 PR 자체가 신설한 회귀를 이 PR 안에서
막기 위한 필연적 통합이라 범위 밖이 아니다. spec 쓰기 경계·plan 저장 위치·리뷰 산출물 저장 위치
모두 프로젝트 규약을 지킨다. 유일한 관찰 사항 둘은 차단 수준이 아니다 — (1) 정보 가치 없는
`--impl-prep` 빈 재시도 세션 6개(10파일)가 diff 노이즈로 남아 있고 1라운드 리뷰에서 이미 지적된
채 미정리 상태이며, (2) `ws-client.ts` 에 의미 없는 이중 빈 줄 하나가 있다.

## 위험도

NONE
