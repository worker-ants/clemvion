# Cross-Spec 일관성 검토 — 배치 B 후속 (`spec/5-system/`, impl-done)

## 검토 범위 요약

- diff-base `origin/main` 대비 코드 diff: `git diff origin/main...HEAD -- codebase/` 실측 **20개
  파일 / 1242줄** — 프롬프트가 명시한 델타와 정확히 일치(위킹트리 절대경로에서 재확인).
  `spec/5-system/**` 자체 델타는 **0개 파일**(순수 코드 PR).
- 이 세션은 같은 브랜치에 대한 **4번째 cross-spec 라운드**다(`12_21_11`→`13_22_38`→`13_34_30`→
  본 라운드). 앞선 세 라운드가 이미 CRITICAL/WARNING 0 · 위험도 NONE/LOW 로 수렴했고, 이번
  라운드가 추가로 보는 것은 그 이후 커밋 3개(`9ab43690a`·`05b899d1f`·`d80583700`)뿐이다 — 전부
  직전 `/ai-review`·`--impl-done` 지적에 대한 **fix 커밋**이며 신규 API·엔티티·RBAC·상태 전이를
  도입하지 않는다(AST 가드 통합·JSDoc 정정·fixture 대조군 보강·plan 메타데이터 정정).
- 위 3개 커밋의 diff 전문을 직접 읽어 6개 관점 대조를 재수행했다. 추가로 발견된 CRITICAL/
  WARNING 은 없다.

## 발견사항

### 확인 1 — 트리거 `endpointPath` 409 계약 (e2e B4·AST 래칫) vs `spec/5-system/3-error-handling.md §1.10`

