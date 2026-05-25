# 신규 식별자 충돌 검토 결과

검토 모드: 구현 착수 전 검토 (`--impl-prep`, scope=`spec/5-system/`)
검토 대상: `spec/5-system/` 전체 (주요 신규 식별자는 `4-execution-engine.md` §7.4 / §7.5 / §9.3 / §11 의 Durable Continuation & Graceful Shutdown)

---

## 발견사항

### [INFO] `§7.5` 절 번호가 두 문서에서 다른 의미로 사용
- target 신규 식별자: `spec/5-system/4-execution-engine.md §7.5 "Resume after Restart (rehydration)"`
- 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md §7.5 "Multi Turn 모드 — 사용자 메시지 수신 (status: 'resumed', transient)"`
- 상세: 절 번호 `§7.5` 가 두 파일에서 각각 다른 개념을 가리킨다. 실행 엔진 spec 의 `§7.5` 는 인스턴스 재시작 후 WAITING_FOR_INPUT 재개(rehydration)이고, AI Agent spec 의 `§7.5` 는 multi-turn resumed transient 출력이다. 두 파일이 각기 독립된 절 번호 체계를 가지므로 **실제 식별자 충돌은 아니다**. 그러나 `4-execution-engine.md` 내부에서 "§7.5 rehydration" 을 cross-link 하는 텍스트(예: `0-overview.md:83`, `data-flow/3-execution.md:52`, `6-websocket-protocol.md:235`)와, `4-nodes/3-ai/1-ai-agent.md` 의 `§7.5` 를 cross-link 하는 텍스트(`spec/4-nodes/3-ai/0-common.md:128`)가 같은 숫자를 사용해 문맥 없이 읽으면 혼동 가능하다.
- 제안: 혼동 여지가 있는 cross-link 에서는 절 번호만 인용하지 말고 간략 레이블 (`§7.5 rehydration` 또는 `ai-agent §7.5 resumed`) 을 병기하는 것을 권장한다. 실질 식별자 변경 불필요.

### [INFO] `RESUME_BULLMQ_ATTEMPTS` 가 spec 에는 환경변수로 기술되어 있으나 codebase 에서는 코드 상수로 구현
- target 신규 식별자: `RESUME_BULLMQ_ATTEMPTS` — `spec/5-system/4-execution-engine.md §11` 환경변수 표에 등재
- 기존 사용처: codebase 내 해당 이름의 `process.env` 참조 없음. `codebase/backend/.env.example` 에 미등재. spec §11 의 비고란 "현재 양쪽 모두 코드 상수, ENV 화는 후속" 이 이를 설명함.
- 상세: spec 이 `RESUME_BULLMQ_ATTEMPTS` 를 환경변수 표에 올렸지만, 구현 현재는 코드 상수이다. 표 명칭이 환경변수처럼 보여 개발자가 `.env` 에 설정을 시도할 수 있다.
- 제안: spec §11 환경변수 표의 `RESUME_BULLMQ_ATTEMPTS` 행에 "(코드 상수 — ENV 화 미완, 후속 PR 예정)" 각주를 명확히 추가하거나, 표 제목/컬럼을 "환경변수 및 코드 상수" 로 변경해 혼동을 방지한다.

### [INFO] `rehydration` 용어가 실행 엔진과 AI Assistant 두 맥락에서 독립적으로 사용
- target 신규 식별자: `rehydration` / `rehydrate` — `spec/5-system/4-execution-engine.md §7.5` 에서 "다른 인스턴스가 WAITING_FOR_INPUT Execution 상태를 DB 에서 복원해 재개하는 행위"로 정의
- 기존 사용처: `spec/3-workflow-editor/4-ai-assistant.md` 의 여러 위치에서 동일 단어를 "프론트엔드 assistant 세션 상태를 서버 응답으로 복원하는 행위"로 사용 (예: line 147, 549, 584, 997, 1409)
- 상세: 두 사용처는 레이어가 다르므로(backend 실행 엔진 vs frontend 어시스턴트 세션) 실제 충돌은 없다. 그러나 같은 단어가 다른 레이어에서 비슷하지만 다른 의미로 쓰이므로, 새로 코드를 읽는 개발자가 검색 시 혼동할 수 있다.
- 제안: 실행 엔진 맥락에서는 "instance rehydration" 또는 "execution rehydration", AI Assistant 맥락에서는 "session rehydration" 또는 "store rehydration" 으로 한정어를 붙이는 것을 권장한다. 이미 `4-ai-assistant.md` 의 사용처들은 문맥이 충분히 명확하므로 즉시 수정 필요 수준은 아니다.

---

## 요약

`spec/5-system/` 이 이번 Durable Continuation & Graceful Shutdown 작업으로 도입한 신규 식별자(`execution-continuation` BullMQ 큐, `SIGTERM_GRACE_MS`, `RESUME_BULLMQ_ATTEMPTS`, `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` / `SERVER_INTERRUPTED` / `SERVER_SHUTTING_DOWN` 에러 코드, `exec:recover:lock` Redis 키, `queued` ack 필드)는 기존 spec 코퍼스 내에서 동일 이름으로 다른 의미를 갖는 선행 정의를 가지지 않는다. 에러 코드 어휘는 `spec/1-data-model.md §2.13` 에 명시적으로 추가되어 단일 진실 원칙이 지켜지고 있으며, 폐기된 Redis pub/sub 채널(`execution:continuation`)과 신규 BullMQ 큐(`execution-continuation`) 의 이름이 유사하나 spec 곳곳에 폐기 사실이 명기되어 있어 혼동 위험이 낮다. 발견된 세 항목은 모두 INFO 수준의 가독성·문서 명확화 제안이며, 구현 착수를 차단할 CRITICAL / WARNING 수준의 식별자 충돌은 발견되지 않았다.

---

## 위험도

NONE
