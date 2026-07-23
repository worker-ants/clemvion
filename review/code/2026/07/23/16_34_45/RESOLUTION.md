# RESOLUTION — review/code/2026/07/23/16_34_45

대상: branch `claude/presentation-previousoutput-spec-drift-e74b2f` (base `origin/main`).
리뷰 시점 마지막 커밋 `df8325862`.

판정: **RISK=LOW / CRITICAL=0 / WARNING=1 / INFO=2**. forced 2/2 확보, 디스크 리포트 대조 누락 0.
`summary_written=false` 라 main 이 SUMMARY.md 직접 기록.

## 1차 CRITICAL 2건 — 해소 재확인

2차 리뷰가 코드 실측으로 재검증했다: `4-form.md:260-264` · `form.md:77-79` 모두 "완전한 금지 필드"
로 정정됐고 `form-interaction.service.ts` 의 `previousOutput` grep 0건과 일치. `0-common.md` 신설
"적용 범위 — `config.buttons` 노드 전용, Form 은 해당 없음" 캐비어도 `buildResumedStructuredOutput`
실동작과 일치 확인.

## WARNING 1 (반영) — 내 1차 조치가 불완전했다

| 지적 | 조치 |
|---|---|
| `README.md:263` 을 "반영 완료" 로 표기했으나 실제로는 **형태만 바뀐 채 미해결**. `previousOutput` 을 "폐기" **열거 목록에 그대로 둔 채** 뒤에 예외 문장만 덧붙여, 인라인 병치가 별도 문장으로 옮겨갔을 뿐 같은 논리적 역전이 남았다. `chart.md`/`form.md` 는 목록에서 **완전히 제거**했는데 README 만 최소 조치였다 | **반영** — 열거 목록에서 `output.previousOutput` 폐기 문구를 **실제로 제거**하고, 예외를 독립 blockquote 각주로 완전 분리(`chart.md`/`form.md` 와 동일 패턴). 잔존 확인: 열거 라인의 `previousOutput` 매치 **0건** |
| 권고 2 — 1차 `RESOLUTION.md` 의 "반영 완료" 표기 재검증 | **반영** — 1차 RESOLUTION 의 WARNING 1 행을 "1차 조치는 불완전, 2차가 재지적해 최종 해소" 로 정정. 과대 표기를 남겨두지 않는다 |

## INFO 2건

- INFO 1 — 위 WARNING 과 동일 지점의 완화 관측. WARNING 조치로 함께 해소.
- INFO 2 — "transitional legacy" 용어 표기 흔들림. **미조치**(1·2차 리뷰어 모두 "조치 불요, SoT
  anchor 로 값 도메인 일원화" 판정).

## 검증

- docs 가드 **18 files / 2658 passed** (`spec-link-integrity` 포함).
- `README.md:263` 열거 라인 `previousOutput` 매치 **0건** (목록 분리 실증).
- 코드 변경 0줄 → 테스트·e2e 불요.

## 수렴 판정

CRITICAL 0 이고 유일한 WARNING 을 리뷰어 권고 문안대로 반영했다. 3차 조치분은 **plan/review 문서의
서술 정정뿐**(spec 본문·코드 무변경)이라, 다시 full 리뷰에 걸면 문서 문안 nit 만 재표면화하는
비수렴 doc-루프가 된다 — 프로젝트 관례(Critical·코드 Warning 0 에서 INFO 비차단 수렴)대로 여기서
종결한다.

## 교훈

**"반영했다" 고 쓰기 전에 반영 결과를 diff 로 확인해야 한다.** 1차에서 나는 예외 문장을 덧붙이는
최소 조치를 하고 RESOLUTION 에 "반영 완료" 로 적었는데, 지적의 핵심(열거 목록 자체가 사실과 다름)은
건드리지 않았다. sibling 문서 두 곳은 목록에서 제거했으면서 README 만 다르게 처리한 **비대칭**이
단서였다 — 같은 배치에서 같은 문제를 서로 다른 강도로 고쳤다면 약한 쪽을 의심할 것.