- 코드: `webhook-trigger.e2e-spec.ts` B4 는 `(workspace_id, endpoint_path)` UNIQUE 위반 시
  `409 RESOURCE_CONFLICT` + `details = { field: 'endpoint_path', code:
  'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 를 단언(드라이버 원문 미노출도 함께 확인). 신규 AST 가드
  (`endpoint-path-conflict-wrap-guard.ts`)는 `triggerRepository.save()` 8곳 중
  `create`/`update` 만 `rethrowEndpointPathConflict` 로 래핑돼야 함을 화이트리스트로 고정한다.
- spec 대조: `spec/5-system/3-error-handling.md` §1.10(1741~1749행)이 정확히 이 조합(top-level
  `RESOURCE_CONFLICT` 유지 + `details.field='endpoint_path'` + 세부 코드
  `TRIGGER_ENDPOINT_PATH_CONFLICT`, `UPPER_SNAKE_CASE`)을 이미 문서화. `spec/2-navigation/
  2-trigger-list.md §3` 교차 참조도 동일 계약을 반복한다.
- 판정: **정합**. 새 e2e·가드는 문서로만 존재하던 계약을 실 DB 경로·정적 래칫으로 처음
  강제할 뿐 신규 계약을 만들지 않는다.

### 확인 2 — `User` 민감 컬럼 vs `WorkspacesService.listMembers` DB 투영

- 코드: `select: { id, userId, role, joinedAt, user: { id, email, name } }` 로 쿼리 범위 투영.
  반환 매핑(6키)은 이전과 동일 — wire 계약 불변.
- spec 대조: `spec/1-data-model.md §2.1.1` 이 정의하는 응답 노출 금지 민감 7컬럼
  (`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
  `emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)은 이 투영에 하나도 없다. 같은
  절이 금지하는 것은 **엔티티 전역** 컬럼 수준 `select: false`(내부 값-소비 경로 fail-silent화)
  이고, 이번 변경은 **쿼리 하나에 한정된 요청측 투영**이라 금지 대상과 다르다 — 코드 주석이
  §2.1.1 을 직접 인용해 그 구분을 명시한다.
- 판정: **정합**. 다만 아래 INFO 참조(§2.1.1 Rationale 표가 이 4번째 패턴을 아직 별도
  행으로 등재하지 않은 상태 — 이미 추적 중, 신규 아님).

### 확인 3 — AST 스캐너 중복 통합(`enclosingName` → `enclosingScopeName` 승격)

- 코드: `user-entity-exposure-guard.ts` 의 로컬 `enclosingName` 과 신규
  `endpoint-path-conflict-wrap-guard.ts` 의 별도 구현이 `source-scan.ts` 공용 함수
  `enclosingScopeName` 으로 합쳐졌다(두 가드 베이스라인 변화 0).
- spec 대조: 이 함수는 repo-guard 내부 테스트 인프라이며 spec 이 참조하는 어떤 식별자·API
  표면도 아니다(`spec/**` grep 0건). cross-spec 표면에 영향 없음.
- 판정: **정합** (해당 없음).

### 확인 4 — `__test-utils__` tsconfig exclude에 대한 3개 파일 JSDoc 정정

- 코드: `source-scan.ts`·`workspace-id-fixtures.ts`·`oauth-config-mock.ts` 가 "build tsc 가
  `__test-utils__` 를 컴파일하므로 순수 함수만 둔다" 는 종전 서술을 취소선 처리하고, 실제로는
  `tsconfig.build.json` 이 그 글로브를 제외하며 타입체크는 별도 ratchet(`tsconfig.json`,
  `run-test.sh build` 내 실행)이 담당한다고 정정했다.
- spec 대조: 이 계약은 `spec/**` 가 아니라 `plan/in-progress/auth-guard-reflection-hardening.md`
  가 예전에 세운 코드 내부 문서 계약이다 — spec 영역과는 무관. cross-spec 관점(6개) 어디에도
  해당하지 않는다.
- 판정: **해당 없음** (spec-doc 영향 없음).

### 확인 5 — fixture 대조군 보강(`wrappedViaVariable`) 및 술어 정밀화

- 코드: `.catch(...)` 전체 텍스트에 래퍼 이름이 **등장**만 해도 통과시키던 fail-open 술어를
  **호출식**으로 좁혔고(`mentionsButDoesNotCall` 음성 대조군), 수신자 매칭을 부분 문자열에서
  정확 프로퍼티 비교로 좁혔다. 순수 테스트 정밀도 개선이며 프로덕션 계약·에러 코드 변경 없음.
- 판정: **정합** (해당 없음, cross-spec 표면 미접촉).

## 참고 — 이미 추적 중인 인접 이슈 (신규 아님, 정보 제공용)

- **[INFO]** `spec/1-data-model.md ## Rationale` "`User` 민감 컬럼 방어" 표가 실제로 두 번 쓰인
  "쿼리 범위 `select` 투영" 패턴(`WorkflowVersionsService.findOne` #1292 ·
  `WorkspacesService.listMembers` 배치 B)을 표의 3개 선택지(컬럼 `select:false` 기각/응답 DTO
  손질 단독 기각/응답 경계 투영+검출 2축 채택) 중 어느 것에도 명시적으로 대응시키지 않는다.
  - target 위치: (해당 없음 — 이번 diff 는 `spec/1-data-model.md` 를 건드리지 않음)
  - 충돌 대상: `spec/1-data-model.md ## Rationale`(§2.1.1 인접) vs
    `codebase/backend/src/modules/workspaces/workspaces.service.ts` 의 query-scope `select`
    주석
  - 상세: 표의 1행("컬럼 `select: false` — 기각")과 실제 코드가 쓰는 "쿼리 범위 `select`"는
    이름은 비슷하나 성질이 반대(엔티티 전역 vs 쿼리 1건 한정)다. 코드 주석은 이 구분을 정확히
    설명하고 있지만, 표 자체에는 아직 4번째 행/각주가 없어 이력을 못 본 다음 검토자가 "기각된
    대안의 재도입"으로 오판할 여지가 남는다.
  - 처분 현황: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(미체크 항목,
    `review/consistency/2026/09/08/13_22_38` rationale_continuity INFO#1 출처)에 planner 턴
    항목으로 등재돼 있다 — developer 권한 밖(`spec/` 쓰기)이라 이번 배치 B 범위에서 고칠 수
    없었던 것이 맞다. 새로운 지적이 아니라 **기존 추적 항목의 재확인**으로 기록한다.
  - 제안: 별도 조치 불요(이미 트래커에 있음). 다음 planner 턴에서 그 항목을 처리할 때 이번
    라운드도 독립적으로 같은 결론에 도달했음을 참고하라.

## 요약

이번 라운드가 새로 보는 델타(3개 fix 커밋, 총 20개 파일/1242줄)는 전부 `codebase/**` 내부의
가드 통합·JSDoc 정정·fixture 대조군 보강이며 신규 API 계약·데이터 모델 필드·RBAC 규칙·상태
전이를 도입하지 않는다. 트리거 `endpointPath` 409 계약(§1.10)과 `User` 민감 컬럼 응답 경계
투영(§2.1.1) 두 핵심 앵커를 재대조한 결과 diff 의 주장과 spec 이 정확히 일치했다. 유일하게
남는 것은 이미 별도 트래커에 등재된 "Rationale 표의 4번째 패턴 미등재" INFO 뿐이며, 이는 이번
diff 가 만든 문제가 아니라 이전 라운드가 이미 잡아 planner 턴으로 넘긴 항목이다. 데이터 모델·
API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 전부에서 CRITICAL/WARNING 급 발견 없음.

## 위험도

NONE
