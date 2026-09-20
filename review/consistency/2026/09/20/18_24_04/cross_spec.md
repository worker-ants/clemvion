# Cross-Spec 일관성 검토 — `spec/2-navigation` (impl-done: rotate lost-update)

## 검토 전제

이번 `--impl-done` 대상 scope 는 `spec/2-navigation` 이지만 해당 영역 spec 델타는 0개다(정상 — 코드
전용 PR). 실제 구현 diff 는 `codebase/backend/src/modules/integrations/integrations.service.ts`
(155줄) · 그 unit spec(151줄) · 신규 e2e `integration-rotate-concurrency.e2e-spec.ts`(162줄) 3개
파일이며, 대상 spec 은 `spec/2-navigation/4-integration.md`(`code:` 프런트매터가
`codebase/backend/src/modules/integrations/**` 를 포괄)다. 동일 착수(`plan/complete/rotate-lost-update.md`)에
대해 `--impl-prep` 단계에서 이미 cross_spec 검토(`review/consistency/2026/09/20/16_58_56/cross_spec.md`,
LOW·INFO 1)가 수행됐다 — 이번 검토는 **실제 구현이 그 사전 분석과 어긋나지 않는지**, 그리고 **구현 중
새로 드러난 cross-spec 충돌이 없는지**를 절대경로 워킹트리 diff 로 재확인한다.

## 구현 내용 요약 (diff 실측)

`IntegrationsService.rotate()`:
- 권한 체크(`scope==='organization' → admin 필요`)와 credentials merge+검증을 각각
  `assertCanRotate` / `mergeAndValidateCredentials` private 헬퍼로 추출.
- 외부 연결 테스트(`dispatchTest`, 실접속·수 초)는 그대로 트랜잭션 **밖**에서 실행.
- 테스트 통과 후 `dataSource.transaction` + `lock: { mode: 'pessimistic_write' }` 로 `{ id, workspaceId }`
  행을 **다시 읽고**, 그 자리에서 권한 재검사·merge 재검증·부분 `update` 를 수행.
- 에러 코드(`FORBIDDEN`, `INTEGRATION_INVALID_CREDENTIALS`, `RESOURCE_NOT_FOUND`, `INTEGRATION_ROTATE_UNSUPPORTED`)와
  성공 응답(200/PublicIntegration)은 변경 없음. audit log(`integration.rotated`) 호출도 트랜잭션 밖에서
  기존과 동일하게 실행.

## 점검 결과

### 1. 데이터 모델 — 충돌 없음
`fresh` 재읽기 조건이 `{ id: entity.id, workspaceId }` 로, 기존 `requireEntity(id, workspaceId)` 와 동일하게
workspace 스코프를 유지한다. `spec/1-data-model.md §2.10 Integration` 에 버전 컬럼(`@VersionColumn`)이 없다는
전제도 그대로 — 새 컬럼·마이그레이션 없이 행 잠금만 추가했으므로 데이터 모델 선언과 어긋나지 않는다.

### 2. API 계약 — 충돌 없음
`spec/2-navigation/4-integration.md` §9.2 `POST /api/integrations/:id/rotate` 행("내부적으로 테스트 →
성공 시만 커밋")과 §4.3 "실패 시 기존 자격 증명 유지" 서술 모두, 구현이 유지하는 외부 계약(200 성공·실패
시 원상 유지·에러 코드 불변)과 일치한다. 새 에러 코드(`INTEGRATION_ROTATE_CONFLICT` 등)는 도입되지 않았고
`spec/` 전체에 그 문자열이 남아있지 않음을 재확인했다(철회된 draft `plan/complete/spec-draft-rotate-conflict.md`
는 `status: superseded` 로 정리되어 있다).

### 3. RBAC — 충돌 없음
`assertCanRotate` 의 "organization scope → admin 필요" 규칙은 `spec/2-navigation/4-integration.md §8`
권한 규칙 표("Rotate: 본인 것만(Personal) / Admin 이상(Organization)")과 정확히 일치하며, 락 안 재검사는
그 규칙을 재정의하지 않고 TOCTOU(연결 테스트 도중 scope 변경) 창만 닫는다.

