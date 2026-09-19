# 유지보수성(Maintainability) 리뷰

## 검토 범위

- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 실제 코드 변경(핵심 리뷰 대상)
- `plan/in-progress/column-guard-gaps.md` — plan 문서 (신규)
- `review/consistency/2026/09/20/00_34_58/*` (SUMMARY.md·meta.json·`_retry_state.json`·각 checker 산출물) — `--impl-prep` 자동 생성 산출물. 코드가 아니라 리뷰 리포트이며, 함수/네이밍/중첩/매직넘버 등 유지보수성 관점이 성립하지 않는 정적 마크다운·JSON 이라 상세 라인 단위 검토는 생략한다. 다만 이 산출물 자체가 `plan_coherence` checker 를 통해 "이번 `--impl-prep` target(`spec/2-navigation/`)이 이 worktree 의 실제 작업(`column-guard-gaps`, 백엔드 컬럼 가드 테스트)과 무관하다"는 스코프 불일치를 이미 자체 보고했고, plan 체크리스트에도 "선례" 로 명시돼 있어 별도 지적하지 않는다.

## 발견사항

- **[INFO]** 부모 엔티티(user → workspace → workflow) 생성용 원시 SQL INSERT 3연쇄가 파일 간 중복
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 신규 테스트 `'선언한 DB 기본값은 값을 생략한 insert 뒤 엔티티로 돌아온다 — model_config.kind · workflow_assistant_session.last_interaction_at'` (unified diff 게이트 613~630행)
  - 상세: `INSERT INTO "user" ... RETURNING id` → `INSERT INTO workspace ... RETURNING id` → `INSERT INTO workflow ... RETURNING id` 순서의 부모 행 생성 보일러플레이트가 `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts`(233~244행 부근), `codebase/backend/test/external-interaction.e2e-spec.ts` 에도 각각 원시 SQL로 반복돼 있고, 공유 헬퍼(`test/helpers/*.ts`)는 존재하지 않는다. 이번 변경이 그 패턴을 새로 만든 것은 아니고 기존 컨벤션(파일별 자기완결 원시 SQL 픽스처)을 그대로 따른 것이라 이 diff 만의 회귀는 아니다.
  - 제안: 지금 3회째 반복이므로, 이후 네 번째 e2e 파일이 같은 체인을 필요로 할 때는 `test/helpers/e2e-fixture.ts` 같은 공유 헬퍼(`createUserWorkspaceWorkflow()`)로 추출을 고려. 이번 PR 범위에서 강제할 사안은 아님.

- **[INFO]** 새 라운드-트립 테스트가 한 함수에서 세 단계(부모 3행 생성 → `ModelConfig` save → `WorkflowAssistantSession` save)를 순차 수행해 테스트 하나의 길이가 46줄(613~658행)로 늘어남
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:613-658`
  - 상세: 여러 책임(픽스처 구성 · 두 엔티티 각각의 기본값 확인)을 한 `it` 블록에 담고 있으나, 두 컬럼(`model_config.kind`, `workflow_assistant_session.last_interaction_at`)이 같은 트랜잭션·같은 부모 행을 공유해야 하는 시나리오라 분리하면 픽스처가 중복된다. 현재 구조가 부적절하다고 보긴 어렵고, 함수 내부는 순차적 await 체인이라 중첩·분기가 없어 인지 부하는 낮다.
  - 제안: 조치 불요. 다만 세 번째 컬럼이 추가되면 그때는 분리를 재고할 것.

- **[없음/개선 확인]** 긍정적 변경 — `log` → `sqlMemory` 리네이밍(가독성 개선), 인라인으로 두 곳에 중복돼 있던 읽기 전용 `DataSource` 옵션을 `readOnlyDataSourceOptions()` 헬퍼로 추출(DRY), `COLUMN_LEVEL_SAMPLES.caught` 각 표본 위에 "어느 뮤턴트 → 어느 패턴" 주석을 달아 의도를 명확히 한 것 모두 유지보수성을 높이는 적절한 변경이다. 이 항목은 결함이 아니라 리뷰 근거로 남긴다.

## 요약

핵심 변경 대상인 e2e 테스트 파일은 이번 diff 로 오히려 유지보수성이 개선됐다 — 모호한 변수명(`log`)을 구체적 이름(`sqlMemory`)으로 바꾸고, 두 테스트가 공유해야 할 읽기 전용 연결 옵션을 헬퍼 함수로 뽑아 중복을 제거했으며, 표본 배열 각 항목에 출처 주석을 달아 "왜 이 문자열인지" 를 코드만 보고 알 수 있게 했다. 새로 추가된 두 테스트(예방 계층 회귀 테스트·기본값 왕복 테스트)는 함수 길이·중첩 모두 무난한 수준이고, 원시 SQL 픽스처 체인 중복은 이 파일이 새로 만든 문제가 아니라 기존 e2e 컨벤션을 따른 것이다. plan/consistency 산출물은 코드가 아니라 자동 생성된 리뷰 리포트라 별도 유지보수성 위험이 없다. 전체적으로 구조적 결함이나 복잡도 문제는 발견되지 않았다.

## 위험도

NONE
