# 정식 규약 준수 검토 — `spec/5-system/` (--impl-done, diff-base=origin/main)

## 검토 방법

- `git diff origin/main...HEAD --stat` 실측: **`spec/` 하위 변경 파일 0개.** 이번 라운드의 diff 는 전부
  코드/plan/review 산출물이며 (`common/utils/update-returning-rows.ts` 신설, `auth-oauth.service.ts`·
  `execution-engine.service.ts`·`knowledge-base.service.ts` 수정 — `UPDATE/DELETE … RETURNING` 이
  TypeORM+pg 에서 `[rows, rowCount]` 튜플임을 오인해 admission gate·CAS 락·OAuth state 소비가
  무력화됐던 결함의 수정), `spec/5-system/**` 본문은 이번 커밋들로 한 글자도 바뀌지 않았다.
- 따라서 "diff 가 spec 을 어겼는가" 가 아니라 **"이 diff 가 되살린/노출한 코드 표면이 `spec/5-system/`
  의 기존 서술·`spec/conventions/**` 정식 규약과 여전히 부합하는가"** 를 확인했다.
- 전문이 프롬프트에 포함된 `error-codes.md`·`spec-impl-evidence.md`·`3-error-handling.md`·`1-auth.md`
  는 직접 대조했고, 예산 초과로 생략된 파일은 target 판정에 필요한 범위에서 절대경로로 직접 열었다
  (`spec/conventions/spec-impl-evidence.md`, `spec/5-system/3-error-handling.md`,
  `spec/5-system/4-execution-engine.md`, `spec/conventions/node-cancellation.md`,
  `plan/in-progress/update-returning-tuple-shape.md`).
- 코드 존재·내용 확인은 전부 워크트리 절대경로(`/Volumes/.../eia-r8-cache-scope-4ae434`) 기준으로
  수행했다 (CWD 도 이 워크트리로 확인됨).

## 발견사항

- **[WARNING] `OAUTH_STATE_MISMATCH` 가 여전히 `3-error-handling.md` 중앙 카탈로그에 미등재 — 자동 추적 백스톱 없음**
  - target 위치: `spec/5-system/3-error-handling.md` §1.2(인증/인가 에러) / §1.2.1(2FA·WebAuthn·재인증) — OAuth 로그인 에러가 등재될 자리. 실측: 문서 전체에 `OAUTH_STATE_MISMATCH` 출현 **0**회 (현재 HEAD 기준 재확인).
  - 위반 규약: `spec/conventions/error-codes.md` §1(적용 범위 — `OAUTH_*` 인라인 리터럴 코드도 규율 대상) + `3-error-handling.md` 자신이 각 도메인 절(§1.6/§1.7/§1.8/§1.9)에서 반복 선언하는 패턴("본 절은 공용 카탈로그 가시성을 위한 등재다"). 같은 층위의 형제 코드 `KB_REEMBED_IN_PROGRESS`·`KB_REEXTRACT_IN_PROGRESS`(§1.8, 실측 각 1회 등장)는 등재돼 있는데 `OAUTH_STATE_MISMATCH`(400, `auth-oauth.service.ts`/`integration-oauth.service.ts` 공유 발행)만 빠져 있다.
  - 상세: 이 갭은 새로 발견한 것이 아니다 — 같은 세션의 `cross_spec 00_20_22`(INFO 2)·`convention_compliance 00_54_07`(WARNING)이 이미 지적했고, 커밋 `a53af772b`가 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(§"추가 위임 #12")에 위임 티켓으로 명시했다. 다만 그 커밋은 **plan 문서만** 갱신했고 `developer` 롤은 `spec/` 쓰기 권한이 없어 실제 spec 반영은 못 한다 — 그래서 HEAD 시점에도 카탈로그는 여전히 비어 있다.
    한 가지는 이전 라운드 서술을 정정한다: `3-error-handling.md` 의 `status: implemented` 이고, `spec/conventions/spec-impl-evidence.md` §3 상태표에 따르면 `pending_plans:` 의무화(R-5)는 **`status: partial` 에만** 걸린다(`implemented` 는 "없음"). 즉 이 문서에 `pending_plans:` 를 안 넣은 것 자체는 R-5 위반이 아니며, `spec-status-lifecycle.test.ts`/`spec-pending-plan-existence.test.ts` 어느 build 가드도 이 카탈로그 완결성 갭을 걸러내지 못한다 — **완전히 수동 추적**에 의존한다는 뜻이라 다음 planner 스윕에서 다시 누락될 위험이 실질적이다.
  - 제안: planner 턴에서 `3-error-handling.md`(§1.2 인근, 아래 INFO 항목 참고)에 `OAUTH_STATE_MISMATCH (400)` 행을 추가해 카탈로그를 닫는다. `implemented` status 라 frontmatter 가드가 강제하지 않으므로, 반영 전까지는 최소한 이 문서 본문(예: §1.2 표 하단 note)에 짧은 pointer 를 남겨 두는 편이 다음 스윕에서 재발견되기 쉽다.

