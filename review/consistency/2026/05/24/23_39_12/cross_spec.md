# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-workflow-resumable-execution.md` (rev 2)
검토 일시: 2026-05-24
검토 모드: `--spec`

---

## 발견사항

### [WARNING] §9.2 Redis 키 표 — `execution:continuation` 행 삭제 후 각주 정합 필요
- **target 위치**: 변경 1.10 — "`execution:continuation` (Pub/Sub) 행 전체 삭제"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §9.2` 표 하단 각주 (line 828)
  > "두 전역 키 (`execution:continuation`, `exec:recover:lock`) 는 §9.1 의 `{service}:{workspaceId}:{resource}` 패턴을 따르지 않는다."
- **상세**: 행 자체는 삭제하지만 §9.2 표 아래의 각주에는 `execution:continuation` 이름이 여전히 남는다. target draft 는 이 각주 갱신을 명시하지 않았다. 각주가 남으면 "삭제된 키를 패턴 예외로 설명하는 orphan 문장"이 생긴다.
- **제안**: spec 적용 시 §9.2 각주의 `execution:continuation` 언급을 함께 제거하거나 "옛 Redis pub/sub 채널. §7.4 BullMQ 전환 후 폐기." 형태로 주석처리. target draft 본문에 이 각주 갱신을 명시적으로 포함할 것.

---

### [WARNING] §4.4 Rationale(단일 sink 정책) 문장 — 갱신 필요
- **target 위치**: 변경 1.8 — "§4.4 단일 sink 정책 Rationale 의 continuation bus 문장 갱신"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §4.4` (line 362)
  > "분산은 Continuation Bus (§7.4) 가 담당 — 인스턴스 간 fan-out 은 Redis pub/sub 채널 `execution:continuation` 이 처리하므로, 이벤트 발행 추상화와 분산 동작은 직교."
- **상세**: target draft 는 변경 1.8 에서 이 문장을 BullMQ 표기로 교체한다고 명시했지만, spec 적용 phase 에서 실제로 실행해야 하는 "갱신 지점 목록"이 한 곳 더 있다: **§4.4 본문 위의 `> 결정:` 블록**에서 근거 불릿 "분산은 Continuation Bus (§7.4) 가 담당 — 인스턴스 간 fan-out 은 Redis pub/sub 채널 `execution:continuation` 이 처리하므로" 를 동시에 갱신하지 않으면 같은 절 안에서 구·신 표기가 혼재한다. target draft 의 변경 1.8 에는 해당 블록 갱신이 명시되지 않았다.
- **제안**: 변경 1.8 교체 대상에 §4.4 `> 결정:` 블록의 근거 불릿 행(line 362)도 명시적으로 포함할 것.

---

