# 테스트(Testing) 리뷰 — schedule-cron-flake

## 발견사항

- **[WARNING]** 새 cron 값(`0 0 1 1 *`)도 이론적으로는 PATCH 대상 cron(`*/1 * * * *`)과 **같은 순간을 가리킬 수 있다** — "겹칠 수 없다"는 주석/plan 서술이 절대적으로 참은 아니다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:286` (JSDoc "연 1회 cron 은 분 단위 cron 과 같은 시각을 가리킬 수 없다"), `:298` (인라인 주석 "매년 1월 1일 — 분 단위 cron 과 겹칠 수 없다"), `:311` (유지된 `not.toBe(originalNext)`)
  - 상세: `*/1 * * * *` 는 **모든** 분 경계를 매치하는 cron이다. 따라서 그 어떤 고정 시각 cron(`0 0 1 1 *` 포함)도, PATCH 처리 시각이 그 고정 시각의 "직전 1분" 안(= Asia/Seoul 기준 12/31 23:59:00.000~23:59:59.999)에 들어오면, PATCH 후 재계산된 `nextRunAt`(다음 분 경계 = 1/1 00:00:00 KST)이 PATCH 전 `originalNext`(역시 다음 1/1 00:00:00 KST)와 **정확히 같아진다**. 이는 이번 수정이 고치려는 버그(매일 09:59 KST 창)와 **같은 메커니즘**이며, 발생 빈도만 하루 1/1440 → 연 1/525600 로 낮아졌을 뿐 구조적으로 사라진 것은 아니다. 그 순간에 테스트가 돌면, 새로 추가한 "1분 이내" 단언(313~315행)은 우연히 통과하지만 **유지된** `not.toBe(originalNext)`(311행)이 실패해 동일 계열의 거짓 실패가 재발한다.
  - 제안: (a) JSDoc/인라인 주석의 "가리킬 수 없다"를 "거의 항상 겹치지 않는다(연 1분 창 잔존, 무시 가능한 수준)"로 정정하거나, (b) 311행의 `not.toBe(originalNext)`가 이제 새 "1분 이내" 단언(313~315행)에 포섭되는 약한 중복 신호임을 인지하고 — 어차피 새 단언이 재계산 미실행(뮤턴트 1)을 이미 잡으므로 — 잔존 창의 유일한 발화 지점인 311행을 제거하거나 조건부(연말 근접 시 skip)로 완화하는 것을 검토. plan 문서(`plan/in-progress/schedule-cron-flake.md`)의 "창이 사라졌으므로 «다르다»도 그대로 둔다"는 서술도 같은 이유로 부정확하다.

- **[INFO]** 새 "1분 이내" 단언이 결과값의 **정합성**(정확히 분 경계인지)까지는 검증하지 않아 커버리지가 다소 느슨하다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:313-315`
  - 상세: `expect(nextRunMs).toBeGreaterThan(patchedAt - 5_000)` / `toBeLessThanOrEqual(patchedAt + 65_000)` 는 "대략 1분 근방의 아무 값"이면 통과한다. 만약 재계산 로직이 `*/1 * * * *`를 잘못 해석해 예컨대 "PATCH 시각 + 30초"(분 경계가 아닌 임의 시각)를 반환하는 버그가 있어도 이 범위 단언은 통과한다 — cron이 실제로 만드는 값의 **형태**(초 단위가 `:00`)까지는 판별하지 못한다.
  - 제안: `expect(new Date(nextRunMs).getSeconds()).toBe(0)` (필요하면 밀리초도) 를 추가해 "새 cron이 만드는 값"이라는 원래 의도를 더 정확히 판별하게 한다.

