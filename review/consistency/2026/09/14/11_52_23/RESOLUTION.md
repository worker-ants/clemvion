# RESOLUTION — `--impl-done spec/conventions/` 라운드 2 (`review/consistency/2026/09/14/11_52_23`)

**BLOCK: NO** · Critical 0 · WARNING 3 · INFO 2 · 위험도 MEDIUM.
5개 checker 전원 전문 제출. `[CRITICAL]` 마커 실측 **0건**.
`cross_spec`·`rationale_continuity`·`convention_compliance`·`naming_collision` **NONE**.

**세 WARNING 이 전부 «라운드 1 에서 내가 등재한 항목» 을 겨눈다.** diff 자체가 아니라
**내 등재 품질**이 대상이다 — 셋 다 타당했고 셋 다 고쳤다.

## WARNING#1 — 실측표가 표본이었고 술어도 틀렸다 (고침)

*"형제 repo-guard 5개 중 등재 2개"* 라 적었다. 두 겹으로 틀렸다:

| 무엇이 틀렸나 | |
|---|---|
| **분모** | 5개는 **표본**이다. 전수는 14개(`repo-guards/__tests__/*-guard.ts`) |
| **술어** | *"이름이 spec 어딘가에 등장하는가"* 로 셌다. 실제 술어는 **«spec frontmatter `code:` glob 이 그 파일에 매칭하는가»** |

`masked-reject-callers` 가 그 차이로 갈린다 — 이름은 spec **산문**에 있고 `code:` 에는 없다.
주어·술어를 고정한 전수 실측: **14개 중 등재 5 · 미등재 9**.

> checker 는 *"14 중 4"* 라 했다. **분모는 맞고 분자가 하나 적다.** 세 숫자가 다 달랐고
> 원인은 전부 «무엇을 세는가» 였다 — 표본 vs 전수, substring vs glob.

인접 항목(`spec-conventions-engine-error-code-surface.md` 의 *"repo-guard 소유 규약 문서
신설"*)을 상호참조했다. **같은 항목은 아니다** — 그쪽은 «규약 문서», 이쪽은 «`code:` 등재».

## WARNING#2 — 선행 진단을 상호참조 없이 재등재했다 (고침)

`harness-review-gate-followups.md` 의 *"승격은 됐는데 굶는다 — tier 안의 거대 파일 하나가
corpus 몫을 다 먹는다"* 절이 같은 결함 클래스를 더 자세히 진단하고 있었다. 상호참조와
owner 통일(harness)을 적었고, **합치기 전에 확인할 것**을 남겼다:

| | 선행 진단 | 내 관측 |
|---|---|---|
| 모드 | `--spec` | `--impl-prep` |
| 분포 | 거대 파일 **하나**가 다 먹음 | 387개 중 **380개** 절단 |

같은 `prioritize_bundle_files` 경로를 타는지 먼저 봐야 한다 — 아니면 하나를 고치고 다른
하나가 남는다.

> checker 가 그 절을 «§M» 이라 불렀는데 §M 은 *"`--impl-done` 번들의 diff 는 커밋 기준인데
> preamble 은 워킹트리를 SoT 라 선언한다"* 로 **다른 절**이다. 라벨은 틀리고 실질은 맞다.

## WARNING#3 — **false positive 를 등재했다** (철회 + 범위 축소)

*"`cafe24-api-catalog/_overview.md` 에 lifecycle frontmatter 가 없다 — (a)/(b) 택일"* 로
올렸는데, `spec-impl-evidence.md` **§1 이 이미 `spec/<영역>/_*.md`(밑줄 prefix)를 제외로
명시하고 `_overview.md` 를 예시로 든다**(실측 55행). frontmatter 부재는 **규약대로**다.

> **경위가 더 나쁘다.** `--impl-prep` checker 가 이 지적을 내면서 *"`spec-impl-evidence.md`
> 원문이 절단돼 정규식까지는 미대조"* 라고 **스스로 미검증임을 밝혔고**, 나는 그 문장을
> 등재 각주에 **옮겨 적기까지 하고 재실측은 하지 않았다.** 미검증 전제를 트래커에 올리면
> 다음 사람이 없는 일을 쫓는다. 이 저장소가 이미 적어 둔 *"미측정 전제가 백로그 항목을
> 만든다 — 착수 전 프로브"* 를 **등재 단계에서** 어겼다.

남는 진짜 갭 하나로 좁혀 재등재했다: §7.1 이 *"최상위 `<resource>.md` 인덱스는 정식 spec
으로 계속 검증된다"* 고만 적어 **`_overview.md` 자신이 §1 예외임이 그 문서에서 안 읽힌다** —
그래서 읽는 사람마다 이 지적을 다시 낸다(실제로 냈다). 처분은 **상호참조 한 줄**이고 택일
결정이 아니다.

## INFO 2건

`#1` `secret-store.md §R4` 가 `TriggersService.delete()` 라 쓰는데 실제는 `remove()` —
기존 spec 오기이고 이 배치의 e2e 주석이 §R4 를 처음 명시 인용해 가시화됐다. **planner 항목
등재.** `#2` `[vacuity]` 태그가 형제 가드의 한국어 태그와 언어 혼용 — 정식 규약 대상 아니고
다음 접촉 시 선택.
