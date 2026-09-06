# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건(권한 밖, planner 인계 대상)이 있어 호출자가 차단해야 함

## 전체 위험도
**CRITICAL** — 신규 `dto-jsdoc-citation-guard.ts`(§3 리뷰-인용 카브아웃을 실제로 강제하는 코드)가 `spec/conventions/review-citations.md`의 `code:`에 미등재된 채, 그 문서의 Rationale 문장("이 규약에는 시행하는 코드가 없다")을 사실과 다르게 만든다. 근본 원인은 `spec/conventions/**` 쓰기이므로 developer 권한 밖 — planner 인계로 처리. 그 외 실질 코드 결함은 없고(신규 코드는 실제 `User` 컬럼 유출 결함을 정확히 방어), 나머지는 전부 WARNING/INFO 수준의 spec 등재 누락·문서 정합 이슈다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance (rationale_continuity 가 동일 지적을 WARNING 으로 중복 보고 → 최고 등급 CRITICAL 로 통합) | 신규 `dto-jsdoc-citation-guard.ts`(§3 DTO/컨트롤러 JSDoc 리뷰-인용 금지를 AST 로 강제하는 ratchet 테스트)가 `review-citations.md`의 `code:`에 미등재. 그 문서 Rationale 의 "이 규약에는 시행하는 코드가 없다 — 주석 형태를 강제하는 가드가 없기 때문" 전제를 이 신규 가드 자체가 반증함 | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`, `dto-jsdoc-citation.spec.ts` (신규) | `spec/conventions/review-citations.md` Rationale 문단 + `code:` frontmatter, `spec/conventions/spec-impl-evidence.md §2.1`(같은 선례를 "시행 코드 없는 순수 문서형" 예시로 인용) | `code:`에 `dto-jsdoc-citation-guard*.ts` 추가 + Rationale 문장을 취소선 처리 후 "§3 DTO JSDoc 카브아웃은 이 가드가 강제, §2 일반 bare-시각 금지는 여전히 비강제" 로 좁혀 정정. `spec-impl-evidence.md §2.1` 의 선례 인용도 재검토 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 근본 원인이 `spec/conventions/**` 쓰기이며 developer 권한 밖이다. 등급은 CRITICAL 그대로이고 `BLOCK: YES` 도 유지된다 — 이 표는 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | developer 는 `spec/`(및 `spec/conventions/`) 에 대해 read-only — 자기반증형 소정정 예외(§5조건)는 "제품 정의·API 계약이 아닌 예고 문장" 한정인데, 이 Rationale 문장은 developer 본인이 쓴 예고가 아니라 2026-09-05 기존 등재분이라 해당 없음 | project-planner | `spec/conventions/review-citations.md` — Rationale "이 규약에는 시행하는 코드가 없다" 문단 정정(취소선+범위 축소) 및 `code:`에 `dto-jsdoc-citation-guard*.ts` 등재. 병행: `spec/conventions/spec-impl-evidence.md §2.1` 의 review-citations.md 선례 인용 재검토, `spec/5-system/2-api-convention.md §5.4`·`spec/conventions/swagger.md §5-1` 의 "두 검증자" 서술을 3축(구조/이름/JSDoc 인용)으로 갱신(개수 고정 문구 대신 나열형으로), `spec/1-data-model.md §2.1` 또는 `secret-store.md §1.1` 에 `User` 7컬럼 노출 금지 규범 + Rationale 승격 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 후속 항목, 단 "2축" 표기가 실제 3축과 불일치 — 아래 WARNING #3 참고) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance, rationale_continuity, naming_collision | 신규 검증자 중 구조축(`user-entity-exposure-guard.ts`)·이름축(`user-secret-absence.ts`)이 §5.4/`swagger.md §5-1` 의 `code:`에 미등재, "두 검증자" 서술이 이제 부정확 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`, `codebase/backend/src/shared/testing/user-secret-absence.ts` (신규) | `spec/5-system/2-api-convention.md §5.4`, `spec/conventions/swagger.md §5-1` | planner 턴에서 표에 구조/이름 두 축 추가 + `code:` 등재 (이미 plan 에 tracked, Critical 항목과 같은 턴에 처리하면 중복 조사 없음) |
| 2 | rationale_continuity, cross_spec | `User` 민감 7컬럼("passwordHash"·2FA 시크릿·복구 코드·토큰) 응답 노출 금지가 spec `## Rationale`/API 계약 문장으로 아직 승격되지 않음, SoT 가 코드 상수(`USER_SECRET_KEYS`)에만 존재 | (spec 미변경) | `spec/1-data-model.md §2.1 User`, `spec/conventions/secret-store.md §1.1`(Trigger/AuthConfig 는 대응 절 있음) | planner 턴에서 규범 문장 + `## Rationale` 승격(전수 열거 수치·기각한 대안 포함, 이미 plan 에 tracked) |
| 3 | plan_coherence | 신규 후속 plan 항목의 진단 문단은 3축(구조/이름/JSDoc 인용)을 명시하나 제목·처방 문장은 "2축"만 언급해 JSDoc 인용 축의 등재 지시가 누락됨. 같은 "2축" 오표기가 `CHANGELOG.md` 제목에도 반복 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 375~402행, `CHANGELOG.md` | 같은 항목 내 진단 문단(3개 파일 나열) vs 처방 문장("두 행") | 제목·처방 문장을 3축 기준으로 수정하고 JSDoc 인용 축의 등재 대상 문서(§5.4 인지 `review-citations.md` 인지)를 명시. `CHANGELOG.md` 제목도 정정 |
| 4 | naming_collision | `isResponseDtoFile` 판정 함수가 `swagger-dto-contract-guard.ts`(기존)와 `dto-jsdoc-citation-guard.ts`(신규)에 동일 이름·동일 로직으로 독립 복제됨. 공유 SoT 부재로 한쪽만 바뀌면 판정 기준이 조용히 갈라질 위험 | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts:46` | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:260` | 신규 쪽이 기존 함수를 import 해 재사용하거나 `source-scan.ts` 같은 공유 유틸로 승격 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 신규 fixture 가 `fixtures/` 서브디렉토리 + `.fixture.ts` 접미를 사용, 기존 형제 가드들의 flat `<name>-fixture.ts` 배치 관례와 다름 (성문화된 규약 위반은 아님) | `codebase/backend/src/repo-guards/__tests__/fixtures/user-eager-relation.fixture.ts` 외 2개 | 지금 당장 조치 불요, 추후 수렴 시 관례 문서화 권고 |
| 2 | plan_coherence | `plan/in-progress/spec-draft-api-convention-verifier-registration.md` 가 이미 병합된 작업(PR #1289, 커밋 `983fd0ade`)인데 `plan/complete/` 로 미이동 | 해당 plan 파일 (이번 PR 미변경) | 다음 §5.4 재등재 작업 집행 시 함께 `plan/complete/` 로 이동 |
| 3 | cross_spec | `WorkflowVersionsService.findOne`의 `creator` 투영(`CREATOR_PROJECTION`)·`WorkspaceMemberDto.joinedAt`·RBAC e2e 주석 인용 정정(§1.3→§3) 모두 기존 spec(§7.1/§7.2, §5.4, §3)과 정합 확인, 조치 불요 | (target 미변경) | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 델타 0, 신규 코드가 데이터 모델·API 규약과 충돌 없음. 검증자 미등재는 이미 plan 에 tracked |
| rationale_continuity | LOW (신규 WARNING 1건은 convention_compliance CRITICAL 로 병합) | 6차 재확인 — 과거 Rationale 번복 없음. review-citations.md 전제 반증은 CRITICAL 항목과 동일 이슈 |
| convention_compliance | HIGH | `dto-jsdoc-citation-guard.ts` 미등재가 CRITICAL(review-citations.md Rationale 직접 반증). 나머지 검증자 쌍 미등재는 WARNING |
| plan_coherence | LOW | 절차 자체는 건전하나 신규 후속 항목이 3축 중 1축(JSDoc 인용)의 등재 지시를 누락 |
| naming_collision | LOW | 이름 충돌 CRITICAL 없음. `isResponseDtoFile` 중복 정의 1건 WARNING |

## 권장 조치사항
1. (BLOCK 해소 우선) project-planner 턴: `spec/conventions/review-citations.md` Rationale 정정(취소선 + §3/§2 범위 구분) + `code:`에 `dto-jsdoc-citation-guard*.ts` 등재, `spec-impl-evidence.md §2.1` 선례 인용 재검토.
2. 같은 planner 턴에서 병행 처리(중복 조사 비용 없음): §5.4·`swagger.md §5-1`에 구조축·이름축 등재 및 "두 검증자" 문구를 나열형으로 교체, `spec/1-data-model.md §2.1`/`secret-store.md §1.1`에 `User` 7컬럼 노출 금지 규범 + Rationale 승격.
3. `plan/in-progress/spec-draft-nullable-notation-followups.md`의 신규 항목 제목·처방 문장을 3축 기준으로 수정하고 `CHANGELOG.md` 제목도 정정.
4. `isResponseDtoFile` 중복 정의를 코드 리팩터로 단일화(BLOCK 과 무관, 별도 developer 턴에서 처리 가능).
5. (선택) `spec-draft-api-convention-verifier-registration.md`를 `plan/complete/`로 이동.