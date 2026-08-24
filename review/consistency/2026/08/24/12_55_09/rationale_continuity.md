STATUS=success rationale_continuity review complete — 0 CRITICAL, 0 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# Rationale 연속성 검토 — `spec/conventions/` (node-output-envelope, impl-done)

## 조사 방법 메모
prompt_file 의 번들에 target diff 자체(`<git diff origin/main...HEAD -- code_areas>`)와
`spec/conventions/node-output.md`·`conversation-thread.md` 본문이 "컨텍스트 예산 초과"로
생략돼 있어, 실제 diff 는 워킹트리에서 `git diff origin/main...HEAD -- spec/conventions/`
로 직접 재확인했다. 변경 파일은 2개뿐이다:
`spec/conventions/chat-channel-adapter.md`, `spec/conventions/conversation-thread.md`
(작업 슬러그는 `node-output-envelope-458f05` 지만 실제 diff 범위 안에 `node-output.md` 자체
편집은 없다 — envelope/domain 두 층 구분을 인접 spec 에 미러하는 sweep 의 일부).

## 발견사항

- **[INFO]** envelope↔domain 두 층 구분 정정이 형제 문서 스윕의 연장선임을 명시
  - target 위치: `spec/conventions/chat-channel-adapter.md` §1.3 JSDoc + §3 매핑표,
    `spec/conventions/conversation-thread.md` §8.4 정정 블록 + §9.7 두 행 + 신설 경고 콜아웃
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` §4.1 "⚠️ `error` 는 문자열이다"
    (2026-08-24 정정, `12_24_55` cross_spec CRITICAL) 및 `execution.node.completed` 행의
    "래퍼(`output`)와 도메인 값(`output.output`)은 이름이 겹칠 뿐 다른 층" 정정
    (`10_44_28` naming W2); `spec/5-system/14-external-interaction-api.md` §R17 의
    "재정정 (2026-08-24)" 블록 (실 DB 조회 93행 실측); `spec/conventions/node-output.md`
    Principle 3.2 (`output.error` 표준 형태, 도메인 레벨 정의는 불변)
  - 상세: target 의 두 정정은 모두 (a) 취소선(`~~...~~`)으로 원문을 보존하고, (b) 정확한
    실측 근거(emit 4곳 파일:라인, 또는 상위 spec 의 재정정 블록 링크)를 동봉하며,
    (c) 새 결론을 명시적으로 적어 "자기-반증형 소정정" 관례를 따른다. 검증 결과:
    - `chat-channel-adapter.md` 의 `output.output.rendered` 정정은 WS §4.1 의
      "래퍼 vs 도메인" 구분과 일치하고, `node-output.md` Principle 3.2 (`NodeHandlerOutput.output.error`
      정의)를 위반하지 않는다 — Principle 3.2 는 도메인 레벨 정의이고 target 은 wire 레벨 중첩
      깊이만 정정한다.
    - `conversation-thread.md` §9.7 의 `error` 필드 정정(`string` vs 구조화 객체)은 WS §4.1
      의 동일 정정과 1:1 대응하며, "구조화 객체는 `output.output.error`" 서술도 EIA §R17
      재정정 블록의 결론과 일치한다.
    - 신설 경고 콜아웃("위 두 행이 프런트 결함을 낳았다")이 인용하는 별건 트래커
      (`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)는 실제로 존재하고
      `extractNodeErrorPayload` 를 참조 대상으로 잡고 있어(코드에도 동일 식별자 존재),
      근거 없는 주장이 아니다.
    - `R-CCA-5`/`R-CCA-7` (인터페이스 최소주의, `renderNode` 시그니처 미확장)·`R3`
      (`EiaEvent` 는 EIA spec 위임)·`R-CCA-8` (native form 예외) 등 기존 Rationale 원칙은
      이번 정정으로 건드리지 않는다 — 함수 시그니처·union 구조·기각된 대안 목록 어느 것도
      재도입·번복되지 않았다.
  - 제안: 조치 불요. 참고로 `spec/5-system/14-external-interaction-api.md` §R17 은 chat-channel
    렌더러가 `nodeOutput` 을 **flat legacy shape**(`nodeOutput.rendered`)으로 읽는다고
    서술하는데, 이는 `waiting_for_input`/`buttonConfig.nodeOutput` 표면에 대한 서술이고
    target 이 다루는 `execution.node.completed`(비차단 presentation, `ChatChannelInternalEvent`)
    표면과는 다른 wire 경로다. 두 표면이 각각 "주 경로/폴백 경로"를 다르게 서술하는 것 자체는
    모순이 아니나, 두 spec 을 나란히 읽을 때 오독 여지가 있으므로 후속 편집에서 상호 링크를
    추가하면 향후 drift 재발을 줄일 수 있다.

## 요약
target 의 두 편집(`chat-channel-adapter.md`, `conversation-thread.md`)은 새 설계 결정이
아니라, 이미 `spec/5-system/6-websocket-protocol.md` §4.1 및
`spec/5-system/14-external-interaction-api.md` §R17 에서 실측·기록된 "wire `output` 은
`NodeHandlerOutput` 래퍼 전체이고 도메인 값은 한 겹 아래"라는 정정을 인접 컨벤션 문서로
미러하는 sweep 이다. 두 편집 모두 취소선으로 원문을 보존하고 실측 근거(파일:라인 또는 상위
spec 재정정 블록)를 동봉해 이 저장소의 "자기-반증형 소정정" 관례를 따르며, 기존
`R-CCA-N`/`R1~R4` 어느 항목이 기각한 대안도 재도입하지 않았고 함수 시그니처·인터페이스
최소주의 원칙도 그대로 유지된다. `node-output.md` Principle 3.2(도메인 레벨 `output.error`
표준)와도 층위가 달라 충돌하지 않는다. Rationale 연속성 관점에서 위반 사항 없음.

## 위험도
NONE
