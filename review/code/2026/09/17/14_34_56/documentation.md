# 문서화(Documentation) 리뷰 — `trigger-cascade-window-probe` (3라운드)

## 검토 범위

이번 라운드(`review/code/2026/09/17/14_34_56`)는 2라운드(`review/code/2026/09/17/14_11_48`)
처분 커밋(`d60cc65aa`)까지 반영된 상태를 검토한다. 1·2라운드 documentation 리뷰가 지적한 두 건
(창 1 머리말 stale 주석, `trigger-transaction-mock.ts` 뮤턴트 재측정 미기록)은 `git show 6d845d8a2`
· `git show d60cc65aa` 로 직접 대조해 실제로 고쳐졌음을 확인했다 — 회귀 없음. 이번 라운드는 그
반영분을 재검증하는 동시에, 최종 커밋 상태(`CHANGELOG.md` 전체, `triggers.service.ts` 전체,
`trigger-save-partial-patch.md` 전체, `spec-draft-nullable-notation-followups.md`)를 새로
대조해 이전 2라운드·21건의 병렬 리뷰가 짚지 않은 자리를 찾았다. 저장소 트리에는 아무것도
쓰지 않았다(`Read`/`grep`만 사용, `git status --short` 확인 불요).

## 발견사항

- **[WARNING]** `CHANGELOG.md` 안에서 새 항목이 실측 확정한 것을, 바로 아래 이전(이미 merge 된) 항목이 여전히 "아직 재지 않았다"고 말한다 — 파일 내부 자기모순
  - 위치: `CHANGELOG.md` — 이번 PR 이 추가한 최신 항목(게이트 `24`~`27`, `## Unreleased — PATCH 가 동시에 커밋된 컬럼을 옛 값으로 되돌렸다` 절 "함께 실측으로 확정한 것" 목록 첫 항) vs 그 바로 아래, `#1341`(커밋 `2d20cc3e1`)로 이미 main 에 merge 된 이전 항목 `## Unreleased — 락을 잡아도 못 막는 세 번째 삭제 경로` 안의 문장(직접 `Read` 로 확인한 실제 줄 번호 `56`~`62`, 게이트 없음 — 이 hunk 는 diff 밖 기존 문맥이라 프롬프트 diff 에 등장하지 않는다).
  - 상세: 최신 항목은 "재읽기 뒤 `workflow` 삭제(FK CASCADE)가 끼어들면 저장은 **시끄럽게 실패**하고 롤백된다"고 실제 Postgres+TypeORM 재현(`test/trigger-update-save-window.e2e-spec.ts` ①)으로 **확정**한다. 그런데 바로 아래 이전 항목은 정확히 같은 창(창 1 = `TriggersService.update()`)에 대해 "**실패 방식이 무엇인지는 아직 재지 않았다** … 확인하려면 재읽기와 저장 **사이**를 멈추는 프로세스 내부 훅이 필요하다 … 후속으로 등재했다(`/ai-review` `review/code/2026/09/15/09_30_03` security·concurrency W2)"라고 **여전히 미해결**인 것처럼 서술한다. 이 "후속"은 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 developer 항목 7(게이트 없음, 실측 줄 `4505`)이 추적하던 바로 그 항목이고, 이번 PR 의 `plan/in-progress/trigger-save-partial-patch.md` 머리말이 "트래커 … 항목 **7** … 을 닫는다"고 명시한 바로 그 결과물이다. 즉 CHANGELOG 를 위에서 아래로 읽는 사람은 같은 파일 안에서 "쟀다"(최신)와 "아직 안 쟀다, 프로세스 내부 훅이 필요하다"(이전)를 연속으로 만난다 — 후자가 제시하는 해법(내부 pause 훅)도 실제로 쓰인 기법(별도 `DataSource`/`pg.Client` 로 순차 `await`, `trigger-update-save-window.e2e-spec.ts` 머리말 확인)과 달라 이제는 부정확하다. 기능적 영향은 없고, 코드 동작과도 무관하다.
    - (참고, 새로 낸 결함 아님) 이 tracker 항목 7 자체를 `[x]` 로 닫는 작업은 **이 PR 이 아직 안 한 것이 맞다** — `trigger-save-partial-patch.md` 자신의 체크리스트가 `- [ ] 트래커 항목 7 [x] + planner 후속(⚠️ 정정) 등재 + plan → complete/` 와 `- [ ] /ai-review + --impl-done` 을 **아직 미체크**로 정확히 남겨 두었고(실제 줄 `186`~`187`), `review/consistency/2026/09/17/13_04_39`(plan_coherence·rationale_continuity)도 이 순서를 "이미 plan 체크리스트에 명시됨 — 이 라운드에서는 실제 집행 여부만 확인"으로 이미 처분해 뒀다. 따라서 tracker `[x]` 미처리 자체는 오탐이 아니라 예정된 후속이다 — 다만 그 후속이 집행될 때 이번에 지적한 **CHANGELOG 이전 항목의 문장**도 함께 정정 대상에 넣어야, "항목 7 닫음" 이 spec 뿐 아니라 CHANGELOG 자기모순까지 청소한다.
  - 제안: 항목 7 종결 커밋(또는 그 직전)에서 `CHANGELOG.md` 게이트 없는 줄 `56`~`62`(위 이전 항목)에 한 줄을 보태 — 예: "**(2026-09-17 갱신)** 창 1 의 이 창은 위 항목에서 실측 확정됐다 — 시끄러운 실패(23503), 부활 없음." — 과거 항목의 "미해결" 서술을 최신 상태와 맞춘다. CRITICAL 은 아니다.

