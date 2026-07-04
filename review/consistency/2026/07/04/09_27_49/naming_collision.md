# 신규 식별자 충돌 검토 — C-3 실행 컨텍스트 in-memory 정직화 (Redis context store 드리프트 제거)

## 검토 대상
- target: `plan/in-progress/spec-draft-c3-context-drift.md`
- 대상 spec: `spec/5-system/4-execution-engine.md` §6.2 / §7.5 / §9.1 / §9.2 + Rationale

## 발견사항

없음. 아래 근거로 판단.

target 은 새 식별자를 도입하는 변경이 아니라, spec 이 서술하던 미구현 Redis context store 관련 표현을 **제거**하고 실제 코드가 이미 사용 중인 기존 식별자로 **정정**하는 변경이다.

1. **요구사항 ID 충돌** — 해당 없음. target 은 신규 요구사항 ID 를 부여하지 않는다 (`4-execution-engine.md` 는 단일-spec 영역이 아니라 `5-system` 하위 상세 spec 이며, 본 변경은 §6.2/§7.5/§9.1/§9.2 본문 서술 교정 + Rationale 추가일 뿐 새 ID 발급이 없음).

2. **엔티티/타입명 충돌** — 해당 없음. 언급되는 식별자 `ExecutionContextService`, `ExecutionContext`, `finalizeRehydrationCleanup`, `rehydrateContext`/`getContext`, `segmentStartMs` 는 모두 코퍼스(`spec/1-data-model.md` 의 `resume_call_stack`/`conversation_thread`/`user_variables` 필드 설명, `spec/0-overview.md`)에서 이미 동일한 의미로 일관되게 쓰이는 기존 식별자다. target 이 새로 명명한 이름이 없다.

3. **API endpoint 충돌** — 해당 없음. target 은 endpoint 를 추가하지 않는다.

4. **이벤트/메시지명 충돌** — 해당 없음. Δ3 에서 제거 대상으로 나열된 Redis 키 6종(`exec:{ws}:execution:{id}:context`·`:status`·`node:{id}:output`·`worker:{id}:heartbeat`·`lock:{id}`·`queue:priority`)은 **삭제**이지 신규 도입이 아니므로 충돌 여지가 없다. 유지되는 키(`exec:recover:lock`·`exec:cont:seq:`·`exec:seq:`·`exec:run:seq:`·`core:rate`·`ws:session`)도 모두 `spec/0-overview.md` §2.4/§2.6 및 data-model 코퍼스에 이미 등장하는 기존 키다.

5. **환경변수·설정키 충돌** — 해당 없음. target 은 신규 ENV var 를 도입하지 않는다. 코퍼스 내 기존 ENV(`EXECUTION_MAX_ACTIVE_RUNNING_MS`, `PARALLEL_ENGINE`, `S3_BUCKET`)와도 무관.

6. **파일 경로 충돌** — 해당 없음. target 자체는 `plan/in-progress/spec-draft-c3-context-drift.md` 라는 plan 파일이며 신규 spec 파일을 생성하지 않고 기존 `spec/5-system/4-execution-engine.md` 를 수정한다. 코퍼스 내 `cafe24-backlog-residual.md` 의 "C-3" 표기와는 다른 plan 문서·다른 도메인(Cafe24 backlog 항목 코드)이라 네임스페이스가 분리되어 있고 혼동 가능성도 낮다(각 plan 문서 내부에서만 유효한 로컬 코드).

Δ4 에서 Rationale 에 신설하는 subsection 제목("실행 컨텍스트 in-memory + DB durable — Redis context store 미채택")은 식별자가 아닌 prose heading이며, `spec/0-overview.md` 의 기존 Rationale 서브섹션 명명 패턴(예: "실행 엔진: Redis 큐 + 분산 워커 풀 (§2.4)")과 스타일이 일치해 컨벤션 이탈도 없다.

## 요약
target 은 신규 식별자를 발급하는 변경이 아니라, 이미 코드·타 spec 문서에서 합의된 기존 명칭(`ExecutionContextService`, `rehydrateContext`, 유지 대상 Redis 키 등)으로 spec 서술을 정정하고, 코드 사용 0건이 확인된 6개 Redis 키를 제거하는 순수 드리프트 정정이다. 신규 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수·spec 파일 경로 어느 관점에서도 새로 도입되는 식별자가 없어 충돌 후보 자체가 존재하지 않는다.

## 위험도
NONE
