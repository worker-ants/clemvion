# 테스트(Testing) 리뷰 — schedule-cron-flake (4라운드 · 수렴 확인)

## 컨텍스트

1~3라운드 리뷰가 이미 같은 결함 클래스(생성 cron 과 PATCH 대상 cron 의 다음 실행이 우연히 같아지는 순간의 flake)를
세 형태로 추적했다 — 하루 1분(1라운드가 지적) → 옛 값 비교를 「창 밖」 단언으로 바꿨다가 연 1분으로 재발(2라운드가
지적, `b40b5b98f` 로 옛 값 비교 자체를 제거) → 방향이 반전된 잔여 약 연 2분 false GREEN 창(3라운드가 지적, `5d551ad73` 로
JSDoc·plan 정정 + 트래커 등재로 처분). 이번 라운드는 코드 재확인 + 신규 관점 스캔이다. 저장소는 읽기 전용으로만
사용했다 (`git status --short` 변화 없음, 뮤테이션 없음 — 서비스 코드의 재계산 블록(`schedules.service.ts:265-272`)
위치만 `grep`/`Read` 로 대조했고 실제로 지워보지는 않았다. 3라운드에 걸쳐 이미 e2e 실행으로 그 뮤턴트가 RED 를
내는 것을 반복 확인했다는 각 RESOLUTION 의 TEST 결과 기록을 근거로 삼았다).

## 발견사항

- **[INFO]** `SchedulesService.update()` 의 cron/timezone 변경 → `nextRunAt` 재계산 happy-path 에 결정적 **단위** 테스트가
  아직 없다 — e2e 케이스 하나(「D. PATCH cron」)에 전적으로 의존한다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (`update()` 관련 `describe` 블록 — 384행
    부근 `[방어 분기] 다음 실행 계산이 비면 nextRunAt 을 null 로 명시 대입한다` 케이스만 있고, `computeNextRuns` 가 정상
    값을 반환하는 happy-path 를 spy 로 고정하는 케이스는 없음을 직접 확인), `plan/in-progress/spec-draft-nullable-notation-followups.md`
    의 「cron 재계산 happy-path 의 결정적 단위 테스트가 없다」 항목
  - 상세: 이미 트래커에 developer 항목으로 등재돼 있고(1라운드 INFO 2 · 3라운드 WARNING 1 이 실측한 잔여 창까지 합쳐서
    기술됨), 이번 diff 의 신규 지적 사항이 아니다. 이 단위 테스트가 들어오면 아래 잔여 항목이 의미를 잃는다는 점도
    트래커·plan 양쪽에 이미 명시돼 있다.
  - 제안: 조치 불요 (재등재 금지) — 이미 정확한 설계(「`computeNextRuns` 를 spy 로 두고 새 cron 으로 호출됐는가 · 그
    결과가 `nextRunAt` 에 들어갔는가」)까지 등재돼 있다.

- **[INFO]** 남아 있는 반대 방향 잔여 창(연 1회 ~2분, 12/31 23:58:30~01/01 00:00:30 KST 근방)은 e2e 만으로는 구조적으로
  닫을 수 없다는 3라운드 결론이 여전히 유효하다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — `it('D. PATCH cron → nextRunAt 재계산', ...)` 케이스 본문의
    `expect(nextRunMs).toBeGreaterThan(patchedAt - 30_000)` / `toBeLessThanOrEqual(patchedAt + 90_000)` / `getUTCSeconds()` 세 단언
  - 상세: 판정이 순수 wall-clock 창(하한 -30s/상한 +90s + 초 자리 0)에만 의존하므로, 생성 cron(`0 0 1 1 *`)의 다음 실행값이
    우연히 그 창 안에 들어오는 순간에는 재계산이 전혀 일어나지 않는 실제 서비스 회귀도 통과한다(뮤턴트 이탈). 코드
    JSDoc(283-300행)이 이 잔여를 명시적으로 서술하고, 트래커 항목이 닫는 자리(`computeNextRuns` spy 단위 테스트)를
    지정해 뒀다 — 3라운드가 이미 "수렴 예외"로 처분한 사안이라 재차단 사유는 아니다.
  - 제안: 조치 불요 — 위 단위 테스트 백로그가 들어오기 전까지는 문서화된 기지(既知) 갭으로 유지.

