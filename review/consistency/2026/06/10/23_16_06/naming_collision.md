# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-update-ws-resumed-ack.md`
검토 일시: 2026-06-10

---

## 발견사항

### 발견사항 없음 — 신규 식별자 미도입

target 문서는 새 식별자를 도입하지 않는다. 변경 내용은 기존 두 파일의 기존 식별자에 대한 **설명(description) 정정**이다.

- `spec/5-system/6-websocket-protocol.md` §4.2 표 line 241: `resumed | boolean | 재개 성공 여부` → `재개 시작 수락(enqueue) 여부`로 설명 문구 변경. 필드명 `resumed`, 타입 `boolean`, 위치(ack payload)는 그대로다.
- `spec/5-system/4-execution-engine.md` §7.5 line 967: "`RESUME_*` 는 ack 에 `resumed: false` + error 로 노출된다" → "`RESUME_*` 는 후행 `EXECUTION_CANCELLED` 이벤트로 통지된다"로 서술 정정. 에러 코드명(`RESUME_FAILED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`), 이벤트명(`EXECUTION_CANCELLED`)은 신설이 아니며 기존 spec 전역에 이미 동일 의미로 사용 중이다.

#### 혼동 가능 영역 사전 점검 결과

점검 항목과 결과를 아래에 명시한다.

**1. `resumed` (WS ack payload boolean) vs `"resumed"` (NodeExecution output `status` 문자열)**

두 식별자는 namespace 가 다르다. WS ack payload 의 `resumed: boolean` 은 4개 continuation 명령의 ack 응답 필드이고, `status: "resumed"` 는 노드 출력 객체의 상태 열거값(`spec/conventions/node-output.md`, `spec/4-nodes/` 전반)이다. 동일 이름이지만 사용 계층이 다르며, 이번 정정은 WS ack 측 설명만 변경하므로 노드 output 측 의미에 영향이 없다.

**2. `execution.resumed` (SSE/WS 이벤트명) vs `resumed` (ack boolean 필드)**

`execution.resumed`는 `waiting_for_input` 후 실행 재개 사실을 알리는 서버→클라이언트 이벤트 이름(`spec/3-workflow-editor/3-execution.md` line 291, `spec/5-system/6-websocket-protocol.md` line 774, `spec/5-system/14-external-interaction-api.md` line 348, 805)이다. ack payload boolean `resumed`와 이름이 유사하지만 서로 다른 계층에 위치하며(이벤트명 vs 페이로드 필드), target 문서는 이벤트명을 변경하지 않으므로 충돌 없다.

**3. `RESUME_*` 에러 코드의 노출 위치 변경**

`RESUME_FAILED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE` 코드명은 변경되지 않는다. §7.5 line 967 정정은 이 코드들이 "ack 동기 응답"이 아니라 "후행 `EXECUTION_CANCELLED` 이벤트"로 노출된다는 서술을 수정하는 것이며, 코드 자체는 기존 spec(`spec/5-system/6-websocket-protocol.md` lines 298–300, `spec/data-flow/3-execution.md`, `spec/conventions/chat-channel-adapter.md` 등)과 동일한 의미로 이미 광범위하게 사용 중이다. 코드 추가/변경 없음.

**4. 요구사항 ID, API endpoint, 환경변수, 설정키, 파일 경로**

target 문서는 요구사항 ID를 신설하지 않는다. API endpoint, 환경변수, 설정키, spec 파일 경로 변경도 없다(기존 두 파일 내 서술 수정만).

---

## 요약

target 문서(`spec-update-ws-resumed-ack`)는 기존 WS ack payload 필드 `resumed`의 설명 문구 정정과 실행 엔진 §7.5의 오기 정정이 전부로, 새로운 식별자(요구사항 ID, 엔티티명, API endpoint, 이벤트명, 환경변수, 파일 경로)를 도입하지 않는다. 식별자 네임스페이스 관점의 충돌이나 기존 사용처와의 의미 중복은 발견되지 않았다.

---

## 위험도

NONE