- **[INFO]** `update()`의 cron 변경 → `nextRunAt` 재계산 "정상 경로"(null이 아닌 실제 값 산출)를 단위 테스트가 직접 커버하지 않고, 이 e2e 하나에 전적으로 의존한다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:384` (기존 단위 테스트는 `computeNextRuns`를 `[]`로 mock 하는 **방어 분기**만 고정 — happy path 는 다루지 않음). 대응 e2e: `codebase/backend/test/schedule-trigger.e2e-spec.ts:291`(`it('D. PATCH cron → nextRunAt 재계산' ...)`)
  - 상세: 이번 수정 자체는 스코프상 정당(plan의 "비대상"에 서비스 코드 변경은 없음)하지만, 근본적으로 이 e2e가 실제 벽시계에 의존해 타이밍 산수를 검증하는 구조라 위 WARNING류의 잔존 엣지가 계속 남는다. `schedules.service.spec.ts`에는 이미 `computeNextRuns`를 spyOn 하는 패턴이 있으므로(384행), 같은 패턴으로 "cron 변경 시 mock 된 `computeNextRuns` 반환값이 그대로 `nextRunAt`에 대입된다"는 happy-path 단위 테스트를 추가하면, 벽시계와 무관하게 재계산 로직 자체를 결정적으로 고정할 수 있다.
  - 제안: (선택, 이번 PR 스코프 밖) 후속 항목으로 `schedules.service.spec.ts`에 결정적 happy-path 단위 테스트 추가를 백로그에 남길 것.

- **[INFO]** `plan/in-progress/schedule-cron-flake.md` §테스트의 "뮤턴트 둘 다 RED" 검증은 이 fix의 핵심 시나리오(재계산 블록 삭제)만 다루고, 위 WARNING의 잔존 엣지 케이스(연말 경계 충돌)는 뮤테이션·시각 mock 어느 쪽으로도 검증되지 않았다.
  - 위치: `plan/in-progress/schedule-cron-flake.md` "## 테스트" 절, "## 할 것" 1번 항목("절대 겹칠 수 없는 값")
  - 상세: "절대 겹칠 수 없는"이라는 설계 근거는 실측/뮤턴트로 반증되지 않은 채 채택됐다. `jest.useFakeTimers().setSystemTime('...12-31T14:59:30Z')` 류로 이 경계를 직접 재현해 보면 위 WARNING이 실측으로 확인될 것이다.
  - 제안: 시간이 허락하면 fake timer 기반 재현으로 실측 후 문서 정정. 급하지 않으면 위 WARNING 코멘트로 대체 가능.

이 외 항목은 통과:
- **Mock 적절성**: e2e 특성상 mock 없이 실제 API·DB를 사용 — 적절하다.
- **테스트 격리**: `uniqueName('sched-d')`로 스케줄을 독립 생성하고 다른 `it()`의 상태에 의존하지 않는다. `E` 케이스도 같은 `0 0 1 1 *` 값을 UTC로 쓰지만 별도 리소스라 충돌 없음.
- **가독성**: JSDoc이 종전 버그의 실측 근거·수정 의도(대리 지표 vs 실제 판별 조건)를 상세히 남겨 의도 전달이 명확하다.
- **회귀 유효성**: 변경 후에도 `not.toBe(originalNext)`는 (위 WARNING의 희귀 창을 제외하면) 계속 유효하고, `assertMatchesContract`/`expectNarrowedScheduleTriggerRef` 등 기존 계약 단언은 그대로 보존됐다.
- **테스트 용이성**: `patchedAt`을 요청 직전에 캡처해 하한 경계로 쓰는 방식은 적절한 구조. 서비스 쪽에 별도 훅 없이도 클라이언트 시각 기준으로 검증 가능하게 설계됐다.

## 요약

이번 변경은 실제로 관측된 하루 1분 창의 거짓 실패(09:59 KST)를 없애는 데는 유효하고, plan 문서가 요구한 뮤턴트 판별력도 이 시나리오에 한해 확보했다. 다만 "생성 cron이 분 단위 cron과 절대 겹칠 수 없다"는 근거는 완전히 참이 아니다 — `*/1 * * * *`는 모든 분 경계를 매치하므로 어떤 고정 시각 cron이든 그 시각 "직전 1분"에 PATCH가 발생하면 여전히 같은 값으로 귀결되는 구조적 잔존 창이 있다(빈도는 하루 1회 → 연 1회 수준으로 극히 낮아졌을 뿐). 이 잔존 창의 유일한 발화 지점은 새로 추가된 "1분 이내" 단언이 아니라 **그대로 남겨둔 옛 `not.toBe(originalNext)`** 단언이다. 실무적으로는 무시 가능한 확률이지만, 문서의 "겹칠 수 없다"는 절대적 표현은 다음 사람의 판단 기준을 오도할 수 있어 정정을 권한다. 그 외에는 mock 없는 e2e 구조에 적합하고, 테스트 격리·가독성·회귀 유효성 모두 양호하다. 부가적으로, 이 재계산 로직의 happy path를 결정적으로 고정하는 단위 테스트가 없어 이 e2e가 유일한 커버리지원이라는 점도 후속 개선 여지로 남는다.

## 위험도

LOW
