# Testing Review — schedule-trigger 「D. PATCH cron → nextRunAt 재계산」 (3라운드)

## 컨텍스트

1·2라운드 리뷰가 이미 「달라졌다」 대리 지표 문제(1라운드)와 그 조치가 재도입한 옛 값 비교 창(2라운드, `originalNext > patchedAt + 90_000`)을 잡아 `b40b5b98f` 로 옛 값 비교를 통째로 제거했다. 현재 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 296~327행(`it('D. PATCH cron → nextRunAt 재계산' ...)`)의 판정은 **옛 값과 무관하게** "PATCH 응답의 `nextRunAt` 이 요청 시점부터 1분 안(하한 -30s/상한 +90s)이고 초 자리가 0인가" 하나로만 이루어진다. 이 형태 자체는 1·2라운드가 반복 지적한 "겹치는 순간에 거짓 실패한다"는 문제(false RED)는 제거했다.

## 발견사항

- **[WARNING]** 옛 값 비교를 제거한 것으로 연말 겹침 문제가 "판정에서 빠졌다"는 1라운드 RESOLUTION의 결론이 반증된다 — 겹침은 사라지지 않았고 **방향이 뒤집혀 잔존**한다(false RED → 뮤턴트 이탈/false GREEN).
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:290`(JSDoc "재계산이 아예 없었다면 값은 생성 cron 의 것 ... 이 창 밖으로 떨어진다" 주장), `:296-321`(`it('D. PATCH cron → nextRunAt 재계산')` 본문, 특히 하한/상한 단언 `:319-320`)
  - 상세: 생성 cron 은 `'0 0 1 1 *'`(Asia/Seoul) — 다음 실행값 `V`(다음 1/1 00:00 KST, 초·밀리초 0)는 테스트 시작 시점에 **고정**된다. 재계산이 통째로 빠진 뮤턴트(서비스 `update()` 의 267~272행 recalculation 블록 삭제)라면 PATCH 응답의 `nextRunAt` 은 그대로 `V` 다. 현재 단언은 `nextRunMs ∈ (patchedAt - 30_000, patchedAt + 90_000]` 와 `getUTCSeconds() === 0` 뿐이다. `V` 자체가 초=0 인 값이므로 두 번째 단언은 전혀 걸러내지 못하고, 만약 실제 테스트 실행 시각(`patchedAt`)이 `V` 기준 `[V - 90_000, V + 30_000)` 구간 — 즉 **매년 KST 12/31 23:58:30 근방부터 익년 00:00:30 근방까지 약 2분** — 안이면, 재계산이 전혀 일어나지 않아도(즉 서비스가 고장난 상태에서도) 위 단언이 전부 통과한다. 구체 예: 테스트 실행 시각이 2026-12-31 23:59:00 KST 라면 `V` = 2027-01-01 00:00:00 KST = `patchedAt + 60_000`으로, 상한 `patchedAt + 90_000` 안에 정확히 들어간다. 즉 이 케이스는 "매일 1분"(1라운드가 고친 것)·"연 1분"(2라운드가 고친 것)에 이어 **"연 2분" 규모로 형태를 바꿔 살아남은 같은 결함 클래스**다 — 다만 이번엔 거짓 실패가 아니라 회귀를 놓치는 거짓 성공이라 방향이 다르고, 발생 확률이 더 낮은 대신 놓쳤을 때의 대가(실제 회귀 은폐)는 더 크다.
  - 1라운드 RESOLUTION(`review/code/2026/09/20/11_54_10/RESOLUTION.md` INFO 3)은 "W1 조치로 그 경계가 판정에서 빠졌다(대리 지표를 제거했으므로 재현 대상이 사라졌다)"고 적어 연말 경계 fake-timer 재현을 명시적으로 보류했는데, 이 근거가 이번 조치(2라운드) 이후 형태에는 더 이상 성립하지 않는다 — "대리 지표(옛 값)를 제거"했지만 "새 지표(1분 창)" 자체가 여전히 연 1회 값과 우연히 겹칠 수 있다.
  - 제안: 근본적으로 wall-clock 창 비교로는 "새 cron 이 만드는 값"과 "생성 cron 이 우연히 창 안에 들어온 값"을 완전히 구분할 수 없다 — 트래커에 이미 등재된 백로그 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md:4933-4937`, `computeNextRuns` spy 기반 단위 테스트)이 이 e2e 케이스보다 더 정확한 판별 수단이다. e2e 를 유지하려면 (a) `jest.useFakeTimers().setSystemTime(...)`로 연말 경계를 직접 재현해 뮤턴트가 실제로 잡히는지 확인하거나, (b) 생성 cron 을 초까지 어긋나게(예: 존재하지 않는 2/29 같은 조합 대신 실제로 "가장 가까운 다음 실행이 최소 몇 시간 이상 남는" 것을 코드로 보장하는 헬퍼로 교체하거나, (c) 최소한 JSDoc `:290` 의 "이 창 밖으로 떨어진다"는 절대 진술을 "거의 항상"으로 낮추고 이 잔존 창을 명시적으로 기록해, 다음 라운드가 또 "판정에서 빠졌다"고 오판하지 않게 한다.

- **[INFO]** (이미 트래커 등재, 재등재 아님) `SchedulesService.update()` 의 cron/timezone 변경 → `nextRunAt` 재계산 경로에 결정적 **단위** 테스트가 없다 — `schedules.service.spec.ts:384` 부근은 `computeNextRuns` 를 `[]` 로 mock 하는 방어 분기만 고정하고, happy-path 는 이 e2e 케이스 하나에 전적으로 의존한다. `plan/in-progress/spec-draft-nullable-notation-followups.md:4933-4937` 에 이미 개발자 항목으로 등재돼 있어 이번 라운드에서 새로 조치할 필요는 없지만, 위 WARNING 이 지적하는 "e2e 만으로는 연말 경계에서 판별력이 없다"는 정확히 이 백로그 항목이 메꿀 구멍이다 — 두 항목을 별개로 두지 말고 백로그 설명에 "e2e 의 잔존 판별력 갭을 메운다"는 문장을 추가하는 것을 고려.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (happy-path 부재), `plan/in-progress/spec-draft-nullable-notation-followups.md:4933-4937`(등재 항목)

- **[INFO]** 이번 조치 자체(옛 값 비교 제거)는 RESOLUTION 이 주장하는 대로 "재계산이 없으면 값이 창 밖으로 떨어진다"는 뮤턴트를 여전히 대부분의 시각에서 정확히 잡는다 — `codebase/backend/src/modules/schedules/schedules.service.ts:265-273` 의 recalculation 블록을 삭제하는 뮤턴트를 통상 시각에 적용하면 `nextRunMs` 가 생성 cron 값(수개월 뒤)이 되어 상한 단언(`:320`)에서 확실히 걸린다. 위 WARNING 은 "항상"이 아니라 "연 1회 약 2분 창에서만" 실패한다는 정정이다 — 전체 위험도를 크게 올릴 사안은 아니다.

## 회귀 테스트 유효성

같은 파일의 다른 cron 케이스(C·E·F·G·H — 값 비교가 아닌 202/200/필드 존재만 확인)는 이번 diff 로 영향받지 않으며, plan 문서(`plan/in-progress/schedule-cron-flake.md` "비대상" 절)의 "겹침이 성립하지 않는다"는 설명도 그 케이스들에는 여전히 유효하다. D 케이스 자체의 회귀 판별력은 위 WARNING 의 좁은 연말 창을 제외하면 유효하다.

## 요약

3라운드에 걸쳐 「D. PATCH cron」 케이스의 flake 원인(옛 값과의 비교가 두 cron 의 다음 실행이 우연히 같아지는 순간 거짓 실패한다)을 제거하려는 시도는 매번 형태만 바뀐 같은 겹침 문제를 재도입해 왔다(하루 1분 → 연 1분 → 이번 라운드의 잔존 형태). 이번 2라운드 조치(`b40b5b98f`, 옛 값 비교 완전 제거)는 지금까지 지적된 **거짓 실패(false RED)** 경로는 확실히 닫았지만, 그 대가로 판정이 순수 wall-clock 창(생성 cron 의 다음 실행값과 우연히 겹칠 수 있는 연 1회 ~2분 구간)에만 의존하게 되어 그 좁은 구간에서는 반대 방향의 문제 — 재계산이 전혀 일어나지 않는 실제 회귀를 놓치는 **뮤턴트 이탈(false GREEN)** — 가 남는다. 발생 확률은 극히 낮지만(연 1회, 약 2분), 1라운드 RESOLUTION 이 "그 경계가 판정에서 빠졌다"고 명시적으로 결론지은 것과 배치되는 실측 가능한 반증이라 문서 정정 또는 재설계가 필요하다. 그 외 나머지 부분 — JSDoc 의 서술 품질, 격리, 가독성, 기존 회귀 테스트와의 정합성 — 은 양호하며, cron 재계산 happy-path 단위 테스트 부재는 이미 백로그에 등재돼 있어 이번 라운드의 새 지적 사항이 아니다. 리포지토리 파일은 이 리뷰 중 수정하지 않았다(`git status --short` 확인, untracked 리뷰 산출물 디렉터리만 존재).

## 위험도

LOW