### [WARNING] `spec/4-nodes/6-presentation/0-common.md §10.9` — 변경 범위 미완
- **target 위치**: 변경 6 — "§10.9 sentinel SoT 채널명, `execution:continuation` → `execution-continuation`"
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md §10.9` (line 381, 387, 389, 415, 417)
  - line 381 테이블의 `(2)` 행: `"server-internal Redis pub/sub execution:continuation 채널"`
  - line 387: `bus.publish({ type: 'continue', executionId, payload: ... })` 의 "Redis pub/sub" 및 `Continuation Bus` 링크 설명
  - line 389: `[Continuation Bus](../../5-system/4-execution-engine.md#74-분산-실행-multi-instance)` 링크 텍스트 — §7.4 는 교체 대상이므로 anchor 연동 여부 확인 필요
  - line 417: `spec [execution-engine §7.4](../../5-system/4-execution-engine.md#74-분산-실행-multi-instance)` — 동일 anchor
- **상세**: 변경 6 은 "SoT 참조도 함께 갱신" 이라고 언급하지만, §10.9 내 "4 layer 분리" 표의 `(2)` 행과 이후 설명 문단에 `Redis pub/sub` / `Continuation Bus` 키워드가 다수 등장한다. 채널명 변경 외에 이 행들의 인프라 표기("Redis pub/sub" → "BullMQ 큐")와 링크 앵커(`#74-분산-실행-multi-instance` → §7.4 의 신규 제목으로 변경 시 앵커가 바뀜)도 동반 갱신이 필요하다.
- **제안**: 변경 6 적용 시 `spec/4-nodes/6-presentation/0-common.md §10.9` 의 (2)행 인프라 표기와 관련 설명 문단 전체를 점검하고, 앵커 링크가 유효한지 확인할 것. target draft 에 이 범위를 명시적으로 추가할 것.

---

### [WARNING] `spec/data-flow/3-execution.md` — line 20의 continuation-bus 표기도 갱신 대상
- **target 위치**: 변경 4 — "§1.1 시퀀스 다이어그램의 continuation-bus 주석 갱신"
- **충돌 대상**: `spec/data-flow/3-execution.md` line 20 (file 내용 확인)
  > `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts — 폼·버튼 인터랙션 깨우기 (Redis pub/sub)`
  그리고 line 165: `waiting_for_input --> running: continuation-bus 수신`
- **상세**: spec/data-flow/3-execution.md 에는 최소 2개의 고정 언급이 있다. (a) 파일 참조 목록의 `continuation-bus.service.ts` (모듈 구조 변경에 따라 파일 경로·클래스명이 달라질 수 있음), (b) mermaid 다이어그램의 `waiting_for_input --> running: continuation-bus 수신`. 변경 4 가 §1.1 시퀀스 다이어그램의 주석(line 52)만 갱신 대상으로 명시했지만, 위 두 위치도 동반 갱신이 필요하다.
- **제안**: 변경 4 의 갱신 범위를 line 52 주석 + line 20 파일 참조 + line 165 mermaid 상태 전이 라벨로 확장. target draft 에 명시할 것.

---

### [WARNING] `spec/0-overview.md §2.6` Data Layer 표기 — 갱신 범위 명확화 필요
- **target 위치**: 변경 5 — "§2.6 Data Layer Redis 항 — '실행 상태 Pub/Sub' 을 '캐시·세션·`exec:recover:lock` 같은 운영 lock' 으로 한정"
- **충돌 대상**: `spec/0-overview.md §2.6` (확인된 line 249)
  > "**Redis**: 캐시, 실행 상태 Pub/Sub, 세션 관리"
  그리고 `spec/0-overview.md §2.4 Rationale` (line 389)
  > "continuation bus·BullMQ 기반 cron·Cafe24 cross-pod refresh 직렬화 등 다른 시스템도 같은 Redis 를 재사용해 net 부담이 낮다."
- **상세**: §2.6 Data Layer 표 갱신과 §2.4 Rationale 의 "continuation bus … 같은 Redis 재사용" 문장 갱신이 변경 5에 모두 포함되어 있으나, §2.4 Rationale 의 해당 행("continuation bus ... 같은 Redis 재사용")은 BullMQ continuation-queue 를 Redis 위에서 운영하는 사실은 여전히 맞기 때문에 "Redis 재사용" 표현 자체는 정확하다. 다만 "continuation bus" 라는 명칭이 "BullMQ continuation-queue" 로 바뀌므로 해당 키워드만 갱신이 필요하다. 변경 5 의 §2.4 갱신 지침이 "continuation bus 표기를 BullMQ continuation-queue (§7.5 참조) 로 갱신" 이라고 명시하고 있어 기술적으로 정합하지만, §2.4 Rationale 의 trade-off 불릿 (line 389) 도 함께 갱신 범위에 포함해야 한다는 점이 target draft 에 명시되지 않았다.
- **제안**: 변경 5 적용 시 §2.4 의 "§2.4 Rationale" 불릿("continuation bus·BullMQ 기반 cron…")도 점검 대상에 포함. target draft 에 해당 불릿 행 갱신 여부를 명시할 것.

---

### [INFO] WS ack `queued` 필드 — `execution.submit_form` / `execution.submit_message` ack 형식 미정의
- **target 위치**: 변경 2.1 — "`queued: boolean` 신규 필드, `execution.click_button.ack` 예시에 추가"
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2` — `execution.submit_form` 과 `execution.submit_message` 는 현행 spec 에 ack 응답 예시 자체가 없음 (명령 표만 있고 ack shape 미정의)
- **상세**: target draft 는 `queued` 필드를 "submit_form / click_button / submit_message / end_conversation 의 공통 에러 코드 표에 행 3개 추가" (변경 2.2) 라고 기술하므로, 네 명령 모두에 공통으로 적용되는 의미로 보인다. 그러나 `queued: boolean` 필드가 `execution.click_button.ack` 예시에만 추가되고, `execution.submit_form.ack` / `execution.submit_message.ack` 의 ack shape 은 현행 spec 에 정의조차 없다. 이 필드가 "공통"이라면 나머지 ack 형식도 함께 정의해야 한다.
- **제안**: 변경 2.1 에 `execution.submit_form.ack` / `execution.submit_message.ack` / `execution.end_conversation.ack` 의 기본 shape (최소 `resumed`, `queued` 포함) 도 함께 추가할 것. 또는 "공통 ack 구조" 한 곳을 SoT 로 지정하는 방식으로 정리.

---

### [INFO] BullMQ 큐 목록(§9.3) 의 `task-queue` — spec 내 근거 출처 미확인
- **target 위치**: 변경 1.10 §9.3 BullMQ 큐 목록 신설, `task-queue` 행
- **충돌 대상**: `spec/5-system/4-execution-engine.md` 전체 — `task-queue` 라는 큐 이름이 현행 spec 어디에도 명시되어 있지 않다. `background-execution` 은 §3.3 에 명시됨.
- **상세**: 변경 1.10 의 §9.3 표에 `task-queue (노드 실행 태스크, §4.2)` 를 기존 큐로 등재했다. §4.2 (Worker 아키텍처) 를 보면 "Redis BQ (Task Queue)" 라는 표현이 있지만 큐 이름 `task-queue` 는 spec 에 명시된 바 없다. 실제 구현 파일에서도 확인되지 않았다. 만약 이 큐가 실제로 존재한다면 spec SoT 가 없는 상태이고, 존재하지 않는다면 잘못된 행 추가다.
- **제안**: `task-queue` 의 실제 존재 여부를 구현 코드(BullMQ 큐 등록 지점)에서 확인한 후, (a) 존재하면 §4.2 에 큐 이름을 명시 추가, (b) 존재하지 않으면 §9.3 표에서 해당 행 삭제. 구현 확인 후 spec 적용 phase 에서 결정.

---

### [INFO] `waiting_for_input → cancelled` 전이 조건 보강 — Rationale 의 `cancelled` 결과 표기와 부분 불일치
- **target 위치**: 변경 1.1 — "기존 `waiting_for_input → cancelled` 행의 조건 보강, '재개 실패(rehydration 실패의 단말 케이스)' 추가"
- **충돌 대상**: `spec/5-system/4-execution-engine.md §1.1` 상태 전이 표 (line 48) 와 변경 1.6 의 rehydration 실패 케이스 표
- **상세**: 변경 1.1 은 `waiting_for_input → cancelled` 조건에 "재개 실패"를 추가한다. 변경 1.6 의 rehydration 실패 케이스 표는 세 케이스 모두 `Execution cancelled` 로 기술한다. 그러나 현행 spec §1.1 의 `waiting_for_input → cancelled` 전이 설명에는 상태 전이 표 위의 ASCII 다이어그램 (line 18-24) 에 이미 `waiting_for_input → cancelled` 화살표가 있다. 다이어그램과 표가 일치하도록 변경 1.1 이 "ASCII 다이어그램 아래 주석 1줄 추가"만 하는 것으로 충분한지, 혹은 다이어그램 자체의 화살표 라벨에도 변경이 필요한지 target draft 에 명시되어 있지 않다.
- **제안**: §1.1 ASCII 다이어그램의 `waiting_for_input → cancelled` 화살표에 rehydration 실패 케이스를 라벨로 추가할지 여부를 target draft 에 명시할 것. 현재 "주석 1줄만 추가" 방식이면 명확히 그렇게 표기.

---

### [INFO] `execution.resumed` 이벤트 — rehydration 후 발행 여부 미명시
- **target 위치**: 변경 2.3 — "`execution.resumed_after_restart` 이벤트 신설 취소, 기존 이벤트로 충분"
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.6` 이벤트 표 (line 649)
  > `execution.resumed (transient)` — SSE, Outbound Notification 미발송
- **상세**: 현행 spec 에 `execution.resumed` (transient) 이벤트가 이미 존재한다. target draft 는 rehydration 후 별도 이벤트를 추가하지 않는다고 결정했으나, §7.5 의 rehydration slow path 에서 in-memory resolver 를 새로 등록하고 즉시 resolve 한 뒤 그래프 순회를 재개할 때 `execution.resumed` 가 발행되는지 여부가 target draft 에 명시되어 있지 않다. 현행 `execution.resumed` 가 "재개 tick" 이라면 rehydration 경로에서도 발행되어야 관측성이 충족된다.
- **제안**: §7.5 의 rehydration slow path 완료 후 `execution.resumed` 이벤트가 발행되는지 여부를 target draft 또는 산출 spec 에 명시할 것.

---

## 요약

target draft(rev 2)는 주요 설계 결정(Redis pub/sub → BullMQ 영속 큐, recoverStuckExecutions 완화, Graceful Shutdown §11 신설)에서 기존 spec 과 직접 모순되는 CRITICAL 충돌은 없다. 상태 enum 신규 값 도입을 명시적으로 거부하고 `waiting_for_input` 내부 transition 으로 정의한 점은 `spec/1-data-model.md §2.13` 의 Execution.status enum, `spec/5-system/13-replay-rerun.md`, `spec/3-workflow-editor/` 의 status pill 등 cross-spec 영향을 최소화하는 올바른 선택이다. 다만 §9.2 Redis 키 표 각주, §4.4 단일 sink 정책 근거 불릿, `spec/4-nodes/6-presentation/0-common.md §10.9` 의 인프라 표기와 앵커 링크, `spec/data-flow/3-execution.md` 의 추가 갱신 위치 등 **4개의 WARNING** 이 발견됐다. 이 항목들은 spec 적용 phase 에서 누락하면 구·신 표기 혼재 또는 orphan 문장이 발생하는 잠재 충돌이므로, spec 적용 단계에서 동반 갱신 대상으로 명시적으로 관리해야 한다. INFO 3건은 ack shape 미정의, 미확인 큐 이름, rehydration 관측성 미명시로 구현 phase 에서 결정이 필요한 사항이다.

## 위험도

MEDIUM

---

STATUS: OK
