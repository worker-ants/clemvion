# Plan 정합성 검토 — error-code-emission-axis (impl-done 라운드 3, scope=spec/conventions/)

## 사전 확인

`plan/in-progress/error-code-emission-axis.md`(신규 plan, 워크트리 루트에 349줄로 추가됨) +
`plan/in-progress/spec-draft-nullable-notation-followups.md`(diff 64줄)를 절대경로로 직접
읽고, `git -C <워크트리> diff origin/main...HEAD --stat` 로 실제 변경 파일을 확인했다. 이번
라운드(20_13_19)는 직전 라운드 2(`review/consistency/2026/09/13/19_51_39/plan_coherence.md`)
**이후** 커밋(`a4b98eda8` "라운드 2 — 지적 4건 중 3건이 «라운드 1 의 내 수정» 을 겨눈다")을
검토 대상으로 하는데, 그 커밋의 `--stat` 을 직접 열어 `plan/**`·`spec/**` 변경이 **0건**임을
확인했다(코드 3파일 + CHANGELOG + review 산출물만). 즉 라운드 2 plan_coherence 가 이미 검토한
plan 정합성 영역은 이번 라운드에서 **변경되지 않았다** — 독립적으로 재검증했고 같은 결론에
도달했다.

## 발견사항

- **[INFO]** `user-guide-evidence.md §2.1` 미등재 백로그는 이번 배치가 더 키웠지만, 그 자체는
  이미 등재된 planner 결정 대기 상태이고 developer 권한 밖이라 침범이 아니다
  - target 위치: `spec/conventions/user-guide-evidence.md §2`("Build-time 가드 (3건)" 표 —
    직접 열람 확인, `guide-identifier-existence.test.ts` 행 없음, frontmatter `code:` 목록에도
    `guide-identifier-*` 3파일 없음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3247-3273`
    (`user-guide-evidence.md §2.1` 관계표에 신규 가드 2건 미등재 — planner, 등재 위치
    "(a) Overview 확장 vs (b) 신규 §6" 택일 대기)
  - 상세: 이번 배치는 `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 에
    **새 축(발행/emission)** 과 새 예외 목록(`GUIDE_NON_EMITTED_VOCABULARY`)을 추가해, 그
    가드가 위 pending 항목이 등재 대상으로 지목한 시점보다 한 겹 더 커졌다. pending 항목의
    표 서술("가이드가 적은 식별자(에러 코드+환경변수)가 실재하는가")은 이제 발행 축을
    설명하지 못해 문면상 stale 하다. 다만 `spec_impact: none`(frontmatter)이 맞고
    `spec/conventions/**` 델타 0 과 일치하며, 이 gap 을 spec 에 반영하는 것은 애초에
    developer 권한 밖(`spec/` 쓰기)이라 이번 PR 이 처리하지 않은 것 자체는 정당하다.
    **미해결 결정과의 충돌·선행 plan 미해소 어느 쪽도 해당하지 않는다** — pending 항목이
    "등재 위치"를 아직 정하지 않은 상태이므로 이번 PR 이 무엇을 앞질러 결정한 것도 아니다.
    다만 "후속 항목 누락" 관점에서 작은 잔여가 있다: pending 항목이 등재될 때 참고할
    서술이 이번 배치로 한 번 더 벌어졌다는 사실 자체는 그 항목 텍스트에 반영되어 있지
    않다(라운드 2 가 이미 같은 관찰을 INFO 로 냈고, 이후 코드 변경이 없어 판단이 바뀔
    근거도 없다).
  - 제안: 없음(조치 불요 — 재등재 시 planner 가 코드를 다시 읽으면 발행 축은 자동으로
    드러난다). 참고용으로만 남김.

- **[INFO]** 트래커 L3404(`CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT`) 해소 확인이
  라운드 2 이후에도 유효함 — 재확인만
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx`/`.en.mdx`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3403-3408`
  - 상세: 라운드 1 WARNING → 라운드 2 확인·INFO 로 이미 종결된 항목이다. 이번 라운드
    대상 커밋(`a4b98eda8`)이 이 plan 파일을 건드리지 않았으므로 상태 변화 없음(재확인 완료).
  - 제안: 없음.

- **[INFO]** 새로 등재된 두 planner 결정 항목(spec 6파일의 `CONTAINER_*` 서술,
  `3-error-handling.md §1.4` 카탈로그 앵커 표기 택일)은 여전히 `spec/conventions/` 밖이고
  이번 배치가 침범하지 않음 — 재확인만
  - target 위치: 없음(`spec/conventions/` 스코프 밖 — `spec/5-system/`·`spec/3-workflow-editor/`·
    `spec/4-nodes/` 소속)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3382-3423`
  - 상세: 라운드 1·2 가 이미 "가드가 카탈로그를 탈출구로 쓰는 설계라 어느 쪽 택일로
    귀결돼도 깨지지 않는다"고 확인했고, 대상 커밋에 해당 plan 문단·spec 파일 변경이 없어
    결론 불변.
  - 제안: 없음.

## 요약

라운드 3 검토 대상 커밋(`a4b98eda8`)은 가드 코드(`guide-identifier-scan.ts`/
`guide-identifier-existence.test.ts`)와 CHANGELOG 만 수정했고 `plan/**`·`spec/**` 변경이
없다. 이번 배치가 의존하는 두 개의 미해결 planner 결정(spec 6파일의 `CONTAINER_*` 서술
정정, `error-handling.md §1.4` 카탈로그 표기 택일)과 이미 등재된 `user-guide-evidence.md`
미등재 백로그를 절대경로로 직접 재확인한 결과, 라운드 2 의 결론(NONE)에서 달라진 것이
없다 — "미해결 결정과의 충돌"·"선행 plan 미해소"·"후속 항목 누락" 세 축 모두 새 위반 없음.

## 위험도

NONE
