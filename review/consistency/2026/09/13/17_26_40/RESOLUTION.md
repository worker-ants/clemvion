# RESOLUTION — `--impl-done spec/conventions/` 라운드 8 (`review/consistency/2026/09/13/17_26_40`)

**BLOCK: NO** · Critical 0 · WARNING 3 · INFO 2 · 위험도 MEDIUM.
5개 checker 전원 전문 제출. `[CRITICAL]` 마커 **0건** — 하향 여부 파일 단에서 대조.

`summary_written: false` 였고 디스크에도 실제로 없었다 — 직접 기록했다. **라운드 7 은
`true` 인데 없었고 라운드 8 은 `false` 이고 없었다.** 플래그가 한쪽으로 치우친 게 아니라
**참·거짓 어느 쪽으로도 신뢰할 수 없다**는 뜻이고, 매 라운드 `ls` 가 유일한 판정이다.

## WARNING #2 — 7라운드 만에 «막힌 지점» 이 드러났다 (등재 보강)

`user-guide-evidence.md` 미등재는 1라운드부터 나왔지만, 이번 convention_compliance 가
한 겹 더 팠다: **그 문서는 스스로를 *"`<ImplAnchor>` 컴포넌트의 단일 진실"* 로 선언**하는데
신규 가드 둘은 `<ImplAnchor>` 와 무관하다(식별자 인용 · 실패 문장 대조). 즉 §2 표에 행만
더하면 **문서의 자기 선언 스코프와 어긋난다**.

> **7라운드 동안 "미등재" 로 불렸지만 실제 막힌 지점은 "등재할 자리가 없다" 였다.**
> 같은 항목이 반복해 나오면 항목이 아니라 **항목의 서술**을 의심해야 한다는 사례다.

트래커에 택일을 적었다 — (a) Overview 스코프를 *"가이드 진실성 가드 가족"* 으로 넓힌다,
(b) §2 와 구분된 새 절을 만든다. **택일 자체를 Rationale 에 남길 것**도 함께 적었다.
고르지 않으면 다음 planner 턴도 같은 자리에서 멈춘다 — 실제로 일곱 번 멈췄다.

## WARNING #1·#3 — 권한 밖 · 등재분

SoT 표·frontmatter `code:` 미등재(#1)와 *"허용목록 없음"* 원칙 번복의 Rationale 미승격(#3).
둘 다 `spec/conventions/**` 이고 초안은 `spec-draft-nullable-notation-followups.md:3247`
이하에 있다. checker 가 **#1·#2·#3 을 한 턴에 묶어 처리**할 것을 권고했고 트래커도 같은
말을 적고 있다 — 나눠서 하면 표가 두 번 미완결이 된다.

## INFO — 조치 불요

| # | 항목 | 사유 |
|---|---|---|
| 1 | `cafe24-api-metadata.md §4` Principle 오인용 | 선재·무관. 등재분 |
| 2 | `lastIndex` 보일러플레이트 4중 복제 | 라운드 5 등재분(developer 소유로 정확히 등재됐음을 checker 가 확인) |

## 이 게이트의 수렴 상태

**라운드 4 부터 수렴**해 있고 이번도 같다 — Critical 0, 잔여는 전부 planner 몫이다.
`plan_coherence` 가 *"권한 밖 spec 갱신 2건 모두 정확한 이름으로 트래커에 등재 확인,
신규 후속 항목도 올바른 소유자로 등재됨"* 으로 판정했고, `naming_collision` 은 신규 식별자
전수 대조 충돌 0건 · 옛 `guide-error-code-*` 댕글링 0건을 재확인했다.

이번 라운드의 처분은 전부 `plan/**` 이므로 `codebase/**` 수정은 0건이다.
