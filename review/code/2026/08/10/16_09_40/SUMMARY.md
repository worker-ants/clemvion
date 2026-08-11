# Code Review 통합 보고서 — 재로드 REST 오류 분기 3종 (§3.1-2·§R4)

- 대상: `claude/webchat-reload-rest-branches` · diff-base `origin/main` · `--route=all`
- forced **7명 전원** 리포트 확보(`_retry_state.json` 으로 확인 — 이번엔 재사용하지 않았다).

## BLOCK: NO

**Critical 1 · WARNING 8** — 전부 반영 (`RESOLUTION.md`).

## 전체 위험도

**LOW** (반영 후).

## Critical

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 1 | **security · side_effect · requirement · testing (4명 독립 수렴)** | **refresh 성공 후 호출부가 갱신 전 토큰으로 SSE 를 연다** — `SeedOutcome` 이 변경을 실어 나르지 않아 `start()`·`applyConfig` 가 캡처해 둔 지역 변수를 그대로 `openStream` 에 넘긴다. **이 PR 이 고치려던 "streaming 고착" 을 §R4 성공 경로에서 재현** | **반영** — 두 호출부가 `sessionRef.current` 를 읽는다 |

> testing reviewer 는 자기 프로브로 `token=iext_stale` 을 **직접 관측**했다.

## 경고

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 2 | security · testing | **테스트가 그 CRITICAL 을 통과시켰다** — `installControllableEventSource` 가 생성자 URL 을 버려 "옳은 토큰으로 열렸나" 를 물을 수 없었다 | **반영** — URL 포획 + 토큰 단언. 뮤테이션 RED |
| 3 | testing | refresh 후 세대 재검사 2곳이 뮤테이션 사각지대 | **반영** — refresh 응답을 붙잡아 그 창에서 종료시키는 회귀. 뮤테이션 RED |
| 4 | scope | 두 PR 머지 순서 의존을 **커밋 메시지에만** 남김 | **반영** — plan 신설 + spec 본문 포인터 |
| 5 | maintainability | 토큰 반영+영속화 4줄이 두 갱신 경로에 복제 | **반영** — `applyRefreshedToken` 추출(오케스트레이션은 분리 유지). 뮤테이션 RED 2건 |
| 6 | documentation | 테스트 JSDoc 이 spec frontmatter 를 **미머지 PR 상태로** 서술 | **반영** |
| 7 | documentation | `seedWaitingFromStatus` 계약이 새 분기 미반영 | **반영** — 세 갈래 + 호출부 계약 명시 |
| 8 | documentation | CHANGELOG 관례 미이행 | **반영** |

## 채택하지 않은 것 (근거)

| reviewer | 내용 | 판단 |
|---|---|---|
| maintainability | 401 복구를 module-level 헬퍼로 추출 | 넷을 주입해야 해 **시그니처가 본문보다 길어진다**. reviewer 도 "주석이 상세해 파악 난이도 완화" 로 적었다. 읽는 비용을 인자 목록으로 옮길 뿐이라 보류 — 다섯 번째 분기에 재판정 |
| maintainability | 테스트 `fetchMock` 파라미터화 (reviewer 가 "필수 아님" 명시) | 네 케이스의 자기완결성이 이점. `410` 이 생기면 그때 |

## 남긴 갭 — 통과할 때까지 구부리지 않았다

`start()` 경로도 같은 형태라 회귀를 쓰려다 SSE 가 아예 안 열려 실패했다. 뮤테이션으로 실측:
**`applyConfig` 만 되돌리면 RED, `start()` 만 되돌리면 초록** — 회귀가 절반만 덮는다.

억지로 통과시키는 대신 제거하고 갭으로 등재했다. 신규 대화 직후 `getStatus` 가 `401` 을 주는
경로가 **실제로 도달 가능한지부터 확인이 필요**하고, 불가라면 그 분기는 방어 코드이지 테스트
대상이 아니다. 코드 주석과 plan 양쪽에 적었다.

## 검증

- 위젯 23파일 **414 passed** · `tsc --noEmit` **0 errors** · 문서 가드 **2876 passed**
- 뮤테이션 **6종 RED** — 두 분기 제거(3) · 재차-401→continue · `applyConfig` stale 토큰 ·
  세대 재검사 제거 · 공유 헬퍼 persist 제거(2)
