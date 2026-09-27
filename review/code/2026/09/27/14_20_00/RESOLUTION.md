# RESOLUTION — `/ai-review` 2R (`review/code/2026/09/27/14_20_00`)

판정 기준 HEAD: `1a9d9b414`(리뷰 대상). 리뷰어 transcript 에 워크트리로 쓰는 명령(`cp` · `sed -i` · 리다이렉트 · Edit · Write)이
세션 디렉터리 밖으로 한 건도 없다. forced 7명 전원 결과 확보(`forced_missing` · `unfinished` 비어 있음).

**종결 판정 — 이 라운드는 codebase 수정 0건이다.** Critical 0. Warning 2건은 developer SKILL §ISSUE FIX 정책의 **수렴 예외**로
등재한다:

- (a) **동작 결함이 아니다** — W1 은 구조(응답 직렬화 계층 부재)이고 리뷰어 스스로 «이번 PR 범위에서 구조 변경은 불필요» 라 적었다.
  W2 는 요청 DTO 선언(OpenAPI 가 이미 받는 null 입력을 덜 광고) — 런타임은 null 을 받아 값을 지우며, 그 동작은 단위 테스트가 고정한다.
  라운드의 발견 성격이 1R 의 동작(`settings: null` 500) → 2R 의 구조 · 선언으로 옮겨 갔다.
- (b) **고치면 새 라운드가 강제된다** — 둘 다 `codebase/**` 수정이라 리뷰 freshness 가 재무장되고, W2 는 두 DTO 의 선언 · 타입을
  바꿔 그 라운드가 또 잔여(스웨거 래칫 · 소비처 타입)를 낼 형태다.
- (c) 이 판정과 근거를 여기 적는다 — 등재 사유는 비용이 아니라 수렴이다.
- (d) **그 턴에 등재했다** — `plan/in-progress/spec-draft-nullable-notation-followups.md` 새 항목 «PATCH 부분 본문 후속 — 요청 DTO
  `description` 의 nullable 선언 · 응답 직렬화 계층 부재 · 캐너리 둘».

## 조치 항목

| SUMMARY # | 심각도 | 조치 | 커밋 |
|---|---|---|---|
| W1 | Warning | 수렴 예외 — 트래커 새 항목 (W1): 인가용 관계가 응답에 새는 형태의 전수 → 응답 매퍼 vs 화이트리스트 직렬화 결정 | 이 커밋(트래커) |
| W2 | Warning | 수렴 예외 — 트래커 새 항목 (W2): `UpdateWorkflowDto` · `UpdateNodeDto` 의 `description` 을 `nullable: true` + `string \| null` 로. 가드가 `Object.assign` 교차 우회를 못 보는 점도 함께 | 이 커밋(트래커) |
| INFO 1 · 2 | Info | 트래커 새 항목에 함께 등재(노드 · 인증 설정 null 캐너리 · 헬퍼 JSDoc 의 null 입력 가드 문장) | 이 커밋(트래커) |
| INFO 4 | Info | `settings` 최상위 null = no-op vs 스칼라 null = 지움 → 트래커 planner 항목 (7)에 한 문장으로 덧붙임 | 이 커밋(트래커) |
| INFO 3 · 5 · 6 | Info | 조치 불요 — 3 은 경미(리뷰어 «결함 아님») · 5 는 plan §가드가 검토한 트레이드오프 · 6 은 기존 신뢰 경계 | — |

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260927-140921.log`)
- unit: 통과 (`_test_logs/unit-20260927-141020.log`)
- build: 통과 (`_test_logs/build-20260927-141145.log`)
- e2e: 통과 — 422 passed (`_test_logs/e2e-20260927-141445.log`). 이 라운드는 codebase 수정이 없어 1R 조치 뒤 결과가 그대로 유효하다

## 보류·후속 항목

- W1 · W2 · INFO 1 · 2 → 위 트래커 새 항목. INFO 4 → 트래커 planner 항목 (7).
