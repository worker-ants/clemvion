# Rationale 연속성 검토 — spec/5-system/ (--impl-prep, plan/in-progress/spec-followups-batch-b.md)

## 조사 방법 및 스코프 한계

- 번들에는 `spec/5-system/1-auth.md` · `2-api-convention.md` · `3-error-handling.md` 세 파일만
  전문이 포함됐고, 나머지 12개 5-system 파일(`4-execution-engine.md` 등)은 "컨텍스트 예산 초과"로
  절단됐다. 절단된 파일의 부재를 "내용 없음"의 근거로 삼지 않고, 대신 (a) 번들에 함께 발췌된
  "관련 Rationale 발췌"(trigger-list · 0-overview · 1-data-model · workflow-list · schedule ·
  integration · knowledge-base) 전문과 (b) 실제 target 작업 대상 코드(`workspaces.service.ts`,
  `workspaces.service.spec.ts`)를 `Read`로 직접 열어 교차 검증했다.
- 실제 변경 대상은 `plan/in-progress/spec-followups-batch-b.md`(B-1~B-8, developer 턴, 전부
  `codebase/**` + harness 파일)다. `spec_impact` 는 `spec/2-navigation/2-trigger-list.md` 하나만
  선언하며, 이번 배치는 **spec/5-system/ 본문을 직접 수정하지 않는다** — 코드 globs 상 관할되는
  영역(`1-auth.md`/`2-api-convention.md`/`3-error-handling.md`)이라서 대상 영역으로 잡힌 것으로
  보인다. 따라서 본 리뷰의 핵심 질문은 "target 문서 자체가 과거 Rationale 을 뒤집는가"가 아니라
  "이 코드 변경이 5-system Rationale 이 이미 확정한 정책과 충돌하는가"다.

## 항목별 대조

### B-4. `listMembers` DB 레벨 투영 — data-model.md "User 민감 컬럼 방어" Rationale 과 대조

- `spec/1-data-model.md` Rationale (`User 민감 컬럼 방어를 select: false 가 아니라 응답 경계에 둔
  이유`)은 **컬럼 `@Column({ select: false })`(엔티티 레벨, 전역)**을 명시적으로 기각했다 — 내부
  경로가 그 컬럼 값을 직접 소비하는 경우 예외 없이 `undefined` 를 받기 때문("fail-silent").
- B-4 는 `WorkspacesService.listMembers` 한 곳의 TypeORM 쿼리 옵션(`select: { user: {...} }`,
  관계 단위 부분 select)으로 좁히는 것이며, 엔티티 전역 `select: false` 데코레이터가 아니다.
  실제 코드(`codebase/backend/src/modules/workspaces/workspaces.service.ts:213-224`)를 확인한 결과
  `listMembers` 가 `user.email`·`user.name` 두 필드만 소비하므로, 쿼리 레벨 투영으로 좁혀도 다른
  내부 소비 경로(로그인 검증·토큰 소비 등)에 영향을 주지 않는다 — data-model.md 가 기각한 대안과
  **범위가 다르다**(엔티티 전역 vs 단일 쿼리). 재도입이 아니다.
- 오히려 이 변경은 같은 Rationale 이 채택한 "응답 경계 투영 + 검출 2축" 원칙의 연장선으로, 이미
  `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts:79-93` 와
  `workspaces.service.spec.ts:1123-1160` 이 "로드 형태 축이 못 보는 유일한 자리"로 명시 기록해 둔
  갭을 닫는 조치다. **결론: 위반 없음, 오히려 기존 결정과 정합.**

### B-6 / B-7. 트리거 `endpointPath` 409 응답 형태 — error-handling.md §1.10 / api-convention.md §5.3 과 대조

- `spec/5-system/3-error-handling.md §1.10`(트리거 endpointPath 충돌 세부 코드)은 top-level
  `code` 를 `RESOURCE_CONFLICT` 로 유지하고 세부 사유(`TRIGGER_ENDPOINT_PATH_CONFLICT`,
  `field='endpoint_path'`)를 `details` 에 싣도록 이미 확정해 뒀다(§5.3 택일 기준 인용).
- B-7 이 추가하려는 e2e 는 "409 + `code` + `details` 두 키 단언"으로, 이 기존 계약과 정확히
  일치한다. B-6(`endpointPath` 를 쓰는 `save()` 전수 래핑 AST 래칫)도 같은 계약을 담당하는
  `rethrowEndpointPathConflict` 의 적용 범위를 넓히는 것이라 새 결정이 아니라 기존 결정의 커버리지
  보강이다. **결론: 위반 없음, 기존 계약과 정합.**

