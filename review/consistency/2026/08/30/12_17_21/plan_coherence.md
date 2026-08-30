# Plan 정합성 검토 — target: `spec/conventions/` (--impl-prep)

## 컨텍스트 재구성 (요약)

`raw-update-guard-scope` 워크트리는 브랜치 diff 가 아직 0(= `origin/main` 과 동일, 착수 전
`--impl-prep` 게이트)이라 실제 변경분은 없다. target 번들·브랜치명·현재 `spec/conventions/`
상태로 미루어, 이 턴은 `plan/in-progress/update-returning-tuple-shape.md` §후속의
**`[planner 위임]`** 두 항목 — ① raw SQL 결과 shape 불변식을 `spec/conventions/` 규약으로
승격, ② 소급 각주 5건 중 `spec/conventions/node-cancellation.md` §2.4 몫 — 을 집행하려는
것으로 판단된다 (target scope 선언이 `spec/conventions/` 로 한정돼 있어 5-system/data-flow
쪽 3~4건은 이 턴의 대상이 아닌 것으로 보인다).

## 발견사항

- **[WARNING]** `node-cancellation.md` §2.4 각주가 이미 다른 plan 에 "정본"으로 선점돼 있다 — 중복 집필 위험
  - target 위치: `spec/conventions/node-cancellation.md` §2.4 "DB 관측 취소 가드" (현재 66~104행, 각주 없음 — 직접 확인)
  - 관련 plan: `plan/in-progress/update-returning-tuple-shape.md` §후속 `[planner 위임]` "소급 각주 — 대상이 한 문서가 아니다"(321~366행) 및 그 자신의 체크리스트 `[x] 소급 영향 세 번째 plan(exec-intake-followups.md) 배너 + 위임 5건 집결 티켓 #12 등재`(227행) / `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` §"추가 위임 (2026-08-14 #12) — `UPDATE … RETURNING` 튜플 shape 수정의 소급 각주 5건"(611~656행)
  - 상세: `update-returning-tuple-shape.md` 자신이 "이 각주가 자기 후속 절에만 있으면 다음 planner 스윕에서 놓칠 위험이 있다"고 판단해 **별도 plan 파일의 #12 티켓에 이미 정본 캡션을 등재**해 뒀다. `spec-update-node-cancellation-shutdown-classification.md:625` 는 `node-cancellation.md §2.4` 에 넣을 caveat 문구(행 라벨이 아니라 소비 경로 단위 — 11곳/3파일, `executeSync` 제외 등)를 이미 정확히 확정해 뒀고, "각주를 쓸 때 전수 목록을 다시 열 것: update-returning-tuple-shape.md §후속 의 표가 정본"이라고 명시한다. 이 저장소는 이 정확한 문구를 **이미 두 번 틀렸다**(서술형 라벨 → 한 파일만 집계, `00_20_21` side_effect W2). `raw-update-guard-scope` 가 이 #12 캡션을 참조하지 않고 §2.4 각주를 독립적으로 다시 쓰면 세 번째 오류 반복 위험이 있고, #12 티켓 쪽 테이블은 갱신되지 않아 두 plan 이 같은 델타를 서로 모른 채 추적하게 된다.
  - 제안: §2.4 각주는 `spec-update-node-cancellation-shutdown-classification.md:625` 의 문구를 그대로(또는 그 문구 갱신과 동기화해) 사용하고, 반영 후 그 plan 의 #12 테이블에서 `node-cancellation.md` 행을 완료로 표시(다른 4행은 `spec/conventions/` 밖이라 이 턴 스코프 밖임을 명시). 두 plan 이 같은 문구를 두 곳에 유지해야 한다면 한쪽을 포인터로 정리할 것.

