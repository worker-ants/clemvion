# Plan 정합성 검토

## 발견사항

- **[WARNING]** 닫는다고 선언한 트래커 항목이 트래커 파일에서는 아직 미해소로 남아 있다
  - target 위치: `plan/in-progress/error-code-emission-axis.md` 머리말 — *"트래커 항목 '가이드 에러 코드 가드가 «존재» 만 보고 «방출» 을 안 본다'(…) 를 닫는다."*
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3394` — `- [ ] **가이드 에러 코드 가드가 "존재" 만 보고 "방출" 을 안 본다 — CRITICAL 을 통과시켰다**`
  - 상세: 이 PR 의 diff(`git diff origin/main...HEAD -- plan/in-progress/spec-draft-nullable-notation-followups.md`)는 인접 항목(3412번, `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 선재 결함)은 `[x]` + `✅ 2026-09-13 해소` 로 갱신했고, 새 planner 항목 둘(3427·3448)도 등재했다. 그런데 **이 배치의 존재 이유인 3394번 항목 자체는 체크박스·해소 각주 어느 쪽도 갱신하지 않았다** — `git blame`/diff 상 3394번 라인은 손대지 않은 그대로다. `error-code-emission-axis.md` 자체 체크리스트가 `- [ ] /ai-review + --impl-done — 라운드 5 대기` 로 아직 미완료임을 감안하면 의도적 유예일 수 있으나, 이 저장소가 반복 지적해 온 형태(`feedback_stale_plan_claims_and_checklist_sync.md` — "체크리스트 두 군데" 동기화 실패, 5건 유실 전력 `feedback_review_fix_stale_loop.md`)와 정확히 같은 자리다. 라운드 5 통과 후 이 항목을 갱신하지 않으면 두 plan 문서가 "닫혔다/열려 있다"로 서로 다른 사실을 주장하는 상태로 굳는다.
  - 제안: `error-code-emission-axis.md` 완료(라운드 5 GREEN) 직후, 같은 커밋에서 `spec-draft-nullable-notation-followups.md:3394` 를 `[x]` + 해소 각주로 갱신할 것. (참고로 3412번 항목 갱신 패턴을 그대로 따르면 된다.)

- **[INFO]** `MAKESHOP_UNRESOLVED_PATH_PARAM` 신규 등록이 미해소 카탈로그 항목(3208)과의 상호작용을 명시하지 않았다
  - target 위치: `plan/in-progress/error-code-emission-axis.md` §D-2 등록 표 — `MAKESHOP_UNRESOLVED_PATH_PARAM` 를 `GUIDE_NON_EMITTED_VOCABULARY` 에 등록 (사유: "메시지 접두. 가이드가 '코드가 아니라 메시지'라고 이미 명시")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3208` — `- [ ] **3-error-handling.md §1 카탈로그가 통합·LLM 코드 계열을 통째로 누락한다**` (planner 미해소, MakeShop 11종 중 `UNRESOLVED_PATH_PARAM` 포함 명시)
  - 상세: 같은 plan 문서 §D-2/§1.4 항목(3448)은 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 §1.4 에 backfill 하면 "이 배치의 등록 항목 둘은 불필요해지고 가드가 자동으로 통과시킨다"고 **명시적으로 교차 참조**해 두었다. 그런데 구조가 완전히 동일한 세 번째 등록 항목(`MAKESHOP_UNRESOLVED_PATH_PARAM`)에는 같은 교차 참조가 없다 — 이 토큰은 이미 3208번 항목이 "언젠가 §1 카탈로그에 채워 넣어야 할 MakeShop 11종"의 목록에 명시적으로 포함하고 있는 코드다. 3208번이 해소되어 `MAKESHOP_UNRESOLVED_PATH_PARAM` 이 카탈로그에 오르면, §B-3 술어("메시지 접두 ∩ 카탈로그 미등재")가 더 이상 성립하지 않아 이 등록 항목도 CONTAINER_* 와 같은 이유로 무의미해진다. 기능적 결함은 아니지만(허용목록에 죽은 항목이 남는 것뿐), 3448번과 대칭이 맞지 않는 절반짜리 forward-note다.
  - 제안: `error-code-emission-axis.md` §D-2 표 또는 `spec-draft-nullable-notation-followups.md:3208` 중 한쪽에, "3208 해소 시 `MAKESHOP_UNRESOLVED_PATH_PARAM` 등록도 재검토 대상" 이라는 한 줄을 추가.

## 요약

이 PR 은 `spec/conventions/**` 를 전혀 건드리지 않아(diff 확인: `git diff origin/main...HEAD -- codebase content spec plan` → spec 파일 변경 0) 이 checker 의 명목 scope 델타는 실제로 0이며, 이는 정상이다. 실질 변경은 `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`(가드 확장)와 `logic{,.en}.mdx`(가이드 문구 정정) 두 짝이고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 대한 갱신도 diff 로 직접 확인했다. 미해결 결정(§1.4 backfill 여부, spec 6파일 CONTAINER_* 서술 정정)은 developer 가 일방적으로 결정하지 않고 정확히 planner 항목으로 등재해 두었으며(3427·3448), 카탈로그를 "요구조건"이 아니라 "탈출구"로 쓰는 설계 덕에 §1 카탈로그 미완결(3208, 여전히 open) 상태에서도 거짓 RED 를 만들지 않는다 — 미해결 plan 과의 충돌은 없다. 다만 (1) 이 배치의 존재 이유인 트래커 항목 3394번이 아직 체크·해소 각주 갱신 없이 열려 있는 점, (2) 신규 등록 3종 중 `MAKESHOP_UNRESOLVED_PATH_PARAM` 에 대해서만 3208번과의 미래 상호작용 교차 참조가 빠진 점, 두 가지 경미한 동기화 갭이 있다. 둘 다 지금 당장 기능을 깨뜨리지 않고 라운드 5 완료·최종 커밋 시점에 정리 가능한 수준이다.

## 위험도
LOW
