# 요구사항(Requirement) 리뷰 — schedule-trigger e2e 「D. PATCH cron → nextRunAt 재계산」 flake 수정 (2라운드)

## 발견사항

- **[WARNING]** 1라운드 리뷰가 제안한 두 가지 해결책 중 "완전히 닫는" 쪽(옵션 b: `not.toBe(originalNext)` 를 제거하고 `nextRunMs` 범위 단언만 남긴다)을 택했다고 문서는 주장하지만, 실제로는 `not.toBe(originalNext)` 자리에 **동일한 위양성 창을 가진 새 비교**(`originalNext > patchedAt + 90_000`)를 대신 넣어, 없앴다고 주장한 연말 경계 플레이크가 형태만 바뀐 채 남아 있다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:320-323` (`expect(new Date(originalNext as string).getTime()).toBeGreaterThan(patchedAt + 90_000)`), JSDoc `:283-291`
  - 상세: 생성 cron `0 0 1 1 *`(Asia/Seoul)로 만든 스케줄을 patchedAt 직후(같은 요청 시퀀스 안, 초 단위 이내)에 `*/1 * * * *` 로 PATCH 한다. `originalNext` 는 "다음 1월 1일 00:00 KST"(T_target)로 고정된 값이다. 새로 추가된 마지막 단언은 `T_target > patchedAt + 90_000` 를 요구하는데, 이는 `patchedAt` 이 T_target 로부터 **90초 이내**(즉 매년 12/31 23:58:30~23:59:59.999 KST)에 캡처되면 조건과 무관하게 실패한다 — `nextRunMs` 가 실제로 올바르게 재계산됐는지와 **무관하게** `originalNext` 값 하나만으로 성립·실패가 갈리는 순수 wall-clock 비교이기 때문이다. 이는 1라운드에서 지적된 "연 1회 cron 도 분 단위 cron 과 겹치는 1분이 있다"는 바로 그 결함을 제거한 것이 아니라 **재도입**한 것이며, 창의 폭도 이전(구현상 초 단위 등가 비교, 실질 ~60초)보다 넓다(90초, W2 조치로 넣은 30초 여유가 그대로 이 비교의 상한에도 적용됐기 때문).
    또한 이 트레일링 단언은 자기모순적으로 **불필요**하다 — plan 문서(`schedule-cron-flake.md` "## 테스트")와 RESOLUTION.md 자신이 명시한 뮤턴트 검증 결과("같은 뮤턴트 + 옛 «다르다» 단언 제거 → 새 «1분 안» 단언 홀로 잡는다")가 이미 증명하듯, `computeNextRuns` 재계산 블록이 삭제되는 회귀는 `nextRunMs` 가 `patchedAt` 부근 창(`:317-318`)을 벗어나는 것만으로 충분히 잡힌다(고장 시 `nextRunMs === originalNext` 가 되어 몇 달~몇 년 뒤 값이 되므로 상한 단언이 이미 실패한다). 즉 `:320-323` 단언은 판별력을 더하지 않으면서 새로운(그리고 더 넓은) 위양성 창만 도입한다.
    JSDoc(`:289-291`)의 "겹치는 순간(12/31 23:59 KST 의 1분)에도 이 단언은 참이라 흔들리지 않는다"는 서술은 문법적으로 앞 문장의 "1분 안" 범위 단언(`:317-319`)만 가리키는 것으로 읽을 수 있으나, 바로 다음 줄(`:320-323`)에 그 안정성이 깨지는 새 단언이 이어져 있어 오독을 유발한다. RESOLUTION.md(`review/code/2026/09/20/11_54_10/RESOLUTION.md` W1 행)의 "고침 — 내 전제가 반증됐다 ... 그 단언을 뺐다"는 처분도 `not.toBe(originalNext)` 를 뺀 것은 맞지만 동형의 새 비교를 넣었다는 사실을 언급하지 않아 "완전히 해결됨"으로 읽히기 쉽다.
  - 제안: `:320-323` 단언을 제거한다(위에서 보인 대로 회귀 판별력은 `nextRunMs` 범위 단언만으로 충분하다는 것이 이미 자체 뮤턴트 검증으로 확인됐다). 혹은 그 판별 의도("PATCH 가 옛 값을 그대로 두었다")를 유지하고 싶다면 wall-clock 비교 대신 원인에 더 가까운 신호(예: 서비스 호출을 spy 해 `computeNextRuns` 가 새 cron 인자로 호출됐는지, 혹은 `nextRunMs !== new Date(originalNext).getTime()` 대신 `nextRunMs` 가 이미 통과한 범위 단언과 **논리적으로 상호배타**임을 근거로 별도 wall-clock 비교를 걸지 않는다).

- **[WARNING]** 트래커(`spec-draft-nullable-notation-followups.md`)가 이 항목을 `[x]`(완료)로 표시하고 "**2026-09-20 해소** `plan/complete/schedule-cron-flake.md`" 라고 인용하지만, 실제로 그 경로에는 파일이 없다 — 해당 plan 은 여전히 `plan/in-progress/schedule-cron-flake.md` 에 있고, 그 plan 자신의 체크리스트에도 `/ai-review` 수렴 · `--impl-done` · 트래커 해소·`plan/complete/` 이동이 아직 `[ ]`(미완료)로 남아 있다. 같은 트래커 파일의 다른 "해소" 인용 3건(`connection-test-codes-and-gaps.md`, `column-guard-gaps.md`, `ssrf-catch-instanceof.md`)은 모두 실재하는 `plan/complete/` 파일을 가리켜 이 항목만 관례에서 벗어난다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4954`(`- [x]` 로 바뀐 줄), `:4960-4962`("2026-09-20 해소" 인용); `plan/in-progress/schedule-cron-flake.md:56-58`(체크리스트 3건 미완료)
  - 상세: 이 리뷰가 도는 시점(`/ai-review` 수렴 이전)에 이미 "해소" 로 마킹·인용한 것은 시기상조다 — 이번 라운드에서 위 WARNING(트레일링 단언 잔존 플레이크)처럼 추가 조치가 필요하면 그 사이 링크를 따라간 독자는 존재하지 않는 파일을 만난다.
  - 제안: `--impl-done` 및 `plan/complete/` 이동이 실제로 끝난 뒤에 "해소" 표시·경로 인용을 확정한다. 그 전까지는 `[ ]` 유지하거나 "진행 중 — review 수렴 대기" 로 표기.

