# Rationale 연속성 검토 — 01-performance.md 유효 항목 구현

## 검토 대상
`plan/in-progress/refactor/01-performance.md` 의 유효 13건 (Critical #1~#3, Major #4~#11, Minor #12·#14·#15; 철회 #9·종결 #13 제외) 구현 착수.

## 검증한 과거 Rationale 출처
- `spec/5-system/4-execution-engine.md` §Rationale "park 즉시 해제 + slow-path 일원화" / §7.4·§7.5 rehydration (#1)
- `spec/data-flow/4-file-storage.md` §Rationale "`s3Service.delete` 실패가 warn 처리인 이유" + 흐름표 lines 89~93 (#2)
- `spec/3-workflow-editor/4-ai-assistant.md` §5 (lines 838~852) prefix-cache / `EXPRESSION_REFERENCE_CACHE` 패턴 (#7)
- `spec/2-navigation/0-dashboard.md` §Rationale Success Rate 분모 정의 (#4)
- `spec/1-data-model.md` line 284 (raw SQL partial UNIQUE 인덱스 — raw 쿼리 전례) (#1·#4)

## 발견사항

- **[INFO]** #1 rehydration 배치 조회 — 과거 Rationale 과 정합 (재확인)
  - target 위치: #1 [Critical] resume rehydration N+1, spec 대조 D
  - 과거 결정 출처: `4-execution-engine.md` §Rationale "park 즉시 해제 + slow-path 일원화" + §7.4 (rehydration setup latency 를 운영 리스크로 명시) + §7.5
  - 상세: target 은 "turn 마다 rehydration 비용은 사람-페이스라 수용" Rationale 이 rehydration 자체의 trade-off 수용이지 N+1 까지 수용한 게 아니라고 해석한다. spec §7.4 가 "rehydration setup latency" 와 "대량 동시 resume 의 setup 직렬화 latency" 를 운영 리스크로 직접 지목하고 bounded-memory 단일 경로를 목표로 하므로, N+1 제거는 기각된 결정의 재도입이 아니라 spec 정합 개선이다. 옵션 B(DISTINCT ON raw 쿼리)도 `1-data-model.md` 가 이미 raw SQL constraint/index 를 SoT 로 쓰는 전례와 충돌하지 않는다 — "repository-only / raw SQL 금지" 라는 합의 원칙은 spec 어디에도 없다.
  - 제안: 없음. 권장안 A(repository In([...]) + Map dedup) 채택 시 V034 `(execution_id, node_id, started_at DESC)` 인덱스가 ExecutionNodeLog 순서 invariant (`1-data-model.md` §Rationale "Execution.execution_path → ExecutionNodeLog") 와 직교 — 노드 실행 순서 SoT(`(execution_id, id)`)는 건드리지 않고 NodeExecution 최신 dedup 만 하므로 invariant 우회 없음.

- **[INFO]** #2 KB S3 배치 삭제 — best-effort invariant 보존 확인, spec 갱신 동반 명시됨
  - target 위치: #2 [Critical] KB 삭제 S3 직렬 루프, B안 확정
  - 과거 결정 출처: `4-file-storage.md` §Rationale "`s3Service.delete` 실패가 warn 처리인 이유" — 정당화 대상은 best-effort/warn 의미론(순서 무관, S3 orphan 은 cost 누수일 뿐 정합성 깨짐 아님)이지 직렬 실행이 아님
  - 상세: `DeleteObjectsCommand` 의 `Errors[].Key → 일괄 warn` 매핑이 기존 단건 try/catch-warn 과 의미 동등함을 target 이 실검증으로 확인했다. best-effort invariant 우회 없음. 흐름표 lines 91~92 의 "for 루프로 호출" code-sync 문구가 stale 해지는데, target 이 "spec 갱신: 필요 — `data-flow/4-file-storage.md` for 루프 문구를 배치 삭제로 (project-planner)" 로 정확히 잡아두었다 — 결정 번복에 동반 Rationale 갱신 의무를 충족.
  - 제안: spec 갱신 시 line 93 의 "별도 GC batch 보강 계획" 문구는 그대로 유효(배치 삭제와 독립)하므로 함께 지우지 말 것.

- **[INFO]** #7 assistant 프롬프트 캐시 — spec 채택 패턴의 미적용 잔여 (재도입 아님)
  - target 위치: #7 [Major] buildSystemPrompt 캐시, spec 대조 D
  - 과거 결정 출처: `4-ai-assistant.md` §5 lines 838~852 — "정적 콘텐츠 앞 배치로 prefix cache hit 향상" 을 설계 의도로 명시 + `EXPRESSION_REFERENCE_CACHE` 모듈 스코프 캐시를 이미 채택
  - 상세: node catalog 캐시는 spec 이 이미 박아둔 동일 패턴의 미적용 잔여다. 합의 원칙 위반·기각 대안 재도입 아님. 권장안 A 의 "5-block structural layout describe 무수정 통과" 검증이 §5 line 881 의 "블록 경계를 넘지 말 것 — 캐시 효과의 근간" 원칙과 정합.
  - 제안: 없음. target 이 "spec 갱신 불요(원하면 §5 에 한 줄 — planner 재량)" 로 둔 것은 적절.

- **[INFO]** #4 dashboard 쿼리 통합 — 분모 invariant 명시적 보존
  - target 위치: #4 [Major] getSummary 쿼리 통합, 권장안 A
  - 과거 결정 출처: `2-navigation/0-dashboard.md` §Rationale "Success Rate 분모 = 7일 전체 실행 건수 (status 무관)"
  - 상세: target 이 회귀 위험으로 "FILTER 조건 누락 시 분모 의미론(status 무관 — Rationale 명시) 훼손" 을 명시하고 `dashboard.service.spec.ts` 기대값 무변화를 검증으로 고정했다. raw `COUNT(*) FILTER` 통합이 분모 정의를 바꾸지 않는 한 Rationale 무위반. 분모 invariant 인지·보존 의도가 plan 본문에 박혀 있음.
  - 제안: 없음.

## 요약
target 은 성능 리팩터 백로그 13건의 구현 착수로, 모두 내부 쿼리/자료구조 최적화이며 spec 본문 사실(latest-only)을 바꾸지 않는다. 항목별 "spec 대조" 가 이미 각 개선이 과거 Rationale 의 어느 원칙과 정합/괴리하는지 판정 라벨(A~E)로 자기 검증을 수행했고, 본 검토가 #1·#2·#4·#7 의 인용 Rationale 을 원문 대조한 결과 인용이 정확하며 기각된 대안의 재도입이나 합의 invariant 우회가 없다. 특히 (a) #1 은 §7.4 rehydration latency 운영 리스크 지목과 ExecutionNodeLog 순서 invariant 양쪽과 정합, (b) #2 는 best-effort/warn 의미론을 보존하며 유일하게 stale 해지는 file-storage 흐름표 문구의 planner 갱신을 동반 명시, (c) #7 은 spec §5 가 이미 채택한 prefix-cache 패턴의 미적용 잔여 적용이다. 결정 번복(#2 spec code-sync 문구)에는 동반 Rationale 갱신 의무가 plan 안에 명시돼 있어 "무근거 번복" 도 없다. raw SQL 채택(#1 옵션B·#4)은 `1-data-model.md` 가 이미 raw constraint/index 를 SoT 로 쓰는 전례와 충돌하지 않으며 "repository-only" 합의 원칙은 부재하다.

## 위험도
NONE
