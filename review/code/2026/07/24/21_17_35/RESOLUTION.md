# RESOLUTION — review/code/2026/07/24/21_17_35 (2R, fix 커버)

대상: 1R(`20_36_21`) 조치 이후의 fresh review. **CRITICAL 0 · WARNING 2 · RISK MEDIUM**.

## 조치 항목

| # | 카테고리 | 판정 | 조치 |
|---|---|---|---|
| W1 | requirement/testing/documentation (**3인 수렴**) | **타당 — 내 잘못. 정정** | 1R RESOLUTION §C1 의 기전 인용(`:313` guarded UPDATE)이 틀렸다. §7.5 resume-claim 전용 sentinel 이라 이 선형 경로에 해당 없음. e2e JSDoc 의 `throwIfAborted()` 인용도 동일하게 부적용(`abortSignal` 은 parallel 전용). **양쪽 모두 "기전 미확인, 결과만 반복 검증됨" 으로 정직하게 격하**하고, 엔진 단위 테스트로 고정하는 항목을 `node-cancellation-residual-signal-propagation.md` 에 추가 |
| W2 | maintainability | **타당 → 수정** | terminal 대기 폴링 3곳을 `waitForTerminalStatus()` 로 추출 (`waitForNodeRunning` 과 대칭) |
| I1~I11 | 각종 | 확인 | 대부분 "조치 불요". I11(하네스 티켓 번들링)은 §범위 참고 |

## W1 — 내가 틀렸던 지점 (기록해 둘 값어치가 있음)

1R 에서 CRITICAL 을 반증하며 "guarded UPDATE 가 기전" 이라고 적었는데, **주석 grep 한 줄로
단정**한 것이었다. 이 세션이 §H·§K·§L 에서 반복해서 경계한 실수를, 하필 "반증" 을 주장하는
문단에서 저질렀다. reviewer 3명이 독립적으로 같은 결론에 수렴해 잡아냈다.

**정정 후 남는 사실관계**(축소되지 않음):
- CRITICAL 의 구체적 예측("B 가 completed 로 끝나 테스트가 실패한다")은 **여전히 반증**이다
  — 3회 재현 + 더 엄격한 허용집합 단언에서도 PASS.
- 대조군(stop 생략 시 B `completed`)은 **취소가 하류의 운명을 바꾼다**는 통제된 관측이다.
- 그러나 이것이 "설계된 기전으로 보장된다" 를 뜻하지는 **않는다**. 그 구분을 e2e JSDoc·
  1R RESOLUTION·신규 plan 세 곳에 명시했다.

## 범위 (I11)

`harness-push-gate-did-not-fire.md` 가 "별도 티켓" 을 자칭하면서 같은 브랜치에 실려 있다는
지적은 타당하다. 다만 **문서 1건이고 코드 변경이 없으며**, 그 티켓이 요구하는 실제 조사·수정은
별도 worktree 에서 진행할 것이라 실질 위험이 없다고 판단해 이번 PR 에 남긴다.

## TEST 결과

- lint: **PASS** · unit: **PASS**(14) · build: **PASS**(직전 라운드)
- e2e: **PASS** — 259. 본 spec `PASS test/node-cancellation-propagation.e2e-spec.ts` 로그 직접 확인.

## 수렴 판단

CRITICAL 0 이고 본 라운드 조치는 (a) 문서/주석 정직성 정정 (b) 테스트 헬퍼 추출뿐이다.
프로덕션 코드 변경 0. 3라운드째 리뷰는 같은 INFO 를 재수집할 뿐이라 **여기서 수렴**한다
(저장소 관행: Critical 0 + 코드 변경 0 이면 doc-루프 금지).

## 보류·후속 항목

- **기전 규명** → `node-cancellation-residual-signal-propagation.md` 에 항목 추가(엔진 단위 테스트)
- WS 이벤트(`execution.node.cancelled`) 검증 · 노드 A 자신의 최종 상태 단언 · 매직넘버/변수명
  정리 등 INFO 는 우선순위 낮음으로 미조치