## 확인 완료 — 회귀 없음

- 창 1 저장 대상 설명 머리말(`triggers.service.ts:658`)이 1라운드 W3 처분대로 "저장 대상 자체는 아래에서 부분 객체로 좁힌다"로 정정돼 아래 실제 코드(`679`~`717`, `const patch = {...defined, config: mergedConfig}`)와 더 이상 모순되지 않는다.
- `trigger-transaction-mock.ts` 의 뮤턴트 재측정 JSDoc(`62`~`69`)은 2라운드 W1 처분대로 구체 숫자(53→60→64→68) 대신 "형태를 고정하지 않은 숫자는 다음 사람이 재현하지 못한다"는 **규칙**만 남기는 방향으로 바뀌었고, `plan/in-progress/trigger-save-partial-patch.md` 의 대응 표도 "수십 건 — 정확한 수는 형태 의존"으로 동기화돼 있다. 두 파일이 서로 어긋나지 않는다.
- CHANGELOG 의 "함께 실측으로 확정한 것" 절은 2라운드 W2 처분대로 `workflow` 삭제만 실측했다고 좁히고 `workspace` 는 "같은 `ON DELETE CASCADE` 구조라 동일할 것으로 보지만 따로 재지 않았다"로 추정과 실측을 정확히 구분해 두었다 — plan 표(실제 줄 `29`, "① B 가 `workflow` 삭제")와도 정합한다.

## 요약

핵심 코드(`triggers.service.ts` 부분 객체 `save`)에 딸린 문서는 세 라운드를 거치며 실제로
좋아졌다 — 1·2라운드가 잡은 stale 머리말과 미재측정 뮤턴트 카운트는 이번 라운드 상태에서
직접 대조 확인한 결과 정확히 고쳐졌고 회귀도 없다. 다만 이번 라운드에서 새로 찾은 것은,
이 PR 의 새 CHANGELOG 항목이 실측으로 닫은 질문을 그 **바로 아래, 이미 main 에 merge 된
이전 항목**이 여전히 "아직 재지 않았다 · 프로세스 내부 훅이 필요하다"고 말하고 있어 파일
하나 안에서 시제가 어긋난다는 점이다. 근본 원인(트래커 developer 항목 7 종결)은 이미 plan
체크리스트와 consistency 리뷰가 "코드 merge 시점"으로 정확히 미뤄 둔 예정된 후속이라 이 PR을
막을 사유는 아니지만, 그 후속을 집행할 때 CHANGELOG 의 이 문장도 함께 정정 대상에 포함해야
청소가 끝난다.

## 위험도

LOW
