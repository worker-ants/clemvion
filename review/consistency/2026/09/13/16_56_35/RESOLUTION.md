# RESOLUTION — `--impl-done spec/conventions/` 라운드 7 (`review/consistency/2026/09/13/16_56_35`)

**BLOCK: NO** · Critical 0 · WARNING 2 · INFO 2 · 위험도 MEDIUM.
5개 checker 전원 전문 제출(`unfinished: []` · `recovered: []`).

## 먼저: 워크플로가 «썼다» 고 했는데 파일이 없었다

반환값은 `summary_written: true` 였는데 **디스크에 `SUMMARY.md` 가 없었다**(checker 리포트
5개는 정상 존재). 플래그를 믿었으면 `--impl-done` 게이트가 리포트 0건으로 집계해 **영구
차단**됐을 것이다 — 이 저장소에 이미 기록된 실패 형태다. main 이 직접 기록해 해소했다.

**라운드 6 에서는 같은 플래그가 `true` 였고 파일도 실제로 있었다.** 즉 이 플래그는 한쪽으로
치우친 게 아니라 **그냥 신뢰할 수 없다**. skill 이 *"`summary_written` 값과 무관하게 멱등
persist"* 라고 적은 이유가 이것이고, 매 라운드 `ls` 로 확인하는 것이 유일한 판정이다.

하향 여부도 파일 단에서 대조했다 — checker 리포트의 `[CRITICAL]` 마커 **0건**.

## WARNING #1 — SoT 미등재 + Rationale 미승격 (권한 밖 · 등재분)

`user-guide-evidence.md §2` 가드 표(3건 고정) + frontmatter `code:` 에 이 가드 가족이
미등재이고, `#1330` 의 *"허용목록 없음"* 원칙을 번복한 근거가 spec `## Rationale` 이 아니라
코드 주석·plan 에만 있다. **7라운드 연속** 같은 항목이며 `spec/conventions/**` 는
`project-planner` 전속이다. 갱신 초안은 `spec-draft-nullable-notation-followups.md:3247`
이하에 있고 checker 가 *"한 턴에 함께 반영"* 을 권고했다.

## WARNING #2 — `cafe24-api-metadata.md §4` Principle 오인용 (선재 · 등재분)

`node-output.md` Principle 7 을 인용하나 실제 5필드 불변 envelope 은 Principle 0 이고
필드 목록에 `status` 가 빠졌다. **이 PR 의 diff 범위 밖 선재 결함**이고 `spec/conventions/**`
델타는 0이다. `spec-draft-nullable-notation-followups.md:3406` 에 등재분.

## INFO #1 — `#1331` 안내 숫자 drift (고침)

plan 이 *"`grep -rn '#1331' plan/` 은 10곳"* 이라 적었는데 실측 11곳이라는 지적. **맞다.**
그 10 은 문장을 쓰기 **전**의 값이었고, 문장 자신이 `#1331` 을 더 담아 쓰는 순간 틀렸다.

같은 자리에서 두 번 틀렸고 이유가 다르다 — 1차는 **술어**가 틀렸고(내 사후 assert 가
잡았다), 2차는 **측정 시점**이 틀렸다(이 checker 가 잡았다). 처방은 더 정확한 숫자가
아니라 **총계를 쓰지 않는 것**이다: 자기를 포함하는 집합의 크기를 본문에 박으면 본문이
자기를 무효화한다. 대상 파일을 지정한 grep 명령만 남겼다.

## INFO #2 — 조치 불요

`spec/5-system/3-error-handling.md §1.4` 인용 정확성 — 오인용 아님을 checker 가 확인.

## 라운드 7 이 수렴이 아닌 이유

이 게이트는 라운드 4 부터 수렴해 있다. 이번에도 잔여는 전부 planner 몫이다. 라운드 8 이
필요한 것은 **`/ai-review` 가 CRITICAL 을 냈기 때문**이다
(`review/code/2026/09/13/16_56_29/RESOLUTION.md` — `BACKTICK` 축이 코퍼스의 6종을 한 번도
검사하지 않고 있었다).
