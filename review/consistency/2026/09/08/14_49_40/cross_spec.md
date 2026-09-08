# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done, 5회차)

## 전제 확인

- target scope(`spec/5-system/`)의 spec 파일 델타: **0개** — `git diff origin/main...HEAD -- spec/`
  결과 없음. `plan/in-progress/spec-followups-batch-b.md` frontmatter 도 `spec_impact: none` 으로
  일치(착수 시 `2-trigger-list.md` 오기재를 스스로 정정한 이력 있음). 델타 0 은 CRITICAL 근거가
  아니다(코드 전용 PR).
- 이 세션은 같은 브랜치에 대한 **5번째 cross-spec 라운드**다
  (`12_21_11`→`13_22_38`→`13_34_30`→`14_01_57`→`14_29_13`→본 라운드). 앞선 5라운드 모두
  CRITICAL/WARNING 0·위험도 NONE 으로 수렴했다.
- 이번 라운드가 새로 보는 델타는 직전 라운드(`14_29_13`, 커밋 `d80583700` 까지 반영) 이후의
  두 커밋뿐이다 — `ead63d797`(`--route=all` 3라운드 코드리뷰 fix)·`76bd51aab`(`--route=all`
  4라운드 코드리뷰 fix). 두 커밋을 직접 열어 확인한 결과:
  - `ead63d797`: `source-scan.ts` 의 죽은 분기(`isFn`) 제거, plan 체크리스트 갱신. **프로덕션
    동작 변경 없음**.
  - `76bd51aab`: `tsconfig.build.json` exclude 주석 정정(devDependency 전제 반증 기록),
    `workspace-rbac.e2e-spec.ts` JSDoc 3번째 갱신 누락분 보완, `source-scan.spec.ts` 에
    `enclosingScopeName` 전용 `describe` 신설. 커밋 메시지 자신이 명시하듯 **"프로덕션 코드
    0줄"** — 주석 2건 + 테스트 1건.
  - 둘 다 `spec/**` 를 건드리지 않고, 새 API·엔티티·필드·RBAC 규칙·상태 전이·요구사항 ID를
    도입하지 않는다.

## 발견사항

6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 전부에서 **CRITICAL/WARNING
급 충돌 없음**. 이전 라운드가 이미 확인한 핵심 앵커 두 곳을 재대조해도 결론은 변하지 않는다.

### 확인 1 — 트리거 `endpointPath` 409 계약 vs `spec/5-system/3-error-handling.md §1.10`

`webhook-trigger.e2e-spec.ts` B4·AST 래칫(`endpoint-path-conflict-wrap-guard.ts`)이 단언하는
`409 RESOURCE_CONFLICT` + `details={field:'endpoint_path', code:'TRIGGER_ENDPOINT_PATH_CONFLICT'}`
는 §1.10(232~240행)이 이미 문서화한 조합과 정확히 일치한다(재확인, 변경 없음). 판정: **정합**.

### 확인 2 — `User` 민감 컬럼 vs `WorkspacesService.listMembers` DB 투영

`select: { id, userId, role, joinedAt, user: { id, email, name } }` 투영은
[`spec/1-data-model.md §2.3 WorkspaceMember`](../../../../../spec/1-data-model.md) 필드
(`id`·`workspace_id`·`user_id`·`role`·`joined_at`)와 §2.1 User 의 공개 필드(`email`·`name`)만
결합하며, §2.1.1 이 금지하는 민감 7컬럼은 하나도 포함하지 않는다. 같은 절이 기각하는 것은
**엔티티 전역** 컬럼 수준 `select:false`(내부 값-소비 경로 fail-silent화)이고, 이 변경은
**쿼리 한 건에 한정된 요청측 투영**이라 대상이 다르다 — 코드 주석이 §2.1.1 을 직접 인용해 그
구분을 명시한다. 판정: **정합** (재확인, 변경 없음).

### 확인 3 — 신규 델타(`ead63d797`·`76bd51aab`) 자체

두 커밋 모두 (a) 테스트 전용 AST 헬퍼의 죽은 분기 제거, (b) 코드 주석·JSDoc·tsconfig 주석의
사실관계 정정, (c) 신규 단위 테스트 추가로 구성된다. 새로 참조하는 spec 앵커가 없고
(`grep` 결과 두 커밋 diff 에 `spec/` 경로 언급 0건, `endpoint-path-conflict-wrap.spec.ts`·
fixture 파일도 spec 미참조), 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느
축에도 새 표면을 만들지 않는다. 판정: **해당 없음**(cross-spec 표면 미접촉).

## 참고 — 이미 추적 중인 인접 이슈 (신규 아님)

- 이전 라운드(`14_01_57`)가 남긴 INFO — `spec/1-data-model.md ## Rationale` 의 "User 민감 컬럼"
  표가 "쿼리 범위 `select` 투영" 패턴을 아직 4번째 행/각주로 명시하지 않는 문제 — 는
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 planner 항목으로
  등재돼 있고 이번 라운드가 review 범위(developer, spec 쓰기 권한 밖)에서 새로 처분할 항목은
  아니다. 재확인만 하고 신규 발견으로 세지 않는다.

## 요약

이번 5번째 라운드가 새로 보는 델타(2개 커밋)는 전부 이전 `/ai-review` 지적에 대한 문서·테스트
정정이며 프로덕션 코드 변경이 없고(`76bd51aab` 커밋 메시지 자인), `spec/**` 를 포함해 어떤
spec 표면도 건드리지 않는다. 5라운드에 걸쳐 반복 대조한 핵심 앵커(트리거 `endpointPath` 409
계약 §1.10, `User` 민감 컬럼 응답 경계 원칙 §2.1.1/§2.3)는 매번 diff 의 주장과 정확히
일치했다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 전부에서
CRITICAL/WARNING 급 발견 없음.

## 위험도

NONE
