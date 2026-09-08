# Rationale 연속성 검토 — spec/5-system/ (impl-done)

## 검토 조건 요약

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `spec/5-system/` 자체의 파일 델타: **0** (배치 B 는 `spec_impact: none` 으로 명시된 순수 developer/harness 배치 — plan 상 정상)
- 대신 코드 diff(20파일/backend·frontend)를 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`(전문 확보) 및 번들에 포함된 `1-data-model.md`·`2-trigger-list.md` 등의 `## Rationale` 과 대조

## 발견사항

없음 (CRITICAL/WARNING 대상 없음).

### 참고 — 확인했으나 문제 없음으로 판정한 항목

- **`http-exception.filter.ts`**: 로컬 `isUniqueViolation`(⇒ `QueryFailedError` 인스턴스만 인식)을 `pg-error.ts` 의 `isPostgresUniqueViolation` 으로 교체. `spec/5-system/3-error-handling.md` 의 `RESOURCE_CONFLICT`/409 서술과 상충하지 않으며, 오히려 그 서술이 의도한 동작(raw `err.code` 표면도 409 로 분류)을 복원하는 결함 수정이다. 이 교체를 "기각된 대안의 재도입"으로 볼 근거(과거 `## Rationale` 에 `QueryFailedError` 한정을 의도적 설계로 못박은 항목)는 3-error-handling.md 전문에 없음.
- **`workspaces.service.ts` (`listMembers` → DB `select` 투영)**: 코드 주석이 `spec/1-data-model.md` `## Rationale` "`User` 민감 컬럼 방어를 `select: false` 가 아니라 응답 경계에 둔 이유 (2026-09-06)" 를 직접 인용하며, 그 항목이 기각한 것은 **엔티티 전역 컬럼 `select: false`**(내부 소비 경로 fail-silent화)이고 이번 변경은 **쿼리 단위 `select` 투영**임을 명시적으로 구분한다. Rationale 원문의 "소비 패턴이 값을 읽는 경로는 응답 경계에서 지운다" 원칙과 정합 — 오히려 그 원칙을 정확히 실천한 사례. 기각된 대안의 재도입이 아님.
- **`user-entity-exposure.spec.ts` 화이트리스트에서 `listMembers` 제거**: 위 전환에 따른 결과이며, 제거 사유(투영으로 전환되어 가드 감시 범위 밖으로 나감)를 인접 주석에 명시. "결정의 무근거 번복"에 해당하지 않음 — 새 근거가 그 자리에 함께 기록됨.
- **`workflow-versions.service.ts`: `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명**: 순수 이름 충돌 해소(공유 타입 패키지화는 명시적으로 보류, 사유 기재). `spec/1-data-model.md` 의 `WorkflowVersion.snapshot` 관련 Rationale 과 무관한 축(필드 구성 vs 타입 이름)이라 충돌 없음.
- **`integration-oauth.service.ts` (cafe24/makeshop) constraint 추출 리팩터**: 손-작성 추출식을 기존 `pgErrorConstraint()` 헬퍼로 치환. 동작 동일(behavior-preserving), `spec/2-navigation/4-integration.md` 의 Cafe24 관련 Rationale(예: `mall_id` UNIQUE 인덱스, install_token 등)이 규정한 제약·정책을 변경하지 않음.
- **`endpoint-path-conflict-wrap-guard.ts`(신설 AST 래칫)**: 기존 프로덕션 동작(트리거 `endpointPath` 를 건드리는 `save()` 는 `rethrowEndpointPathConflict` 로 감싼다)을 앞으로도 강제하는 정적 가드일 뿐, `spec/2-navigation/2-trigger-list.md` Rationale(R-1~R-16, `TRIGGER_ENDPOINT_PATH_CONFLICT` 등)이 정의한 결정을 바꾸지 않음.
- **`workspace-id-fixtures.ts` / `oauth-config-mock.ts` 주석 정정**: "build tsc 가 `__test-utils__` 를 컴파일한다" 는 옛 서술을 취소선으로 남기고 `tsconfig.build.json` exclude 확장(B-2) 사실로 정정 — 코드 주석 수준의 자기-반증형 소정정이며 spec 문서의 `## Rationale` 은 아니라 이 리뷰의 정식 대상은 아니지만, 프로젝트 관례(원문 보존 + 취소선 + 날짜)를 그대로 따르고 있어 지적할 결함 없음.

## 요약

이번 배치(B-1~B-8)는 `spec/5-system/` 문서 자체를 건드리지 않는 순수 developer/harness 정리(pg-error SoT 통일, `User` 노출 방어를 select:false 대신 응답 경계·쿼리 투영으로 전환, 트리거 endpointPath 래핑 래칫 신설, 타입 개명 등)로, 각 변경이 관련 spec(`1-data-model.md`, `2-trigger-list.md`, `3-error-handling.md`)의 기존 `## Rationale` 이 채택한 원칙(특히 `User` 민감 컬럼 방어 축)을 정확히 인용·구분하며 따르고 있다. 과거에 명시적으로 기각된 대안(엔티티 전역 `select: false`)을 다시 들여오는 사례는 없고, 오히려 그 Rationale 이 요구하는 형태(쿼리 단위 투영)로 한 걸음 더 나아갔다. 결정을 번복한 자리(`listMembers` 화이트리스트 제거, 타입 개명)는 모두 그 자리에서 사유를 남겨 "무근거 번복"에 해당하지 않는다.

## 위험도

NONE
