# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done)

## 사전 확인 (target 재정의)

프롬프트가 지정한 워크트리 이름(`eia-r8-cache-scope-4ae434`)과 "구현 대상 spec 영역: `spec/5-system/`" 배너는
stale 하다 — 이 세션에서 이미 확인된 사실이다(직전 라운드 `00_00_45/cross_spec.md` INFO + 방금 커밋
`103dee234 "stale 워크트리 이름이 consistency 대상을 오염시킨다"`). 실제로 비교해야 할 대상은
`git diff origin/main...HEAD` 이며, `spec/**` 파일은 **1건도 포함되지 않는다** — 전부 `codebase/backend/src/**`
(TypeORM `UPDATE`/`DELETE … RETURNING` 튜플 shape 오인 버그 수정: `auth-oauth.service.ts`,
`execution-engine.service.ts`, `knowledge-base.service.ts` + 신규 유틸 `update-returning-rows.ts`/
`source-scan.ts` + `assert-row-array.ts` 문서화)와 `plan/`·`review/` 산출물이다. 이번 라운드는 프롬프트 내
"target 문서(spec/5-system/ 전 파일 번들)" 를 문자 그대로 비교하는 대신, 실제 diff 가 건드리는 코드가
기존 **여러 spec 영역**(§5-system/1-auth, §5-system/3-error-handling, §5-system/4-execution-engine,
§5-system/8-embedding-pipeline, §5-system/10-graph-rag, data-flow/2-auth, data-flow/3-execution)의
문서화된 계약과 상충하는지를 점검했다(예산 초과로 프롬프트에서 생략된 파일은 워크트리 절대경로로 직접 `Read`).

## 발견사항

이번 diff 는 순수 **버그 수정**(런타임에서 `UPDATE`/`DELETE … RETURNING` 이 `[rows, rowCount]` 튜플을
반환하는데도 행 배열로 오인해 8개 지점의 조건 분기가 죽어 있던 결함)이며, API shape·엔티티 필드·요구사항
ID·상태 머신 정의·RBAC 매트릭스를 새로 도입하거나 변경하지 않는다. 교차 검증 결과, 오히려 각 지점은
**이미 존재하는(변경되지 않은) spec 서술과의 불일치를 해소**한다:

- OAuth 소셜 로그인 콜백 (`auth-oauth.service.ts`): 수정 전에는 `record.rememberMe`(camelCase, 항상
  `undefined`)를 읽어 `rememberMe ? 30 : 7`이 늘 7을 골랐고, `consumed[0]`이 행이 아니라 행 배열이라 정상
  콜백까지 전부 `OAUTH_STATE_MISMATCH`로 실패했다. `spec/data-flow/2-auth.md:274`(`auth_oauth_state` 컬럼명
  `remember_me`)·`spec/5-system/1-auth.md:2254`(`rememberMe` 시 30일)와 대조한 결과, 수정 후 코드
  (`AuthOAuthStateRow.remember_me` snake_case 필드로 읽기)가 정확히 두 문서의 기존 서술과 일치한다 — 신규
  충돌 없음, 오히려 상시 회귀를 해소.
- 실행 admission gate (`execution-engine.service.ts` admission UPDATE): `spec/5-system/4-execution-engine.md`
  §8("동시 실행 제한" — advisory lock + 조건부 UPDATE…RETURNING 으로 cap 을 원자적으로 강제)과 대조.
  수정 전에는 튜플 length 가 항상 2 라 `rows.length === 1` 판정이 항상 거짓 → 매 admission 이 (UPDATE 는
  실제로 커밋됐음에도) "미승인"으로 오판돼 BullMQ stalled 재배달(§7.1) 경로로 우회 구동되고 있었다(2초 지연 +
  `execution.started` WS 이벤트/`recordRunningSegmentStart` 미실행). `spec/data-flow/3-execution.md`
  §1.2 시퀀스(정상 admission 시 `UPDATE status='running'` 직후 즉시 `emit 'execution.started'`)와 대조한
  결과, 수정 후 코드가 이 시퀀스를 다시 따른다 — 신규 충돌 없음.
