# Rationale 연속성 검토 — forbidden-helper-sentences

## 발견사항

없음 — 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았다.

### 확인한 근거 (기각·채택 이력과의 대조)

- **`spec/conventions/swagger.md` §5-4 "새 엔드포인트 체크리스트"**(라인 500-513)가 이미 "문장은 공용 헬퍼
  `FORBIDDEN_NOT_A_MEMBER`·`forbiddenForRole(role)` 로 만들고, 서비스가 내는 403 은 그 뒤에 덧붙인다" 고 규정하고
  있고, target diff(`common/swagger/forbidden-descriptions.ts` 등 7파일/262줄)는 이 규정을 **그대로 따라** 손으로
  보간되어 있던 13곳(`auth.controller.ts` `switchWorkspace`, `executions.controller.ts` `reRun`/`getChain`/테스트
  훅 2, `integrations.controller.ts` 모듈 상수 3 + `oauthBegin`, `workspaces.controller.ts` `leave`/`removeMember`,
  `workflow-test-datasets.controller.ts`)를 헬퍼로 치환한다. 새 대안 채택이 아니라 기존 규약 적용의 마무리다.
- **`spec/conventions/swagger.md` §Rationale "§5-4 403 설명의 거부 코드"(2026-09-26)**가 "`@Roles()` 라우트도
  `NOT_A_MEMBER` 를 싣는다"·"viewer 는 코드가 하나다"·"공용 헬퍼로 쓴다" 를 이미 채택안으로 못박아 두었고,
  target 코드의 `forbiddenForRole`/`forbiddenWithService` 사용 형태는 이 채택안과 라우트별로(`reRun`→editor+서비스,
  `getChain`→멤버십만+서비스 등) 정확히 일치한다.
- **`spec/data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드"(2026-09-25)**의 채택안 (나)("비멤버는 요구
  역할과 무관하게 `NOT_A_MEMBER`, 멤버의 역할 미달만 역할 코드")도 기각안 (가)로 되돌아가지 않고 그대로 적용됐다.
- **구두점 변경(`, 또는` → ` 또는 `, `forbiddenWithService` 도입)** 은 결정 번복처럼 보일 수 있으나 (a) 종전
  `, 또는` 형식은 Rationale 로 채택된 설계가 아니라 손으로 쓰던 시절의 우연한 불일치(plan 실측: "이음을 손으로 쓰던
  시절 `forbiddenForRole` 안의 ` 또는 ` 과 덧붙인 `, 또는 ` 이 한 문장에서 갈렸다")였고, (b) 이번 PR 이
  `forbiddenWithService` JSDoc 에 그 근거를 **직접 새로 기술**했다(`codebase/backend/src/common/swagger/forbidden-descriptions.ts`
  라인 41-44). 즉 "결정의 무근거 번복"이 아니라 무근거 상태(우연한 불일치)를 새 Rationale 로 정리한 경우다.
- **plan 자체의 자기 회귀 확인**: `plan/in-progress/forbidden-helper-sentences.md` 는 직전
  `--impl-prep`(`15_08_57`) INFO2("이음 구두점 결정의 근거가 spec Rationale 에 없다")를 명시적으로 처리 항목에 넣고
  JSDoc 삽입으로 닫았으며, INFO4(연관 트래커 `integration-personal-owner-followup.md` 의 dangling 참조)도
  `plan/in-progress/integration-personal-owner-followup.md` 라인 45 에 실제로 갱신 문장이 반영돼 있음을 확인했다 —
  약속한 후속 갱신이 실제로 이행됐다.
- **"안 하는 것" 섹션**(형식 가드 미도입·서비스 문장 표기 전면 통일 미도입)도 각각 §5-4 Rationale
  "서비스 거부는 세지 않는다" 원칙을 그대로 인용해 범위를 좁힌 것이라, 원칙 이탈이 아니라 원칙의 적용이다.
- spec 변경 없음(`spec_impact: none`)이 타당한 이유: 이 PR 이 구현하는 규칙 자체가 이미 `swagger.md` §5-4 /
  §Rationale 에 선재하므로, 코드가 규약을 뒤늦게 따라잡는 diff 이지 새 결정이 아니다.

## 요약

target 은 `spec/conventions/swagger.md` §5-4 및 그 Rationale, `spec/data-flow/12-workspace.md` "가드 거부의
오류 코드" 결정을 정확히 재확인·적용하는 순수 리팩터이며, 과거 기각된 대안을 재도입하거나 원칙을 위반한 지점이
없다. 유일하게 번복처럼 보이는 구두점 표기 변경도 (1) 종전 표기가 Rationale 로 채택된 설계가 아니었음을 실측으로
근거 짓고 (2) 새 결정(`forbiddenWithService` 의 이음 규칙)을 헬퍼 JSDoc 에 즉시 성문화했으므로 "무근거 번복"
기준에 해당하지 않는다. Rationale 연속성 관점에서 이 PR 은 특이하게도 스스로 선행 리뷰 지적(INFO2/INFO4)을
추적해 반영까지 마친 상태라 추가 조치가 필요 없다.

## 위험도
NONE
