# 요구사항(Requirement) 리뷰 — schedule-trigger e2e 「D. PATCH cron → nextRunAt 재계산」 flake 수정

## 발견사항

- **[WARNING]** "연 1회 cron 은 분 단위 cron 과 같은 시각을 가리킬 수 없다" / "겹칠 수 없는" 이라는 문서화된 절대 보장이 실제로는 완전히 참이 아니다 — 매년 마지막 1분(Dec 31 23:59:00~59.999 KST)에 창(create)이 호출되면 여전히 원래 결함과 같은 종류의 충돌(annual cron 의 다음 발화 = per-minute cron 의 다음 발화)이 재현될 수 있다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:286` (docstring "연 1회 cron 은 분 단위 cron 과 같은 시각을 가리킬 수 없다"), `:298` (`// 매년 1월 1일 — 분 단위 cron 과 겹칠 수 없다`), `plan/in-progress/schedule-cron-flake.md:32` ("연 1회 cron 과 같아질 수 없다")
  - 상세: `create()` 가 계산하는 `nextRunAt` 은 `CronExpressionParser.parse(cron, { tz, currentDate: new Date() }).next()` 로, 호출 시점(T_c) 기준 "다음 Jan 1 00:00:00 Asia/Seoul" 이다. T_c 가 그 해의 마지막 1분(23:59:00~59.999 KST) 안이면 이 값은 T_c 로부터 60초 이내다. 그리고 patch 시점(T_p, T_c 직후)의 `*/1 * * * *` 다음 발화도 T_p 기준 다음 분 경계 — 같은 1분 구간 안이면 두 값이 완전히 같아진다. 즉 이전 버그(1440분/일 창)를 1분/년 창으로 **줄였을 뿐, 문서가 주장하는 것처럼 원천적으로 "겹칠 수 없는" 것은 아니다**. `expect(patch.body.data.nextRunAt).not.toBe(originalNext)` (`:311`) 가 이 극히 드문 창에서 다시 거짓 실패할 수 있다.
  - 영향은 실질적으로 매우 낮다(연간 60초/525,600초, 약 0.00011%)— 이번 수정의 방향(daily → yearly 창 축소, 그리고 "새 cron 이 만드는 값인가" 라는 독립 판정 추가)은 명백히 개선이며 되돌릴 이유는 없다. 다만 docstring/plan 의 "겹칠 수 없다" 는 표현이 과장돼 있고, `:288-289` 의 "대리 지표가 무너져도 이쪽이 남는다" 라는 서술도 실제 구현과 어긋난다 — `not.toBe(originalNext)` (`:311`) 가 새 `nextRunMs` 단언(`:314-315`)보다 **먼저** 실행되고 실패 시 즉시 throw 하므로, 극단적으로 값이 같아지는 경우 뒤의 새 단언은 아예 실행되지 않고 테스트는 여전히 FAIL 한다. "대리 지표가 무너져도 이쪽이 남는다" 는 "이 창에서도 테스트가 통과한다" 는 의미가 아니라 "판별력이 이중화됐다" 는 설계 의도로 읽어야 하는데, 문장만 보면 오독 소지가 있다.
  - 제안: (a) docstring 의 "겹칠 수 없다" 를 "겹칠 확률이 무시할 수준으로 낮다(연 1회, 1분 창)" 정도로 정정하거나, (b) 완전히 닫으려면 `not.toBe(originalNext)` 를 제거하고 `nextRunMs` 범위 단언만 남긴다(둘 다 통과해야 한다는 현재 설계 의도와는 다소 배치되지만 위양성 창을 0으로 만든다). 코드 동작 자체를 바꿀 필요는 없다 — 문서화된 확신의 정도만 낮추면 된다.

