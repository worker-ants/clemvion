# 테스트(Testing) 리뷰 — schedule-cron-flake (5라운드 재확인)

## 컨텍스트

이 changeset 은 1~4라운드(`review/code/2026/09/20/{11_54_10,12_17_18,12_45_31,13_12_35}`)를 거쳐 이미 수렴이
선언된 작업이다(`13_12_35/RESOLUTION.md`: "4라운드는 검증 라운드로 그 결과와 무관하게 수렴", `plan/complete/schedule-cron-flake.md`
체크리스트 전항 `[x]`). `git status --short` 로 확인한 결과 이 세션의 출력 디렉터리 외에 저장소에 미커밋 변경은 없고,
실제 코드(`codebase/backend/test/schedule-trigger.e2e-spec.ts` 296~327행 부근, `it('D. PATCH cron → nextRunAt 재계산', ...)`)를
직접 열어 프롬프트의 diff·4라운드 리뷰가 서술한 최종 형태와 바이트 단위로 일치함을 확인했다(라운드4 W1 조치 `568fd2ecd` 의
전체 경로 인용까지 반영됨). 즉 이번 라운드가 보는 코드는 4라운드가 "종결" 로 처분한 것과 **동일**하다. 뮤테이션은 하지
않았다(읽기 전용 `Read`/`grep` 만 사용, `schedules.service.spec.ts` 도 실제 delete 없이 대조만 했다).

## 발견사항

새로 발견되는 Critical/Warning 급 테스트 결함은 없다. 1~4라운드가 이미 실측·처분한 항목을 재확인한 결과는 아래와 같다.

