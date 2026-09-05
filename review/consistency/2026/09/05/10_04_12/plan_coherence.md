# Plan 정합성 검토

## 검토 범위

- target: `spec/conventions/`(실제 델타 2파일: `migrations.md`, `review-citations.md`) + 구현 diff 1파일(`codebase/backend/migrations/README.md`, 54줄 — "인덱스 교체는 DROP-먼저" 패턴 신설, V110 언급)
- 대조 대상: `plan/in-progress/**` 전체(예산 내 전문 노출분 + 예산 초과로 절단된 파일은 제목만)

## 발견사항

없음 — 이 델타를 직접 다루는 유일한 plan 문서(`plan/in-progress/spec-draft-nullable-notation-followups.md` §후속)와 대조한 결과, target 의 세 변경 모두 그 plan 이 이미 추적·해소한 항목과 **정확히 일치**한다.

- `codebase/backend/migrations/README.md` 의 "인덱스 교체는 DROP-먼저" 신설 + `spec/conventions/migrations.md` §5 의 포인터 추가 ↔ plan 의 체크 완료 항목 `[x] CREATE INDEX CONCURRENTLY IF NOT EXISTS 재실행 위험 — 규약화 완료 (2026-09-05)` 와 동일 내용(선례 V110, 기각 근거 V056/V106 대조표까지 일치).
- `spec/conventions/review-citations.md` 신설(인용 유지 + 날짜 요구, PR 번호 미채택 근거) ↔ plan 의 체크 완료 항목 `[x] 코드 주석의 리뷰 세션 ID 인용 — 규약화 완료 (2026-09-05)` 와 선택지 (a) 성문화가 그대로 반영됨.
- target diff 가 명시적으로 미결정으로 남긴 `Flyway -mixed=true 도입 여부`("도입 여부는 별도 결정 항목입니다") ↔ plan 에 정확히 같은 항목이 **미체크 상태로 등재**되어 있음(`[ ] Flyway mixed=true 도입 여부 (planner + 인프라, 2026-09-05 등재)`). target 이 이 미해결 결정을 일방적으로 내리지 않고 정확히 defer 한 것을 확인 — 결정 우회(CRITICAL) 없음.
- `review-citations.md` §2 가 근거로 드는 "해소 불가 bare 인용 8건" 도 target 문서 안에서 해소하지 않은 채 남겨두었고, plan 에도 별도 미체크 항목(`[ ] 해소 불가 bare 인용 8건 채우기 (developer, 2026-09-05 등재)`)으로 정확히 대응되어 있음 — 선행 plan 미해소 항목을 target 이 임의로 건드리지 않음.
- 참고용으로 함께 번들된 `swagger.md`, `chat-channel-adapter.md` 는 diff 가 없는 unchanged 파일(관련 문서로 포함된 것)이라 이번 델타의 정합성 판단 대상이 아님.

기타 `plan/in-progress/**` 항목(node-output-redesign 계열, ai-agent-tool-connection-rewrite, backend-lint-gate 등 예산 초과로 절단된 60여개 포함)은 제목·부분 본문 기준으로 마이그레이션/리뷰-인용 컨벤션과 무관한 도메인이며, 이번 target 변경이 가정하는 선행 조건이나 후속 항목과 겹치는 지점을 찾지 못했다.

경미한 관찰(조치 불요): plan 문서 본문의 "104개 파일 · 508회"(2026-09-04 측정) 수치와 target `review-citations.md` 의 "107개 파일 · 514회"(2026-09-05 09시 측정) 수치가 다르다 — 두 문서 모두 "리뷰 라운드가 늘 때마다 수는 계속 증가한다"고 명시적으로 인지하고 있어(문서 자체가 "판단에 쓰이는 것은 마지막 줄"이라 적음) 불일치가 아니라 측정 시점 차이다.

## 요약

이번 검토 대상(`spec/conventions/migrations.md`, `review-citations.md`, `codebase/backend/migrations/README.md`)은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `## 후속` 트래커가 사전에 명시적으로 등재해 둔 항목을 정확히 그대로 구현·성문화한 결과물이다. 미해결로 남겨야 할 두 항목(Flyway `mixed=true` 도입 여부, 해소 불가 bare 인용 8건)은 target 이 결정을 내리지 않고 plan 과 동일하게 열어 두었으며, 다른 in-progress plan 문서와 충돌하거나 그 전제를 무효화하는 지점도 없다. Plan 정합성 관점에서 이 델타는 깨끗하다.

## 위험도

NONE
