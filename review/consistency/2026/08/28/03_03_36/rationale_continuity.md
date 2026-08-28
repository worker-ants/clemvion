# Rationale 연속성 검토 — `system-error-banner`

## 검토 범위

- target: `spec/5-system/` (impl-done, diff-base `origin/main`)
- 실제 diff 내용: `codebase/frontend/src/lib/websocket/use-execution-events.ts` +
  `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` (프런트
  코드/테스트 전용, spec 파일 변경 없음 — `plan/in-progress/system-error-banner-live-ws.md`
  frontmatter `spec_impact: none` 과 일치)
- 대조한 Rationale/본문 근거: `spec/5-system/6-websocket-protocol.md` §4.1 / §4.1-a,
  `spec/conventions/node-output.md` Principle 0 / Principle 3.2,
  `spec/conventions/conversation-thread.md` §1.1.1 / §1.2.1 / §8.3 / §9.7 표

## 발견사항

해당 없음 — 아래 확인 결과 target diff 가 기각된 대안을 재도입하거나 합의 원칙을 위반하는
사례를 찾지 못했다.

### 확인한 배경 (참고용, 발견사항 아님)

target diff(`extractNodeErrorPayload` 리팩터 — top-level `error` 를 문자열로만 취급하고
구조화 에러를 `output.output.error` 한 겹 더 깊이서 추출하도록 변경, `direct` 분기 삭제)는
**`spec/5-system/6-websocket-protocol.md` §4.1-a (2026-08-24 실측 정정)** 및
**`spec/conventions/node-output.md` Principle 0** 의 "wire envelope 은 `NodeHandlerOutput`
래퍼를 통째로 싣는다" 정정과 **정확히 일치**한다. 두 문서 모두 이 코드 결함을 이미 다음과
같이 명시적으로 예고해 두었다:

- §4.1-a: "이 문구가 프런트 결함을 낳았다 … `payload.error` 를 객체로 파싱해 … `system_error`
  재시도 배너가 라이브 WS 경로에서 뜨지 않는다. **코드 수정은 별건으로 정본 트래커에
  등재했다**"
- `conversation-thread.md` §9.7 표 하단: "코드 수정은 UI 동작·테스트 fixture 가 함께
  바뀌므로 별건으로 정본 트래커에 등재돼 있고, **그 작업이 이 두 행의 문구도 함께
  검증**한다"

즉 target 은 과거 Rationale 이 이미 "기각"한 예전 해석(top-level `error` 가 객체 전체
구조라는 서술 — §4.1-a 취소선 처리됨)을 다시 채택한 것이 아니라, 그 기각을 코드에
반영하는 **사전 예고된 후속 작업**이다. 테스트 주석의 "옛 backend 호환" 라벨 삭제도
실제 spec Rationale 로 뒷받침되는 결정 번복이 아니라, spec 에 근거 없던 잘못된 코멘트
라벨을 정정한 것이다(`spec/` 어디에도 `execution.node.failed` 의 객체형 `error` 를
의도적으로 지원한다는 결정 기록이 없음 — grep 로 확인).

`plan/in-progress/system-error-banner-live-ws.md` 는 이 작업이 정본 트래커의 CRITICAL
항목(`12_24_55` cross_spec)을 프런트 전용으로 해소하는 것이며, "백엔드를 바꾸면 8/24 에
정정한 방향을 되돌리는 것이므로 건드리지 않는다"고 스코프를 명시적으로 좁혀 두었다 —
합의된 방향(§4.1-a)과 반대 방향으로 가지 않도록 스스로 가드한 상태다.

## 요약

target diff 는 spec Rationale 이 이미 확정한 "top-level `error` 는 문자열, 구조화 에러는
`output.output.error` 래퍼 한 겹 아래" 라는 2026-08-24 정정을 프런트 코드에 뒤늦게
반영하는 예고된 후속 수정이며, 과거에 기각된 해석(객체형 `error` 직접 파싱)을 되살리거나
`node-output.md` Principle 0 / `6-websocket-protocol.md` §4.1-a 가 못박은 invariant 를
우회하는 지점을 찾지 못했다. spec 문서 변경이 없는 순수 코드 수정이라 새 Rationale 을
써야 할 "결정 번복"도 발생하지 않았다.

## 위험도

NONE