### 4. 동시성 패턴 — 충돌 없음, 기존 관례와 일치
`dataSource.transaction` + `pessimistic_write` 재읽기 후 부분 update 패턴은 diff 주석이 스스로 인용하는
`integration-oauth.service.ts`(CONC H-3, 재인증 콜백)와 형태가 같고, 이는 이미 `spec/data-flow/5-integration.md`
100~104행에 `SELECT integration FOR UPDATE (pessimistic_write — 동시 callback lost-update 차단)` 로
문서화된 패턴이다. `4-integration.md` Rationale 이 cafe24 토큰 갱신 맥락에서 기각한 "advisory lock"과는
성격이 다르다는 diff 주석의 주장(연결 테스트가 트랜잭션 밖 vs 기각 사유인 "lock 보유 중 HTTP 요청을
트랜잭션 안에 묶음")도 실제 코드 구조와 일치 — row-level lock 이고 트랜잭션 내부에는 재읽기+merge+update 만
있다. `spec/2-navigation/2-trigger-list.md`(advisory lock), `spec/5-system/1-auth.md`(WebAuthn `FOR UPDATE`),
`spec/data-flow/11-workflow.md`·`12-workspace.md`(`pessimistic_write`) 등 인접 도메인의 "외부 호출은 락 밖,
락 안에서 재읽기" 관례와도 형태가 일치한다.

### 5. 상태 전이 — 충돌 없음
`§6` 상태 전이표(`expired/error → connected`, rotate 성공 경로)는 그대로이며, 구현은 merge base 만 바꿀 뿐
성공/실패 판정이나 `status` 전이 로직 자체를 바꾸지 않는다.

### 6. 계층 책임 — 충돌 없음
변경은 `IntegrationsService` 단일 backend 서비스 메서드(및 그 unit/e2e 테스트) 내부에 국한되고,
`4-integration.md` frontmatter `code:` 글롭이 이미 이 파일들을 포괄한다. frontend·타 모듈 경계 재조정 없음.

## 발견사항

- **[INFO]** `spec/data-flow/5-integration.md` 의 rotate 서술이 여전히 신규 잠금 메커니즘을 언급하지 않음
  (impl-prep 단계 INFO 의 잔존 — 이번 구현에서도 미반영)
  - target 위치: `spec/2-navigation/4-integration.md` §9.2 rotate 행 — 문구 변경 없음(계획대로, `spec_impact: none`)
  - 충돌 대상: `spec/data-flow/5-integration.md` rotate 산문(약 65~67행) vs 같은 파일의 OAuth
    reauthorize/request_scopes 시퀀스(100~104행, `SELECT integration FOR UPDATE` 명시)
  - 상세: 구현이 완료되어 rotate 도 이제 같은 모듈의 `pessimistic_write` 재읽기 패턴을 쓰는데,
    `data-flow/5-integration.md` 의 rotate 산문은 여전히 "연결 테스트 통과 시 merge + `last_rotated_at`
    갱신 + `connected` 복귀"만 적어 잠금 메커니즘에 침묵한다. 모순은 아니다(침묵이지 부정이 아님)만,
    같은 문서의 인접 흐름은 이미 잠금을 명시하고 있어 정보 밀도가 비대칭적이다.
  - 제안: `--impl-prep` 때와 동일하게 비차단으로 유지. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (2026-09-20 `18_09_24` 라운드 SPEC-DRIFT 1)에 planner 후속 항목으로 등재되어 있으므로 별도 조치
    불필요 — 다음 planner 턴에서 `data-flow/5-integration.md` rotate 산문에 "커밋 직전 `SELECT integration
    FOR UPDATE` 로 재읽기 후 머지 — CONC H-3 와 동일 메커니즘" 한 줄을 덧붙이면 해소된다.

- **[INFO]** personal-scope 통합의 소유자(본인 것만) 검증 부재는 이 PR 의 회귀가 아님 — 참고용 기록
  - target 위치: `IntegrationsService.assertCanRotate` (및 이 diff 가 손대지 않은 personal-scope 분기)
  - 충돌 대상: `spec/2-navigation/4-integration.md §8` 권한 규칙 표의 "Rotate: 본인 것만(Personal)"
  - 상세: `git show origin/main:...` 대조로 이 갭이 이번 PR 이전부터 있던 것으로 이미 확인됐다
    (`review/code/2026/09/20/18_09_24/RESOLUTION.md` INFO 6). 이 diff 는 organization-scope 분기만
    재확인 대상으로 삼았을 뿐 personal-scope 소유자 검증 로직 자체를 추가·제거하지 않았으므로 cross-spec
    관점에서 이번 구현이 새로 만든 충돌이 아니다.
  - 제안: 이미 트래커(`spec-draft-nullable-notation-followups.md`)에 등재됨 — 별도 조치 불요, 이 리뷰에서는
    상태 확인 목적으로만 기록.

## 요약

구현된 코드(`integrations.service.ts` rotate 경로)는 `--impl-prep` 단계 cross-spec 분석이 예측한 그대로
"외부 호출은 락 밖 · 락 안에서 재읽기 후 머지 + 부분 update" 패턴을 도입했으며, API 계약(§9.2)·RBAC(§8)·
상태 전이(§6)·데이터 모델(§2.10) 중 어느 것도 거짓으로 만들지 않는다. 채택된 동시성 처방은 같은 모듈
(OAuth 재인증 콜백, `data-flow/5-integration.md`)과 인접 도메인(트리거 config, 워크플로우 버전, WebAuthn,
워크스페이스 삭제)에 이미 spec 으로 박제된 관례와 정확히 일치해 오히려 cross-spec 일관성을 강화하는
방향이다. 유일하게 남은 정보성 비대칭(`data-flow/5-integration.md` 의 잠금 서술 침묵)은 impl-prep 단계부터
이미 비차단으로 식별·등재되어 있고 이번 구현으로 악화되지 않았다. Critical·Warning 급 충돌은 발견되지 않았다.

## 위험도

NONE