- **[WARNING]** 새로 추가된 `nextRunMs` 상한 단언(`patchedAt + 65_000`)의 65초 예산 중 60초는 cron 분 경계 반올림 몫이고 나머지 5초만 "네트워크 왕복 + 서버 처리" 몫이다 — PATCH 요청·DB 갱신·트리거 config lock 획득(`update()` 의 `acquireTriggerConfigLock` 경로, `schedules.service.ts`)이 5초를 넘기면(도커 e2e 환경 부하·GC 등으로) 실제로는 정상 동작인데도 새 단언이 거짓 실패할 수 있다. 이 파일의 다른 시각 단언(A 케이스 `:112`)은 하한만 걸어(`Date.now() - 60_000`) 지연에 관대한 반면, 이번에 추가된 상한은 지연에 매우 민감하다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:312-315`
  - 상세: 이 작업의 목적 자체가 "하루 1분 창에서 거짓 실패"를 없애는 것인데, 그 자리에 "지연이 5초를 넘으면 거짓 실패"하는 새로운 종류의 타이밍 취약점을 들여왔다. 이 저장소의 e2e 이력(잦은 SIGSEGV·docker 자원 경합 — 같은 plan 체크리스트 `unit 1회차는 jest 워커 SIGSEGV`)을 보면 5초 여유가 상시 충분하다고 단정하기 어렵다.
  - 제안: 여유를 예컨대 15~30초로 넉넉히 키우거나(상한 판정의 취지는 "같은 분 경계 안"이 아니라 "새 cron 이 만드는 값"이므로 널널해도 판별력에 지장 없음), CI 관측치로 실제 왕복 지연 분포를 확인해 예산을 정한다.

- **[INFO]** spec fidelity — `spec/2-navigation/3-schedule.md` §2.2(타임존)·PATCH 표(§`/api/schedules/:id`)는 "cron/timezone 변경 시 `nextRunAt` 재계산" 이라는 상위 동작만 규정하고, 재계산 결과가 "요청 시각으로부터 몇 초 안" 이어야 하는지 같은 타이밍 세부는 명시하지 않는다. 이번 변경은 테스트 전용이고 spec 이 이 정밀도에 침묵하는 영역이라 spec 위반은 아니다(회색지대).

## 요약

`schedule-trigger.e2e-spec.ts` 「D. PATCH cron → nextRunAt 재계산」의 하루 1분 충돌 창(생성 cron `0 10 * * *` KST vs PATCH `*/1 * * * *` 가 09:59 KST 에 같은 값)을 없애기 위해 생성 cron 을 연 1회(`0 0 1 1 *`)로 바꾸고, 「다르다」 판정에 「새 cron 이 만드는 값인가(요청 시각 기준 65초 이내)」 판정을 더한 수정이다. 실제 서비스 코드(`schedules.service.ts` `computeNextRuns`/`update()`)를 직접 대조해 보면 재계산 로직 자체는 건드리지 않았고, 테스트 비교식만 정교화한 것이 맞다 — 방향은 타당하고 `plan/in-progress/schedule-cron-flake.md` 의 뮤턴트 검증(재계산 블록 삭제 시 RED, 옛 단언만 제거해도 새 단언이 단독으로 RED)도 설계 의도와 부합한다. 다만 (1) "연 1회 cron 은 분 단위 cron 과 절대 겹칠 수 없다" 는 문서화된 절대 보장이 매년 마지막 1분이라는 극히 드문 창에서는 여전히 깨질 수 있어 과장돼 있고, (2) 새로 추가한 상한 단언의 5초 지연 여유가 이 저장소의 e2e 인프라 불안정성 이력에 비해 타이트해 "플레이크를 없애려다 다른 타이밍 플레이크를 도입"할 잠재 위험이 있다. 둘 다 실질 발생 확률은 낮고 서비스 코드 결함은 아니므로 즉시 차단 사유는 아니지만, docstring 표현 완화 또는 상한 예산 확대를 권한다. Spec 은 이 정밀도에 침묵하므로 spec 불일치는 없다.

## 위험도
LOW
