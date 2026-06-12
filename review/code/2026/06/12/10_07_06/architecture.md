# 아키텍처(Architecture) 리뷰

리뷰 대상: test-code-http-hardening PR (2026-06-12)
주요 변경 파일:
- `spec/conventions/error-codes.md` — §4 내부 전용 분류 코드 섹션 신설
- `spec/conventions/node-output.md` — D4 주석 앵커 갱신
- `spec/conventions/chat-channel-adapter.md` — `HTTP_TIMEOUT` 미발행 주석 추가
- `spec/4-nodes/4-integration/1-http-request.md` — dry-run SSRF 생략 명시, Usage 로그 매트릭스 주석, Deprecated 필드
- `spec/4-nodes/5-data/2-code.md` — 2단 async 래퍼, 라인 오프셋, vars copy-out, meta.durationMs 예시
- `spec/5-system/3-error-handling.md` — HTTP_TIMEOUT 미발행 주석, DB_HOST_BLOCKED 추가
- `spec/2-navigation/4-integration.md` — DB_HOST_BLOCKED, HTTP_BLOCKED 에러 코드 표 추가

---

## 발견사항

### [WARNING] `error-codes.md §4` 위치 — §3 "Historical-artifact 예외 레지스트리" 아래 배치로 인한 레이어 책임 모호성
- **위치**: `spec/conventions/error-codes.md` §4 (`## 4. 내부 전용 분류 코드`)
- **상세**: §3은 "§1 UPPER_SNAKE_CASE 위반 외부 노출 코드"를 다루고 §4는 "§1 적용 범위 밖 내부 코드"를 다루는데, 헤더 계층 구조가 두 목적을 동등 계층(##)으로 묶는다. 레이어 책임(내부 분류 레이어 vs. 외부 노출 레이어)이 섹션 구조에서 명확히 드러나지 않는다.
- **제안**: §4 도입문에 "본 절은 §3('외부 노출 코드의 naming 위반 레지스트리')과 별개다 — 내부 분류 레이어 전용 코드로 §1 위반 아님"을 명시하거나, 섹션 제목에 레이어를 명시한다.

---

### [WARNING] `EXECUTION_TIMEOUT` 동명 코드 — 레이어 추상화 충돌 (장기 ISP 위반 위험)
- **위치**: `spec/conventions/error-codes.md §4` 레이어 주의 블록, `spec/5-system/3-error-handling.md §1.4`
- **상세**: `error-codes.md §4`는 `EXECUTION_TIMEOUT`을 "Code 노드 핸들러 내부 분류 레이어 한정"으로 선언하고 레이어 주의 블록에서 엔진 레벨 동명 코드와 구분을 시도한다. 그러나 `3-error-handling.md §1.4`는 `EXECUTION_TIMEOUT` 행에 "엔진 레벨 — execution status → failed, EIA" 레이어를 기술하면서 "노드 출력 레이어는 CODE_TIMEOUT으로 발행한다"는 두 레이어 설명을 동일 셀에 혼재시킨다. 이는 레이어 책임 분리(노드 출력 계약 vs. 엔진 EIA 계약)가 한 행에 압축되는 구조적 결함이다. 아키텍처적으로 "같은 이름, 다른 레이어"는 장기적으로 인터페이스 분리 원칙(ISP)을 위반하는 방향이다.
- **제안**: 핸들러 내부 분류 문자열을 `CODE_NODE_TIMEOUT_INTERNAL` 등으로 rename하는 장기 계획을 Rationale에 기록한다 (내부 코드이므로 클라이언트 계약 breaking 아님). 단기적으로는 §1.4 `EXECUTION_TIMEOUT` 행을 "엔진 레벨 코드(EIA)"와 "(Code 노드 핸들러 내부 분류 코드, 노드 출력은 CODE_TIMEOUT)" 두 행으로 분리한다.

---

### [INFO] Code 노드 2단 async 래퍼 — 추상화 경계(isolate boundary) 명확화
- **위치**: `spec/4-nodes/5-data/2-code.md §4` 2단 async 래퍼 구조 기술
- **상세**: `JSON.stringify`를 isolate 안에서 수행해 "JSON-안전 데이터만 경계를 넘는다"는 설계는 isolate 경계 책임을 핸들러 쪽이 완전히 소유하는 명확한 추상화다. `vars copy-out`이 실패하면 스냅샷으로 복원하는 패턴도 원자성 보장을 레이어 안에서 처리한다. 아키텍처 관점에서 올바른 방향이다.
- **제안**: 없음.

---

### [INFO] `output.response.error` Deprecated 선언 — 레이어 계약 명확화, 폐기 일정 미기재
- **위치**: `spec/4-nodes/4-integration/1-http-request.md §5.5` `output.response.error` 필드
- **상세**: Deprecated 명시는 프레젠테이션-비즈니스 레이어 계약의 버전 이행 전략을 명확히 한 것이다. 그러나 제거 일정(Phase, Planned 상태)이 기술되지 않아 기술 부채 트래킹이 불명확하다.
- **제안**: `output.response.error` 행 또는 §Rationale에 폐기 목표 Phase/PR을 명시한다.

---

### [INFO] dry-run SSRF 생략 — 조건부 가드 실행 순서의 모듈 경계 미명시
- **위치**: `spec/4-nodes/4-integration/1-http-request.md §4` step 8 추가 문구
- **상세**: "dry-run 실행은 SSRF 가드 이전에 mock을 반환하고 가드를 생략한다"는 명시는 의미론적으로 올바르다. 그러나 이 분기 로직("dry-run이면 mock 반환 후 early return")이 어느 레이어(핸들러 상단)에서 이루어지는지 spec이 명시하지 않아, 구현자가 SSRF 가드를 dry-run 분기보다 먼저 실행하는 실수를 할 수 있다.
- **제안**: step 8 또는 §5 dry-run 절에 "dry-run 분기는 step 1~7 이후, step 8(SSRF 가드) 이전에 처리된다"는 순서를 명시한다.

---

### [INFO] `chat-channel-adapter.md §3.1` `EMAIL_HOST_BLOCKED` 미등재 — SSRF 분류 경로 비대칭
- **위치**: `spec/conventions/chat-channel-adapter.md §3.1` 분류 표
- **상세**: `HTTP_BLOCKED`, `DB_*` wildcard는 각각 명시적 또는 패턴 매핑으로 `executionFailedInternal`에 등재됐으나, `EMAIL_HOST_BLOCKED`는 `ERROR_PORT_FALLBACK` 경유 간접 흡수에 의존한다. 세 통합 노드 SSRF 차단 코드의 분류 경로가 비대칭이다. 어댑터 레이어의 단일 책임(분류 규칙 단일화) 측면에서 개선 여지가 있다.
- **제안**: `EMAIL_HOST_BLOCKED`를 `executionFailedInternal`로 명시 등재해, HTTP/DB/Email SSRF 차단 코드 세 가지가 동일 분류 결과를 갖는 것을 명시적 패턴으로 만든다.

---

### [INFO] `send_email` 성공 포트명 `'out'` vs Principle 5 `port: undefined` — conventions 레이어 불일치
- **위치**: `spec/conventions/node-output.md` Principle 5, `spec/4-nodes/4-integration/3-send-email.md §3.2`
- **상세**: `http_request`, `database_query`는 `success`/`error` 이중 포트 모델이고, `send_email`은 `out`/`error` 이중 포트 모델이다. Principle 5는 `send_email`을 여전히 "단일 출력(port: undefined)" 노드로 기술해 conventions 레이어와 구현 spec 레이어가 불일치 상태다. 이는 노드 출력 추상화 계층의 개방-폐쇄 원칙(OCP) 관점에서, 새로운 포트 모델이 추가됐으나 conventions가 갱신되지 않아 확장이 닫히지 않은 상태다.
- **제안**: `send_email`을 `port: 'out'`/`port: 'error'` 모델로 Principle 5 표에서 분리하거나, 성공 포트명을 `success`로 통일해 Integration 노드 전체의 포트 명명을 단일화한다.

---

### [INFO] `DB_HOST_BLOCKED` spec Rationale 미기재 — 결정 추적 가능성 갭
- **위치**: `spec/4-nodes/4-integration/2-database-query.md` Rationale 섹션
- **상세**: `HTTP_BLOCKED`(`1-http-request.md §8.2`), `EMAIL_HOST_BLOCKED`(`3-send-email.md §8.0`), Redis pub/sub 캐시 무효화 등 인접 결정들은 모두 해당 spec 문서의 Rationale에 근거를 갖는다. `DB_HOST_BLOCKED` 신설 결정은 `## Rationale` 절에 항목이 없어 커밋 메시지에만 근거가 남아있다. 이는 단일 진실 원칙(SoT: spec) 위반이며, 향후 동일 설계 결정을 재검토할 때 근거 추적이 불가능하다.
- **제안**: `2-database-query.md ## Rationale`에 `DB_HOST_BLOCKED` 신설 근거(구 `INTEGRATION_CALL_FAILED` fallback 문제, HTTP/Email 대칭 달성, `ALLOW_PRIVATE_HOST_TARGETS` 단일 플래그 통일 근거)를 추가한다.

---

## 요약

이번 변경은 HTTP Request SSRF 경화, Code 노드 isolated-vm 격리 강화, DB SSRF 가드 대칭 확장 등 보안 아키텍처 강화를 spec 수준에서 문서화한 작업이다. SOLID 원칙 관점에서 isolated-vm 2단 래퍼와 vars copy-out 복원 패턴은 단일 책임 경계를 핸들러 안에 완결시키는 긍정적 설계다. 주된 아키텍처 우려는 레이어 추상화 혼동으로, `EXECUTION_TIMEOUT`이 핸들러 내부 분류 레이어와 엔진 EIA 레이어에서 같은 이름으로 사용되는 구조는 장기적으로 ISP 위반 방향이며, `error-codes.md §4` 섹션 위치가 §3 "naming 위반 레지스트리"와 같은 헤더 계층에 놓여 레이어 책임이 불명확하게 읽힌다. `EMAIL_HOST_BLOCKED` chat-channel 분류 경로의 비대칭과 `send_email` 포트명 conventions 불일치는 모듈 경계 응집도 측면의 기술 부채로, conventions 문서 갱신으로 해소 가능하다. `DB_HOST_BLOCKED` Rationale 미기재는 결정 추적 가능성(traceability) 갭으로 향후 리팩토링 시 근거 재발굴 비용을 유발한다.

## 위험도

LOW
