# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실행 코드 변경 없는 순수 문서/spec/plan PR(마이그레이션 재실행 안전성 컨벤션 + 리뷰 인용 규약 성문화). 신설 `review-citations.md` 가 스스로의 적용 범위 주장("spec/** 위반 사례 0건")에서 실측 오류를 냈다는 WARNING 1건 외 CRITICAL 은 없음. forced whitelist(database, documentation, requirement) 3명 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `review-citations.md` §3 이 `spec/**` 를 "현재 위반 사례 0건" 이라고 단언하지만, 실측하면 최소 12개 파일·22곳에서 날짜 없는 bare `hh_mm_ss` 인용이 이미 존재함(예: `spec/1-data-model.md:995-996`, `spec/5-system/1-auth.md:545`, `spec/5-system/14-external-interaction-api.md` 다수, `spec/5-system/6-websocket-protocol.md`, `spec/conventions/secret-store.md` 등). 같은 오류가 이 PR 안의 두 consistency-check 라운드(`10_04_12`→`10_13_38`)에도 재확인 없이 이어짐 | `spec/conventions/review-citations.md:67` | §3 의 "현재 위반 사례 0건"을 실측치로 정정하거나, 최소한 §4 grandfather 목록(`codebase/**` 499건 + `scripts/**`·`.github/**` 6건)에 `spec/**` 기존 bare 인용도 포함시켜 "적용은 신규 인용부터"임을 명확히 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `spec/conventions/migrations.md` §3 이 `migrate-repair` 절차를 README.md "§5" 로 가리키나 실제 위치는 "§6"(pre-existing, `origin/main` 과 동일해 이번 diff 게이트 없음). 같은 절차를 이번 PR 이 README §5 안에 새로 추가한 문장(160행)은 정확히 "§6 말미"로 인용해, 같은 절차를 가리키는 두 인용이 엇갈린 채 병존 | `spec/conventions/migrations.md` "## 3. Append-only 원칙" 마지막 불릿 | 이 PR 범위 밖(diff 미포함)이라 강제 사안 아니나, 다음에 이 절을 손댈 때 "§5"→"§6" 정정 병행 권장 |
| 2 | documentation | `plan/in-progress/spec-draft-nullable-notation-followups.md` 안에 날짜 없는 bare `hh_mm_ss` 인용과 전체 경로 인용이 한 문서에 혼재. `review-citations.md` §3 이 `plan/**` 을 규약 "대상 아님"으로 명시했으므로 위반은 아님(가독성 참고 사항, 조치 불요) | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 없음(스코프 밖 선택 사항) — `plan/**` 에도 전체 경로 표기를 관례로 굳히고 싶다면 별도 결정 항목으로 등재 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | `review-citations.md` §3 "spec/** 위반 사례 0건" 주장이 실측과 어긋남(WARNING 1건). 그 외 9라운드 누적 검토 항목은 전부 실제 반영 확인, 회귀 없음 |
| documentation | NONE | 사소한 pre-existing 교차참조 오류 1건(§5→§6, 스코프 밖) + 가독성 참고 1건(INFO 2건). CRITICAL/WARNING 없음 |
| database | NONE | 실행되는 SQL 마이그레이션·쿼리·트랜잭션·커넥션 코드 변경 전무. 문서(README §5 "DROP-먼저" 패턴)만 변경, 실물 마이그레이션(V056/V106/V110) 대조는 이전 3라운드가 이미 수행·일치 확인 |

## 발견 없는 에이전트

- database — 실행되는 DB 코드 변경이 없어 지적 대상 없음(NONE)

## 권장 조치사항
1. `spec/conventions/review-citations.md` §3 의 "spec/** 현재 위반 사례 0건" 서술을 실측치(12개 파일·22곳 이상 bare 인용)로 정정하거나, §4 grandfather 목록에 `spec/**` 기존 bare 인용을 명시적으로 포함시켜 향후 오탐지 재발을 막는다.
2. (선택, 스코프 밖) 다음에 `spec/conventions/migrations.md` §3 를 손댈 기회가 있으면 README.md 절 참조를 "§5"→"§6" 으로 정정한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `requirement`, `documentation`, `database` (3명, 전원 router_safety 강제 포함)
  - **제외**: 표 (reviewer · 이유, 11명)
  - **강제 포함(router_safety)**: `database`, `documentation`, `requirement` — 3명 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | security | router 가 이번 diff(문서/spec/plan 전용)에 대해 비관련으로 판단해 제외 |
  | performance | 상동 |
  | architecture | 상동 |
  | scope | 상동 |
  | side_effect | 상동 |
  | maintainability | 상동 |
  | testing | 상동 |
  | dependency | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |
