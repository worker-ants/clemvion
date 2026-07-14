# Rationale 연속성 검토 — `@nestjs/swagger` 핀 제거 + deep-import 정리

## 검토 대상
- target spec: `spec/5-system/14-external-interaction-api.md` (diff-base `origin/main`)
- 구현 변경: `@nestjs/swagger` `^11.2.7` → `^11.4.5` 버전 bump, `codebase/backend/src/common/swagger/api-wrapped.ts` 및 EIA DTO spec 2곳의 deep-import(`@nestjs/swagger/dist/interfaces/open-api-spec.interface`)를 공개 타입 `ApiResponseSchemaHost['schema']` 파생으로 교체. (부수적으로 backend Dockerfile 의 `pnpm deploy` 전환도 diff 에 포함.)

## 조사 경과
- `spec/5-system/14-external-interaction-api.md`, `spec/conventions/swagger.md`, `spec/0-overview.md` 등 spec 전역의 `## Rationale` 절 어디에도 `@nestjs/swagger` 버전 핀(11.2.7)·deep-import·`SchemaObject` 관련 결정 기록이 존재하지 않는다 (`grep -n "핀\|overrides\|중립성\|SchemaObject\|deep-import\|open-api-spec"` 전수 무결과).
- 해당 핀의 유일한 근거 문서는 `plan/in-progress/pnpm-migration-followups.md` §2 (`@nestjs/swagger 11.2.7 핀 제거 + deep-import 정리`) 이며, 이는 spec 의 `## Rationale` 이 아니라 **작업 추적 plan** 이다. 그 plan 자체가 핀을 "마이그레이션 버전 중립성을 위한 임시 조치"로 명시하고, "**교체 완료 시 `pnpm-workspace.yaml` `overrides` 의 `@nestjs/swagger` 핀 제거 (= 이 작업의 명시적 완료 조건)**" 라고 못박아 두었다.
- 금번 diff(버전 bump + deep-import → 공개 타입 파생 교체)는 그 plan 이 정의한 완료 조건을 정확히 충족하는 조치이며, 새로운 대안 채택도 과거 기각안의 재도입도 아니다 (오히려 plan 이 검토했던 `openapi3-ts` 신규 devDep 도입 대안 대신, 신규 의존성 없이 `ApiResponseSchemaHost['schema']` 공개 타입에서 파생하는 더 가벼운 방법을 택함 — 이는 의존성 최소화라는 일반적 설계 지향과 상충하지 않고 오히려 부합).
- `spec/5-system/14-external-interaction-api.md` 자체의 `## Rationale` 절 어디에도 swagger 버전·DTO 타입 소스에 대한 언급이 없어(전수 grep 무결과), target 문서 관점에서 번복되는 결정 자체가 없다.
- Dockerfile 변경(`prod-deps` → `pnpm deploy` 기반 `deploy` 스테이지)도 `spec/0-overview.md` 등 spec Rationale 에 기록된 배포 이미지 구조 관련 결정이 없어 동일하게 해당 사항 없음. (이 변경 이력은 `plan/in-progress/pnpm-migration-followups.md` §1/§1-(a) 에 별도로 추적되며 이미 "완료" 로 표기돼 있다.)

## 발견사항
없음 (해당 변경과 상충하는 spec `## Rationale` 결정을 찾지 못함).

## 요약
`@nestjs/swagger` 11.2.7 핀과 deep-import 우회는 애초에 spec 의 `## Rationale` 에 등재된 합의 결정이 아니라 `plan/in-progress/pnpm-migration-followups.md` 에 "임시 조치 + 명시적 완료 조건"으로 추적되던 항목이며, 금번 diff 는 그 plan 이 정의한 완료 조건(버전 bump + deep-import 제거)을 그대로 이행한 것이다. spec 전역 Rationale 어디에도 이 핀·deep-import 를 정당화하거나 그 반대를 금지하는 기록이 없어, 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 중 어느 것에도 해당하지 않는다.

## 위험도
NONE
