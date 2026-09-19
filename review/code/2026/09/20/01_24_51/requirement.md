# 요구사항(Requirement) 리뷰

## 검토 범위

- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 신규 테스트 2건(읽기 전용 세션 예방 계층 회귀, 선언한 DB 기본값 RETURNING 왕복) + 헬퍼 추출(`readOnlyDataSourceOptions()`) + 가독성 개선(`log`→`sqlMemory`, 표본 주석)
- `plan/in-progress/column-guard-gaps.md` — 트래커(`spec-draft-nullable-notation-followups.md`)의 "수렴 예외" 두 항목을 닫는 plan
- `review/code/2026/09/20/01_00_21/**`, `review/consistency/2026/09/20/00_34_58/**` — 선행 리뷰/consistency 라운드 산출물(이미 커밋됨). 코드 자체가 아니므로 요구사항 완전성 판단 대상에서는 제외하되, RESOLUTION 이 주장하는 "1라운드 조치 완료" 를 실제 diff/커밋과 대조하는 근거로 사용.

전체 파일이 프롬프트 크기 제한에 걸려 실려 있지 않아 `Read` 로 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 전문을 직접 열람했다. 아래 위치 표기는 그 파일의 실제 줄 번호(1-기준)다.

## 검증한 것

1. **1라운드 WARNING #2(커넥션 누수 가능성) 실제 수정 확인** — RESOLUTION.md 가 주장한 조치를 커밋 `a71642fe0` diff 로 직접 대조했다. `qr.connect()`/`qr.startTransaction()` 이 `try` 안으로 이동(614~618행), `finally` 는 `qr.isTransactionActive` 일 때만 롤백하고 안쪽 `finally` 로 `release()` 를 방어(655~661행). `readOnlyDataSourceOptions()` 소비처(568행 기존 테스트, 595~606행 신규 테스트) 두 곳 모두 `initialize()` 를 `try` 안에 두는 관용구로 통일됨(INFO #1 실제 반영). TypeORM `PostgresQueryRunner.release()` 소스(`node_modules/typeorm/driver/postgres/PostgresQueryRunner.js`)를 직접 확인 — `connect()` 가 실패해 `releaseCallback` 이 미설정이어도 `release()` 는 예외 없이 조용히 반환하므로, `finally` 체인이 어떤 실패 지점에서도 추가 예외를 던지지 않는다. 수정이 의도한 문제를 실제로 닫았다.
2. **읽기 전용 세션이 `CREATE TEMP TABLE` 도 거부한다는 핵심 전제** — 이 두 신규 테스트(예방 계층 테스트 자체 + 기존 컬럼 층 테스트가 공유하는 헬퍼)의 성립 근거가 되는 기술적 전제다. `review/consistency/2026/09/20/00_34_58/rationale_continuity.md` 가 pg18(이 저장소가 쓰는 이미지)로 실측 재현했다고 기록하고 있고, 이는 PostgreSQL 의 실제 동작(읽기 전용 트랜잭션은 임시 여부와 무관하게 모든 `CREATE`/`ALTER`/`DROP` 을 거부)과 일치한다 — `/read-only transaction/` 정규식이 매칭할 실제 에러 메시지("cannot execute CREATE TABLE in a read-only transaction")도 포함 관계가 맞다. 근거 없는 주장이 아니다.
3. **spec 본문 line-level 대조** — `plan/in-progress/column-guard-gaps.md` 와 신규 테스트 JSDoc(609~613행)이 인용하는 `spec/1-data-model.md`:
   - §2.16 ModelConfig 표: `kind | Enum | ... default=chat(V088)` ↔ 마이그레이션 `V088__model_config_rename_kind.sql`(`kind VARCHAR(20) NOT NULL DEFAULT 'chat'`) ↔ 엔티티 `model-config.entity.ts`(`@Column({ length: 20, default: 'chat' }) kind`) ↔ 테스트 단언(`expect(config.kind).toBe('chat')`, 640행) — 넷이 일치.
   - §2.20 AssistantSession 표: `last_interaction_at | Timestamp | ... default=now()` ↔ 마이그레이션 `V019__workflow_assistant.sql`(`last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`) ↔ 엔티티 `workflow-assistant-session.entity.ts`(`default: () => 'now()'`) ↔ 테스트 단언(654행, 같은 트랜잭션의 `now()` 와 정확히 일치) — 넷이 일치.
   - 커밋 참조 `#1358` 실재 확인(`6f9c0f1c1`).
   불일치 없음 — CRITICAL 없음.
