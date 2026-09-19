# 요구사항(Requirement) 리뷰 — 엔티티 컬럼 선언 아홉 곳 정정 + 컬럼 층 가드 확장

## 검증 방법

`plan/in-progress/entity-column-declaration-drift.md` 의 실측 표(아홉 곳 선언↔DB 불일치)와 각 엔티티 diff 를 1:1 대조했고, `spec/1-data-model.md` 의 관련 §(2.6 Node, 2.7 Edge, 2.16 ModelConfig, 2.20 AssistantSession, 2.25 AlertRule 등)를 직접 열어 필드 타입·기본값 서술과 line-level 로 대조했다. 또 실제 마이그레이션 SQL(V088 `model_config.kind DEFAULT 'chat'`, 이후 어떤 마이그레이션도 그 DEFAULT 를 DROP 하지 않음)로 plan 의 "실제 DB" 열 주장을 저장소에서 직접 재확인했다. `entity-schema-declarations.e2e-spec.ts` 전체 파일(567줄)을 Read 로 직접 읽었다(프롬프트가 크기 제한으로 전체 컨텍스트를 싣지 못했음). 저장소 파일은 뮤테이션하지 않았다 — `Read`/`Bash`(grep/find/git status)만 사용했고, 세션 종료 시 `git status --short` 로 변경 없음을 확인했다.

## 발견사항

- **[INFO]** `spec/1-data-model.md` §2.16 ModelConfig 표가 `kind` 컬럼의 DB 기본값(`'chat'`)을 언급하지 않는다
  - 위치: `spec/1-data-model.md:610` (`| kind | Enum | ... |`)
  - 상세: 같은 문서 §2.25 AlertRule 은 `channel`·`enabled` 처럼 기본값이 있는 필드마다 "(기본 `in_app`)"/"(기본: true)" 를 명시하는데, §2.16 `kind` 행은 그 관례를 따르지 않는다. 이번 diff 가 고친 `model-config.entity.ts` 의 `default: 'chat'` 은 V088 마이그레이션이 이미 만든 실제 DB DEFAULT 를 정확히 반영한 것(추가 조사로 확인 — 이후 어떤 마이그레이션도 그 DEFAULT 를 drop 하지 않음)이고, `create-model-config.dto.ts` 가 `kind` 를 필수 필드로 요구해 애플리케이션 경로에서는 이 기본값이 실질적으로 쓰이지 않는다. 코드는 DB 사실과 정확히 일치하므로 결함은 아니고, spec 표의 서술 관례 공백이다.
  - 제안: 코드 변경 불필요. 다음 `project-planner` 편집 시 §2.16 `kind` 행에 "(레거시 기본값 `chat` — V088. 신규 생성은 필수 지정)" 같은 한 줄을 추가하면 다른 필드와 서술 일관성이 맞는다.

- **[INFO]** `spec/1-data-model.md` §2.20 AssistantSession 표가 `last_interaction_at` 의 DB 기본값(`now()`)을 언급하지 않는다
  - 위치: `spec/1-data-model.md:769`
  - 상세: `workflow-assistant-session.service.ts:94, 170` 가 생성·갱신 시 `lastInteractionAt` 을 항상 명시적으로 채우므로 DB `DEFAULT now()` 는 애플리케이션 경로에서 실질적 의미가 없다(엔티티 삽입 후 `RETURNING` 값도 동일 시각). 코드 fix 는 DB 사실과 일치하며 결함이 아니다.
  - 제안: 코드 변경 불필요. spec 정정도 선택 사항(경미) — 굳이 반영할 필요는 낮다.

- **[INFO]** 컬럼 층 가드 새 테스트에 미세한 연결 누수 가능성 — `readOnly.initialize()` 실패 시 `destroy()` 가 호출되지 않는다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:544-554` (`const readOnly = new DataSource(...); await readOnly.initialize(); let log: SqlInMemory; try { log = await readOnly.driver.createSchemaBuilder().log(); } finally { await readOnly.destroy(); }`)
  - 상세: `try/finally` 가 `createSchemaBuilder().log()` 호출만 감싸고 `initialize()` 호출은 감싸지 않는다. `initialize()` 가 (예: `extra.options` 값이 유효하지 않은 환경에서) 예외를 던지면 커넥션 풀이 정리되지 않은 채 테스트가 실패로 끝날 수 있다. 다만 `initialize()` 실패는 통상 풀이 완전히 생성되지 않은 상태라 실제 누수 가능성은 낮고, jest 프로세스가 그 직후 종료되는 e2e 컨텍스트라 영향은 제한적이다.
  - 제안: `readOnly.initialize()` 도 같은 `try/finally` 블록 안으로 옮기면 방어적으로 더 안전하다. 우선순위는 낮음(현재 뮤테이션 실측에서 이 경로가 문제를 일으킨 적은 없음).

- **[INFO]** `COLUMN_LEVEL` 의 `ADD` 패턴(`/^ALTER TABLE "[^"]+" ADD "/`)이 TypeORM 이 `ADD COLUMN "x"` 형태(키워드 `COLUMN` 포함)로 출력할 가능성을 흘려보낸다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:62-68` (`COLUMN_LEVEL` 배열)
  - 상세: 현재 패턴은 2026-09-19 TypeORM 0.3.31 실측(`ALTER TABLE "alert_rule" ADD "probe_extra" text`)에 정확히 맞춰졌고, plan 문서가 이 근거를 명시한다(뮤턴트 검증 포함). 다만 향후 TypeORM 버전이 `ADD COLUMN` 키워드를 포함하는 형태로 바뀌면 이 패턴만 조용히 새 컬럼 추가를 놓칠 수 있다(다른 네 패턴은 영향 없음). 지금 시점에서는 결함이 아니라 버전 종속적 잠재 취약점 기록 차원.
  - 제안: 당장 조치 불요. TypeORM 메이저 업그레이드 시 `COLUMN_LEVEL_SAMPLES.caught` 표본을 그 버전으로 재채집해 패턴을 재검증하는 것을 후속 작업으로 남겨도 좋다.

