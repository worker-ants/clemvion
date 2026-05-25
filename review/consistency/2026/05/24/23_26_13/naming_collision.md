# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-workflow-resumable-execution.md`
검토 일시: 2026-05-24

---

## 발견사항

### **[WARNING]** 새 WS 이벤트 `execution.resumed_after_restart` vs 기존 `execution.resumed` 의미 혼동 가능성

- **target 신규 식별자**: `execution.resumed_after_restart` (`spec/5-system/6-websocket-protocol.md §4.1` 에 추가 예정)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` 649번째 줄: `execution.resumed` (transient) — §4.6 매핑 표
  - `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` 335, 348, 757번째 줄: `execution.resumed` 이벤트가 SSE stream 과 EIA 표면에 이미 정의되어 있으며 "재개됨" 을 뜻하는 transient 이벤트로 사용 중
- **상세**: `execution.resumed` 는 이미 "사용자 입력 수신 후 실행 재개" 를 알리는 transient 이벤트로 WebSocket spec §4.6 과 EIA spec 에 정의되어 있다. target 이 추가하는 `execution.resumed_after_restart` 는 "다른 인스턴스에서 rehydrate 재개" 를 의미한다. 두 이벤트 모두 "재개됨" 의미를 담고 있어 클라이언트 코드 작성자가 둘의 차이를 혼동할 수 있다. `resumed` 와 `resumed_after_restart` 의 의미 경계가 충분히 명확하지 않으면 클라이언트가 양쪽을 모두 처리해야 하는 이벤트로 오인할 수 있다.
- **제안**: target spec 에 두 이벤트의 의미 차이를 명시적으로 기술한다. 예: `execution.resumed` 는 "동일 인스턴스에서 입력 수신 후 resolver 즉시 호출", `execution.resumed_after_restart` 는 "다른 인스턴스의 rehydration 경로 완료 알림 (디버깅 전용, 선택 이벤트)". 이름 자체보다 §4.1 표의 설명 컬럼에서 관계를 명문화하는 것으로 충분하다.

---

### **[WARNING]** BullMQ 큐 이름 `execution-continuation` vs 기존 Redis pub/sub 채널 `execution:continuation` 이름 유사성

- **target 신규 식별자**: BullMQ 큐 이름 `execution-continuation` (`spec/5-system/4-execution-engine.md §7.4` 변경 예정)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` 362, 740, 825, 828번째 줄: Redis pub/sub 채널명 `execution:continuation` 이 §7.4 과 §9.2 표에 이미 정의되어 있고, §9.2 에는 별도 행으로 명시됨
  - `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/0-common.md` 381번째 줄: `execution:continuation` 이 internal continuation bus payload SoT 로 참조됨
- **상세**: 기존 Redis pub/sub 채널 `execution:continuation` (콜론 구분자) 과 신규 BullMQ 큐 `execution-continuation` (하이픈 구분자) 은 기술적으로 다른 리소스이나, 이름이 극히 유사하다. target 이 "Redis pub/sub → BullMQ 영속 큐" 교체를 명시하고 있으므로 기존 채널은 제거되겠지만, 교체 전 과도 기간에 두 식별자가 코드·설정·로그에 혼재될 때 `execution:continuation` 과 `execution-continuation` 을 구분하지 못하는 운영 혼선이 발생할 수 있다. 또한 §9.2 Redis 키 네이밍 표에 `execution:continuation` (채널) 행이 남아 있으면 신규 BullMQ 큐와의 관계가 불명확해진다.
- **제안**: target spec 에서 §9.2 표의 `execution:continuation` 행을 제거하거나 "레거시 → 폐기" 로 명시하고, 신규 BullMQ 큐는 `continuation-queue` 와 같이 기존 채널명과 명확히 구분되는 이름을 사용하는 것을 검토한다. 이름을 `execution-continuation` 으로 유지할 경우에도 spec §7.4 에서 두 식별자의 관계를 명시적으로 서술해야 한다.

---

### **[INFO]** 환경변수 `SIGTERM_GRACE_MS` — 기존 사용처 없음, 네이밍 컨벤션 확인 권장

- **target 신규 식별자**: `SIGTERM_GRACE_MS` (`spec/5-system/4-execution-engine.md §11` 신설 예정)
- **기존 사용처**: 코드베이스 및 spec 어디에도 해당 식별자 없음. 검색 결과 zero hit.
- **상세**: 직접 충돌은 없다. 기존 환경변수 컨벤션 (`MAX_NODE_ITERATIONS`, `PARALLEL_ENGINE=v1`) 은 기능 도메인을 prefix 로 사용하지 않는다. `SIGTERM_GRACE_MS` 는 OS 시그널 이름을 직접 포함하는 이름으로, 서버 운영 레벨 변수임을 잘 드러낸다. 다만 k8s `terminationGracePeriodSeconds` 와 1:1 대응하는 변수이므로 `SHUTDOWN_GRACE_MS` 처럼 신호 종류에 독립적인 이름도 고려할 수 있다.
- **제안**: 현재 이름 그대로도 충분히 명확하다. 단, 신설 §11 에서 k8s `terminationGracePeriodSeconds` 와의 관계를 환경변수 설명 컬럼에 명시하는 것으로 충분하다 (target draft 이미 포함).

---

### **[INFO]** 환경변수 `RESUME_BULLMQ_ATTEMPTS` — 기존 사용처 없음, 이름 일관성