### B-3. `http-exception.filter.ts` → `isPostgresUniqueViolation` SoT 전환

- 번들·spec 어디에도 `QueryFailedError` 선-검사를 요구하는 명시적 Rationale 은 없다 — 즉 이 지점은
  "합의된 설계"가 아니라 "SoT 도입 시 놓친 fallback"으로 plan 스스로도 명시("blast radius 는 지금
  ~0", "구조적 불일치이지 현재 버그는 아니다")한다. 뒤집는 대상이 되는 과거 결정 자체가 없으므로
  "무근거 번복"에 해당하지 않는다. **결론: 해당 없음(뒤집을 선행 Rationale 부재).**

### B-8. `WorkflowVersionDetail` 백엔드 개명, 공유 패키지 미승격

- 데이터 모델 Rationale 은 `WorkflowVersion.snapshot`(nodes/edges/name/description) 구성이
  `data-flow/11-workflow.md` Rationale 을 SoT 로 참조하는 구조만 다루고, DTO 명명·공유 타입 승격
  정책과는 무관하다. B-8 이 "형태가 실제로 다르므로 억지 통합하지 않는다"고 명시한 판단은 이
  저장소의 기존 선례(예: cafe24/makeshop 미러 중복이 의도된 설계로 유지된 사례)와 같은 결의
  방향이라 원칙 이탈이 아니다. **결론: 위반 없음.**

### B-1 / B-2 / B-5

- 각각 harness(`test-stages.sh`/`PROJECT.md`)·`tsconfig.build.json` exclude·손-작성 constraint 추출
  치환으로, spec/5-system 어떤 Rationale 도 참조·번복하지 않는다. **결론: 대상 외.**

## 발견사항

없음 — CRITICAL/WARNING 등급에 해당하는 발견 없음.

- **[INFO]** B-4 커밋 본문에 data-model.md Rationale 교차 인용 권장
  - target 위치: `plan/in-progress/spec-followups-batch-b.md` B-4 항목 / 구현 시
    `codebase/backend/src/modules/workspaces/workspaces.service.ts` `listMembers`
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` → "`User` 민감 컬럼 방어를 `select: false`
    가 아니라 응답 경계에 둔 이유" (컬럼 소비 패턴 표: "값을 읽는다" vs "WHERE 절에만")
  - 상세: B-4 의 쿼리 레벨 투영은 이 Rationale 이 기각한 엔티티 전역 `select:false` 와는 범위가
    달라 충돌하지 않지만, 같은 문서가 이미 "이 문단을 `select:false` 를 쓰지 마라 의 선례로
    인용하려면 그 컬럼의 소비 패턴이 전자임을 먼저 보여야 한다"고 못박아 뒀다. B-4 구현 시 커밋/PR
    본문에 이 Rationale 을 인용하며 "쿼리 레벨 투영 ≠ 엔티티 전역 select:false" 구분을 명시해 두면,
    다음 사람이 이 커밋을 "select:false 기각 원칙의 예외"로 오독하는 것을 막을 수 있다.
  - 제안: 코드 리뷰/커밋 메시지에 위 구분을 한 줄 남긴다. spec 본문 수정은 불필요(원칙 자체가
    바뀌는 것이 아니므로).

## 요약

이번 --impl-prep 대상(`spec-followups-batch-b`, B-1~B-8)은 `spec/5-system/` 본문을 직접 수정하지
않는 순수 codebase/harness 배치이며, 코드 globs 상 관할 문서인 `1-auth.md`·`2-api-convention.md`·
`3-error-handling.md`(및 교차 인용된 `1-data-model.md`)의 기존 `## Rationale` 결정과 대조한 결과
어떤 항목도 기각된 대안을 재도입하거나, 합의된 원칙을 위반하거나, 새 근거 없이 과거 결정을
번복하지 않는다. B-4(`listMembers` 투영)·B-6/B-7(트리거 409 계약)은 오히려 기존 Rationale 이 이미
확정한 방향(응답 경계 투영·details 하위 세부코드)을 코드 레벨에서 완결시키는 성격이고, B-3/B-8 은
뒤집을 대상이 되는 선행 Rationale 자체가 없거나(B-3) 기존 저장소 선례와 같은 결을 따른다(B-8).
번들에서 절단된 12개 5-system 파일 본문에 대해서는 이번 plan 이 접점을 갖지 않는다는 점(코드 diff
없음, spec_impact 미포함)을 확인했으므로 스코프 한계가 결론에 영향을 주지 않는다.

## 위험도

NONE
