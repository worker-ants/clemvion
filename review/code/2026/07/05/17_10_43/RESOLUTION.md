# RESOLUTION — V-05 fix round (17_10_43)

## 조치 항목

| # | Checker/위험도 | 발견 | 조치 |
|---|---|---|---|
| 1 | plan_coherence / WARNING | 직전 RESOLUTION(16_49_52)의 "후속 이관(planner)" 항목(§3.3 탭 열거·hook 추출·folder rename)이 `plan/in-progress/` 에 미등록 → RESOLUTION 은 review 산출물이라 추적 홈 아님 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-05 항목에 **"V-05 후속 항목"** 하위 목록 등록: (planner) spec-doc §3.3 탭 열거+§7.4/§9.2 dry-run 배지 스코프+Config viewer masking Rationale, (refactor) props 공용 hook, (low) orphan i18n 키 제거+folder rename |
| 2 | cross_spec + rationale / LOW | dry-run 배지가 execution-level(`Execution.dry_run`)을 쓰는데 §7.4/§9.2 는 node marker-only 로 서술 | **후속(planner)** — #1 의 spec-doc 항목에 포함. 코드는 refactor **전 기존 UX 복원**(신규 행위 아님, cross_spec 확인). 비차단 |
| 3 | convention / INFO | 미사용 i18n 키 `executions.tabPreview/tabInput/tabOutput/tabError`(코드 참조 0) | **후속(low)** — #1 목록. 제거는 codebase 변경이라 불필요한 리뷰 사이클 회피 위해 이관 |

## TEST 결과

- lint / unit / build / e2e: 직전 fix 커밋 `bef267c17` 에서 전부 PASS (lint·unit·build·e2e 235). 본 라운드 조치는 **plan/review 문서만** 변경(codebase 무변경) → 재테스트 불요.

## 보류·후속 항목

`plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-05 후속 목록에 3건 등록 완료(planner spec-doc / refactor hook / low cleanup). 세션 chip(task_36655abc·task_7c629e5a)로도 spawn 가능.