- KB CAS 락/재큐 (`knowledge-base.service.ts` re-extract/re-embed/embedding-requeue/graph-requeue):
  `spec/5-system/10-graph-rag.md:565`(`KB_REEXTRACT_IN_PROGRESS`, atomic CAS)·
  `spec/5-system/8-embedding-pipeline.md:257-268`("결과가 0행이면 409 KB_REEMBED_IN_PROGRESS", "빈 KB 는
  진입 시 즉시 idle 로 되돌린다")와 대조. 수정 전에는 튜플 length 가 항상 2 라 0행 분기가 한 번도 타지
  않아 (a) 동시 재추출/재임베딩 요청이 거부되지 않고, (b) 빈 KB 가 `reembed_status='in_progress'` 로
  좌초하는 두 가지 spec 위반이 있었다. 수정 후 코드가 두 문서의 명시적 서술을 그대로 복원한다 — 신규
  충돌 없음.
- 에러 코드 카탈로그: `KB_REEXTRACT_IN_PROGRESS`/`KB_REEMBED_IN_PROGRESS`(409)는
  `spec/5-system/3-error-handling.md` §1.8 인근에 이미 등재돼 있고 코드와 status·의미가 일치한다.

- **[INFO] `OAUTH_STATE_MISMATCH` 중앙 카탈로그 미등재 — 이미 이 세션에서 처리됨(신규 아님)**
  - target 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:179,186`
  - 충돌 대상: `spec/5-system/3-error-handling.md` (도메인 전용 코드 카탈로그, `KB_REEXTRACT_IN_PROGRESS`/
    `KB_REEMBED_IN_PROGRESS`는 등재돼 있는데 `OAUTH_STATE_MISMATCH`는 빠짐)
  - 상세: 이 코드 자체는 `spec/2-navigation/4-integration.md:851`·`spec/conventions/error-codes.md:35`
    에 이미 문서화돼 있어 "미문서화"는 아니지만, `3-error-handling.md` 의 중앙 카탈로그 절에는 누락돼
    있다(실측 0건, 자매 KB 코드는 각 1건). 이 항목은 직전 라운드 cross_spec 이 이미 지적했고,
    커밋 `a53af772b`(`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`)로
    "위임 티켓" 형태로 이미 기록·추적 중이다 — 신규 발견이 아니라 상태 확인.
  - 제안: 조치 불요(이미 plan 에 등재됨). 추가 조치가 필요하면 해당 plan 실행 시점에 §1.8 인근에
    `OAUTH_STATE_MISMATCH (400)` 행을 추가하되, 로그인 OAuth 와 연동(cafe24/makeshop) OAuth 가 같은
    문자열을 공유한다는 점(두 서비스가 동일 에러 코드를 던짐)을 명시할 것.

- **[INFO] `auth_oauth_state` 테이블이 `spec/1-data-model.md` 엔티티 카탈로그에 없음 (기존 상태, 이 diff 가 만든 문제 아님)**
  - target 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`AuthOAuthStateRow`)
  - 충돌 대상: `spec/1-data-model.md` (엔티티 목록)
  - 상세: `auth_oauth_state` 테이블은 `spec/data-flow/2-auth.md`(§274-275, DB effects 표)에는 나오지만
    `1-data-model.md` 의 엔티티 카탈로그에는 없다(단명 CSRF state 토큰 테이블이라 의도적으로 제외됐을 가능성이
    높다 — WorkspaceInvitation·RefreshToken 등 다른 단명/보조 테이블과 취급이 다를 이유는 확인 못 함).
    이번 diff 가 이 테이블의 존재나 스키마를 바꾸지 않으므로 새로 만든 불일치는 아니다.
  - 제안: 조치 불요(스코프 밖). 차후 데이터 모델 문서를 손볼 때 참고.

## 요약
diff 는 `spec/**` 를 전혀 건드리지 않는 순수 코드 버그 수정(TypeORM `UPDATE`/`DELETE … RETURNING` 튜플
shape 오인 8곳 정정)이며, 영향 영역(OAuth 소셜 로그인의 `remember_me`/상태 소비, 실행 엔진 admission
gate, KB CAS 락·재큐)을 각각의 SoT 문서(`data-flow/2-auth.md`, `5-system/1-auth.md §2.1 표`,
`5-system/4-execution-engine.md §8`, `data-flow/3-execution.md §1.2`, `5-system/10-graph-rag.md §5.1`,
`5-system/8-embedding-pipeline.md §7.3`)와 대조한 결과 전부 **기존에 이미 정의된 계약을 복원**하는
방향이었고, 새 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다.
`OAUTH_STATE_MISMATCH` 중앙 카탈로그 미등재는 실재하는 간극이지만 이미 이 세션 내에서 plan 으로
위임·추적되고 있어 신규 차단 사유가 아니다.

## 위험도
NONE
