# Rationale 연속성 검토 보고서

## 검토 개요

- 대상 spec 영역: `spec/5-system/` (scope 델타 0개 파일 — 이 브랜치는 spec 을 바꾸지 않음, 정상)
- 실제 대조 대상: 구현 diff 16개 파일(1041줄, `codebase/backend`·`codebase/frontend`) vs `spec/1-data-model.md`·`spec/2-navigation/4-integration.md`·`spec/2-navigation/2-trigger-list.md`·`spec/0-overview.md` 등의 `## Rationale`
- 방법: 번들 diff 전문 + Rationale 발췌 전수 대조, 핵심 결정(User 민감 컬럼 방어 정책)은 워킹트리 절대경로로 직접 재확인 (`codebase/backend/src/modules/users/entities/user.entity.ts`, `codebase/backend/src/modules/workspaces/workspaces.service.ts`)

## 발견사항

- **[INFO]** `listMembers` 의 "쿼리 레벨 `select` 투영" 이 데이터모델 Rationale 표에 아직 정식 등재되지 않음
  - target 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` L213-231 (`memberRepository.find({ select: { …, user: { id, email, name } } })`), 짝을 이루는 `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` L1121-1200 부근
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` → "`User` 민감 컬럼 방어를 `select: false` 가 아니라 응답 경계에 둔 이유 (2026-09-06)" 결정 표 (3개 안: ①컬럼 `select: false` — 기각, ②DTO 손 좁힘 단독 — 기각, ③응답 경계 투영 + 검출 2축 — 채택)
  - 상세: 이번 변경은 ①(엔티티 전역 `select: false`)을 재도입한 것이 **아니다** — 코드 주석이 정확히 이 구분("엔티티 전역 `select: false` 와는 다른 것이다 … 이것은 이 쿼리 하나의 투영이라 다른 경로를 건드리지 않는다")을 스스로 적어 놓았고, 실측(`user.entity.ts` 에 `select: false`·`@Exclude()` 0건, 재확인 완료)도 여전히 유효하다. 다만 "단일 쿼리 범위의 DB-레벨 `select` 투영"은 `WorkflowVersionsService.findOne`(이미 반영됨)에 이어 이번이 두 번째 사례이고, `user-entity-exposure.spec.ts` 의 가드 주석 자체가 "이것이 목록 항목들이 지향할 형태" 라고 명시할 만큼 사실상 승인된 패턴이 됐다. 그런데 이 패턴은 `spec/1-data-model.md` 의 결정 표 3항 어디에도 명시적으로 이름 붙여져 있지 않다 — 근거는 코드 주석에만 존재한다. 표의 문구만 보면 "컬럼을 값 소비 경로에서 좁힌다"는 것이 ①(기각)과 표면적으로 유사해 보여, 코드 주석 이력을 못 본 미래의 검토자가 이를 기각된 대안의 재도입으로 오판할 위험이 있다.
  - 제안: `spec/1-data-model.md` `## Rationale` 의 해당 항목에 "쿼리 범위 DB-레벨 `select` 투영(엔티티 전역 `select: false` 와 구분됨)"을 4번째 채택 옵션 또는 ③의 하위 각주로 명시하고, `WorkflowVersionsService.findOne`·`WorkspacesService.listMembers` 두 사례를 근거로 인용. 이후 같은 패턴이 재발할 때 "이미 승인된 형태"임을 spec 만으로 판단 가능해진다.

## 요약

이번 diff(#1292 이후 후속 배치)는 자기 검토적 성격이 강하다 — pg-error 두 표면(cafe24/makeshop unique violation), User 민감 컬럼 방어(엔티티 전역 `select:false` vs 쿼리 범위 투영의 구분), `WorkflowVersionDetail`→`…Projection` 개명 등 각 변경이 코드 주석 안에 `spec/1-data-model.md` 및 과거 리뷰 산출물(`review/…`)을 명시적으로 인용하며 "이것이 기각된 대안과 왜 다른지"를 직접 논증하고 있다. `spec/1-data-model.md`·`spec/2-navigation/4-integration.md`·`spec/0-overview.md` 의 `## Rationale` 을 전수 대조한 결과, 기각된 대안의 무단 재도입이나 합의 원칙 위반, 무근거 결정 번복은 발견되지 않았다. 유일한 보완점은 두 번째 사례로 굳어진 "쿼리 범위 DB-레벨 투영" 기법이 아직 spec Rationale 표에 정식 등재되지 않아, 코드 주석 이력을 놓친 미래 검토에서 오판 여지가 있다는 것(INFO).

## 위험도

LOW