- **[INFO]** spec fidelity — `spec/data-flow/10-triggers.md` §1.4("Schedule cron/timezone 변경 → next_run_at 재계산")가 이 e2e 케이스가 검증하는 상위 동작의 SoT 다. 이 문서는 "재계산이 일어난다"만 규정하고 재계산 결과가 요청 시각으로부터 몇 초 안에 있어야 하는지 등 타이밍 세부는 침묵한다 — 이번 변경은 테스트 전용이고 이 정밀도에 spec 이 침묵하는 회색지대라 spec 위반은 아니다.

- **[INFO]** `getUTCSeconds() === 0`(`:319`) 검증은 초 단위까지만 보고 밀리초는 보지 않는다. cron 라이브러리가 분 경계를 항상 `.000` 로 반환한다는 전제하에 실무상 문제는 없으나, 완전성을 원한다면 `getUTCMilliseconds() === 0` 도 함께 확인할 수 있다. 우선순위는 낮다.

## 요약
1라운드 리뷰의 Warning 3건(연말 겹침 과장, 상한 여유 타이트, 인용 오류) 중 W2(여유 확대)·W3(인용 정정)는 정확히 조치됐다. 그러나 W1("연 1회 cron 이 겹칠 수 없다는 보장이 거짓")은 `not.toBe(originalNext)` 를 제거하며 형태는 바뀌었지만, 그 자리에 넣은 `originalNext > patchedAt + 90_000` 트레일링 단언이 **같은 종류의(오히려 더 넓은 90초 창의) 연말 경계 위양성**을 재도입한다 — 그리고 이 단언은 작성자 자신의 뮤턴트 검증 결과에 따르면 판별력에 기여하지도 않는다(회귀는 이미 앞선 `nextRunMs` 범위 단언 하나로 잡힌다). 실질 발생 확률은 연 90초/31,536,000초(약 0.00029%)로 극히 낮고 서비스 코드 결함은 아니므로 즉시 차단할 사안은 아니지만, "완전히 닫았다"는 RESOLUTION.md·JSDoc 의 설명과 실제 구현 사이에 괴리가 있어 다음에 이 파일을 만지는 사람이 잘못된 전제(이 잔존 창이 없다)로 출발하게 된다. 부수적으로 트래커의 "해소" 표기가 아직 존재하지 않는 `plan/complete/` 경로를 인용해 같은 문서의 다른 항목들과 관례가 어긋난다. 서비스 코드(`schedules.service.ts` 재계산 로직) 자체는 손대지 않았고 정상이며, spec(`data-flow/10-triggers.md` §1.4)이 규정하는 "cron 변경 시 재계산" 상위 동작과 테스트 의도는 일치한다.

## 위험도
LOW
