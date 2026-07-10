# 문서화(Documentation) 리뷰 — Fresh Re-review (resolution 커밋 `bd15f63f6`)

대상: 직전(`review/code/2026/07/10/23_20_30`) 세션이 낸 WARNING 1건("plan 체크박스 미갱신에 durable 추적 부재")에 대한
해소 조치 — (1) `RESOLUTION.md` 를 developer SKILL 3-헤더 스키마로 재작성 + task chip 등록 명시, (2) background task
chip `task_33bc64aa`, (3) PR 설명. 부수적으로 `--impl-done` consistency 가 추가로 지적한 `ai-turn-executor.ts` 인라인
주석의 TS 규칙 서술 정정도 검증 대상.

검증 방법: `git show bd15f63f6`(대상 커밋 diff 직접 확인) + `plan/in-progress/resume-llm-usage-attribution.md` 실제
파일 읽기 + `git log`/`gh pr view 898` 로 durability 채널의 실제 상태 확인.

## 발견사항

- **[WARNING]** RESOLUTION.md 자체가 "3중 durable 등록" 중 하나(task chip)에서 이미 stale — 커밋 메시지의 교체 주장이 파일 본문에 반영되지 않음
  - 위치: `review/code/2026/07/10/23_20_30/RESOLUTION.md` 10행("background task chip `task_e03a0b87` 3중으로 해소"), 26행("task chip `task_e03a0b87` 에도 반영"), 55행("durable 등록: ... + background task chip `task_e03a0b87`")
  - 상세: 이번 재검토 대상 커밋 `bd15f63f6` 의 커밋 메시지는 "task chip 도 교체(e03a0b87 → 33bc64aa)" 라고 명시하고, `review/consistency/2026/07/10/23_33_44/SUMMARY.md`(59행)도 "기존 chip `task_e03a0b87` 은 dismiss, `task_33bc64aa` 로 대체" 라고 기록한다. 그런데 `git show bd15f63f6 -- review/code/2026/07/10/23_20_30/RESOLUTION.md` 로 실제 diff 를 직접 대조한 결과, 이 커밋이 만든 RESOLUTION.md 최종본 어디에도 `task_e03a0b87` → `task_33bc64aa` 치환이 일어나지 않았다 — 파일은 세 곳 모두 여전히 옛 chip id(`task_e03a0b87`)를 인용한다(`grep -rn task_e03a0b87 review/` 로 재확인, 현재 워크트리에서도 동일). 즉 "durable 등록(chip)" 이라는 명목의 세 번째 채널이, 정작 그 채널을 가리키는 문서 텍스트 자체는 이미 dismiss 된 chip 을 계속 가리키고 있다 — 원래 WARNING 이 우려했던 "결정이 stale 하게 방치될 위험" 과 같은 클래스의 문제가 이번엔 해소 산출물(RESOLUTION.md) 내부에서 재발한 셈이다. 다만 영향은 제한적이다: RESOLUTION.md 의 "종결 조건" 절(체크박스 3개 + `git mv` + `spec_impact` 리스트)은 chip id 와 무관하게 그 자체로 완결된 durable 텍스트라, chip 참조가 stale 하다고 해서 종결 조건 자체를 못 찾는 것은 아니다. 그러나 미래에 누군가 RESOLUTION 이 명시한 `task_e03a0b87` 를 따라가 보면 dismiss 된 chip 만 발견하게 되어 "이 결정을 추적하는 활성 채널이 하나 사라졌다"는 사실을 알아채기 어렵다.
  - 제안: `review/code/2026/07/10/23_20_30/RESOLUTION.md` 의 3개 chip id 참조를 `task_33bc64aa` 로 갱신(또는 chip id 자체가 저장소 아티팩트로 검증 불가능한 out-of-band 값이라는 점을 이미 `convention-compliance`(23_33_44) checker 가 별도 Info 로 지적했으므로, 차라리 특정 chip id 를 텍스트에 박아두지 않고 "durable 등록: RESOLUTION.md + PR 설명" 2채널만 명시하는 편이 향후 chip 교체 때마다 문서가 stale 해지는 것을 원천 차단한다).