- **[WARNING]** #12 집결 티켓 5건 중 4건이 `spec/conventions/` 밖 — 이번 턴에서 닫히지 않음이 plan 에 반영돼야 함
  - target 위치: target 번들 헤더 "구현 대상 영역: `spec/conventions/`"
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:619~624` (표 4행: `spec/5-system/4-execution-engine.md` §1.1, `spec/5-system/8-embedding-pipeline.md` §7.3, `spec/5-system/10-graph-rag.md` 동시 호출 표, `spec/data-flow/2-auth.md` OAuth state 소비)
  - 상세: 직접 실측 — 네 문서 모두 `updateReturningRows`/`8332d9a20`/`persisted`/"항상 실패" 류 소급 각주가 **아직 없다**(grep 0건, `execution-engine.md`·`embedding-pipeline.md`·`graph-rag.md`·`data-flow/2-auth.md` 전수 확인). target scope 가 `spec/conventions/` 로 선언돼 있어 이번 턴은 구조적으로 이 4건을 건드릴 수 없다. 이 자체는 결함이 아니지만(스코프를 좁게 잡는 건 정상), #12 티켓이 "5건 일괄" 로 서술돼 있어 이번 턴이 그중 1건만 닫고 끝나면 완료 여부가 plan 상 불분명해진다.
  - 제안: 이번 턴에서 `node-cancellation.md` 몫만 닫는다면, `spec-update-node-cancellation-shutdown-classification.md` #12 표에 "1/5 완료, 나머지 4건은 `spec/conventions/` 밖이라 별도 턴 필요"를 명시해 다음 planner 스윕이 잔여 4건을 다시 찾을 수 있게 할 것.

- **[WARNING]** `node-cancellation.md` frontmatter `pending_plans:` 미등재 — plan 이 명시적으로 지시한 항목
  - target 위치: `spec/conventions/node-cancellation.md` frontmatter `pending_plans:` (현재 `node-cancellation-residual-signal-propagation.md` 1건만 존재 — 직접 확인)
  - 관련 plan: `plan/in-progress/update-returning-tuple-shape.md:365` "덧붙여 `node-cancellation.md` frontmatter `pending_plans:` 에 이 plan 을 등재해 `spec-pending-plan-existence.test.ts` 가 추적하게 할 것 (`23_46_01` WARNING 2)"
  - 상세: 이 지시는 `[planner 위임]` 항목 산하에 있고 아직 미반영이다. target scope(`spec/conventions/`)에 정확히 속하는 작업이라 이번 턴에서 처리 가능/필요.
  - 제안: `node-cancellation.md` frontmatter 에 `plan/in-progress/update-returning-tuple-shape.md` 를 `pending_plans:` 항목으로 추가.

- **[INFO]** 신규 불변식 위치 — `migrations.md` 확장은 문서 스코프와 어긋난다
  - target 위치: `spec/conventions/migrations.md` (Overview: "PostgreSQL 스키마 마이그레이션을 다음 세 가지 안전성 기준으로 운영" — 충돌 방지·순서 보장·운영 안전성)
  - 관련 plan: `plan/in-progress/update-returning-tuple-shape.md:319~320` "위치는 `spec/conventions/` 신규 문서 또는 기존 `migrations.md` 확장. 어느 쪽이든 (b) 를 빼지 말 것"
  - 상세: `migrations.md` 본문을 직접 읽었다 — Flyway 파일 버전 번호·명명·append-only·머지 race 안전망만 다루며, `raw` / `.query(` / `RETURNING` / `updateReturningRows` 등 런타임 쿼리 결과 처리와 관련된 서술은 0건이다. 이 문서에 "raw UPDATE/DELETE RETURNING 결과는 `updateReturningRows` 경유" + "raw `.query()` 컬럼명은 snake_case" 를 끼워 넣으면 문서 책임(마이그레이션 *파일* 버전 안전성) 과 무관한 런타임 계약이 섞여 Overview 의 "세 가지 안전성 기준"과 어긋난다.
  - 제안: 신규 전용 문서(예: `spec/conventions/raw-query-results.md` 류)로 승격 권장. plan 이 이미 경고한 대로 (a) 튜플 언랩 + (b) snake_case 컬럼명 두 불변식을 **모두** 넣을 것 — (b) 를 빠뜨렸던 것이 이 plan에서 이미 한 번 CRITICAL 로 실현된 실수다(`rememberMe` 결함).

## 요약

`raw-update-guard-scope` 는 `update-returning-tuple-shape.md` 의 `[planner 위임]` 후속(규약
승격 + 소급 각주)을 집행하는 턴으로 보이는데, 정확히 이 델타를 다루는 "정본" 캡션과 집결
티켓이 **다른 plan 파일**(`spec-update-node-cancellation-shutdown-classification.md` #12)에
이미 확정돼 있다. 그 문구가 이미 두 번 틀렸던 이력이 있어, 이번 턴이 그 캡션을 참조하지 않고
독립적으로 §2.4 각주를 다시 쓰면 세 번째 반복과 두 plan 간 추적 drift 위험이 있다. 그 외
`pending_plans:` 미등재(명시적 지시 미반영)와 `migrations.md` 확장 시 문서 스코프 이탈
가능성도 실측으로 확인된 구체적 리스크다. 미해결 사용자 결정(예: 취소 상태 분류 (a)/(b))과의
직접 충돌은 없다 — §2.4/규약 승격 작업은 그 결정과 독립적이다.

## 위험도
MEDIUM