- **target 신규 식별자**: `RESUME_BULLMQ_ATTEMPTS` (`spec/5-system/4-execution-engine.md §11` 신설 예정)
- **기존 사용처**: 코드베이스 및 spec 어디에도 해당 식별자 없음.
- **상세**: 직접 충돌은 없다. 기존 retry 관련 환경변수 패턴이 spec 상에 별도 정의되어 있지 않아 비교 불가. `RESUME_BULLMQ_ATTEMPTS` 는 "재개 전용 BullMQ 재시도 횟수" 라는 의미가 명확하다. 단, 기존 BullMQ 큐(`background-execution`)의 `attempts` 는 환경변수가 아닌 코드 내 하드코딩 또는 spec 표 기본값으로 관리한다. 이 변수만 환경변수화되면 관리 일관성이 불균일해진다.
- **제안**: 기존 BullMQ 큐의 `attempts` 설정이 환경변수화되어 있지 않다면, `RESUME_BULLMQ_ATTEMPTS` 도 코드 상수로 관리하는 편이 일관성이 높다. 운영 튜닝 목적으로 ENV 로 뽑는다면 spec 에서 명시적으로 그 이유를 기술한다.

---

### **[INFO]** 에러 코드 4종 (`RESUME_QUEUED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE`) — 기존 사용처 없음, `SERVER_INTERRUPTED` 코드와의 체계 확인

- **target 신규 식별자**: `RESUME_QUEUED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE`, `SERVER_INTERRUPTED` (WebSocket ack 에러 코드 및 `Execution.error.code` 값으로 추가 예정)
- **기존 사용처**: spec 전체에 해당 코드 없음. 기존 WebSocket 에러 코드 집합은 `INVALID_BUTTON_ID`, `INVALID_EXECUTION_STATE`, `INTERACTION_TIMEOUT`, `RETRY_STATE_NOT_FOUND`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY`, `FORBIDDEN` 등.
- **상세**: 직접 충돌 없음. `RESUME_FAILED` 와 `RESUME_QUEUED` 는 같은 `RESUME_*` prefix 를 공유하면서 하나는 성공 변형, 하나는 실패로 의미가 대칭되지 않는다. target draft 의 설명에서 `RESUME_QUEUED` 는 "`(성공 변형)` Continuation 이 큐로 enqueue 되었음" 이라고 명시하고 있어 혼동 위험이 있다. 기존 에러 코드 패턴상 성공 변형은 별도 ack 필드(`resumed: true`)로 표현하고 에러 코드 표에는 실패 코드만 둔다 (`execution.click_button.ack` 패턴 참조). `RESUME_QUEUED` 를 에러 코드 표에 성공 변형으로 두는 것은 기존 패턴과 불일치한다.
- **제안**: `RESUME_QUEUED` 는 에러 코드 표에서 제거하고, ack payload 의 `resumed: true` + 별도 `queued: true` 플래그로 표현하거나, `RESUME_QUEUED` 를 `info` 코드 네임스페이스로 분리한다 (예: ack `payload.mode = 'queued' | 'direct'`). `SERVER_INTERRUPTED` 는 `Execution.error.code` 로 추가되므로 `spec/1-data-model.md §2.13` 의 에러 코드 설명에도 언급이 필요하다.

---

### **[INFO]** 섹션 번호 `§11` 신설 — 기존 execution-engine.md 에 §11 부재 확인됨, 충돌 없음

- **target 신규 식별자**: `spec/5-system/4-execution-engine.md §11 Graceful Shutdown` 신설
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` 의 현재 최고 섹션은 `§10 Integration Handler 계약`. `§11` 은 비어 있다. 다른 spec 파일의 `§11` 참조(예: `spec/1-data-model.md` 의 `§11.2.1 canvas 스펙 참조`) 는 각자 문서 내부 섹션 참조이므로 충돌 없음.
- **상세**: 충돌 없음. 순차 번호 배정이 적절하다.
- **제안**: 없음.

---

### **[INFO]** 섹션 `§7.5` 신설 — 기존 §7.4 다음 순서, 충돌 없음

- **target 신규 식별자**: `spec/5-system/4-execution-engine.md §7.5 Resume after Restart`
- **기존 사용처**: 현재 §7 하위 섹션은 §7.1 ~ §7.4 까지만 존재하며 §7.5 는 비어 있다. `prd/3-node-system.md §11` 참조는 다른 문서의 §11 이므로 무관.
- **상세**: 충돌 없음.
- **제안**: 없음.

---

## 요약

target 문서가 도입하는 신규 식별자들은 대부분 기존 코드베이스와 spec 에 충돌 없이 삽입 가능하다. 가장 주의가 필요한 지점은 두 가지다. 첫째, 신규 WS 이벤트 `execution.resumed_after_restart` 가 기존의 `execution.resumed` (transient) 와 의미상 유사하여 클라이언트 구현자가 혼동할 수 있으므로, spec §4.1 에서 두 이벤트의 의미 경계를 명시해야 한다. 둘째, 신규 BullMQ 큐 이름 `execution-continuation` 과 기존 Redis pub/sub 채널 `execution:continuation` 은 구분자(하이픈/콜론)만 다른 극히 유사한 이름이어서 과도기 운영 혼선 위험이 있으며, target spec 에서 교체 관계와 §9.2 표 정리를 명시해야 한다. 나머지 신규 에러 코드·환경변수·섹션 번호는 기존 식별자와 충돌하지 않으나, `RESUME_QUEUED` 가 에러 코드 표에 "성공 변형" 으로 들어가는 패턴이 기존 ack 설계 관례와 불일치하므로 별도 flag 로 표현하는 방향이 바람직하다.

---

## 위험도

LOW
