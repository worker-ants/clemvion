# 변경 범위(Scope) 리뷰 — entity-column-drift-b83f15

## 발견사항

- **[INFO]** 리뷰 대상 diff(`origin/main..HEAD`, 27개 파일)는 plan 문서 `plan/in-progress/entity-column-declaration-drift.md` 의 9행 표(아홉 곳 컬럼 drift)와 1:1 대응한다.
  - 위치: `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts:19`, `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts:18`, `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts:30,33`, `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts:20`, `codebase/backend/src/modules/nodes/entities/node.entity.ts:48`, `codebase/backend/src/modules/edges/entities/edge.entity.ts:53-58`, `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46`, `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:75-79`
  - 상세: 8개 엔티티 파일 각각에서 `@Column`(또는 `@CreateDateColumn`) 옵션 객체 한 줄만 바뀌었고, 그 외 어떤 줄(주석·임포트·포맷·인접 컬럼 선언)도 건드리지 않았다. `git diff --stat` 로 확인한 실제 변경 범위(`+/-` 라인 수)도 각 파일당 딱 그 정도(예: `edge.entity.ts` +5/-1, 나머지는 대부분 +1/-1)뿐이다. 요청된 "선언이 실제 DB 와 다른 아홉 곳 정정" 범위를 정확히 지켰다.
  - 제안: 없음 — scope 준수 사례.

- **[INFO]** `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 변경은 plan 이 명시한 "컬럼 층 가드 확장"에 정확히 대응한다.
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:9-23`(헤더 주석을 인덱스·제약 층/컬럼 층 두 문단으로 분리), `:40-53`(`UNDECLARED_COLUMNS` 신설), `:55-66`(`COLUMN_LEVEL` 정규식 신설), `:474-486`(신규 `it(...)` 테스트).
  - 상세: 전체 파일을 직접 Read 로 열어 대조한 결과, diff에 나타난 부분 외에 기존 테스트 4개(인덱스·유니크·CHECK·FK)나 헬퍼 함수는 전혀 수정되지 않았다. 새 상수·정규식·테스트만 파일 끝/상단에 추가된 순수 additive 변경이다.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 변경(+6줄)은 이번 작업과 무관해 보이는 새 백로그 항목(Prisma→TypeORM 서술 오류, `spec/0-overview.md` Rationale)을 추가한다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4860-4864` (diff 게이트 기준)
  - 상세: `--impl-prep` consistency-check(INFO 2, `review/consistency/2026/09/19/16_54_09/rationale_continuity.md` 또는 `plan_coherence`)가 발견한 기존 spec 결함을 "planner 가 처리할 백로그"로 등재만 한 것이며, 이번 세션이 직접 `spec/0-overview.md` 를 고치지는 않았다. 코드 수정이 아니라 발견사항 기록이라 실질적인 scope 이탈은 아니지만, 엄밀히는 "엔티티 컬럼 선언 아홉 곳 정정"이라는 태스크 표제와는 별개의 화제다.
  - 제안: 조치 불요 — 이 프로젝트의 developer→planner 인계 관례(발견 즉시 수정 대신 트래커에 등재)를 따른 것으로 보이며, 실제 spec 파일은 손대지 않았다.

- **[INFO]** `review/consistency/2026/09/19/{10_58_34,16_54_09}/**` (18개 파일, ~750줄) 은 `--impl-prep` 의무 실행에 따른 산출물이며, 코드 변경이 아니다.
  - 위치: `review/consistency/2026/09/19/10_58_34/*`, `review/consistency/2026/09/19/16_54_09/*`
  - 상세: `git status --short` 확인 결과 이들은 diff 안에 새 파일로 커밋 포함돼 있다. CLAUDE.md 규약상 `review/` 는 gitignore 대상이 아니고 검토 산출물의 정식 저장 위치이므로 커밋에 포함되는 것 자체는 정상이다. 다만 diff 통계상 전체 변경량(981줄 추가)의 대부분(약 630줄)이 이 산출물이라, "아홉 곳 컬럼 정정"이라는 논리적 변경 규모에 비해 diff 가 커 보일 수 있다.
  - 제안: 조치 불요 — 프로세스 준수 산출물이며 실질 코드 변경과 섞여 있지도 않다(파일 경계가 명확히 분리됨).

## 요약

핵심 코드 변경(8개 엔티티 파일)은 plan 문서의 9행 표와 정확히 1:1 대응하며, 각 파일에서 의도한 `@Column` 옵션 한 군데만 최소로 수정했다 — 포맷팅·주석·임포트·무관 리팩토링이 전혀 섞이지 않은 모범적인 scope 준수 사례다. 가드 테스트 확장(`entity-schema-declarations.e2e-spec.ts`)도 plan 이 명시한 목적에 정확히 부합하는 additive 변경이다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 새 백로그 항목과 `review/consistency/**` 산출물은 이번 작업의 핵심 diff(엔티티 컬럼 정정)와는 별개 화제이지만, 둘 다 실제 코드 수정이 아니라 이 저장소의 정식 워크플로(developer→planner 인계 기록, impl-prep 산출물 보존)에 따른 부산물이므로 scope 이탈로 보지 않는다.

## 위험도
NONE
