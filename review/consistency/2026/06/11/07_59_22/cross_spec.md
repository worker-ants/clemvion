# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/4-nodes/4-integration/` (전 파일)
**검토 모드**: 구현 완료 후 (`--impl-done`, scope=`spec/4-nodes/4-integration/`, diff-base=`origin/main`)
**검토 일시**: 2026-06-11

---

## 발견사항

### [WARNING] `INTEGRATION_NOT_FOUND` 코드 — 공통 규약과 노드별 에러 코드 표 간 불일치

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §5.8 · §6.2; `spec/4-nodes/4-integration/1-http-request.md` §5.8 · §6
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md` §4.2
- **상세**: `0-common.md §4.2` 의 공통 에러 코드 표는 `INTEGRATION_NOT_FOUND` 코드가 현재 코드에 존재하지 않는다고 명시한다 — `IntegrationsService.getForExecution → requireEntity` 가 `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 를 throw 하고, 이 예외는 `IntegrationError` 가 아니므로 핸들러 catch 에서 `INTEGRATION_CALL_FAILED` (http-request) 또는 `EMAIL_SEND_FAILED` (send-email) 로 흡수된다고 기술되어 있다. 그러나 `1-http-request.md §5.8`·`§6` 과 `2-database-query.md §5.8`·`§6.2` 는 여전히 `INTEGRATION_NOT_FOUND` 를 `INTEGRATION_*` 열거 목록에 포함해 "본 경로로 surface" 된다고 기술한다. 즉 공통 spec 은 "코드 없음·흡수됨" 이고 노드 spec 은 "surface 됨" 으로 충돌한다.
- **제안**: `1-http-request.md §5.8` 과 `2-database-query.md §5.8`·`§6.2` 의 `INTEGRATION_NOT_FOUND` 항목을 공통 §4.2 의 설명("현재 코드 미존재, `INTEGRATION_CALL_FAILED` 로 흡수")에 일치하도록 수정하거나, 아니면 공통 §4.2 에 이 코드를 추가 정의해 일관성을 확보한다.

---

