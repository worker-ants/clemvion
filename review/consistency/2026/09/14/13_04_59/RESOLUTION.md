# RESOLUTION — `--impl-done spec/conventions/` 라운드 5 (`review/consistency/2026/09/14/13_04_59`)

**BLOCK: NO** · Critical 0 · WARNING 1 · INFO 5 · 위험도 LOW.
5개 checker 전원 전문 제출. `[CRITICAL]` 마커 실측 **0건**.
`rationale_continuity`·`naming_collision` **NONE**.

## WARNING#1 — carry-forward, 조치 불요 (등재분)

`TriggersService.delete()` 오기. **이 PR 이 만든 결함이 아니고**, checker 가 두 가지를 함께
확인했다: *"이번 PR 의 주석은 오히려 정확한 이름(`remove()`)을 인용한다"* ·
*"`migrations/V063` 의 동일 오기는 **Flyway 체크섬 문제로 의도적 무조치 결정이 이미 트래커에
근거와 함께 기록**됐다"*.

라운드 4 에서 전수 3곳으로 스코프를 넓혀 둔 것이 그대로 유효하다.

## INFO#4 — 역방향 포인터를 넣었다 (고침)

harness corpus 굶주림의 **두 번째 사례**를 내가 등재하면서 **단방향 인용**만 했다 —
지정 소유 트래커(`harness-review-gate-followups.md`)에서는 그 사례가 보이지 않았다.
그쪽 «승격은 됐는데 굶는다» 절에 역방향 포인터를 넣고, **같은 근본원인인지는 미확정**임과
확인 순서(*"두 모드가 같은 `prioritize_bundle_files` 를 타는가"*)를 함께 적었다.

## INFO#5 — **checker 의 처방을 채택하지 않는다** (다른 처분으로 반영)

checker 가 *"인접 plan 의 구값 7/8 을 신값 14/5/9 로 교체하라"* 고 했다. **두 값은 다른 양**이다:

| 출처 | 무엇을 센 수인가 |
|---|---|
| `spec-conventions-engine-error-code-surface.md` (2026-09-04) | `*-guard.ts` **7** · `*.spec.ts` **8** — **파일 쌍** 개수 |
| 이 배치 (2026-09-14) | 가드 **14** 중 `code:` 등재 **5** · 미등재 **9** — **등재** 개수 |

교체하면 **다른 질문의 답으로 덮어쓴다.** 그 문서에 «두 값은 주어가 다르니 교체하지 말고
결정 턴에 주어를 명시해 재측정하라» 는 註를 넣었다.

> 이 배치에서 checker 처방을 실측으로 기각한 세 번째다(라운드 2 `:3494` · 라운드 3 INFO#3
> 반증 · 이번). 매번 **지적 자체는 타당했고 처방만 빗나갔다** — 그래서 지적은 수용하고
> 처분은 다시 짠다.

## INFO#1·#2·#3 — 조치 불요

`#1` `2-trigger-list.md` `code:` · `#2` repo-guard 등재 관례 — 둘 다 등재분.
`#3` 은 **양성 확인**이라 기록해 둘 만하다: `secret-store.md` 가 **스스로 예고한** «정본-사본
드리프트» 위험을 이 배치의 신규 가드가 정확히 시행한다. 항목 1 이 겨눈 자리가 spec 이 이미
걱정하던 자리였다는 뜻이다. (spec 각주에 가드 경로를 남기는 것은 planner 몫이라 repo-guard
`code:` 항목에 묶여 있다.)
