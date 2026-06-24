# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-c1m7-publish-failfast.md`
편집 대상 파일: `spec/5-system/2-api-convention.md §6`, `spec/5-system/3-error-handling.md §1.5`, `spec/5-system/4-execution-engine.md §9.2·§7.4·Rationale`

---

## 발견사항

### [INFO] `EXECUTION_ENQUEUE_FAILED` — 신규 에러 코드, 기존 충돌 없음
- **target 신규 식별자**: `EXECUTION_ENQUEUE_FAILED`
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` §1.5 카탈로그, `/Volumes/project/private/clemvion/spec/conventions/error-codes.md` — 해당 식별자 없음. 코드베이스 전체(`codebase/backend/src/**/*.ts`) 에도 미등장.
- **상세**: `UPPER_SNAKE_CASE` 표기 규약 준수. 동일 §1.5 에 `EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG` 이 이미 존재하며 `EXECUTION_` prefix 네임스페이스는 확립돼 있다. 신규 코드는 그 패턴을 따른다. `EXECUTION_ENQUEUE_FAILED` 는 기존 어느 식별자와도 표기·의미 모두 충돌하지 않는다.
- **제안**: 없음. 다만 target 이 §1.5 intro 를 "주로 WebSocket ack 응답 전용이다. 일부 코드(`SERVER_SHUTTING_DOWN`·`EXECUTION_ENQUEUE_FAILED`)는 REST 실행 제어 진입점에서 HTTP 503 으로도 표기된다" 로 수정하는데, `EXECUTION_ENQUEUE_FAILED` 가 §1.5 테이블 본문에 추가될 예정이므로 intro 와 본문 사이 일관성이 보장된다. 이 수정은 `SERVER_SHUTTING_DOWN` 이 이미 동일 패턴(WS ack + REST 503 양면)으로 등재된 선례와 동형이다.

### [INFO] `ContinuationPublishResult` — 신규 타입명, spec 에는 미등재 상태였으나 코드에 이미 존재
- **target 신규 식별자**: `ContinuationPublishResult`
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 329 — `export interface ContinuationPublishResult { queued: boolean; jobId: string | null }` 로 이미 정의·사용 중. spec 에는 아직 미등재.
- **상세**: target 은 이 인터페이스를 spec 본문에 처음 등재하는 것이므로 "신규 spec 식별자 도입" 에 해당한다. 코드에 이미 존재하는 타입을 사후 문서화하는 것이어서 충돌 위험이 없다. 동명 타입이 다른 의미로 사용되는 사례는 전 spec·코드 내 없다.
- **제안**: 없음.

### [INFO] `cancelWaitingExecution` — 기존 메서드명, spec 에 이미 §7.4 line 894 에 등장
- **target 신규 식별자**: spec 에서 `cancelWaitingExecution` 의 `Promise<ContinuationPublishResult>` 반환 타입 추가
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` line 894 — `cancelWaitingExecution` 이 "동일 패턴" 메서드 목록에 이미 열거됨. 코드 (`executions.service.ts` line 730, `execution-engine.service.ts` line 3821) 에서는 현재 `void` 반환으로 구현 중(dist 파일 반영 기준).
- **상세**: target §7.4 추가 bullet 은 `cancelWaitingExecution` 이 `ContinuationPublishResult` 를 반환한다고 명시한다. 기존 §7.4 line 894 는 메서드 이름만 나열하고 반환 타입을 명시하지 않으므로 의미 충돌은 아니다. PR #693 머지 완료에 따라 소스 시그니처가 변경됐을 것이며 본 spec 편집은 그 결과를 문서화한다.
- **제안**: 없음.

### [INFO] HTTP 503 행 추가 — `2-api-convention.md §6` 표에 기존 503 행 없음
- **target 신규 식별자**: HTTP 상태 코드 `503` 행
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/2-api-convention.md` line 164–179 — §6 표에 `503` 행 미존재. `500` 행(line 178) 다음이 표 끝.
- **상세**: 503 은 spec 의 다른 위치(`data-flow/10-triggers.md:43`, `spec/5-system/4-execution-engine.md §11`, `spec/5-system/16-system-status-api.md`)에서 사용 중이나, `2-api-convention.md §6` 표에는 아직 503 행이 없다. target 이 새 행을 추가하는 것은 표 항목 신설이며 기존 행과 충돌하지 않는다.
- **제안**: 없음.

### [INFO] `exec:cont:seq` Redis key — `nextSeq` INCR 실패 정책 명시, 기존 §9.2 정의와 연속
- **target 신규 식별자**: `exec:cont:seq:<executionId>` 키에 대한 추가 설명 (`INCR 실패 시 fail-fast`)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` line 1090 — `exec:cont:seq:<executionId>` 키가 이미 §9.2 표에 등재됨. "seq 단조성은 활성 구간 내내 보존" 문장이 존재.
- **상세**: target 은 기존 문장 끝에 "INCR 실패 시 random fallback 없이 `publish` 가 null(queued:false) 반환(fail-fast, M-7)" 설명을 추가한다. 이는 기존 식별자를 재정의하는 것이 아니라 동일 키의 동작을 명확화하는 것이다. 충돌 없음.
- **제안**: 없음.

---

## 요약

target 문서(`spec-draft-c1m7-publish-failfast.md`)가 도입하는 신규 식별자 `EXECUTION_ENQUEUE_FAILED`(에러 코드), `ContinuationPublishResult`(인터페이스 타입), HTTP 503 테이블 행, `exec:cont:seq` INCR 실패 동작 명세 모두 기존 spec·코드베이스 내 동일 이름 식별자와 의미 충돌이 없다. `cancelWaitingExecution` 은 기존 §7.4 에 이미 등재된 이름이며 target 은 반환 타입만 추가 명시하는 것이라 충돌이 아니다. 기존에 등재된 에러 코드 네임스페이스(`EXECUTION_*`) 및 HTTP 503 사용처(§11 graceful shutdown, health check)와 의미·레이어가 명확히 구분된다. 신규 식별자 충돌 관점에서 차단 사유 없음.

---

## 위험도
NONE
