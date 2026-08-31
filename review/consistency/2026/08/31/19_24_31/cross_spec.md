# Cross-Spec 일관성 검토 — `spec/5-system/6-websocket-protocol.md` · `spec/5-system/14-external-interaction-api.md`

## 검토 범위 요약

이번 delta 는 두 파일에 걸쳐 있다.

- `spec/5-system/6-websocket-protocol.md` (70줄 변경): §4 하위 섹션 재번호. origin/main 에는
  `### 4.4` 헤딩이 **"사용자 입력 대기 이벤트 상세"** 와 **"알림 이벤트"** 두 곳에 중복
  부여돼 있었다(문서 순서상 KB 문서 이벤트(§4.3)가 사용자 입력 대기(§4.4) *뒤*에 위치해
  물리적 순서와 번호가 어긋나 있었음). 본 변경은 KB 문서 이벤트를 §4.2 직후(새 §4.3)로
  이동시키고, 이후 알림 이벤트(§4.4→4.5)·시스템 이벤트(§4.5→4.6)·외부 표면 매핑(§4.6→4.7)을
  순차 재번호했다. `## 1. 연결`/`Rationale` 등 문서 내부 상호참조도 함께 갱신됨.
- `spec/5-system/14-external-interaction-api.md` (5줄 변경): (1) §11 의 WS 매핑 표 참조를
  `§4.6`→`§4.7` 로 갱신, (2) §8.2 HMAC 알고리즘 화이트리스트 서술을 `hmac-sha256 만` 에서
  `hmac-sha256 / hmac-sha512 두 값` 으로 정정하고, inbound webhook(§12-webhook.md §4.2)의
  `sha256`/`sha512` 화이트리스트와 동일 알고리즘임을 명시 + 서명 스킴 버전(`v1=`)과
  `notification_secret_v2` 컬럼이 별개 축임을 명확화.
- 코드 diff 9개 파일 중 7개(`websocket.service.ts` 등 4개 + `chat-channel.dispatcher.*`/`types.ts`
  3개)는 위 재번호에 맞춘 JSDoc/테스트 설명 문구 동기화(§4.4→§4.5 주석 갱신, "line NNN" 앵커
  제거)이며 동작 변경은 없다. 나머지 2개(`workflow-assistant.controller.ts` +
  신규 `*.swagger.spec.ts`)는 `spec/conventions/swagger.md §2-4` 401 문서화 규약을 따르기
  위한 컴플라이언스 보강으로, 이번 target(`spec/5-system/`) scope 와 무관한 별도 작업이다.

## 발견사항

- **[INFO]** 재번호 diff 와 무관한 코드 변경이 같은 커밋 범위에 포함됨
  - target 위치: 구현 diff `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts` + 신규 `workflow-assistant.controller.swagger.spec.ts`
  - 충돌 대상: 없음 (`spec/conventions/swagger.md §2-4` 기존 규약 준수 보강일 뿐, `spec/5-system/6-websocket-protocol.md`/`14-external-interaction-api.md` 와는 무관)
  - 상세: `spec/5-system/` scope 로 선언된 이번 검토 대상과 직접 관련 없는 workflow-assistant 401 문서화 보강이 같은 diff 에 섞여 있다. cross-spec 관점의 모순은 없으나(오히려 기존 convention 준수 방향), scope 밖 변경이 이 세션의 diff 에 왜 포함됐는지는 별도로 확인할 가치가 있다(다른 병렬 작업의 혼입 가능성).
  - 제안: 조치 불요. 병합 전 이 파일들이 이번 plan 항목의 의도된 산출물인지만 확인.

