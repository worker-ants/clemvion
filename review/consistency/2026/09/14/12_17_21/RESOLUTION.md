# RESOLUTION — `--impl-done spec/conventions/` 라운드 3 (`review/consistency/2026/09/14/12_17_21`)

**BLOCK: NO** · Critical 0 · **WARNING 0** · INFO 3 · **전체 위험도 NONE**.
5개 checker 전원 전문 제출 + 전원 **NONE**. `[CRITICAL]` 마커 실측 **0건**.

라운드 2 의 세 WARNING 이 전부 해소 확인됐다:

| 라운드 2 지적 | 확인 |
|---|---|
| 실측표가 표본(5)이고 술어가 substring | 주어·술어 고정 전수 **14 중 5** 로 정정됨 |
| 선행 진단(`harness-review-gate-followups.md`) 미참조 | 상호참조 + 「같은 경로를 타는지 먼저 확인」 추가됨 |
| `_overview.md` frontmatter — **false positive** | 철회 + 「§7.1 상호참조 한 줄」로 축소됨 |

`plan_coherence` 가 *"신규 6항목 중 target 범위 4건 전부 실측 대조 후 정합, 미해결 결정
선점·우회 없음"* 으로 판정했다.

## INFO 3건 — 전부 등재분, 새 조치 불요

| # | 항목 | 상태 |
|---|---|---|
| 1 | `secret-store.md §R4` 의 `delete()` → `remove()` | 라운드 2 에 planner 항목으로 등재. checker 가 *"이번 diff 의 신규 주석 자체는 정확한 메서드명을 써 drift 를 악화시키지 않는다"* 확인 |
| 2 | repo-guard `code:` 등재 관례 미정 (14 중 5) | 두 plan 에 **상호 포인터로** 등재됨. checker 가 *"plan 이 이미 그렇게 요청 중 — 새 조치 불요"* |
| 3 | 번들 예산 절단이 이 세션에서도 재현 | harness 등재분. checker 들이 **워킹트리 직접 열람으로 우회해 실질 검토 완결** |

> INFO#3 은 라운드 1 에서 내가 등재한 그 결함이 **같은 세션에서 다시 관측된 것**이다.
> 다만 이번엔 checker 들이 우회했고 판정이 NONE 이라, 등재된 harness 항목의 **추가 증거**일
> 뿐 새 결함이 아니다.

## 이 라운드가 `codebase/**` 를 요구하지 않았다

`--impl-done` 쪽 처분은 **0건**이다. 이 라운드의 `codebase/**` 수정은 전부
`/ai-review` WARNING#1(괄호 언랩 대조군)에서 왔다.