- **[INFO]** 원래 WARNING 의 핵심 요구(durable 추적)는 실질적으로 잘 해소됨 — RESOLUTION.md 의 종결 조건 자체가 자기완결적
  - 위치: `review/code/2026/07/10/23_20_30/RESOLUTION.md` "## 보류·후속 항목 > 1. W1" 절
  - 상세: 재작성된 RESOLUTION.md 는 (a) defer 사유(#898 과의 plan 파일 hunk 인접 → merge 충돌 회피, `--impl-prep` 단계 사전 승인 인용), (b) 정확한 종결 조건(INFO#1·INFO#4 체크 + **`:53` 의 `- [ ] PR (push + gh pr create)`** 까지 3개 체크박스 + `git mv` + `spec_impact` YAML 리스트 5개 파일 명시)을 git-committed 문서 안에 직접 기술한다. 실제로 `plan/in-progress/resume-llm-usage-attribution.md` 를 읽어 확인한 결과 INFO#1(74행 부근)·INFO#4(78행 부근)·`:53`("- [ ] PR (push + gh pr create)") 모두 서술된 그대로 `[ ]` 상태이고, `gh pr view 898` 로 확인한 결과 #898 은 아직 `OPEN`(미머지)이라 "지금 당장은 갱신하지 않는다"는 전제도 여전히 유효하다. chip id 문제(위 WARNING)를 빼면, 이 절 자체는 다음 세션이 별도 컨텍스트 없이도 실행 가능한 수준으로 잘 기술돼 있다.
  - 제안: 없음(위 WARNING 반영만 하면 완결).

- **[INFO]** 3번째 stale 체크박스(`:53` PR 체크리스트) 를 impl-done consistency 가 잡아 종결 조건에 반영한 것은 적절한 교정
  - 위치: `plan/in-progress/resume-llm-usage-attribution.md:53`, `RESOLUTION.md` "종결 조건" 두 번째 불릿
  - 상세: 직접 파일을 읽어 `- [ ] PR (push + gh pr create)` 가 실제로 미체크 상태임을 확인했다. 이 항목은 `#879`(이미 origin/main 에 머지된 PR)가 남긴 pre-existing 누락이며, 원래 W1 의 "종결 조건"(체크박스 2개)만으로는 `plan-lifecycle.md` 의 self-check("모든 체크박스가 `[x]`")를 실제로 통과시킬 수 없었을 것이다. 이번 impl-done 라운드가 이를 3번째 조건으로 추가한 것은 정확하고 필요한 보강이다.
  - 제안: 없음.

- **[INFO]** `ai-turn-executor.ts` 인라인 주석 정정 — 정확하고 명확함
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2602-2605`
  - 상세: 정정 전 문구("excess-property check 는 리터럴을 인자로 직접 넘길 때만 걸린다")는 이 diff 가 하는 일(주석 붙은 `const` 선언에 타입을 붙여 가드를 얻는 것)이 왜 효과가 있는지를 설명하지 못하는 논리적 공백이 있었다. 정정 후 문구("object literal 이 타입이 알려진 대상(함수 인자 또는 주석 붙은 변수)에 직접 assign 될 때만 걸린다")는 TypeScript 의 실제 excess-property check 규칙(fresh object literal 이 함수 인자 또는 타입-주석 붙은 변수 선언에 직접 대입될 때만 적용되고, 무주석 `const` 를 경유해 널리 퍼진 뒤에는 freshness 가 사라져 검사 대상에서 빠진다)과 정확히 일치한다. 이는 `review/consistency/2026/07/10/23_33_44/rationale-continuity.md` 가 `tsc --strict` 3-케이스(annotated const / unannotated const→함수 인자 / 리터럴 직접 인자)로 독립 실증한 내용과도 부합한다. 코드(`const llmContext: LlmCallContext = {...}`)와 주석의 서술이 서로 어긋나는 지점 없음 — "오래된 주석" 문제 없음.
  - 제안: 없음.

- **[INFO]** RESOLUTION.md "## 조치 항목" 아래 "후속 impl-done 지적에 대한 fix" 표에 fix commit hash 매핑이 없음(경미)
  - 위치: `RESOLUTION.md` "### 후속 impl-done 지적에 대한 fix" 표(출처/지적/조치 3열, `commit` 열 없음)
  - 상세: developer SKILL 의 RESOLUTION.md schema(`§RESOLUTION.md schema`)는 "`## 조치 항목`: SUMMARY # 와 fix commit hash 매핑 표"를 요구한다. 이번 3건(rationale-continuity 주석 정정·convention-compliance 스키마 재작성·plan-coherence 체크박스 보강)은 실제로 이 RESOLUTION 을 포함한 커밋(`bd15f63f6`)에서 fix 됐는데, 그 표에는 `commit` 열 자체가 없어 어느 커밋이 이 fix 를 반영했는지 텍스트만으로는 명시되지 않는다(문서 서두의 "대상: `5e6f70b76`" 은 원 커밋만 가리킴). push-gate 는 파일 존재 여부만 보므로 차단 사유는 아니고, `convention-compliance`(23_33_44) checker 가 이미 이 RESOLUTION 의 스키마 이슈를 폭넓게 다뤘으므로 중복 지적은 피하되, 완결성 관점에서 사소하게 남겨둠.
  - 제안: 조치 선택적 — 이 표에 `commit: bd15f63f6` 한 열을 덧붙이면 완전해진다. 차단 사유 아님.

## 검토 항목별 결론

- **원래 WARNING("plan 체크박스 durable 추적 부재")의 해소 여부**: **실질적으로 적절히 해소됨.** RESOLUTION.md 가 developer SKILL 3-헤더 스키마로 재작성되어 defer 사유·정확한 3-체크박스 종결 조건·`spec_impact` 리스트까지 git-committed 문서 안에 자기완결적으로 기술한다. 다만 그 문서가 스스로 내세우는 "3중 해소" 채널 중 하나(task chip id)가 이미 stale 하다(위 WARNING) — 이 부분만 고치면 완전하다.
- **주석 정확성**: `ai-turn-executor.ts` 의 정정된 인라인 주석은 TypeScript 의 실제 동작과 정확히 일치하며 코드와 모순 없음.
- **README/API 문서/설정 문서/예제 코드/CHANGELOG**: 이번 delta(주석 문구 정정 + review/consistency 문서 6건 신설)는 런타임·공개 API·설정·CHANGELOG 트리거 어디에도 해당하지 않음 — 해당 없음(이전 라운드 결론 유지).

## 요약

직전 라운드의 유일한 WARNING("plan 체크박스 미갱신에 durable 추적 부재")은 RESOLUTION.md 를 developer SKILL 의 3-헤더 스키마로 재작성하고, defer 사유·정확한 3-체크박스 종결 조건(#879 가 남긴 stale `:53` 항목까지 포함)·`spec_impact` 리스트를 git-committed 문서 안에 자기완결적으로 기술함으로써 실질적으로 잘 해소됐다 — 직접 `plan/in-progress/resume-llm-usage-attribution.md` 와 `gh pr view 898` 을 확인해 서술이 현재 상태와 정확히 일치함을 검증했다. `ai-turn-executor.ts` 의 정정된 인라인 주석도 TypeScript 의 실제 excess-property-check 규칙을 정확하고 명확하게 설명한다. 다만 새로 발견한 것은, RESOLUTION.md 가 스스로 내세우는 "3중 durable 등록" 중 task chip 채널의 id 가 이미 stale 하다는 점이다 — 대상 커밋(`bd15f63f6`)의 커밋 메시지와 `review/consistency/2026/07/10/23_33_44/SUMMARY.md` 는 chip 을 `task_e03a0b87` → `task_33bc64aa` 로 교체했다고 기록하지만, `git show bd15f63f6` 로 직접 diff 를 대조한 결과 RESOLUTION.md 본문의 세 곳은 여전히 옛(이미 dismiss 된) chip id 를 인용한다. 종결 조건 텍스트 자체는 chip id 와 무관하게 완결돼 있어 실무 영향은 제한적이지만, "durable 추적"이라는 이번 수정의 취지에 정확히 반하는 stale 참조이므로 WARNING 으로 기록하고 갱신을 권고한다.

## 위험도

LOW

STATUS: DONE
