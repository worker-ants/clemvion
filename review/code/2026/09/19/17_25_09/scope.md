# 변경 범위(Scope) 리뷰

## 검증 방법

`git diff --stat origin/main...HEAD` 로 실제 커밋 diff(27 파일, +1053/-12)를 프롬프트에 실린 17개 목록과 대조했다 — 완전히 일치한다(숨은 변경 없음). 엔티티 9개 컬럼 수정을 plan 표(`plan/in-progress/entity-column-declaration-drift.md` "실측" 표)와 1:1로 대조했고, 절단된 두 파일(`entity-schema-declarations.e2e-spec.ts`, 두 plan 문서)은 `Read` 로 전문을 직접 열람했다. 저장소에 뮤테이션은 하지 않았다.

## 발견사항

- **[INFO]** 엔티티 컬럼 수정 9건이 plan 문서의 실측 표와 정확히 1:1 대응한다
  - 위치: `codebase/backend/src/modules/{alerts,workspaces,integrations,llm,model-config,nodes,edges,workflow-assistant}/entities/*.entity.ts`
  - 상세: `alert-rule`(uuid×1) · `workspace-invitation`(uuid×1) · `integration-usage-log`(uuid×2) · `llm-usage-log`(uuid×1) · `model-config`(default×1) · `node`(enumName×1) · `edge`(enumName×1) · `workflow-assistant-session`(default×1) = 9. `plan/in-progress/entity-column-declaration-drift.md`의 "실측 — TypeORM 스키마 비교기" 표 9행과 정확히 일치하며, 이 9곳 밖의 다른 컬럼·다른 데코레이터 속성(예: `length`, `nullable`)을 건드린 흔적은 없다. 여러 모듈에 걸친 것은 가드가 전체 엔티티를 스캔하는 성격상 자연스러운 분산이지 무관한 영역 확장이 아니다.
  - 제안: 없음(정상)

- **[INFO]** `entity-schema-declarations.e2e-spec.ts` 확장은 plan이 명시한 "가드를 컬럼 층으로" 작업 범위 안에 있다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (`UNDECLARED_COLUMNS`, `COLUMN_LEVEL`, `COLUMN_LEVEL_SAMPLES`, `isColumnLevel`, 신규 테스트 2개)
  - 상세: 기존 인덱스·제약·FK 3개 테스트는 手 대지 않았고, 헤더 주석만 "컬럼 층은 이 가드 밖" → "컬럼 층은 양방향" 으로 정정했다(취소선 없이 문장 자체를 교체했지만, 이는 spec 파일이 아니라 테스트 파일 자체의 주석이라 §자기-반증형 소정정 규정 대상이 아니다). 새 로직·새 상수·새 테스트 모두 "컬럼 층 가드" 라는 단일 목적에 수렴한다. 기능 확장(over-engineering)으로 볼 여지가 없다 — 오히려 리뷰 1라운드 WARNING(패턴이 매치된 적 없다는 지적)에 대한 보강으로 커밋 이력(`717382613`)에 정확히 대응한다.
  - 제안: 없음(정상)

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 항목은 spec 자체 수정이 아니라 발견 사실의 백로그 등재
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (Prisma/TypeORM Rationale drift 항목, "planner, 낮음, 2026-09-19 등재")
  - 상세: `spec/0-overview.md` 자체는 diff에 없다 — 이번 작업 중 발견한 무관한 기존 drift(Prisma 전제 vs 실제 TypeORM)를 직접 고치지 않고 트래커에 항목만 추가했다. CLAUDE.md의 "developer 는 spec 변경 필요 시 멈추고 project-planner 위임" 원칙과 정확히 일치하는 처리이며, 이번 diff 범위(엔티티 컬럼 정정)를 벗어나 spec 본문을 건드리지 않았다.
  - 제안: 없음(정상)

- **[INFO]** `review/consistency/**` 18개 신규 파일은 workflow가 강제하는 `--impl-prep` 산출물이지 임의 추가물이 아니다
  - 위치: `review/consistency/2026/09/19/{10_58_34,16_54_09}/**`
  - 상세: CLAUDE.md 표에 따라 `developer` 는 `review/**` 쓰기 권한을 가지며, `--impl-prep` 은 구현 착수 직전 의무 절차다. 1차(BLOCK:YES, `spec/2-navigation/4-integration.md` §5.4 케이스 규약 위반)와 2차(#1357 머지 후 재실행, BLOCK:NO) 두 라운드 모두 이 작업의 필수 게이트 흐름이며, `plan/in-progress/entity-column-declaration-drift.md` 체크리스트가 그 실행을 명시적으로 기록한다. 코드베이스(`codebase/**`) 변경은 정확히 8개 엔티티 파일 + 1개 테스트 파일뿐이다.
  - 제안: 없음(정상)

## 검토했으나 문제 아님 (오탐 방지)

- `edge.entity.ts`의 `@Column({...})` 한 줄 → 4줄 포맷 변경은 `enumName` 속성 추가로 객체가 3개 키가 되며 발생한 필연적 개행이다(prettier 표준 동작) — 의미 없는 포맷팅 끼워넣기가 아니다.
- `workflow-assistant-session.entity.ts`의 동일 패턴(1줄 → 4줄)도 `default: () => 'now()'` 추가로 인한 같은 성격의 변경이다.

## 요약

diff는 plan 문서가 예고한 "엔티티 컬럼 선언 9곳 정정 + 가드를 컬럼 층으로 확장"이라는 단일 목적에 정확히 수렴한다. `git diff --stat`로 확인한 실제 커밋 범위(27 파일)가 리뷰 프롬프트의 파일 목록과 완전히 일치해 숨겨진 변경이 없고, 8개 엔티티의 9건 컬럼 수정은 plan의 실측 표와 1:1 대응하며 그 밖의 속성·컬럼은 건드리지 않았다. 테스트 파일 확장은 같은 컬럼 층 가드 목적에 수렴하고, plan/tracker 문서 변경은 CLAUDE.md의 developer→planner 위임 원칙을 그대로 따른 백로그 등재이며, `review/consistency/**` 산출물은 워크플로가 강제하는 `--impl-prep` 게이트의 필수 부산물이다. 포맷팅·주석·임포트·설정 파일 변경 중 실질 변경과 무관한 것은 발견되지 않았다.

## 위험도

NONE
