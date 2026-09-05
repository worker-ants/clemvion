# Plan 정합성 검토 — `spec-draft-migration-rerun-and-citations.md`

## 발견사항

- **[WARNING]** 출처 plan(`spec-draft-nullable-notation-followups.md`)의 체크박스 2건을 닫는 절차가 target 에 없다
  - target 위치: 문서 상단 인용문(`> 출처: spec-draft-nullable-notation-followups.md 의 남은 규약 항목 둘`), §① 1.4 결정, §② 2.2 결정
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미체크 항목
    - `- [ ] CREATE INDEX CONCURRENTLY IF NOT EXISTS 재실행 위험 — 규약 차원 처리 (developer, `23_02_51` W1)` (line 400)
    - `- [ ] 코드 주석의 리뷰 세션 ID 인용 — 규약으로 결정하거나 관례를 성문화 (planner, `00_06_38` W2)` (line 434)
  - 상세: target 은 이 두 항목의 실질적 결정(① DROP-first 기본 채택 + mixed=true 는 별도 결정 항목으로 분리, ② 날짜 포함 성문화)을 이미 내렸지만, 문서 어디에도 출처 plan 의 해당 체크박스를 `[x]` 로 닫고 포인터를 남기는 절차가 없다. 같은 출처 plan 파일 안에서 이미 3회 반복된 확립된 패턴 — `§2.2 자원 액션 패턴`(→ `spec-draft-scope-and-anchor-drift.md` ③), `§5.4 스코프 문구`(→ 동 파일 ①), `idx_schedule_next_run 교체`(→ `spec-draft-schedule-index.md`) — 는 전부 "반영 완료 (`<child-draft>.md` §N)" 형태로 원본 체크박스를 닫는다. 이번 두 항목만 그 동기화 계획이 빠지면, 출처 plan 은 실제로는 해소된 항목을 여전히 미해결로 표시한 채 남고, 그 plan 자신의 `## 종결 조건`("`## 후속` 체크박스가 전부 닫히는 것")도 영구히 미충족 상태가 된다. 이는 이 저장소가 반복 지적해 온 "체크리스트 두 군데 동기화" 실패 패턴과 같은 유형이다.
  - 제안: target 문서(또는 실제 편집이 반영되는 커밋)에 `spec-draft-nullable-notation-followups.md` 의 두 체크박스를 `[x]` + "반영 완료 (`spec-draft-migration-rerun-and-citations.md` ①/②)" 포인터로 닫는 단계를 명시적으로 추가한다.

- **[INFO]** 리뷰 인용 통계가 같은 날짜에 두 plan 문서에서 서로 다른 수치로 인용됨
  - target 위치: §2.1 표 (`107개 파일 · 514회`, `499회` bare 인용, `8개` 해소 불가)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `00_06_38` W2 항목 (line 437-439, `104개 파일 · 508회`)
  - 상세: 두 실측 모두 `started: 2026-09-05` 로 같은 날 수행됐지만 수치가 다르다(작업이 계속 쌓이며 재측정 시점이 갈렸을 가능성이 높다). 결론(방향)은 일치하지만, 두 문서가 "같은 사실"을 다른 숫자로 인용한 채 나란히 남으면 다음에 이 수를 읽는 사람이 어느 쪽이 최신인지 판단할 근거가 없다.
  - 제안: target §2.1 에 측정 시각(세션 경로) 한 줄을 덧붙여, 출처 plan 의 수치보다 나중에 잰 것임을 명시하거나, 출처 plan 쪽 수치를 target 값으로 갱신.

- **[INFO]** §3 "이 draft 가 등재하는 후속" 두 항목이 체크박스 형식이 아니다
  - target 위치: §③ "이 draft 가 등재하는 후속" (`mixed=true 도입 여부`, `bare 인용 8건의 해소`)
  - 관련 plan: 동일 파일의 `## 후속` 체크박스 관행(`- [ ]`/`- [x]`) 및 [`plan-lifecycle.md §5`](../../.claude/docs/plan-lifecycle.md) 이동 전 자가점검("미해결 follow-up 이 0건인가")
  - 상세: 출처 plan 은 미해결 항목을 전부 `- [ ]` 체크박스로 관리해 이동 시 자가점검이 그대로 먹힌다. target 은 같은 성격의 두 항목을 산문으로만 적어, 나중에 이 draft 를 `complete/` 로 옮기려는 사람이 체크박스만 훑고 두 항목을 놓칠 위험이 있다.
  - 제안: §3 두 항목을 `- [ ]` 형식으로 바꾸거나, 별도 `## 후속` 섹션을 신설해 출처 plan 과 같은 구조를 따른다.

## 요약

target 이 결정하는 두 항목(CONCURRENTLY 재실행 패턴 DROP-first 채택 + mixed=true 분리 결정, 리뷰 인용 날짜 포함 성문화)은 출처 plan(`spec-draft-nullable-notation-followups.md`)이 "결정 필요"로 남겨둔 항목과 충돌하지 않고, 오히려 그 항목이 명시한 제약(예: mixed=true 전역 해제는 별도 결정)을 그대로 존중한다. `migrations.md`/`migrations/README.md` 의 기존 서술(§5 "정확히 한 개만"·transactional 혼합 금지)과도 실측(V110 선례) 기준으로 어긋나지 않는다. 다만 target 이 출처 plan 의 두 체크박스를 닫는 동기화 절차를 문서에 담지 않아, 같은 파일에서 이미 3회 확립된 "자식 draft 로 위임 후 원본 체크박스 포인터 클로징" 패턴이 이번만 누락된 상태다 — 방치하면 출처 plan 이 실제로 해소된 항목을 미해결로 계속 표시하게 된다.

## 위험도

LOW
