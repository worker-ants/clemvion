# 보안(Security) 코드 리뷰

## 검토 범위

이번 diff 는 8개 TypeORM 엔티티 파일의 `@Column()` 데코레이터 옵션(`type: 'uuid'`, `enumName`, `default`)을 실제 DB 스키마와
일치시키는 정정, 그에 대응하는 e2e 가드 테스트 확장(`entity-schema-declarations.e2e-spec.ts`), 그리고 plan/consistency-review
산출 마크다운·JSON 문서로 구성된다. 애플리케이션 실행 경로 중 사용자 입력을 받는 컨트롤러·서비스·인증 로직은 포함되지 않는다.

- `alert-rule.entity.ts` — `workspace_id` 컬럼에 `type: 'uuid'` 추가
- `edge.entity.ts` — `type` enum 컬럼에 `enumName: 'edge_type'` 추가
- `integration-usage-log.entity.ts` — `node_execution_id`/`workflow_id` 에 `type: 'uuid'` 추가
- `llm-usage-log.entity.ts` — `workspace_id` 에 `type: 'uuid'` 추가
- `model-config.entity.ts` — `kind` 컬럼에 `default: 'chat'` 추가
- `node.entity.ts` — `category` enum 컬럼에 `enumName: 'node_category'` 추가
- `workflow-assistant-session.entity.ts` — `last_interaction_at` 에 `default: () => 'now()'` 추가
- `workspace-invitation.entity.ts` — `workspace_id` 에 `type: 'uuid'` 추가
- `entity-schema-declarations.e2e-spec.ts` — TypeORM 스키마 비교기(`log()`)로 컬럼 층 drift 를 잡는 테스트 2건 추가 (정적 문자열만 사용, 외부 입력 없음)
- `plan/in-progress/entity-column-declaration-drift.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/consistency/**` — 작업 추적·검토 산출 문서

## 발견사항

- **[INFO]** e2e 테스트 DB 접속 정보에 하드코딩된 fallback 자격증명
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (해당 라인은 이번 diff 밖 — `createDataSource`/`db` 설정 블록, `password: process.env.DB_PASSWORD ?? 'clemvion-e2e'` 등)
  - 상세: `process.env.DB_PASSWORD ?? 'clemvion-e2e'` 형태의 fallback 값이 파일에 존재한다. 다만 이 줄은 이번 PR 의 diff 에 포함되지 않은 기존 코드이고(`git diff origin/main` 대조로 확인), 로컬 e2e 컨테이너 전용 관례적 기본값(운영 자격증명 아님)이라 신규 위험이 아니다. 참고로만 기록한다.
  - 제안: 조치 불요 (기존 관례, 이번 변경 범위 밖).

- **[INFO]** 신규 e2e 테스트가 만드는 SQL 은 전부 정적 문자열/식별자 리터럴
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 함수 `catalog`, `isColumnLevel`, 신규 `it(...)` 블록 2건
  - 상세: 새로 추가된 `catalog()` 쿼리와 `COLUMN_LEVEL`/`COLUMN_LEVEL_SAMPLES`/`UNDECLARED_COLUMNS` 는 모두 코드에 박힌 상수 문자열·정규식이며 사용자 입력이나 외부 변수를 SQL 문자열에 보간하지 않는다. 인젝션 표면 없음.
  - 제안: 없음 (양호).

- **[INFO]** 엔티티 컬럼 타입/기본값 정정은 데이터 무결성 강화 방향
  - 위치: `alert-rule.entity.ts:19`, `workspace-invitation.entity.ts:18`, `integration-usage-log.entity.ts:30,33`, `llm-usage-log.entity.ts:20`, `edge.entity.ts:53-58`, `node.entity.ts:48`, `model-config.entity.ts:46`, `workflow-assistant-session.entity.ts:75-79`
  - 상세: `type: 'uuid'` 명시는 TypeORM 이 이전에 `varchar` 로 오추론하던 것을 실제 DB 컬럼 타입과 일치시키는 정정이고, `enumName` 명시는 enum 타입 이름 drift 를 막는다. 두 변경 모두 `synchronize: false` 환경에서 스키마 비교기 계산에만 쓰이며 런타임 쿼리 동작·인가 로직에 영향이 없다(plan 문서의 "런타임 영향" 절도 동일하게 서술). 보안 관점에서 위험을 만들지 않는다.
  - 제안: 없음.

- **[INFO]** review/plan 산출 문서에 시크릿·PII 없음
  - 위치: `plan/in-progress/entity-column-declaration-drift.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `review/consistency/2026/09/19/{10_58_34,16_54_09}/**`
  - 상세: grep 결과 API 키·비밀번호·토큰 패턴 없음. 내용은 작업 추적·consistency-check 결과 요약이며 코드 실행 경로와 무관.
  - 제안: 없음.

## 요약

이번 변경은 TypeORM 엔티티 `@Column()` 데코레이터의 타입/기본값 메타데이터를 실제 DB 스키마와 일치시키는 순수 정합성 정정과, 그 정합성을 지키는 e2e 가드 테스트 확장(정적 문자열만 사용)으로 구성된다. 사용자 입력 처리, 인증/인가 로직, 암호화, 외부 통신 경로를 건드리지 않으며 새로운 인젝션 표면이나 하드코딩된 시크릿도 발견되지 않았다. e2e 헬퍼의 fallback 테스트 DB 비밀번호는 이번 diff 밖의 기존 관례적 코드로, 신규 위험이 아니다.

## 위험도

NONE