- **[INFO]** §4 재번호가 여러 문서에 걸친 앵커 무결성을 요구하지만 실제로는 전량 정합
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.3~§4.7 헤딩 번호
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/3-ai/1-ai-agent.md`,
    `spec/4-nodes/6-presentation/0-common.md`, `spec/5-system/4-execution-engine.md`,
    `spec/5-system/15-chat-channel.md`, `spec/conventions/conversation-thread.md`,
    `spec/conventions/interaction-type-registry.md`, `spec/conventions/chat-channel-adapter.md`,
    `spec/conventions/data-hydration-surfaces.md`, `spec/data-flow/8-notifications.md` 등
    `6-websocket-protocol.md` 를 앵커 링크로 참조하는 전 영역
  - 상세: `git -C <worktree> grep`으로 `#44-…`/`#45-…`/`#46-…` 구 앵커를 전수 검색한 결과,
    변경되지 않은 번호(§4.4 "사용자 입력 대기", §4.3 "KB 문서 이벤트")를 가리키는 참조는
    그대로 유효하고, 번호가 바뀐 세 섹션(§4.4→4.5 알림, §4.5→4.6 시스템, §4.6→4.7 외부 매핑)에
    대한 stale 앵커는 **0건** 발견됐다. 흥미롭게도 `spec/data-flow/8-notifications.md` (이번
    diff 로 건드리지 않은 파일)는 이미 `#45-알림-이벤트-server--client` 를 참조하고
    있었는데, origin/main 기준으로는 그 섹션이 실제로는 §4.4 였으므로 **이 PR 이전에는
    dangling 앵커**였다 — 이번 재번호가 그 참조를 사후적으로 유효하게 만들었다(회귀 아님,
    부수적 정합화).
  - 제안: 조치 불요. 정보 제공 목적 — 재번호 작업이 전 영역 앵커 무결성을 실제로
    유지했음을 실측으로 확인.

- **[INFO]** HMAC 알고리즘 확장 서술이 실제 구현·자매 spec 과 정합
  - target 위치: `spec/5-system/14-external-interaction-api.md` §8.2 "HMAC 검증 일반 규약"
  - 충돌 대상: `spec/5-system/12-webhook.md` §4.2 (`config.algorithm` 허용 목록 `sha256`/`sha512`)
    + `codebase/backend/src/modules/external-interaction/notification-signature.util.ts`
  - 상세: 신규 서술("`hmac-sha256`/`hmac-sha512` 두 값만, inbound webhook 과 동일 두
    알고리즘")을 `12-webhook.md §4.2` 원문(`config.algorithm` 은 `sha256`, `sha512` 만 허용)과
    대조 — 일치. 코드도 `SupportedHmacAlgorithm = 'hmac-sha256' | 'hmac-sha512'` 로 이미
    두 값을 지원 중이라(사전 구현, 이번 diff 로 신설된 기능 아님) 문서가 뒤늦게 구현 현실을
    반영한 것으로, 신규 API 계약 충돌은 없다.
  - 제안: 조치 불요.

CRITICAL/WARNING 등급 발견사항 없음 — 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층
책임 6개 관점 전부에서 다른 spec 영역과의 직접 모순을 발견하지 못했다.

## 요약

이번 target 은 기능·계약 변경이 아니라 **문서 위생 수정**이다 — origin/main 에 있던 진짜
결함(같은 문서 안에서 `### 4.4` 헤딩이 두 개의 서로 다른 섹션에 중복 부여된 것)을 KB 문서
이벤트 섹션 재배치 + 후속 3개 섹션 순차 재번호로 해소했고, `14-external-interaction-api.md` 의
교차참조와 HMAC 알고리즘 화이트리스트 서술을 그에 맞춰 정정했다. `spec/**` 전역에서
`6-websocket-protocol.md` 를 앵커로 참조하는 모든 위치(대화 스레드·AI Agent·채팅 채널·
실행 엔진·워크플로우 에디터 등 10여개 파일)를 전수 검색했으나 stale 앵커나 번호 불일치는
발견되지 않았고, 오히려 사전에 존재하던 `data-flow/8-notifications.md` 의 앞선 참조 하나를
사후적으로 유효하게 만드는 긍정적 부수효과가 있었다. HMAC 알고리즘 확장 서술도 자매 문서
(`12-webhook.md`)·실제 코드와 정확히 일치한다. 유일한 관찰 사항은 이번 target scope 와 무관한
`workflow-assistant` 401 문서화 코드 변경이 같은 diff 범위에 섞여 있다는 점인데, 이는 기존
`swagger.md` 규약 준수 보강이라 cross-spec 모순을 일으키지 않으며 정보성 관찰로만 기록한다.

## 위험도

NONE
