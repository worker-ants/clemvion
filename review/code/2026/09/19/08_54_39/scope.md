# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 브랜치가 서로 다른 owner·주제의 커밋 두 개를 함께 담고 있다
  - 위치: 커밋 `ffd58da4e`(entities, developer) / `ff530fc8a`(spec, project-planner) — `git log origin/main..HEAD`
  - 상세: 이번 브랜치는 (1) `entity-schema-declaration-drift`(엔티티 인덱스·제약 선언 8곳 정정 + e2e 가드, `codebase/**`)와 (2) `spec-draft-assistant-i18n-table-sync`(§13 i18n 키 표를 글로서리·사전에 맞추는 정정, `spec/**`)를 함께 포함한다. 후자는 전자의 `--impl-prep spec/3-workflow-editor/`(08_07_50) 가 CRITICAL·BLOCK:YES 를 낸 데 따른 것으로, CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 규약을 그대로 따른 것이며 별도 커밋·별도 plan 파일(`plan/complete/spec-draft-assistant-i18n-table-sync.md`, owner: project-planner)·별도 consistency-check 세션(08_07_50→08_23_02)으로 투명하게 분리·추적되어 있다. `codebase/` diff 자체는 8-항목 계획과 정확히 6개 파일로만 대응해 순수하다(`git diff --stat` 로 확인 — entities 6개 + 신규 e2e 1개뿐). 두 관심사가 한 브랜치/PR 에 섞인 것은 "몰래 끼운 추가 수정"이 아니라 게이트가 강제한 절차이므로 결함으로 보지는 않으나, PR 리뷰 시 두 커밋을 분리해서 읽는 것이 좋다.
  - 제안: 조치 불요(이미 사후 그물인 `--impl-done` 이 두 spec 영역 모두를 스코프로 재검증할 예정 — plan 체크리스트에 명시됨). PR 설명에 "이 브랜치는 두 개의 독립 plan(엔티티 정정 + spec i18n 동기화)을 포함한다"는 한 줄만 남기면 리뷰 편의가 좋아진다.

## 점검한 항목 (이상 없음)

- **의도 이상의 변경 / 무관한 수정**: `codebase/` 변경은 `plan/in-progress/entity-schema-declaration-drift.md` 의 "발견 — 여덟 곳" 표와 파일 단위로 1:1 대응한다(`edge.entity.ts`·`node.entity.ts`·`node-execution.entity.ts`·`workspace.entity.ts`·`integration-expiry-dispatch.entity.ts`·`workflow-assistant-session.entity.ts` + 신규 `test/entity-schema-declarations.e2e-spec.ts`). 각 파일의 diff 를 개별 대조한 결과 표에 없는 추가 수정은 없었다.
- **임포트 변경**: `node.entity.ts` 에서 제거된 `import { Index } from 'typeorm'` 은 같은 diff 에서 `@Index('IDX_node_workflow_label', …)` 데코레이터 자체를 제거한 데 따른 필연적 정리다(다른 `Index` 사용처 없음) — 무관한 임포트 정리 아님.
- **주석 변경**: 각 파일의 주석 수정(`workspace.entity.ts` V109 언급, `node.entity.ts` "같은 이유로 제거했다" 추가, `node-execution.entity.ts` V095 참조 추가, `integration-expiry-dispatch.entity.ts` 이름 미명시 사유)은 모두 정정 대상 데코레이터를 설명하는 문장이며, 정정 전 주석이 실제 DB 상태와 어긋나 있던 것을 바로잡는 내용이다 — 범위 밖 주석 첨삭 아님.
- **기능 확장**: 신규 e2e 파일(382줄)은 "선언↔DB 대조" 라는 plan 이 명시한 단일 목적에 집중돼 있다(인덱스/유니크/CHECK/FK 네 개 `it` 블록 + 가드 자체의 정규화 로직을 검증하는 대조군 테스트 1개). 기존 헬퍼(`./helpers/db`, `ROOT_ENTITIES`)만 재사용하고 신규 앱 코드·신규 프로덕션 유틸을 만들지 않았다.
- **포맷팅 변경 / 설정 변경**: 6개 엔티티 파일 diff 모두 데코레이터 인자 변경에 국한된 최소 hunk이며, 무관한 줄바꿈·재정렬·설정 파일 변경은 없었다.
- **plan/review 부속 파일**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 트래커 항목, `review/consistency/2026/09/19/{08_07_50,08_23_02,08_33_13}/**` 산출물은 모두 두 plan(entities/spec)이 실제로 통과한 `--impl-prep`/`--spec` 게이트의 감사 기록이며, 새로 발견했지만 이번 턴 범위 밖인 항목(§8.1 자동 요약 서술, 사전 키 셋 미문서화)은 정책대로 그 자리에서 등재만 하고 손대지 않았다.

## 요약

핵심 작업(엔티티 인덱스·제약 선언 정정 8곳 + 회귀 e2e 가드)은 `codebase/` 범위에서 plan 표와 정확히 1:1 대응하며 불필요한 리팩토링·포맷팅·임포트·주석 잡음이 없는 매우 깨끗한 diff다. 유일한 관찰 사항은 브랜치가 `--impl-prep` 게이트가 강제한 별도 planner 턴(spec i18n 표 동기화)을 별도 커밋으로 함께 싣고 있다는 점인데, 이는 프로젝트 규약이 명시적으로 요구하는 절차이고 별도 plan·별도 consistency-check 세션으로 완전히 문서화돼 있어 은닉된 스코프 확장이 아니다.

## 위험도
NONE