## 검토했으나 문제 없음 (명시적으로 남김)

- 아홉 개 컬럼 수정(`type: 'uuid'` ×5, `enumName` ×2, `default` ×2) 전부가 `plan/in-progress/entity-column-declaration-drift.md` 의 실측 표와 diff 가 1:1 로 일치했다. `alert_rule.workspace_id`·`workspace_invitation.workspace_id`·`integration_usage_log.node_execution_id`/`workflow_id`·`llm_usage_log.workspace_id` 는 `spec/1-data-model.md` 가 이미 `UUID` 로 명시한 필드이므로 fix 가 spec 과 정확히 일치한다. `node.category`/`edge.type` 의 `enumName` 도 §2.6/§2.7 의 Enum 서술과 모순 없음(enum 타입 *이름*은 spec 관할 밖 — DB 물리 세부).
- `UNDECLARED_COLUMNS` 예외 목록(`document_chunk.embedding`, `agent_memory.embedding`)이 실제 엔티티 파일에서 정말로 `embedding` 컬럼을 선언하지 않고 원시 SQL 로만 다루는 것을 `document-chunk.entity.ts`/`agent-memory.entity.ts` 주석으로 확인했다 — 목록과 코드 사실이 일치.
- `model_config.kind` 의 `default: 'chat'` 이 매치하는 실제 DB DEFAULT 가 V088 마이그레이션에서 유래하고 이후 어떤 마이그레이션도 drop 하지 않음을 직접 확인 — plan 표 8행의 "실제 DB: `DEFAULT 'chat'`" 주장이 근거 있다.
- `readOnly` DataSource 를 `-c default_transaction_read_only=on` 세션으로 여는 "예방" 계층은 plan 의 뮤턴트 RO1(읽기 전용 세션에서 DDL 실행 시도 → Postgres 가 실제로 거부)로 이미 실측 검증됐다. 카탈로그 해시 비교("탐지" 계층)도 별개로 존재해 이중 방어가 실제로 작동함을 확인했다.
- 컬럼 층 정규식 5종은 `COLUMN_LEVEL_SAMPLES` 대조군 테스트로 "각 패턴이 적어도 하나의 실측 표본을 잡는다"를 자체 검증하고, `ignored` 표본(FK 삭제·인덱스 생성/삭제·COMMENT ON)은 잡지 않음을 assert 한다 — 판별력이 실제로 방어된다.
- TODO/FIXME/HACK/XXX 주석은 diff 전체에서 발견되지 않았다.
- `spec_impact: none` 선언이 타당하다 — 이번 변경은 이미 존재하는 DB 물리 사실을 엔티티 선언에 반영하는 것뿐이고, 관련 spec(`1-data-model.md`) 필드 타입 서술은 이미 정확했으므로 spec 텍스트 수정이 필요하지 않다.
- `synchronize: false` 환경이라 이번 변경(타입 힌트·enumName·default 선언)이 실제 DDL 을 유발하지 않는다는 plan 의 주장은 코드로도 확인된다(`database/database.module.ts` 류의 부트스트랩 설정과 무관하게 `dataSourceOptions()` 자체가 `synchronize: false` 고정).

## 요약

이번 diff 는 앞선 세션의 실측(스키마 비교기 `log()` dry-run)으로 확인된 아홉 개 엔티티 컬럼 선언↔DB 불일치를 전부 정확히 정정했고, `spec/1-data-model.md` 의 대응 필드 타입 서술과 line-level 로 어긋나는 곳이 없다. 새로 추가된 "컬럼 층" 가드 테스트는 판별력 대조군·읽기 전용 세션 예방·카탈로그 해시 탐지의 이중 방어까지 갖췄고, 그 설계 근거(어떤 패턴이 무엇을 잡고 무엇을 흘리는지)를 plan 문서의 반복된 뮤테이션 실측(R1/R2, P1~P4, S1, RO1)으로 직접 검증해 두었다 — "설계 근거는 사용 전에 뮤턴트로 반증하라"는 요구 수준을 충족한다. TODO/FIXME 는 없고, 반환값·에러 시나리오도 정상 흐름을 벗어나지 않는다. 발견된 항목은 모두 INFO 등급(spec 서술 관례 공백 2건, 테스트 코드의 이론적 엣지케이스 2건)으로, 코드를 되돌리거나 즉시 고쳐야 할 결함이 아니다.

## 위험도

NONE