- **[INFO]** D 케이스가 PATCH 로 등록한 매분(`*/1 * * * *`) cron 트리거를 테스트 종료 후 정리(DELETE)하지 않는다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — `it('D. PATCH cron → nextRunAt 재계산', ...)` 케이스 본문
    (스케줄 생성·PATCH 만 하고 삭제 호출 없음)
  - 상세: e2e 컨테이너 생존 기간 동안 계속 발화하는 기존 패턴이며 1~3라운드 모두 같은 처분(스코프 밖)을 내렸다. 이번
    diff 로 새로 생긴 문제가 아니다.
  - 제안: 조치 불요.

## 확인했으나 문제 없음 (재확인)

- `getUTCSeconds()` 로 분 경계를 판정해 호스트/컨테이너의 로컬 타임존에 무관하게 결정적이다 — 로컬 `getSeconds()` 를
  썼다면 서버 타임존에 따라 흔들릴 수 있었는데, 그 함정을 피했다.
- 다른 cron 케이스(C·E·F·G·H)는 값 비교(`not.toBe` 류)를 쓰지 않아 이번 diff 의 결함 클래스와 무관 — 회귀 없음. plan
  문서 "비대상" 절의 서술과 실제 코드가 일치한다.
- `uniqueName('sched-d')` 로 스케줄을 독립 생성해 다른 `it()` 상태에 의존하지 않는다 — 테스트 격리 양호.
- 1라운드 문서화 리뷰가 지적했던 「실측」 인용 오류(당시 `plan/complete/ssrf-catch-instanceof.md` 를 가리켰던 문제, W3)는
  현재 JSDoc(286-287행)에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` · `review/code/2026/09/20/09_35_16/RESOLUTION.md`
  로 정정된 채로 남아 있음을 직접 확인했다 — 재발 없음.
- 3라운드 W2/W3(JSDoc·인라인 주석이 반증된 「생성 cron 값은 창 밖」 전제를 계속 서술)는 현재 JSDoc 이 "거의 언제나 이
  창 밖이다" 로 낮추고 반대 방향 잔여를 그 자리에 적은 것으로 정정 확인됨 — 재발 없음.

## 회귀 테스트 유효성

D 케이스 자체는 위에 문서화된 좁은 연 2분 창을 제외하면 유효한 회귀 판별력을 갖는다(서비스의 재계산 블록 삭제 뮤턴트가
통상 시각에는 확실히 걸림 — 3라운드까지 e2e 실행으로 반복 확인됨). 다른 케이스는 이번 diff 로 영향받지 않는다.

## 요약

4라운드에 걸친 수정 이력을 재확인한 결과, 이번 diff 의 실제 코드 변경(`schedule-trigger.e2e-spec.ts` D 케이스)에서
새로 발견되는 Critical/Warning 급 테스트 결함은 없다. 세 라운드 동안 지적된 결함 클래스(비교 대상이 우연히 겹치는
순간의 flake)는 형태를 바꿔 가며 반복 재발했지만, 이번 diff 가 반영하는 최종 형태(옛 값 비교 완전 제거 + wall-clock
창 + 분 경계 검증)는 거짓 실패(false RED) 경로를 확실히 닫았고, 남은 반대 방향의 거짓 통과(false GREEN) 창은 연 1회
약 2분으로 극히 좁으며 JSDoc·plan·트래커 세 곳 모두에 정합적으로 기록·등재돼 있어 은폐된 갭이 아니다. 그 잔여를
구조적으로 닫는 자리(`computeNextRuns` spy 기반 단위 테스트)도 이미 백로그에 구체적으로 명시돼 있다. 테스트 격리·
가독성·기존 회귀 테스트와의 정합성 모두 양호하다.

## 위험도

LOW — 실제 코드 결함은 없으나, 문서화·등재된 채로 남아 있는 연 1회 ~2분 규모의 e2e 판별력 갭(구조적으로 e2e 로는
닫을 수 없고 별도 단위 테스트가 필요) 자체는 여전히 실재하는 잔여이기 때문에 NONE 이 아니라 LOW 로 유지한다.
