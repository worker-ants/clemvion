# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `AuthEventType`/`AuthTokenExpiredPayload` 신규 export 가 #1174 회귀 가드의 "완전한 목록" 불변식에서 누락
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:49-62` (`EXPECTED_EXPORTS` 배열, diff 대상 아님 — Read 로 직접 확인)
  - 상세: 이 스펙 파일은 자체 docstring(`:6-41`)에서 "`websocket-events.types.ts` 가 **의존성-프리**로 남는지 지키는 정적 가드" 라고 명시하고, `EXPECTED_EXPORTS` 주석(`:48`)은 "이 모듈이 갖고 있어야 할 export — 선언이 딴 데로 옮겨가면 '간선 0' 이 공허해진다" 라고 그 리스트의 존재 이유를 설명한다. 실제로 이 리스트는 지금까지 `websocket-events.types.ts` 의 **모든** `export enum/interface/type` 선언(12개)과 정확히 1:1 이었다 — 직접 대조 확인. 이번 diff 가 같은 파일에 `AuthEventType`(엔지, `:283`)·`AuthTokenExpiredPayload`(인터페이스, `:297`) 두 개의 새 export 를 추가했지만, `EXPECTED_EXPORTS` 는 갱신되지 않았다. 두 번째 테스트(`:341`)는 `EXPECTED_EXPORTS ⊆ 실제 export` 만 확인하는 부분집합 검사라 지금 당장 RED 는 아니다 — 그러나 이 리스트가 원래 의도한 "완전한 목록" 보장은 이 두 심볼에 대해서는 조용히 깨졌다. #1174 는 "72 suites 가 `Cannot read properties of undefined` 로 터진" 실제 장애였고, 이 가드는 그 재발을 막기 위해 만들어졌다 — 커버리지가 좁아지는 편집이 조용히 통과하는 패턴이다.
  - 제안: `EXPECTED_EXPORTS` 배열에 `'AuthEventType'`, `'AuthTokenExpiredPayload'` 두 항목을 추가한다.

- **[WARNING]** CHANGELOG.md 미갱신
  - 위치: `CHANGELOG.md` (저장소 루트, 이번 diff 미포함)
  - 상세: 이 저장소는 유의미한 기능/동작 변경마다 `CHANGELOG.md`"Unreleased" 섹션에 서술형 항목을 남기는 관행이 확립돼 있다(`git log --oneline -5 -- CHANGELOG.md` 로 최근 5개 커밋 전부가 CHANGELOG 를 동반 갱신함을 확인). 이번 변경은 새 WS 시스템 이벤트(`auth.token_expired`) 도입 + 소켓 강제 종료(§1.2) + 클라이언트 명시적 재연결(§9.2) 이라는, 사용자에게 보이는 동작 변화를 포함하는 실질적 기능이다. 그런데도 CHANGELOG.md 는 이번 diff 에 없다.
  - 제안: PR 완료 전 CHANGELOG.md 에 "WS 소켓 수명이 토큰 수명에 종속된다" 계열 항목을 추가한다(기존 항목들과 같은 narrative 톤).

- **[WARNING]** 구현 완료 후 spec `Planned` 배지·tracker 체크박스가 stale 될 예정 — 후속 조치 포인터 부재
  - 위치: `spec/5-system/6-websocket-protocol.md:28`(intro blockquote), `:872-876`(§4.6 표), `:1096-1100`·`:1133`(Rationale) / `plan/in-progress/spec-sync-websocket-protocol-gaps.md:23`
  - 상세: spec 은 `auth.token_expired` 를 `_(계획·미구현)_`/"Planned" 로 표기하며, `:1133` 은 명시적으로 "배지는 구현 전까지 Planned 다" 라고 적어 뒀다. 이번 diff 는 정확히 그 backend 타이머 + frontend 구독·재연결을 구현했다(파일 1·3·5). `spec-sync-websocket-protocol-gaps.md:23` 의 `- [ ] 서버발신 auth.token_expired 시스템 이벤트 emit` 체크박스도 아직 미체크다. developer 는 `spec/` 을 직접 고칠 권한이 없고(이 문구는 developer 가 쓴 예고가 아니므로 자기-반증형 소정정 예외에도 해당 안 됨), tracker 는 `plan/**` 이라 developer 쓰기 권한이 있다. 이번 PR 산출물(`ws-token-expired-socket-lifetime-impl.md`)의 체크리스트에는 "spec flip" 후속 조치에 대한 포인터가 없어, PR 이 머지된 뒤 planner 턴을 별도로 상기시킬 장치가 없다.
  - 제안: `ws-token-expired-socket-lifetime-impl.md` 체크리스트에 "PR 머지 후 planner 턴으로 spec Planned 배지 flip + `spec-sync-websocket-protocol-gaps.md:23` 체크" 항목을 추가하거나, PR 머지 직후 tracker 체크박스만이라도 갱신해 둔다(devloper 쓰기 권한 범위 내).

- **[INFO]** `refreshAndReconnect` 가 기존 `connect_error` 핸들러의 재발급 로직과 중복되는데 그 이유를 설명하는 주석이 없음
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts:63-77`(기존 `connect_error` 핸들러) vs `:87-97`(신규 `refreshAndReconnect`)
  - 상세: 두 블록 모두 `refreshAccessToken()` → `socket.auth.token` 교체 → `socket.connect()` → catch 로그, 동일한 핵심 로직을 반복한다(`connect_error` 쪽은 `refreshAttempted` 무한루프 가드가 추가로 있음). `:82-86` 주석은 "왜 `connect_error` 로는 이 케이스를 못 잡는가" 는 설명하지만, "왜 두 로직을 공유 헬퍼로 통합하지 않았는가" 는 설명하지 않는다. 향후 재발급 로직이 바뀔 때 한쪽만 고치고 다른 쪽을 놓칠 위험이 있다.
  - 제안: 공유 헬퍼로 리팩터링하거나(권장), 유지하기로 한 경우 그 이유를 한 줄 주석으로 남긴다.

- **[INFO]** 구현 완료됐지만 `impl-plan` 체크리스트의 TDD 항목이 아직 `[ ]`
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md:77-78`
  - 상세: `- [ ] backend: 소켓별 타이머 + emit + disconnect + 해제 (TDD)` / `- [ ] frontend: 구독 + disconnect reason 분기 + 명시 재연결 (TDD)` 둘 다 미체크지만, 이번 diff(파일 1·2·3·4·5)는 두 항목을 모두 실제로 구현·테스트했다. 이 저장소 관례상("plan 체크박스 = 실제 상태, 수행 후에만 체크") `/ai-review` 통과 후 체크하는 정상 워크플로일 가능성이 높아 결함으로 단정하지 않지만, 이 리뷰 라운드가 끝나면 체크박스 갱신을 놓치지 않도록 상기시킨다.
  - 제안: 이번 `/ai-review` fix 라운드가 끝나면 해당 두 체크박스와 `[ ] lint / unit / build / e2e` 를 함께 갱신한다.

- **[INFO]** 실패한 consistency-check 재시도 세션 6개가 diff 에 함께 포함됨
  - 위치: `review/consistency/2026/09/02/{17_08_55,17_09_30,17_11_15,17_11_16,17_11_33,17_11_34}/`
  - 상세: 이 6개 디렉터리는 `_retry_state.json`·`meta.json` 만 있고 실제 checker 출력(`SUMMARY.md`, `cross_spec.md` 등)이 없다 — 성공한 `17_13_02/` 세션 이전의 rate-limit/재시도 잔재로 보인다. 코드 문서화 결함은 아니지만, 6개의 빈 세션 디렉터리가 저장소에 영구히 남는 것에 대한 설명(주석·plan 언급)이 diff 어디에도 없다.
  - 제안: 조치 불요(이 저장소 관례상 `review/` 는 gitignored 아니고 재시도 산출물도 통상 보존됨) — 참고용으로만 기록.

## 요약

핵심 코드(백엔드 `armExpiryTimers`/`AuthEventType`/`AuthTokenExpiredPayload`, 프론트 `refreshAndReconnect`)의 JSDoc·인라인 주석은 spec §1.2/§4.6/§6.1/§9.2 및 Rationale `R-ws-socket-lifetime-binds-token` 을 문구 단위로 정확히 반영하고 있고, 테스트 설명·plan 문서(`ws-token-expired-socket-lifetime-impl.md`)도 착수 전 실측치·설계 결정 근거를 잘 남겨 전반적인 문서화 품질은 높다. 다만 (1) #1174 회귀 가드(`websocket-events.types.spec.ts`)의 자체 문서화된 완전성 불변식이 신규 export 2개에 대해 조용히 깨졌고, (2) 이 저장소가 상시 유지하는 CHANGELOG.md 관행이 이번 실질 기능 변경에서 빠졌으며, (3) spec 자신이 예고한 "구현 완료 시 Planned 배지 flip" 후속 조치에 대한 포인터가 PR 산출물에 없다 — 세 건 모두 차단 수준은 아니지만 이 저장소가 반복적으로 겪어 온 "vacuous coverage"·"stale Planned 마커" 패턴과 정확히 일치해 조치를 권한다.

## 위험도
LOW
