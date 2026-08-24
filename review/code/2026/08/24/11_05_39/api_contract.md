# API 계약(API Contract) 리뷰

## 개요

이번 변경의 핵심은 `execution.node.completed`/`.failed` 의 SSE/fanout(외부 webhook·SSE 구독자용)
`envelope.output` 필드에 기존(`#1208`) `waiting_for_input` 표면과 동일한 fail-closed
allowlist(`NODE_OUTPUT_ALLOWED_KEYS`)를 적용하는 보안/계약 강화다. 코드 변경은
`codebase/backend/src/modules/websocket/websocket.service.ts` 의
`allowlistFanoutNodeOutput`/`narrowTopLevelNodeOutput` 뿐이고, 나머지는 spec(EIA §R17,
WS §4.1/§4.4)·plan·CHANGELOG·consistency-check 산출물 동기화다.

## 발견사항

- **[WARNING]** CHANGELOG 의 breaking-change 고지가 새로 닫힌 `envelope.output` 표면을 명시적으로 지칭하지 않는다
  - 위치: `CHANGELOG.md:30-38` (게이트, 2026-08-24 신규 정정 블록) — 참고로 기존 문장은 `CHANGELOG.md:46`
  - 상세: `#1208` 때 남긴 "**외부 수신자에게는 동작 변경이다** — SSE/webhook payload 의 `nodeOutput`
    최상위에서 목록 밖 키가 사라진다(엔진 내부 `_retryState` 등)"(`CHANGELOG.md:46`) 문장은 인용
    블록 중첩 구조상 `nodeOutput`(`waiting_for_input`) 표면 전용으로 스코프돼 있다. 이번 PR 이
    같은 CHANGELOG 항목 안에 추가한 2026-08-24 중첩 정정(게이트 33-38)은 *"그 표면(`envelope.output`)
    도 같은 목록으로 닫혔다"* 는 사실만 적을 뿐, `execution.node.completed`/`.failed` 구독자에게도
    동일한 강도의 *"과거에 이미 `_retryState` 등이 노출됐을 수 있다"* 는 운영 영향 고지를 새로
    달지 않는다. 실질 영향은 e2e 285건 + 실 DB 조회로 회귀 없음이 확인됐고 근거도 충분하지만,
    CHANGELOG 를 훑는 제3자 API 소비자 입장에서는 이 표면도 breaking-change 대상이라는 사실을
    놓치기 쉽다(REST `getStatus` 최초 발견 때는 `CHANGELOG.md:13-15` 에 전용 "운영 영향" 콜아웃이
    따로 있었던 것과 대조적).
  - 제안: `execution.node.completed`/`.failed` 외부 SSE/webhook 구독자 대상으로도 "과거 응답에
    `_retryState` 등 목록 밖 필드가 이미 노출됐을 수 있다"는 문장을 명시적으로 추가.

- **[INFO]** 잔여 위험(flat 폴백 shape)은 이미 인지·캐너리·백로그로 적절히 처리됨 — 확인만, 조치 불요
  - 위치: `plan/in-progress/node-output-envelope.md:77-87` (게이트), `spec/5-system/14-external-interaction-api.md:1794-1799` (게이트)
  - 상세: `ai-turn-orchestrator.service.ts` 의 `finalAdapted ?? context.nodeOutputCache[node.id]`
    폴백이 `outputData` 에 flat view(`{parameters: {}}` 류)를 쓸 경우, 그 shape 은
    `NODE_OUTPUT_ALLOWED_KEYS` 밖 키(`parameters`/`items` 등)를 갖고 있어 fail-closed 원칙에 따라
    조용히 소실된다. e2e 285건 실측에서는 미발현이지만 코드 경로로는 살아 있다. 이번 PR 은 이를
    은폐하지 않고 캐너리 테스트(`[잔여 고정] flat 폴백 shape 이 오면 목록 밖 키는 떨어진다`)로 현재
    fail-closed 동작을 명시적으로 고정하고, "flat view 를 `outputData` 로 영속하는 것이 옳은가"라는
    더 근본적인 영속 계약 질문은 별건 트래커 항목으로 분리했다. API 응답 스키마 관점에서 적절한
    처분이다.

- **[INFO]** API 계약 spec(EIA §R17 / WS §4.1·§4.4) 수정 권한 경계 — 이미 consistency-check 가 CRITICAL 로 다루고 처분함 (참고용, 이 리뷰 소관 밖)
  - 위치: `review/consistency/2026/08/24/10_44_28/SUMMARY.md`, `review/consistency/2026/08/24/10_44_28/RESOLUTION.md`
  - 상세: `plan/in-progress/node-output-envelope.md` 의 `spec_impact` 가 API 계약 문서(EIA §R17,
    WS §4.4 — 자기-반증형 소정정 예외 조건 2 의 명시적 제외 대상)와 `conversation-thread.md`(예외
    적용 대상)를 같은 frontmatter 아래 나열해, "developer 턴이 API 계약 spec 을 예외 없이 직접
    수정했다"는 CRITICAL 을 유발했다. `RESOLUTION.md` 는 두 파일을 plan 체크리스트의
    "(planner 턴)" 항목으로 재분류하고 frontmatter 주석을 두 블록으로 분리해 처분했으나, 실제로는
    같은 worktree·동일 git identity(`worker-ants`)의 연속 커밋(`e6a017a18` → `970cac5cf`)으로
    이뤄져 있어 별도 planner 세션이 실재했는지는 커밋 이력만으로 구분되지 않는다(선례 `#1204`·
    `#1208` 을 근거로 반박함). 이는 developer 권한 밖의 절차 판단이라 이 API-contract 리뷰의
    조치 대상은 아니지만, API 계약 SoT(EIA/WS) 문서가 이번 PR 로 직접 갱신됐다는 점은 참고로 남긴다.

