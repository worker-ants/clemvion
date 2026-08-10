# Code Review 통합 보고서 — 재로드 REST 오류 분기 (2라운드)

- 대상: `claude/webchat-reload-rest-branches` · diff-base `origin/main` · `--route=all`
- forced **7명 전원** (`_retry_state.json` 확인 후 디스패치).

## BLOCK: NO

Critical 0 · WARNING 7 — 전부 반영 (`RESOLUTION.md`).

## 전체 위험도

**LOW** (반영 후).

## 경고

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 1 | **requirement** | **refresh 가 네트워크 오류로 실패해도 종료 확정** — §R4 문언(`401`/`410`)보다 넓고 **이 변경 자신의 CHANGELOG 원칙("그 외는 soft-fail")과 충돌.** 일시적 장애가 살아있는 대화를 끝낸다 | **반영** — `401`/`410` 만 종료. 회귀 1건 + 뮤테이션 RED |
| 2 | **testing** | **내 "세대 재검사 2곳 뮤테이션 RED" 주장이 절반만 참** — `catch` 분기는 제거해도 초록 | **정정** — 실측 확인, 재현 시도 실패, **미검증 사실을 가드 옆 주석·plan 양쪽에 기록** |
| 3 | **maintainability** | **내 보류 근거가 반증됨** — 형제 `use-token-refresh` 의 `useCallback` 클로저 패턴이면 인자가 셋뿐 | **반영** — `recoverFromExpiredToken` 분리. 순수 이동을 뮤테이션으로 확인 |
| 4 | side_effect | refresh 동시 발화 경합 — 첫 라운드에 **채택도 보류도 없이 흘림** | **plan 등재** + 왜 지금 안 고치는지 명시 |
| 5 | documentation | 같은 diff 안에서 "몇 명 수렴" 이 **셋 다 다름**(4/3/2) | **반영** — 실측값 4명 + **이름 나열**(다음에 어긋나면 누가 빠졌는지 보인다) |
| 6 | documentation | JSDoc 이 **새 단락만 얹혀** 기존 서술 넷과 배치 | **반영** — 요약·실패정책·`@returns`·타입 독스트링 전부 현행화 |
| 7 | scope | plan 이 완료 조건 독립인 두 항목을 한 문서에 담음 | **반영** — 완료 조건 표로 명시 |

## 0/0 을 낸 reviewer

| reviewer | 비고 |
|---|---|
| security | NONE — 직전 CRITICAL 을 **3중 재검증**(소스 직독·헬퍼 grep·실제 실행) |
| scope | 0/0 — 세 추가분이 "이 diff 자신이 만든 문제" 에 대한 비례적 응답임을 실측 확인 |

## 이 티켓에서 같은 형태가 세 번 났다 — 집계가 곧 추적이다

| 흘린 항목 | 잡힌 라운드 |
|---|---|
| refresh 동시 발화 경합 | side_effect 2R |
| 네트워크 오류 종료 확정 | requirement 2R |
| catch 분기 세대 재검사 미검증 | testing 2R |

셋 다 **1라운드에 이미 지적됐고** 내 SUMMARY/RESOLUTION 집계에서 빠졌다. 다른 항목들은
근거와 함께 명시 보류했는데 이 셋만 조용히 사라졌다 — **빠뜨리면 그 항목은 존재하지 않게 된다.**

## 남긴 갭 (전부 plan 등재)

- `start()` 경로 401 회귀 — 도달 가능성 미확인
- `catch` 분기 세대 재검사 — 갈라내는 인터리빙 미발견. **재현 실패를 "결함 없음" 으로 읽지 않는다**
- refresh 동시 발화 경합 — 세 조건 겹침 미재현

셋 다 **통과할 때까지 구부리지 않고** 미검증 사실을 코드·plan 양쪽에 남겼다.

## 검증

- 위젯 23파일 **415 passed** · `tsc --noEmit` **0 errors** · 문서 가드 **2876 passed**
- 뮤테이션 누적 **9종** — 분기 제거(3) · 재차-401→continue · applyConfig stale 토큰 ·
  세대 재검사(성공 분기) · 공유 헬퍼 persist(2) · terminal 조건 확대
