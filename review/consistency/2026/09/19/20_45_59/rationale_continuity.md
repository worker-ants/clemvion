# Rationale 연속성 검토

## 발견사항

- **[INFO]** `0-overview.md` Rationale 정정에 넣을 상호참조 링크의 상대경로 확인 필요
  - target 위치: `plan/in-progress/spec-draft-spec-fact-orm-defaults.md` §변경 A, trade-off 항목 (`entity-schema-declarations` 인용부)
  - 과거 결정 출처: 해당 안건이 아니라 문서 역학(mechanics) 이슈 — Rationale 내용 자체와는 무관
  - 상세: draft 본문은 `plan/in-progress/` 기준 상대경로로 `[데이터 모델 Rationale «code: 에 전용 e2e 가드 셋»](../../spec/1-data-model.md)` 를 적었다. 이 표기는 draft 문서 자신의 위치(`plan/in-progress/`)에서는 올바르지만(`../../` → repo root → `spec/1-data-model.md`), 실제로 `spec/0-overview.md` 본문에 삽입될 링크라면 `spec/0-overview.md` 는 `spec/1-data-model.md` 와 **같은 디렉터리의 형제 파일**이므로 상대경로는 `./1-data-model.md#...` 여야 한다. Rationale 간 상호참조는 이 저장소에서 "단일 진실을 가리키기만 하고 중복 서술하지 않는다" 는 확립된 관례(예: `spec/data-flow/0-overview.md` 의 "KB 원본 문서 S3 key 구조" 절이 `spec/0-overview.md` Rationale 을 정확한 상대경로로 가리킴)를 따르는데, 경로가 깨지면 그 관례의 실효성이 떨어진다.
  - 제안: planner 가 실제로 `spec/0-overview.md` 에 반영할 때 링크를 `./1-data-model.md#code-에-전용-e2e-가드-셋-2026-09-19` 형태(해당 문서 기준 상대경로)로 교정할 것. Rationale 내용의 사실관계와는 무관한 표기 문제이므로 CRITICAL/WARNING 이 아니라 INFO.

검토 관점 1~4 (기각된 대안 재도입 / 합의된 원칙 위반 / 결정의 무근거 번복 / 암묵적 가정 충돌) 에 해당하는 CRITICAL·WARNING 급 발견은 없음. 근거는 아래 "요약" 참조.

## 요약

target 은 `spec/0-overview.md` Rationale "DB 마이그레이션 도구로 Flyway 채택 (§2.8)" 의 배경 문장에서 ORM 이름(Prisma → TypeORM)만 정정하고, **채택한 결정(SQL 기반 Flyway, 이유 (a)(b)(c), forward-only, CLI 인자 주입 등)은 전혀 건드리지 않는다** — 실측(`git log -S prisma` 전체 이력 0건, TypeORM 은 V001 과 같은 첫 커�밋부터, `synchronize: false`, `package.json` 의 `typeorm ^0.3.31`)으로 뒷받침되며 모두 코드와 일치함을 직접 확인했다. `spec/1-data-model.md` 의 두 기본값(`model_config.kind` `DEFAULT 'chat'`(V088), `workflow_assistant_session.last_interaction_at` `DEFAULT NOW()`(V019))도 마이그레이션 원문과 정확히 일치하고, 표기 형식(`default=\`…\``)은 §2.8 `notification_health`/`chat_channel_health` 행의 기존 선례를 그대로 따른다. entity-schema-declarations e2e 가드의 "인덱스·제약=선언→DB 단방향, 컬럼 정의=양방향" 서술도 실제 테스트 파일 헤더 주석·PR 번호(#1354, #1358)와 정확히 일치한다.

"원문을 취소선으로 남기지 않고 고쳐 쓴다" 는 target 자신의 선택은, 이 저장소 Rationale 전반에서 이미 여러 차례 쓰인 확립된 두 번째 패턴 — 순수 사실 오류 정정은 `> **정정 (YYYY-MM-DD)**: …` 콜아웃만 붙이고 원문을 고쳐 쓰는 방식(예: `5-system/4-execution-engine.md:1200`, `5-system/3-error-handling.md:345,625`, `5-system/1-auth.md:527`, `4-nodes/0-overview.md` §1.3 "옛 서술 정정") — 과 일치한다. 이는 설계 결정 자체가 폐기·대체될 때 전문을 취소선으로 보존하는 다른 패턴(`2-navigation/2-trigger-list.md` R-2→R-14)과는 성격이 다른 경우(사실 오류 vs 결정 번복)이므로 패턴 선택도 적절하다. `CLAUDE.md` 의 "자기-반증형 소정정" 5조건(취소선 보존 의무 포함)은 **developer 가 자신이 쓴 예고 문장을 반증할 때**로 스코프가 좁혀진 예외이며, 이 draft 는 owner 가 project-planner 이고 정정 대상 문장도 developer 가 아닌 과거 커밋(#256)이 넣은 것이라 그 다섯 조건의 적용 대상이 아니다 — 즉 "취소선 미보존" 이 그 governance 규칙 위반은 아니다. target 자신도 `## Rationale` 절에서 "왜 취소선 없이 고쳐 쓰는가" 를 명시적으로 근거를 남겨(원칙 3 요구사항 충족), "비대상" 절에서 이번 정정의 스코프를 명확히 좁혀(§2 전체 기본값 대조는 안 함) 과잉 확장도 피했다. 종합적으로 이 draft 는 기각된 대안을 되살리지도, 합의된 설계 원칙(Flyway·forward-only·CLI 인자 주입·`select: false` 판단 기준 등)을 건드리지도 않으며, 정정 자체에 대한 근거도 새로 기록했다. 유일한 지적 사항은 실제 spec 반영 시 상호참조 링크의 상대경로를 문서 위치 기준으로 다시 확인하라는 표기상 INFO 이며, Rationale 연속성 실질에는 영향이 없다.

## 위험도
NONE
