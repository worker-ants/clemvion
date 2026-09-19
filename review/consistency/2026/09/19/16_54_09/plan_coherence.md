# Plan 정합성 검토 — entity-column-declaration-drift (spec/1-data-model.md 실질 타겟)

검토 모드: `--impl-prep` (요청 scope `spec/2-navigation/`). 단, 이번 작업이 실제로 건드리는 spec 은
scope 디렉터리 밖의 루트 파일 `spec/1-data-model.md` 다 (`code: codebase/backend/src/modules/**/entities/*.entity.ts`
글롭이 변경된 8개 엔티티 파일 전부를 포함) — 프롬프트의 "(main 추가)" 지시대로 이 파일을 직접 Read 하고
`plan/in-progress/entity-column-declaration-drift.md` · 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md`
· 선행 `plan/complete/entity-schema-declaration-drift.md` 를 대조했다.

## 발견사항

- **[INFO]** 트래커의 세 번째 하위 결정("선언 생략 vs 거짓 선언 기준")이 명시적으로 재확인되지 않음
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4659-4660` — "넓히면 «선언 생략» 과
    «거짓 선언» 을 가르는 기준부터 정해야 한다(타입은 생략해도 추론값이 선언이 된다)."
  - 관련 plan: `plan/in-progress/entity-column-declaration-drift.md` "가드" 섹션(100-106행)
  - 상세: 트래커 항목은 "고칠지" · "가드를 컬럼 층으로 넓힐지" 외에 **세 번째 하위 결정**(생략 vs 거짓 선언 판별 기준)을
    별도로 요구했다. `entity-column-declaration-drift.md` 는 이를 별도 문장으로 답하지 않지만, 설계 자체가 답을
    내포한다 — 비교기(`createSchemaBuilder().log()`)가 내는 컬럼 층 SQL 문을 기준으로 삼아, **추론값까지 포함한
    실효 선언과 DB 가 다르면 전부 위반**(아홉 곳이 정확히 이 사례)이고, **엔티티가 아예 선언하지 않은 컬럼**(`embedding`
    둘)만 이름·이유를 적어 예외 처리한다. 즉 "생략"은 예외가 아니라 "TypeORM 이 프로퍼티 자체를 모른다"로 좁게
    재정의됐다 — 트래커가 우려한 "타입 생략도 선언이 된다" 케이스를 정확히 잡아낸다. 논리적으로는 정합하지만, 이
    답이 트래커 항목이나 이 plan 본문에 "이게 그 결정이다"로 명시되어 있지 않아, `complete/` 이동 시 트래커
    체크박스만 닫고 그 세 번째 하위 결정이 실제로 무엇으로 정해졌는지가 산문에서 사라질 위험이 있다.
  - 제안: `entity-column-declaration-drift.md` 의 "가드" 섹션에 "이것이 트래커가 요구한 «생략 vs 거짓 선언» 기준이다"
    라는 한 문장을 추가하거나, `complete/` 이동 시 트래커 항목의 해소 문구에 이 기준을 그대로 옮겨 적을 것.

- **[INFO]** `--impl-done` 체크리스트 항목이 `spec/1-data-model.md` 첨부를 산문에만 의존
  - target 위치: `plan/in-progress/entity-column-declaration-drift.md` "체크리스트" 132-137행, 특히
    `- [ ] --impl-done — spec/2-navigation/ · spec/3-workflow-editor/`
  - 관련 plan: 같은 문서의 "착수 전 검토" WARNING 2 문단(127-128행) — "`--impl-done` 은 `spec/2-navigation/` ·
    `spec/3-workflow-editor/` 둘 다 돌리고 같은 블록(= `spec/1-data-model.md` 를 직접 Read 로 붙인 블록)을 붙인다."
  - 상세: `spec/1-data-model.md` 는 이번 변경이 실제로 닿는 유일한 spec 파일(코드 glob 매치)인데, 도구가 디렉터리
    scope 만 받아 루트 파일을 줄 수 없다는 제약 때문에 "수동으로 Read 블록을 첨부"하는 우회가 필요하다는 사실이
    체크리스트 문장 자체에는 없고 그 위 산문에만 있다. 지금 세션은(본 리뷰의 prompt 조립 방식이 실제로 그 우회를
    이미 수행하고 있어) 문제 없지만, 나중에 체크리스트만 보고 `--impl-done` 을 돌리는 세션은 이 우회를 놓칠 수 있다.
  - 제안: 체크리스트 항목 자체에 "(+ `spec/1-data-model.md` Read 블록 첨부)"를 인라인으로 적어 자기완결적으로 만든다.

