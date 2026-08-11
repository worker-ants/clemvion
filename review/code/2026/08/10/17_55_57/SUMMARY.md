# ai-review SUMMARY — `17_55_57` (forced 7 전원 실행)

대상: `claude/webchat-reload-rest-branches` vs `origin/main` (85파일 단일 세션).

> **세션 준비 메모**: 기본 `--prepare` 가 85파일을 50+35 **두 배치**로 쪼갰고, 그 결과 forced
> 집합이 배치별로 갈렸다(7 vs 2). 뒤 배치만 채우면 앞 50파일은 아무도 안 보고 게이트는
> 통과한다 — 이 저장소가 `harness-review-batch-false-pass`(#1131)에서 고치고 있는 바로 그
> 거짓 PASS 구조다. `REVIEW_BATCH_SIZE=500` 으로 단일 세션 재준비해 forced 를 **전체
> changeset 기준**으로 계산시켰다.

## 집계

| reviewer | Critical | Warning | Info | 위험도 |
|---|---|---|---|---|
| security | 0 | 0 | 1 | NONE |
| scope | 0 | 0 | 4 | NONE |
| requirement | 0 | 1 | 1 | LOW |
| maintainability | 0 | 1 | 4 | LOW |
| testing | 0 | 2 | 3 | LOW |
| documentation | **1** | 0 | 3 | HIGH |
| side_effect | 0 | 1 | 3 | MEDIUM |
| **합계** | **1** | **5** | **19** | **HIGH** |

## 직전 CRITICAL 은 닫혔다 (독립 재검증 3명)

- **requirement**: 소스 추적 + `vitest run`(426 통과) + **repo 밖 scratch 뮤테이션 3건 전부 RED**
  로 두 절반(갱신 성공 시 스트림 오픈 / 실패 시 백오프 재예약)이 실제로 닫혔음을 확인.
  §R4 신설 문단이 구현보다 넓게 약속하지 않는 것도, `status: implemented` 승격이
  `spec-impl-evidence §3` 기준 정당한 것도 함께 확인.
- **security**: 세대 검사 위치(재예약 **이전**)와 teardown 의 이중 방어를 소스로 확인. 머지
  해소가 `sessionRef.current` 읽기를 되돌리지 않았음도 직접 확인.
- **scope**: 두 범위 확장(주기 갱신 실패 처리 / 머지+frontmatter 재판정)이 정당하고, 산출물의
  처분 주장 3건이 커밋과 일치.

## Critical

### C1 (documentation) — plan 이 방금 고친 결함을 여전히 "미해결" 로 서술한다

`webchat-auth-session-status-reconcile.md` 의 "## 미해결 — `refresh_deferred` 는 고착의 절반만
닫는다" 절이 커밋 `410705910` 으로 닫힌 결함을 미해결로, 처방을 **미정 3택**으로 적고 체크박스도
비어 있었다. `plan/` 은 다음 세션의 전제가 되는 자리라, 거짓 전제가 남으면 이미 있는 배선과
충돌하는 대안을 다시 설계하게 된다. requirement 도 같은 것을 WARNING 으로 독립 지적했다.

## Warning

| # | reviewer | 내용 |
|---|---|---|
| W1 | side_effect | **`onRefreshed` 가 예외로부터 격리돼 있지 않다** — 재진입 `openStream` 의 동기 throw 가 "갱신 실패" 로 오분류되고, 낙관적으로 지운 `deferredStreamRef` 가 복구되지 않아 그 세션은 다시는 스트림을 못 연다. 이 PR 이 고치려던 고착의 **새 진입 경로** |
| W2 | maintainability | `scheduleRefresh(retryDelay?)` 의 내부 전용 인자가 훅 반환 타입에 노출 — `failuresRef` 리셋 조건과 결합돼 외부가 넣으면 백오프가 조용히 죽는다 |
| W3 | testing | `410` 재시도 중단 축이 `use-token-refresh.test.ts` 에 없다 — **다른 파일**의 기존 테스트가 공유 술어를 통해 대신 잡고 있을 뿐 |
| W4 | testing | `resumeDeferredStream` 의 no-op 가드도 근-등가 survivor 인데, 같은 뿌리의 `teardownSession` 쪽만 근거가 적혀 있다 |
| W5 | requirement | C1 과 같은 것(plan stale) |

## 이 라운드의 성격

**W1 은 내가 직전 라운드에서 만든 결함이다.** CRITICAL 을 고치면서 낙관적 클리어를 넣었고,
그 한 줄이 같은 고착을 다른 트리거로 되살렸다. 이 브랜치에서 **여섯 번째**로 반복된 형태 —
*고친 값·범위가 인접 표면을 보는지 확인하지 않았다.*

W3·W4 는 다른 각도의 같은 이야기다: **"한쪽만" 이 코드에서 두 번 잡힌 뒤 이번엔 테스트와
주석에서 재발했다.** 커버리지가 우연히 다른 파일에 기대고 있었고, 두 survivor 중 한쪽만
기록돼 있었다.

## RISK: HIGH
## CRITICAL_COUNT: 1
## WARNING_COUNT: 5
