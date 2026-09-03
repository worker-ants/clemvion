# Rationale 연속성 검토

## 검토 대상 요약

- scope 는 `spec/5-system/` 이나 이 브랜치(`claude/entity-nullable-batch3`)는 그 영역의 spec 파일을 1줄도 바꾸지 않았다(정상 — plan 자체가 "코드 전용" 이라 명시).
- 실제 구현 diff(10파일/152줄, `origin/main...HEAD`)는 전량 **엔티티 `nullable: true` 컬럼의 TS 타입을 `| null` 로 넓히고, 그로 인해 불필요해진 이중 캐스트를 제거하는 기계적 배치 3**이다: `audit-log.entity.ts`(`ipAddress`), `auth-config-response.dto.ts`(`ipWhitelist`), `auth-config.entity.ts`(`ipWhitelist`·`lastUsedAt`), `auth.service.spec.ts`(`lockedUntil` 캐스트 제거), `edge.entity.ts`(`condition`), `folder.entity.ts`(`parentId`·`parent`) + `folders.controller.ts`(캐스트 제거) + `folders.service.spec.ts`(캐스트 제거), `workflow-version.entity.ts`(`changeSummary`), `workspace-member.entity.ts`(`joinedAt`).
- 근거 문서는 `plan/in-progress/entity-nullable-column-type-mismatch.md` — 선례(같은 저장소가 `Execution.error`·`llm-usage-log.workflowId`/`executionId` 를 이미 같은 방식으로 두 번 넓혔음)를 명시하고, 배치 1~3 이 일관된 술어("`nullable: true` 인데 non-null 타입")로 닫히는 것을 실측(AST)으로 보였다.

## 발견사항

없음.

관련 가능성이 있는 두 지점을 짚어 보증(clearance)으로 남긴다 — 둘 다 **위반이 아니라 정합**임을 확인했다:

- **`spec/5-system/2-api-convention.md` §5.4 (부재 표현 — `null` vs 키 생략)** 와의 관계: `AuthConfigDto.ipWhitelist` 를 `string[]` → `string[] | null`(옵셔널) 로 바꾼 것은 §5.4 의 "기본은 `null`" 원칙과 "DTO 선언이 wire 를 반영해야 한다"(`@ApiPropertyOptional({nullable:true})` + `field?: T | null`) 규칙을 **그대로 따른다**. §5.4 는 "소급 적용 대상 아님 — 앞으로 도입·변경되는 필드에 적용" 이라 명시하는데, 이 diff 가 정확히 그 필드의 nullability 를 **변경**하므로 적용 대상이 맞다 (plan 문서 §"새로 드러난 축" 이 이 논리를 자체적으로 명시). 기각된 대안 재도입이나 원칙 우회가 아니다.
- **엔티티 nullable ↔ TS 타입 정합화라는 결정 자체**: 이 저장소는 이미 두 차례(`Execution.error`, `llm-usage-log.workflowId`/`executionId`) 같은 클래스의 drift 를 같은 방식(타입을 `| null` 로 넓히고 필요 시 `type:` 명시)으로 고쳤다. 이번 배치는 그 확립된 패턴을 계속하는 것이지 번복이 아니며, 새 설계 원칙을 도입하지도 않는다.

`spec/5-system/1-auth.md` `## Rationale`(계정 잠금·이메일 변경·WebAuthn·복구 코드 등)과 `3-error-handling.md` `## Rationale`, 그리고 번들에 포함된 `spec/1-data-model.md`·`spec/data-flow/10-triggers.md`·`spec/0-overview.md` 등의 `## Rationale` 전체를 훑었으나, 이번 diff 가 다루는 필드(`ipAddress`·`ipWhitelist`·`lastUsedAt`·`condition`·`parentId`·`changeSummary`·`joinedAt`·`lockedUntil`)나 그 타입 표현 방식에 대해 **명시적으로 기각된 대안**이나 **다른 결론의 합의된 원칙**을 기록한 항목은 없었다. `audit_log.workspaceId` non-nullable 결정(§1-auth Rationale)은 다른 컬럼(`workspaceId`)에 대한 것이며 이번 diff 가 건드리는 `ipAddress` 와 무관하다.

## 요약

이번 변경은 spec 문서를 전혀 수정하지 않는 순수 코드 리팩터(엔티티 nullable 컬럼의 TS 타입 정합화, 배치 3/축 종결)이며, 저장소가 이미 확립한 동일 클래스의 두 선례를 그대로 계승한다. `AuthConfigDto.ipWhitelist` 응답 DTO 정정만이 spec 규칙(§5.4)과 직접 접촉하는데, 그 규칙의 "신규·변경 필드에 적용" 조건에 정확히 부합하는 것으로 확인돼 위반이 아니라 준수다. `spec/5-system/` 및 인접 참조 spec 의 `## Rationale` 전체를 대조한 결과 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다.

## 위험도
NONE