### [WARNING] DB Query SSRF 차단 에러 코드 — 공통 에러 코드 표 누락

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §4 SSRF 가드 인라인 노트 + §6.2
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md` §4.2 공통 에러 코드 표; `spec/4-nodes/4-integration/1-http-request.md` §6 (`HTTP_BLOCKED`); `spec/4-nodes/4-integration/3-send-email.md` §5.3 (`EMAIL_HOST_BLOCKED`)
- **상세**: `2-database-query.md §4` 인라인 노트는 "차단 시 전용 코드 없이 `mapDbError` fallback 인 `INTEGRATION_CALL_FAILED` 로 surface 된다 (HTTP 의 `HTTP_BLOCKED`·Email 의 `EMAIL_HOST_BLOCKED` 와 달리 driver 도메인 전용 코드 미정의 — 향후 통일 후보)" 라고 기술한다. 그런데 `§6.2` 에러 코드 표에는 이 `INTEGRATION_CALL_FAILED` 로 surface 되는 SSRF 차단 경로 자체가 명시적으로 행으로 존재하지 않는다. `INTEGRATION_CALL_FAILED` 코드는 공통 §4.2 에만 정의되어 있고, DB Query §6.2 표에는 포함되지 않아 실제 발생 가능한 에러 코드를 소비자가 처리하는 데 필요한 정보가 누락되어 있다.
- **제안**: `2-database-query.md §6.2` 표에 `INTEGRATION_CALL_FAILED` 를 추가하고 "(SSRF 가드 차단 포함)" 조건을 명시한다. 또는 DB Query 도 전용 에러 코드(`DB_HOST_BLOCKED` 등)를 정의해 HTTP·Email 과 대칭을 맞춘다.

---

### [WARNING] Redis pub/sub broadcast 트리거 범위 — `0-overview.md` 과 `2-database-query.md` 간 표현 차이

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §4 멀티 인스턴스 무효화 항, §Rationale
- **충돌 대상**: `spec/0-overview.md` §2.6 Data Layer Redis 설명; `spec/5-system/4-execution-engine.md` §9.2 Redis 채널 표; `spec/data-flow/5-integration.md` §1
- **상세**: `2-database-query.md §4` 는 broadcast 트리거를 "`rotate`·`remove` 두 동기 경로뿐이다 — `update` 는 name 만 바꾸고(자격증명 불변), OAuth 토큰 갱신·`reauthorize` 는 DB/email 같은 풀-캐시 소비자가 OAuth 자격증명을 쓰지 않아(구독자 부재) broadcast 대상이 아니다" 라고 상세히 기술한다. `spec/0-overview.md §2.6` 은 채널을 "integration 자격증명 회전의 멀티 인스턴스 캐시 무효화" 라고만 적고, `spec/5-system/4-execution-engine.md §9.2` 는 "integration 자격증명 회전·삭제 시" 로 기술해 `rotate`·`remove` 두 경로를 포함한다. `spec/data-flow/5-integration.md §1` 도 "`rotate`(자격증명 회전) 와 `remove`(삭제) 직후" 로 정확히 기재한다. 이들 사이의 표현이 일치하지만, `spec/0-overview.md §2.6` 은 "삭제"(`remove`) 경로를 언급하지 않아 불완전하다.
- **제안**: `spec/0-overview.md §2.6` 의 Redis 채널 설명을 "integration 자격증명 회전(rotate)·통합 삭제(remove) 시 멀티 인스턴스 캐시 무효화" 로 정밀화한다. 충돌이라기보다 INFO 수준이지만 `0-overview.md` 가 진입 문서로서의 정확성을 위해 갱신이 권장된다.

---

### [INFO] Send Email transport 캐시의 `integration:cache:invalidate` 구독 — spec 미기술

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §4 ("채널은 integration-generic 이라 같은 메커니즘에 다른 인스턴스-로컬 자격증명 캐시(예: Send Email transport)도 구독 등록할 수 있다")
- **충돌 대상**: `spec/4-nodes/4-integration/3-send-email.md` (전체); `spec/5-system/4-execution-engine.md` §9.2 채널 표
- **상세**: `2-database-query.md` 는 Send Email 의 nodemailer transporter 캐시도 `integration:cache:invalidate` 에 구독 등록할 수 있다고 암시한다. 그러나 `3-send-email.md` 에는 transport 캐시 무효화(pub/sub 구독)에 대한 언급이 전혀 없다. `spec/5-system/4-execution-engine.md §9.2` 채널 표의 예시도 "database-query 연결 풀" 로만 기재된다. 현재 Send Email transport 캐시가 실제로 구독하는지, 아닌지 spec 수준에서 명확하지 않다. 구현이 Send Email 에도 동일 pub/sub 구독을 적용했다면 `3-send-email.md §4` 에 해당 내용이 누락되어 있다.
- **제안**: `3-send-email.md §4` (또는 §Rationale) 에 "nodemailer transporter 캐시가 `integration:cache:invalidate` 를 구독하는지 여부와 동작" 을 명시한다. 구현하지 않았다면 `2-database-query.md §4` 의 "(예: Send Email transport)도 구독 등록할 수 있다" 표현이 미구현 제안을 spec 에 혼입하는 것이므로 "향후 확장 가능" 이나 "Planned" 로 명확히 표시한다.

---

### [INFO] `0-common.md §4.1` 에서 `INTEGRATION_NOT_FOUND` 코드 미정의이나 `0-common.md §4.2` 에서는 이를 `INTEGRATION_CALL_FAILED` 로 흡수한다고 기술 — 코드 표에 명시적 항목 부재

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §4.2 (인라인 노트)
- **충돌 대상**: 해당 없음 (내부 일관성 문제)
- **상세**: §4.2 의 `INTEGRATION_CALL_FAILED` 설명은 "기타 일반 예외(분류되지 않은 실패). `IntegrationError` 가 아닌 throw 의 기본 코드 (`toLogError` fallback)" 라고만 기술하고, 인라인 노트에서 NotFoundException 이 이 코드로 흡수됨을 별도 설명한다. 즉 `INTEGRATION_NOT_FOUND` 는 코드 표 항목으로는 존재하지 않으면서 인라인 노트에서만 언급되어 있어 소비자가 에러 코드 목록만 보고는 이 흡수 동작을 파악하기 어렵다.
- **제안**: 코드 표의 `INTEGRATION_CALL_FAILED` 행에 "integrationId 미존재/타 워크스페이스 소속의 `NotFoundException` 흡수 포함" 조건을 인라인으로 추가한다.

---

## 요약

`spec/4-nodes/4-integration/` 은 전반적으로 공통 규약(`0-common.md`)과 각 노드 문서가 잘 정렬되어 있다. Redis pub/sub 채널 `integration:cache:invalidate` 메커니즘은 `spec/0-overview.md`, `spec/5-system/4-execution-engine.md`, `spec/data-flow/5-integration.md` 와 일관되게 기술된다. 다만 두 가지 경계 케이스에서 WARNING 수준의 불일치가 발견된다: (1) `INTEGRATION_NOT_FOUND` 코드가 공통 §4.2 에서는 "코드 미존재·흡수"로, 노드별(`1-http-request.md`, `2-database-query.md`) 에서는 "surface 됨"으로 상반되게 기술되는 점, (2) DB Query SSRF 차단 시 `INTEGRATION_CALL_FAILED` 로 흡수되는 경로가 §6.2 에러 코드 표에 명시되지 않은 점. 두 건 모두 구현 상태를 정확히 반영하는 spec 갱신으로 해결 가능하며 아키텍처 변경 없이 문서 수정으로 닫힌다. 크리티컬한 직접 충돌은 없다.

---

## 위험도

LOW