## 관점별 점검 결과

1. **하위 호환성**: `execution.node.completed`/`.failed` 의 `envelope.output` 에 처음으로 allowlist
   가 걸려, 목록 밖 필드(`_retryState` 등)가 더 이상 외부(SSE/webhook) 로 나가지 않는다 —
   기술적으로는 breaking change 다. 다만 (a) 제거 대상은 `_` 접두 내부 필드 컨벤션을 따르는
   비공개 필드, (b) e2e 285건 실행 후 실 postgres 조회(93행, object 84행)로 실사용 shape 이
   전부 allowlist 안임을 검증, (c) 공식 소비처(위젯·chat-channel) 양쪽 모두 영향 없음을 실측
   확인, (d) `NODE_OUTPUT_ALLOWED_KEYS` 는 `NodeHandlerOutput` 공개 키에 컴파일타임
   assertion 으로 결속돼 향후 핸들러 키 추가 시 자동으로 검토를 강제한다. 위 WARNING(CHANGELOG
   고지 범위) 외에는 하위 호환성 리스크가 낮게 관리됐다.
2. **버전 관리**: 이 프로젝트는 URL `/v1/` 버전 세그먼트를 쓰지 않는 컨벤션이다
   (`spec/5-system/14-external-interaction-api.md:685` 부근, API 규약 §1 참조). 이번 변경도 그
   컨벤션을 따라 별도 버전 세그먼트 없이 CHANGELOG 로 breaking-change 를 고지하는 기존 방식
   (`#1205`/`#1208` 과 동일 패턴)을 유지한다. 문제 없음.
3. **응답 형식**: `execution.node.completed`/`.failed` 의 wire `output` 필드가 실은
   `NodeExecution.outputData`(=`NodeHandlerOutput` 래퍼) 전체이지 도메인 값 자체가 아니라는
   기존 spec 문서(WS §4.1)의 서술 오류(한 겹 얕음)도 이번 PR 에서 함께 바로잡았고
   (`spec/5-system/6-websocket-protocol.md` §4.1 표), `.failed` 행에 누락돼 있던 `output` 열도
   추가했다 — 응답 스키마 문서 정확도가 개선됐다.
4. **에러 응답**: 이번 변경은 에러 응답 경로를 건드리지 않는다. `execution.node.failed` 의
   `error` 필드 구조·HTTP/이벤트 코드 체계는 변경 없음.
5. **요청 검증**: 해당 없음 — 이 PR 은 요청 파라미터/바디를 다루지 않는다(응답 fanout 필터링만).
6. **URL/경로 설계**: 해당 없음 — 신규/변경 엔드포인트 없음.
7. **페이지네이션**: 해당 없음.
8. **인증/인가**: 직접적인 인증/인가 로직 변경은 없으나, 이미 인증된 외부 채널(SSE 토큰 보유자·
   webhook 구독자)에게 노출되는 데이터의 *범위*를 좁히는 방어 강화로, 인가 경계와 인접한
   개선이다. 내부 WS(에디터)는 이번 필터 대상이 아님을 캐너리로 명시적으로 고정해 둔 것도 적절
   (`websocket.service.spec.ts` 의 "내부 WS 는 안 바뀐다" 대조군 단언).

## 요약

`execution.node.completed`/`.failed` 의 `envelope.output` 을 fail-closed allowlist 로 좁히는
API 응답 계약 강화 PR 이다. 실질적으로는 breaking change 지만, e2e 285건 + 실 DB 조회로 회귀
없음을 실증하고 공식 소비처 영향 없음을 확인했으며, spec(EIA §R17/WS §4.1·§4.4)·CHANGELOG·
plan·캐너리 테스트·뮤테이션 검증까지 같은 PR 안에서 동기화해 spec-impl drift 를 남기지 않았다.
유일한 개선 여지는 CHANGELOG 의 "외부 수신자 동작 변경" 고지가 새로 닫힌 `envelope.output`
표면을 전용으로 명시하지 않는다는 점(WARNING)이고, 잔여 폴백 리스크와 spec 수정 권한 경계는
이미 트래커·별도 consistency-check 게이트로 적절히 처분돼 있어 참고(INFO) 수준이다.

## 위험도

LOW
