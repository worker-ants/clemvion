# 요구사항(Requirement) 리뷰 — column-guard-gaps

## 발견사항

- **[INFO]** `readOnlyDataSourceOptions()` 헬퍼 사용처의 `try`/`finally` 방어 패턴이 두 호출부에서 다르다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 기존 "컬럼 —" 테스트(568행 `readOnly.initialize()` 를 `try` 안에서 호출, `finally` 에서 `if (readOnly.isInitialized) await readOnly.destroy();`)와 신규 "비교기 연결은 읽기 전용이다" 테스트(596행 `readOnly.initialize()` 를 `try` 밖에서 호출, `finally` 에서 무조건 `await readOnly.destroy();`)
  - 상세: `initialize()` 가 `try` 밖에 있으므로 그것이 던지면 애초에 `finally` 에 진입하지 않아 `destroy()` 호출 여부는 실질적으로 문제되지 않는다 — 논리적 결함은 아니다. 다만 같은 파일 안에서 같은 헬퍼를 감싸는 두 가지 다른 관용구가 공존해 다음에 세 번째 사용처를 추가하는 사람이 어느 쪽을 따라야 할지 애매해질 수 있다.
  - 제안: 조치 불요(기능 결함 아님). 다음에 이 헬퍼를 또 쓸 일이 생기면 한 관용구로 통일 검토.

- **[INFO]** `--impl-prep`/`--impl-done` 게이트가 실제 diff 스코프(`spec/1-data-model.md` 귀속)와 무관한 `spec/2-navigation/` 를 target 인자로 사용
  - 위치: `plan/in-progress/column-guard-gaps.md` 체크리스트 1번째 항목, `review/consistency/2026/09/20/00_34_58/meta.json`
  - 상세: 실제로 이 구현이 따르는 spec 은 `spec/1-data-model.md` §2.16/§2.20 이지만, 소비된 consistency-check 세션의 `target_path` 는 `spec/2-navigation/` 다. `rationale_continuity.md` 자체가 "harness 의 선례를 따른 우회 경로"라고 명시하고, `plan_coherence.md`·`convention_compliance.md` 도 동일하게 이 불일치를 INFO 로 자진 신고했다. 저장소 이력을 보면 동일 패턴(`scope spec/2-navigation/ + 보정 블록`)이 최근 완료된 plan 셋(`spec-draft-webhook-endpoint-reservation.md`, `ssrf-guard-integration-unify.md` 는 `spec/4-nodes/4-integration/`, `connection-test-codes-and-gaps.md`)에서 반복돼 확립된 하네스 관행으로 보인다 — 이번 PR 이 새로 만든 문제가 아니다.
  - 제안: 기능적 결함은 아니므로 이 PR 에서 조치할 사안 아님. 다만 하네스 차원에서 `--impl-prep`/`--impl-done` 이 실제 diff 로부터 target 을 유도하지 못하는 구조적 갭이 반복 관측되므로, 별도 harness 개선 항목으로만 참고.

## 스팟체크 요약 (결함 없음 확인)

- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 신규 테스트 2건을 엔티티·마이그레이션·spec 원문과 대조:
  - `ModelConfig.kind` 의 `@Column({ length: 20, default: 'chat' })` ↔ `V088__model_config_rename_kind.sql`(`DEFAULT 'chat'`) ↔ `spec/1-data-model.md` §2.16 "default=`chat`(V088)" — 세 곳 모두 일치. 테스트는 `kind` 를 생략하고 `save()` 한 뒤 `expect(config.kind).toBe('chat')` 로 정확히 이 경로를 검증.
  - `WorkflowAssistantSession.lastInteractionAt` 의 `@Column({ default: () => 'now()' })` ↔ `V019__workflow_assistant.sql`(`DEFAULT NOW()`) ↔ `spec/1-data-model.md` §2.20 "default=`now()`" — 일치. 테스트는 값 생략 후 같은 트랜잭션의 `SELECT now()` 와 `getTime()` 을 비교해 "같은 트랜잭션의 `now()` 는 트랜잭션 시작 시각으로 고정된다"는 전제를 올바르게 활용.
  - raw INSERT 로 만든 `user`/`workspace`/`workflow` 부모 행이 각 엔티티의 NOT NULL 컬럼(email/name, name/owner_id/slug/type, workspace_id/name/created_by)을 빠짐없이 채움 — FK·NOT NULL 위반 없음, `qr.rollbackTransaction()` 으로 격리.
  - `readOnlyDataSourceOptions()` 리팩터는 실제로 두 호출부(568행, 595행)에만 쓰여 문서 주석("이 한 함수를 쓴다")의 주장과 일치. 헬퍼에서 `extra.options` 를 지우면 신규 "읽기 전용" 테스트만 RED, 기존 "컬럼 —" 테스트는 계속 GREEN 이라는 주석 속 뮤테이션 논리도 검토 결과 타당(전자는 예방을, 후자는 탐지를 검증하므로).
  - `COLUMN_LEVEL_SAMPLES` 에 새로 붙은 "표본→패턴" 주석 5개조는 `COLUMN_LEVEL` 정규식 5개와 실제로 1:1 대응 — 오기재 없음.
  - `plan/in-progress/spec-draft-nullable-notation-followups.md` 4892~4899행(원 트래커 항목)의 "예방 계층 회귀 테스트"·"`default` RETURNING 왕복" 두 요구를 이번 diff 가 각각 정확히 구현 — 요구사항 누락 없음.
- TODO/FIXME/HACK/XXX 주석: 없음.
- 반환값·에러 경로: 두 신규 `it` 모두 `try/finally` 로 커넥션 정리를 보장하고, 예상 실패 경로(read-only 거부)를 `rejects.toThrow` 로 명시적으로 단언 — 누락된 경로 없음.

## 요약

신규 테스트 두 개는 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)가 지정한 좁은 스코프(예방 계층 회귀·`default` RETURNING 왕복)를 정확히 구현했고, 관련 엔티티 선언·마이그레이션·`spec/1-data-model.md` §2.16/§2.20 서술과 line-level 로 일치한다. 리팩터(`readOnlyDataSourceOptions` 추출, `log`→`sqlMemory`, 표본 주석)도 부작용 없이 기계적이다. 발견한 두 항목은 모두 INFO 수준이며 — 하나는 스타일 비일관(기능에 영향 없음), 다른 하나는 이 PR 이전부터 반복돼 온 하네스 target-스코프 관행(다른 checker 들도 이미 자진 신고)으로 이번 코드 변경의 결함이 아니다. Critical/Warning 급 요구사항 미충족은 발견하지 못했다.

## 위험도

NONE
