# Cross-Spec 일관성 검토 — refactor/01-performance.md 유효 항목 구현

검토 모드: 구현 착수 전 (`--impl-prep`). target = 성능 리팩터 plan 7개 영역
(execution-engine rehydration 배치 조회 #1, KB S3 배치 삭제 #2, dashboard 쿼리 통합 #4,
workflow import 배치 insert #10, assistant 프롬프트 캐시 #7, RAG CTE 통합 #12,
frontend execution-store 자료구조 전환 #3·#8).

## 발견사항

### [INFO] #2 S3 배치 삭제 — `data-flow/4-file-storage.md` "for 루프" code-sync 문구 동기화 필요

- target 위치: 01-performance.md §#2 ("spec 갱신: **필요**")
- 충돌 대상: `spec/data-flow/4-file-storage.md:100,103,137-138`
- 상세: target 이 KB 삭제 S3 경로를 직렬 `for...of`(단건 `DeleteObjectCommand`)에서
  배치 `DeleteObjectsCommand`(`deleteMany`)로 전환한다. 현 spec 본문은
  `> for 루프로 호출하여 수행한다 (...remove..., 각 삭제는 best-effort — 실패 시 warn 만)`
  (line 103) 및 흐름표 line 100 이 직렬 for-loop 을 code-sync 사실로 박제한다. 코드 전환 후
  이 문구가 stale code-sync 가 된다. **단, 의미론(best-effort/warn) 은 불변** — spec Rationale
  (line 137-138) 이 정당화하는 것은 "best-effort warn + orphan GC" 이지 직렬 실행이 아니므로
  **정책 충돌은 아니고 문구 동기화**다. target 본인이 이미 "spec 갱신 필요(planner)" 로 식별.
- 제안: 코드 전환과 동반해 `data-flow/4-file-storage.md` line 100/103 의 "for 루프" 표현을
  "배치 삭제(`DeleteObjectsCommand`, 1000키 청크)" 로 갱신. project-planner 위임. CRITICAL 아님 —
  best-effort 의미론이 보존되므로 어느 한 영역도 작동 불가가 되지 않음.

### [INFO] #1 rehydration 배치 조회 — `4-execution-engine.md §7.5` 와 정합 (충돌 없음, 확인)

- target 위치: 01-performance.md §#1 ("spec 갱신: 불요")
- 충돌 대상: `spec/5-system/4-execution-engine.md` §7.5 rehydration (line 763,799,804,817 등)
- 상세: §7.5 는 rehydration 의 *의미*(임의 worker 가 durable 매체에서 컨텍스트 무손실 복원)만
  규정하고 내부 쿼리 전략(N+1 vs 배치)은 무규정. N+1 → 단일 `In([...])` + Map dedup 전환은
  관측 가능 동작·상태 전이(`waiting_for_input` → 재개) 를 바꾸지 않으며, §842 가 "N+1 회피"를
  이미 다른 경로에서 명시(`executionPath` 빈 배열 반환) 해 배치 지향이 spec 패턴과 정합. **충돌 없음.**
- 제안: 없음. spec 갱신 불요 판정 타당.

### [INFO] #7 assistant 프롬프트 캐시 — `4-ai-assistant.md §5` 가 채택한 동일 패턴의 미적용 잔여

- target 위치: 01-performance.md §#7 ("spec 갱신: 불요(원하면 §5 에 한 줄 — planner 재량)")
- 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md:843,855,857,886`
- 상세: spec §5 가 "정적 콘텐츠 앞 배치 → prefix cache hit" 설계 의도(line 843,855)와
  `EXPRESSION_REFERENCE_CACHE` 모듈 스코프 캐시(line 857)를 이미 명문화. node catalog 캐시는
  **spec 이 채택한 동일 패턴의 미적용 잔여**라 정합 방향이고 충돌이 아니다. 단 line 862·886 의
  "5-block structural layout / 블록 경계를 넘지 말 것" 규율은 spec 약속이므로, target 권장안 A
  (expressionReferenceCache 패턴 복제, 블록 결합 안 함) 가 이 규율과 일치 — 권장안 B(정적 블록
  1~3 + 카탈로그 단일 prefix 결합)는 블록 경계를 건드릴 수 있어 spec describe 수정 동반 가능.
- 제안: 없음(권장안 A 선택 시). B 선택 시 §5 의 5-block 규율 문서를 함께 점검.

### [INFO] #12 RAG CTE 통합 — `10-graph-rag.md` KB-GR-SR-06 표면 수치 불변이 전제 (조건부)

- target 위치: 01-performance.md §#12 ("spec 갱신: 의미 변경 시에만 §4.3")
- 충돌 대상: `spec/5-system/10-graph-rag.md:116` (KB-GR-SR-06 `traversedEntityCount`)
- 상세: KB-GR-SR-06 은 `traversedEntityCount` 를 "개수형(목록형 ID 배열 아님)" 권장 메타데이터로
  spec 약속. target 이 2회 CTE 를 1회로 통합하되 **seed 동등성 검증을 선행조건으로** 명시하고,
  비동등 시 현 2회 왕복(정확한 의미론)을 유지(권장안 A→C)하므로 spec 표면 수치 불변. 검증 생략
  강행(권장안 B)만이 `traversedEntityCount` 의미를 바꿔 spec 위반 위험. target 권장안이 A 라
  충돌 회피됨.
- 제안: 없음. seed 동등성 검증 선행 조건을 구현 시 반드시 준수(권장안 B 금지).

### [INFO] #4 dashboard / #10 import / #3·#8 frontend — spec 무언급 구현 전략, 충돌 없음

- target 위치: §#4, §#10, §#3, §#8 (모두 "spec 갱신: 불요")
- 충돌 대상: `2-navigation/0-dashboard.md:60`(분모 status-무관 의미론), `1-workflow-list.md:126`
  (import 엔드포인트), `3-workflow-editor/3-execution.md §10.5`(시간순 컴팩트 리스트)
- 상세: 세 영역 모두 spec 이 *의미론/표시 요건*만 규정하고 쿼리·자료구조·삽입 전략은 무언급.
  - #4: dashboard 분모 = `status 무관 7일 전체`(spec line 60) 가 `COUNT(*) FILTER` 통합 후에도
    보존되어야 함 — target 이 "FILTER 조건 누락 시 분모 의미론 훼손" 을 회귀 위험으로 명시하고
    `dashboard.service.spec.ts` 기대값 불변을 검증 게이트로 둠. API 응답 shape(`runs7d`,
    `successRate` 등) 무변경.
  - #10: import API 계약(엔드포인트·request/response) 무변경, 트랜잭션 내부 삽입 전략만 전환.
  - #3·#8: WS 이벤트 계약·`3-execution.md §10.5` 타임라인 표시 요건 무변경, store 내부 자료구조
    (Array → Map/selector) 전환. ghost row fallback 의미론 보존을 회귀 테스트로 고정.
- 제안: 없음. 데이터 모델·API 계약·RBAC·상태 전이 어느 축도 충돌 없음.

### [INFO] 요구사항 ID / RBAC / 상태 전이 / 계층 책임 — 신규·변경 없음

- 상세: target 은 신규 요구사항 ID 를 부여하지 않는다(기존 #1~#15 백로그 항목 번호는 plan 내부
  추적용, spec 요구사항 ID 가 아님). 권한·RBAC 모델 변경 없음(S3 키 prefix·workspace 격리 정책
  무변경 — `0-overview.md §2.7` Rationale 그대로). 도메인 엔티티 상태 머신(Execution/NodeExecution
  status enum, Integration status, Document embedding_status) 변경 없음. 계층 책임 분할
  (서버 execution-engine / KB / dashboard / import vs frontend execution-store) 모두 기존 경계
  내부의 구현 최적화라 cross-layer 책임 재분배 없음.

## 요약

본 target 은 7개 영역에 걸친 순수 성능 리팩터로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·
계층 책임 어느 축에서도 다른 spec 영역과의 직접 모순(CRITICAL)이 발견되지 않았다. 모든 변경은
기존 spec 이 규정한 *의미론*(S3 best-effort, rehydration 무손실 복원, dashboard 분모 status-무관,
prefix-cache 패턴, KB-GR-SR-06 개수형 메타데이터, WS 이벤트·타임라인 표시 요건)을 보존하는
내부 구현 전략의 교체이며, 실제로 #1·#7·#14 는 spec 이 이미 채택한 배치/캐시/read-once 패턴과
*정합* 하는 방향이다. 유일한 spec 동기화 항목은 #2 의 `data-flow/4-file-storage.md` "for 루프"
code-sync 문구로, target 본인이 "spec 갱신 필요(planner)" 로 정확히 식별했고 의미론 불변이라
정책 충돌이 아닌 문구 동기화에 그친다. #12 는 seed 동등성 검증 선행이라는 조건만 지키면(권장안 A)
KB-GR-SR-06 표면 수치 불변이 보장된다.

## 위험도

LOW