- **[INFO]** (기존 발견 재확인, 조치 불요) 반대 방향의 좁은 거짓-통과 창이 구조적으로 남아 있다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — `it('D. PATCH cron → nextRunAt 재계산', ...)` 본문의
    `expect(nextRunMs).toBeGreaterThan(patchedAt - 30_000)` / `toBeLessThanOrEqual(patchedAt + 90_000)` /
    `expect(new Date(nextRunMs).getUTCSeconds()).toBe(0)` 세 단언
  - 상세: 판정이 순수 wall-clock 창(하한 -30s/상한 +90s + 분 경계)에만 의존하므로, 생성 cron(`'0 0 1 1 *'`)의 다음
    실행값이 우연히 그 창 안에 들어오는 매년 약 2분(12/31 23:58:30~01/01 00:00:30 KST 근방)에는 재계산이 전혀
    일어나지 않는 실제 회귀도 통과한다(false GREEN, 뮤턴트 이탈). 3·4라운드가 이미 이 값을 실측하고, JSDoc(283~299행)·
    `plan/complete/schedule-cron-flake.md`·트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`
    「cron 재계산 happy-path 의 결정적 단위 테스트」 항목) 세 곳 모두에 정합적으로 기록·등재된 것을 직접 대조해 확인했다.
    e2e 는 실 서버 시각을 쓰므로 구조적으로 닫을 수 없고, 닫는 자리는 `computeNextRuns` 를 spy 로 보는 단위 테스트라는
    처분도 여전히 타당하다.
  - 제안: 조치 불요(재-flag 아님) — 트래커 항목이 이미 정확한 설계까지 명시하고 있다.

- **[INFO]** (기존 발견 재확인, 조치 불요) `SchedulesService.update()` 의 cron 재계산 happy-path 에 결정적 단위 테스트가
  없다 — `schedules.service.spec.ts:379-403` 부근은 `computeNextRuns` 를 `[]` 로 mock 하는 **방어 분기**(도달 불가능하다고
  스스로 주석에 적혀 있음)만 고정하고, 정상 값을 반환하는 happy-path 를 spy 로 보는 케이스는 없음을 직접 grep/Read 로
  재확인했다. 이 e2e 케이스 하나가 그 경로의 유일한 회귀 방어선이다. 이미 트래커에 등재돼 있어 이번 라운드의 신규
  지적이 아니다.

- **[INFO]** (기존 발견 재확인, 조치 불요) D 케이스가 PATCH 로 등록한 매분(`*/1 * * * *`) 트리거를 테스트 종료 후
  정리(DELETE)하지 않는다 — 같은 파일의 기존 패턴이며 1~4라운드 모두 스코프 밖으로 처분했다.

## 확인했으나 문제 없음

- **테스트 격리**: `uniqueName('sched-d')` 로 스케줄을 독립 생성해 다른 `it()` 상태·실행 순서에 의존하지 않는다. 같은
  파일의 다른 cron 케이스(C·E·F·G·H)는 값 비교(`not.toBe` 류)를 쓰지 않아 이번 결함 클래스와 무관 — 회귀 없음.
- **분 경계 판정의 결정성**: `getUTCSeconds()` 로 판정해 호스트/컨테이너 로컬 타임존에 무관하다. 로컬 `getSeconds()` 를
  썼다면 서버 타임존 설정에 따라 흔들릴 수 있었던 함정을 피했다.
- **Mock 적절성**: 이 e2e 테스트 자체는 mock/stub 을 쓰지 않는 실 서버 통합 테스트라 "실제 동작과의 괴리" 관점의
  리스크가 없다. 서비스 단위 테스트(`schedules.service.spec.ts`)의 `computeNextRuns` mock 은 방어 분기 전용으로
  범위가 정확히 라벨링돼 있다.
- **회귀 테스트 유효성**: 서비스의 재계산 블록(`schedules.service.ts` 의 `update()` cron/timezone 분기)을 삭제하는
  뮤턴트는 통상 시각에는 확실히 걸린다(1~4라운드 각 `RESOLUTION.md` TEST 결과에 e2e 재실행 + 뮤턴트 RED 재확인이
  반복 기록돼 있다) — 이번 라운드는 코드가 그때와 동일함을 대조 확인했을 뿐 재실행은 하지 않았다.
- **가독성**: JSDoc(283~299행)이 "무엇이 문제였는지 → 왜 대리 지표가 무너지는지 → 무엇을 대신 보는지 → 남는 잔여가
  무엇인지"를 실측 인용(전체 경로)과 함께 순서대로 서술해 의도가 명확하다.
- **테스트 용이성**: `SchedulesService` 가 시각을 직접 `new Date()`/`Date.now()` 로 읽는 대신 클록을 주입받는 구조였다면
  이 e2e 자체가 필요 없이 단위 테스트로 연말 경계까지 결정적으로 재현할 수 있었을 것이다 — 다만 이는 이번 diff 의
  범위를 벗어나는 설계 변경이고, 트래커의 `computeNextRuns` spy 항목이 사실상 이 방향의 최소 조치를 이미 담고 있다.

## 요약

이번 changeset(codebase 실질 변경은 `schedule-trigger.e2e-spec.ts` 「D. PATCH cron」 케이스 한 곳)은 1~4라운드에
걸쳐 같은 결함 클래스(생성 cron 과 PATCH 대상 cron 의 다음 실행이 우연히 같아지는 순간의 flake)를 하루 1분 → 연
1분 → 연 90초 순으로 세 번 좁혔고, 4라운드가 "종결" 로 처분한 최종 형태(옛 값 비교 완전 제거 + wall-clock 창 +
분 경계 검증)를 직접 코드에서 재확인했다. 이번 5라운드에서 코드는 4라운드 이후 변경되지 않았고, 새로 발견되는
Critical/Warning 급 테스트 결함은 없다. 남아 있는 유일한 잔여(연 1회 약 2분의 구조적 false-GREEN 창)는 이미 JSDoc·
plan·트래커 세 곳에 정합적으로 기록·등재돼 있고 은폐된 갭이 아니므로 이번 라운드의 재지적 대상이 아니다. 테스트
격리·가독성·기존 회귀 테스트 유효성 모두 양호하다.

## 위험도

LOW — 실제 코드 결함은 없으나, 문서화·등재된 채로 남아 있는 연 1회 ~2분 규모의 e2e 판별력 갭(구조적으로 e2e 로는
닫을 수 없고 별도 단위 테스트가 필요) 자체는 여전히 실재하는 잔여이기 때문에 NONE 이 아니라 LOW 로 유지한다.