## 위 두 건 외 검토 결과 — 충돌 없음

- **미해결 결정과의 충돌**: 트래커(`spec-draft-nullable-notation-followups.md:4651-4660`)가 남긴 "고칠지 / 가드를
  넓힐지" 결정은 사용자 결정(2026-09-19, "고치고 가드 확장")으로 명시적으로 해소됐고, 이 plan 은 그 결정을
  일방적으로 내린 게 아니라 **트래커가 요구한 바로 그 두 결정을 좁혀 답한 것**이다.
- **선행 plan 미해소**: 1차 `--impl-prep spec/2-navigation/`(`review/consistency/2026/09/19/10_58_34`) 가 남긴
  CRITICAL(§5.4 소문자 코드 + Database 포함 다섯 서비스 연결 테스트 미구현)은 `#1357`(`0a040b96c`)로 실제 머지됐다 —
  `codebase/backend/src/modules/integrations/database-connection-tester.ts` · `http-connection-tester.ts` 에
  `DB_AUTH_FAILED`/`DB_CONNECT_FAILED`/`HTTP_AUTH_FAILED` UPPER_SNAKE 코드가 존재하고, `spec/2-navigation/4-integration.md:1167-1168`
  가 "종전 §5.4 의 소문자 … 는 다른 층의 값이었다"로 그 정정을 기록한 것을 확인했다. plan 이 주장하는 "해소"는
  근거가 있다.
- **후속 항목 누락**: 변경된 8개 엔티티(`alert-rule` · `workspace-invitation` · `integration-usage-log` · `llm-usage-log` ·
  `node` · `edge` · `model-config` · `workflow-assistant-session`) 를 참조하는 다른 in-progress plan 은
  `plan/in-progress/marketplace-and-plugin-sdk.md` 하나뿐(`node.entity.ts` 의 `NodeCategory` DB enum 에 `custom` 을
  추가해야 한다는 항목)이며, 이번 변경은 `enumName: 'node_category'` 를 **추가만** 할 뿐 enum 값 집합·마이그레이션
  경로를 바꾸지 않아 그 항목과 충돌하지 않는다(오히려 이름이 명시돼 향후 그 작업에 유리). `spec/1-data-model.md` 의
  §2 필드 표(`workspace_id` 등)는 이미 전부 "UUID" 로 서술돼 있어 이번 `type: 'uuid'` 정정과 어긋나지 않고,
  가드(§ Rationale, 990-1000행)의 서술도 "인덱스·제약 층만" 처럼 범위를 못박지 않아 컬럼 층 확장이 spec 텍스트
  갱신을 별도로 요구하지 않는다. `update-returning-tuple-shape.md`(raw `.query()` UPDATE/DELETE RETURNING 튜플
  결함)는 `repository.save()` 의 `ReturningResultsEntityUpdator` 경로와 무관한 별개 메커니즘이라 겹치지 않는다.

## 요약

핵심 결정(아홉 곳 수정 + 가드를 컬럼 층으로 확장)은 트래커가 남긴 "결정 필요" 항목을 정확히 좁혀 답했고, 선행
`--impl-prep` 이 남긴 Critical 도 실제 머지(#1357)로 해소됐음을 코드·spec 양쪽에서 확인했다. 다른 in-progress plan
과의 충돌이나 무효화되는 후속 항목도 찾지 못했다. 남은 두 건은 모두 "지금은 맞지만 다음 세션이 산문을 건너뛰면
놓칠 수 있는" 자기완결성 문제(INFO) 로, 결정 재검토나 plan 갱신을 막지 않는다.

## 위험도

LOW
