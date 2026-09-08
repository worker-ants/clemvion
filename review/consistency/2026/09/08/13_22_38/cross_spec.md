# Cross-Spec 일관성 검토 — 배치 B (`spec/5-system/`, impl-done)

## 검토 범위 요약

- diff-base `origin/main` 대비 코드 diff 16개 파일 / 1041줄 (`spec/5-system/**` 자체 델타는 0).
- 커밋: `03f665c63`(배치 B 6건) · `9ab43690a`(ai-review fix).
- 성격: `plan/in-progress/spec-followups-batch-b.md` B-1~B-8 — 전부 **developer 스코프의 버그 수정·중복 제거·명명 충돌 해소**이며 신규 요구사항·신규 계약을 도입하지 않는다. `spec_impact` 는 `spec/2-navigation/2-trigger-list.md` 하나를 적었으나, 실제로 그 파일을 포함해 어떤 `spec/**` 파일도 이 브랜치에서 바뀌지 않았다(전수 확인: `git diff origin/main...HEAD --stat -- spec/` 결과 없음) — 새 e2e 케이스(B-7)가 그 문서를 SoT 로 인용하기만 하고 텍스트를 고치지는 않았기 때문으로 보인다. 이는 "충돌"이 아니라 참조 목적의 등재로 판단된다.

## 발견사항

검토한 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 전부에서 **CRITICAL/WARNING 급 충돌 없음**. 상세 대조 근거는 아래.

### 확인 1 — 트리거 `endpointPath` 409 계약 (신규 e2e B4) vs `spec/5-system/3-error-handling.md` §1.10 / `spec/2-navigation/2-trigger-list.md`

- 코드(diff): `webhook-trigger.e2e-spec.ts` B4 는 `(workspace_id, endpoint_path)` UNIQUE 위반 시 `409 RESOURCE_CONFLICT` + `details = { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 를 단언한다.
- spec 대조: `spec/5-system/3-error-handling.md` §1.10(238행)이 정확히 이 조합(top-level `RESOURCE_CONFLICT` 유지 + `details.field='endpoint_path'` + 세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`)을 이미 문서화하고 있고, `spec/2-navigation/2-trigger-list.md` 96행·164행·166행도 동일 계약을 반복 서술한다. UPPER_SNAKE_CASE 명명도 `spec/conventions/error-codes.md` 규약과 일치.
- 판정: **정합**. 새 e2e 는 기존에 문서만 있던 계약을 실 DB 유니크 제약 경로로 처음 검증할 뿐, 신규 계약을 만들지 않는다.

### 확인 2 — `User` 민감 컬럼 vs `workspaces.service.ts listMembers` DB 투영

- 코드(diff): `listMembers` 쿼리가 `select: { user: { id: true, email: true, name: true } }` 로 좁혀졌다. 반환 매핑(`id, userId, email, name, role, joinedAt`)은 이 PR 이전과 동일 — 응답 wire 계약은 변경되지 않았다.
- spec 대조: `spec/1-data-model.md` §2.1.1(87~95행)이 정의하는 "응답 노출 금지 민감 7컬럼"(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)은 이 투영에 하나도 포함되지 않는다. §2.1.1 이 명시하는 "컬럼 수준 `select: false` 를 쓰지 않는다"(내부 소비 경로 fail-silent 우려) 제약도 이 변경은 위반하지 않는다 — 이것은 엔티티 전역 선언이 아니라 **이 쿼리 하나에 한정된 요청측 투영**이라는 점을 코드 주석 자체가 §2.1.1 을 인용해 명시하고 있다.
- 판정: **정합**. 오히려 §2.1.1 이 요구하는 "응답 경계에서 지운다" 는 원칙을 방어 축(검출→강제)으로 한 단계 강화한 변경이다.

### 확인 3 — `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명

- 코드(diff): 백엔드 `workflow-versions.service.ts` 의 내부 타입만 개명. wire 응답 필드·shape 은 변경 없음(JSDoc 갱신만, `Omit<WorkflowVersion, ...> & {...}` 구조 동일).
- spec 대조: `spec/**` 전체에 `WorkflowVersionDetail` 문자열을 참조하는 곳이 없음(grep 0건) — 이 이름은 spec 이 아니라 코드 내부(백/프론트 손-미러) 간에만 존재했다. 따라서 spec 레벨의 API 계약 이름·엔티티 이름과 충돌할 여지가 없다.
- 판정: **정합**. 순수 명명 충돌 해소이며 cross-spec 표면에 영향 없음.

### 확인 4 — 전역 예외 필터 `isPostgresUniqueViolation` 표면 확장 (raw `err.code` 도 409)

- 코드(diff): 기존 로컬 `isUniqueViolation` 이 `QueryFailedError` 인스턴스만 인정하던 것을, `pg-error.ts` SoT(`err.code` / `err.driverError.code` 두 표면)로 교체.
- spec 대조: `spec/5-system/3-error-handling.md` 87행이 `RESOURCE_CONFLICT`/409 를 "리소스 충돌(이름 중복 등)" 일반 카테고리로 이미 정의하고 있어, 새 표면 검출은 그 카테고리의 판정 폭을 넓히는 버그 수정이지 새 계약이 아니다. 이 표면 확장으로 인해 종전에 500 이던 응답이 409 로 바뀌는 경로가 있으나, plan(B-3)이 "blast radius ~0"(요청 경로에 이 표면을 만드는 raw query 없음)이라고 명시하며, 다른 spec 영역이 "raw 23505 는 500 이어야 한다"고 규정한 곳은 없음(검색 결과 없음).
- 판정: **정합**. 다른 spec 영역과 충돌하는 신규 계약 없음.

### 확인 5 — `spec_impact` 등재와 실제 diff 의 불일치 (plan 위생, 참고용 INFO)

- `plan/in-progress/spec-followups-batch-b.md` frontmatter 의 `spec_impact: [spec/2-navigation/2-trigger-list.md]` 이지만 이 브랜치는 `spec/**` 를 전혀 수정하지 않았다(확인 1 에서 검증한 대로 그 문서는 이미 B-7 이 요구하는 계약을 담고 있어 텍스트 수정이 불필요했던 것으로 보인다).
- 이는 spec 영역 간 "충돌"은 아니며, cross-spec 검토 관점(데이터 모델/API/ID/상태전이/RBAC/계층 책임) 어디에도 해당하지 않는다 — plan 메타데이터의 사후 정확성 문제로, 필요하면 plan 종결 시 `spec_impact: none` 으로 정정하거나 "참조만 하고 편집 없음" 주석을 남기는 것을 권장한다(강제 아님).

## 요약

이번 배치는 `spec/5-system/` 를 포함해 `spec/**` 를 전혀 수정하지 않는 순수 backend 버그 수정·중복 제거·타입 명명 충돌 해소 PR 이다. diff 가 인용하는 두 spec 앵커(`spec/5-system/3-error-handling.md` §1.10, `spec/1-data-model.md` §2.1.1)를 직접 열어 대조한 결과 모두 diff 의 주장과 정확히 일치했고, 리네임된 타입(`WorkflowVersionDetail`)은 애초에 spec 표면에 등장하지 않는 내부 이름이라 충돌 여지가 없었다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 전부에서 CRITICAL/WARNING 급 발견은 없으며, plan `spec_impact` 표기가 실제 diff(spec 델타 0)와 어긋나는 사소한 메타데이터 불일치만 INFO 로 남긴다.

## 위험도

NONE