- **[INFO] 위임 plan 이 지정한 신규 카탈로그 행 삽입 위치가 도메인과 어긋남**
  - target 위치: (향후 편집 대상) `spec/5-system/3-error-handling.md` — plan 은 "§1.8 인근(도메인 전용 코드 등재 절)"을 지목.
  - 위반 규약: 현재 spec 본문엔 아직 미반영이라 직접 위반은 아니나, `3-error-handling.md` 자체의 절 구성 관례(§1.2/§1.2.1 인증·2FA, §1.6 EIA, §1.7 Webhook, §1.8 KB/GraphRAG, §1.9 워크스페이스 — 도메인별 분리) 및 `spec/conventions/error-codes.md` §1 "도메인 prefix" 원칙 관점에서 일관성 문제.
  - 상세: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(§"추가 위임 (2026-08-14 #12)")가 지정한 §1.8 은 "KB / Graph RAG 도메인 에러 코드" 전용 절이다. `OAUTH_STATE_MISMATCH` 는 인증/OAuth 로그인 코드이므로 §1.2 계열(예: §1.2.1 과 나란한 "§1.2.2 OAuth 소셜 로그인 에러 코드" 신설, 또는 §1.2 표 자체에 행 추가)이 위치상 맞다.
  - 제안: 위 WARNING 항목을 집행하는 planner 턴에서 삽입 위치를 §1.2 계열로 정정. 규약 자체 갱신은 불필요 — plan 문서의 위치 지정 오기로 보인다.

- **[INFO] 이번 diff 가 신설한 코드 표면은 명명·출력 포맷 규약을 위반하지 않는다 (조치 불필요, 확인용 기록)**
  - target 위치: `codebase/backend/src/common/utils/update-returning-rows.ts`(신규) / `AuthOAuthStateRow` 인터페이스(`auth-oauth.service.ts`).
  - 위반 규약: 해당 없음.
  - 상세: 신규 유틸 파일명(`update-returning-rows.ts`, export `updateReturningRows`)은 기존 자매 헬퍼 `assert-row-array.ts`(export `assertRowArray`)와 동일한 kebab-case-파일/camelCase-export 패턴을 따른다. `AuthOAuthStateRow` 는 API 응답 DTO 가 아니라 raw SQL row 내부 타입이라 `swagger.md` 의 DTO 명명 패턴 적용 대상이 아니다. `spec-impl-evidence.md` R-1(glob 허용)에 따라 변경된 서비스 파일들은 이미 관련 spec(`4-execution-engine.md` 등)의 `code:` glob 에 포함돼 매치되므로, 신규 공용 유틸이 별도로 각 spec `code:` 에 등재될 의무는 없다.

## 요약

이번 diff 는 `spec/5-system/` 문서를 한 글자도 바꾸지 않았고, 수정된 코드(OAuth state 소비·execution 상태 UPDATE·KB CAS 락의 `[rows, rowCount]` 튜플 오인 버그 수정, 그 하위에서 드러난 `remember_me` 컬럼명 매핑 버그 수정)도 API 표면·에러 코드 신설·DTO 네이밍 변경을 동반하지 않아 명명 규약·출력 포맷 규약·문서 3섹션 구조·Swagger 데코레이터 규약 관점에서 신규 위반은 없다. 유일한 실질 간극은 이 PR이 되살린 `OAUTH_STATE_MISMATCH`가 `3-error-handling.md` 공용 에러 카탈로그에 여전히 미등재라는 점인데, 이는 이번에 처음 발견된 것이 아니라 두 차례 앞선 라운드(`00_20_22`·`00_54_07`)가 이미 지적했고 plan 티켓으로 명시 위임됐다 — 다만 `developer` 는 `spec/` 쓰기 권한이 없어 여전히 미반영 상태이고, 문서 status 가 `implemented`라 R-5 `pending_plans:` 의무화 대상도 아니어서 이 갭을 잡아 줄 build 가드가 전혀 없다(수동 추적 전적으로 의존). 위임 plan 이 지정한 삽입 위치(§1.8)도 도메인상 §1.2 이 맞다는 점을 함께 남긴다. 그 외 전문 대조가 가능했던 `error-codes.md`·`spec-impl-evidence.md`·`1-auth.md`·`3-error-handling.md` 본문은 도메인별 카탈로그 절 구성·`UPPER_SNAKE_CASE`·Overview/본문/Rationale 3섹션 구조를 일관되게 따르고 있다.

## 위험도
LOW