4. **테스트가 검증 대상 엔티티에 값을 미리 채워 넣어 결과를 위장하는지(vacuous 여부)** — `ModelConfig`/`WorkflowAssistantSession` 양쪽에 `@BeforeInsert` 훅·`EventSubscriber` 가 없음을 grep 으로 확인(0건). 즉 `kind`/`lastInteractionAt` 이 채워지는 경로는 정말 DB `DEFAULT` → `RETURNING` 뿐이고, 테스트가 자기 자신을 속이는 구조가 아니다.
5. **부모 행(user/workspace/workflow) raw INSERT 가 실제 NOT NULL 제약을 전부 채우는지** — `V001` 스키마 대조 결과 `user.email/name`, `workspace.name/owner_id/slug`, `workflow.workspace_id/name/created_by` 가 기본값 없는 NOT NULL 컬럼 전부이며 테스트가 모두 값을 준다. 누락 없음.

## 발견사항

- **[INFO]** 파일 헤더 JSDoc 이 아직 존재하지 않는 경로(`plan/complete/column-guard-gaps.md`)를 인용한다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:29`
  - 상세: 현재 그 plan 은 `plan/in-progress/column-guard-gaps.md` 에 있고(체크리스트 마지막 항목 "트래커 해소 · 이 plan `plan/complete/` 로" 가 미완료 `[ ]`), `plan/complete/column-guard-gaps.md` 는 아직 존재하지 않는다(`ls` 확인). 다만 `git log -p` 로 확인한 바 이 파일의 선행 사례(`plan/complete/entity-column-declaration-drift.md` 인용, 25행)도 **plan 이 아직 in-progress 이던 최초 커밋(`3c2b39305`)부터 이미 완료 경로를 인용**했고, 실제로 4라운드 리뷰를 거쳐 최종 커밋(`037dcb7d6`)에서 그 경로로 이동해 참조가 맞아떨어졌다 — 이번 건도 같은 선례를 따르는 것으로 보이며, plan 체크리스트가 그 이동을 이미 to-do 로 추적하고 있다. 코드 결함이 아니라 진행 중 스냅샷의 정상적인 선행 참조이나, 이 라운드에서 병합이 확정될 경우 plan 이동이 실제로 수행되는지 마무리 커밋에서 확인이 필요하다.
  - 제안: 조치 불요(이미 체크리스트가 추적). 마무리 커밋에서 plan 이동 여부만 재확인.

## 요약

신규 테스트 2건은 트래커(`spec-draft-nullable-notation-followups.md`)가 지정한 좁은 스코프(예방 계층 자체의 회귀, 선언한 `default` 두 컬럼의 RETURNING 왕복)를 정확히 구현한다. 함수 시그니처·필드명·기본값·상태 전이 모두 `spec/1-data-model.md` §2.16·§2.20, 관련 마이그레이션(V088/V019), 엔티티 데코레이터와 line-level 로 일치하며 spec drift 나 spec 위반이 없다. 1라운드 리뷰가 지적한 커넥션 누수 가능성(WARNING #2)은 커밋 `a71642fe0` 에서 `try`/`finally` 구조를 견고하게 고쳐 실제로 해소됐음을 TypeORM 소스 레벨까지 확인했다. 테스트가 검증하는 핵심 전제(읽기 전용 세션이 임시 테이블 `CREATE` 도 거부한다)는 근거 없는 주장이 아니라 pg18 실측으로 뒷받침된다. 유일한 특이사항은 헤더 JSDoc 이 아직 `plan/complete/` 로 옮겨지지 않은 plan 경로를 인용하는 것인데, 이는 이 저장소의 기존 선례와 동일한 패턴이고 plan 체크리스트가 이미 추적 중이라 조치가 필요한 결함으로 보지 않는다. TODO/FIXME 류 미완성 표식은 없다.

## 위험도

NONE
