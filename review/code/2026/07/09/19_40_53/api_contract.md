# API 계약(API Contract) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침 히스토리
> 복원. 본 changeset 페이로드에는 실제 `codebase/**` 소스 diff 가 직접 포함되어 있지 않고, 앞선 5개 코드 리뷰
> 라운드 산출물(requirement/scope/security/side_effect/testing, `19_26_15`)·consistency-check 산출물
> (`18_27_06`)·spec 문서 diff(`14-external-interaction-api.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`)
> 만 라우팅되어 있다(이전 라운드에서 이미 코드가 리뷰된 뒤의 후속 커밋이라 changeset 이 코드를 제외한 것으로
> 보임 — 메모리 "리뷰 changeset이 직전 검토 코드 제외" 패턴과 일치). 아래는 이 페이로드에 인용된 코드 근거
> (라인 번호·조건문 포함)와 spec diff 원문을 근거로 API 계약 관점만 독립 재분석한 결과다.

## 발견사항

- **[INFO]** `GET /api/external/executions/:id` 응답에 `context.conversationThread` additive 확장 — 하위 호환성은 안전하나 "키 생략 vs null" 이 형제 필드 관례와 다름
  - 위치: `spec/5-system/14-external-interaction-api.md` §5.3/§R17 (`context.conversationThread`), 코드 근거(리뷰 인용)
    `codebase/backend/src/modules/external-interaction/interaction.service.ts:256-297` (`getStatus()`,
    `...(conversationThread ? { conversationThread } : {})` 조건부 스프레드)
  - 상세: 신규 필드는 `waiting_for_input` 이고 durable thread 가 있을 때만 **키 자체가 존재**하고, 없으면 키가
    아예 생략된다. 반면 같은 `context` 객체의 형제 필드(`interactionType`/`waitingNodeId`/`buttonConfig`/
    `nodeOutput`)는 해당 없음일 때 `null` 값으로 채워지는 관례를 따른다(이미 requirement.md/security.md 리뷰에서
    지적된 지점을 API 계약 축에서 재확인). `ExecutionStatusDto.context` 타입이 이미 `Record<string, unknown> | null`
    로 개방형이라 이번 변경으로 Swagger 시그니처 자체는 깨지지 않지만, 이는 역으로 `conversationThread` 필드의
    존재/부재/타입이 OpenAPI 스키마에 **형식적으로 문서화되지 않는다**는 뜻이기도 하다(별도 DTO 클래스 없음).
    다만 이 "present-when-available" 설계는 spec 이 명시하듯 SSE `waiting_for_input` wire 형식과 **의도적으로
    parity 를 맞춘 것**이고, 하위 호환성 자체(기존 클라이언트가 신규 optional 필드를 무시)에는 영향이 없다.
  - 제안: 조치 필수 아님. 후속으로 (a) `context` 를 위한 전용 DTO/스키마 클래스를 도입해 Swagger 상에서
    `conversationThread` 의 존재/타입을 명시하거나, (b) 최소한 스펙 문서(`14-external-interaction-api.md` §5.3
    JSON 예시)에 "present-when-available, 없으면 키 생략" 문구를 코드 예시 옆에 한 줄 더 명시하면 제3자 API
    소비자의 타입 정의(옵셔널 vs nullable) 실수를 줄일 수 있다.

- **[INFO]** `getStatus` — durable thread 존재 + 대기 `NodeExecution` 부재/`node` relation 없음 조합에서 `context` 전체가 `null` 로 떨어져 `conversationThread` 가 조용히 드롭됨 (테스트 미고정, API 계약상 edge case)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:260-296` — `conversationThread`
    는 `if (execution.status === WAITING_FOR_INPUT)` 블록 최상단에서 계산되지만, `context` 조립 자체는 중첩된
    `if (nodeExec?.node)` 안에서만 발생(testing.md INFO, round 2/3 반복 지적·미해소·우선순위 낮음으로 defer 확정)
  - 상세: spec §R17 은 "`waiting_for_input` 상태면 durable thread 를 동봉한다"고 서술하는데, 구현은 여기에 암묵적
    선결 조건("대기 `NodeExecution` 이 실제로 존재하고 `node` relation 이 로드됨")을 하나 더 두고 있다. 도달
    가능성이 낮은 데이터 정합성 극단 케이스(실행 엔진 불변식상 `waiting_for_input` 이면 대기 NodeExecution 이
    항상 있어야 함)라 CRITICAL 급 계약 위반은 아니지만, 이 조건이 spec 본문에 명문화되어 있지 않고 테스트로도
    고정되어 있지 않다는 점은 "응답 형식의 스펙-구현 완전 일치" 관점에서 미세한 갭이다.
  - 제안: 우선순위 낮음(이미 testing.md 가 동일 지적을 defer 로 기록). 여력이 되면 spec §5.3/§R17 에 "대기
    NodeExecution 자체가 유실된 극단 케이스에서는 `context` 전체가 `null` 로 fail-safe 한다"는 한 줄만 추가해
    구현-스펙 간극을 문서화하면 충분하다.

- **[INFO]** `wc:event` `conversationEnded.data.reason` 이 닫힌 enum 이 아닌 열린 문자열로 확장 — host SDK 계약 관점에서 forward-compatible 하게 잘 설계됨
  - 위치: `spec/7-channel-web-chat/2-sdk.md` (`wc:event` 표, `conversationEnded.data.reason`), 코드 근거(인용)
    `codebase/channel-web-chat/src/widget/use-widget.ts:432` (`sendEvent("conversationEnded", { reason: "user_ended" })`)
  - 상세: 기존에는 SSE terminal 이벤트명(`execution.completed`/`failed`/`cancelled`)이 `reason` 값으로 쓰였는데,
    이번 diff 로 위젯 로컬 종료 사유(`user_ended`/`gone`)가 추가됐다. `2-sdk.md` 표는 이미 "**열린 문자열**(닫힌
    enum 아님) ... host 는 특정 값에 강결합하지 말고 '종료됨' 신호로만 소비" 라고 diff 자체에서 명시하고 있어,
    본 changeset 은 이 확장을 사전에 문서화한 상태로 반영했다 — SDK 계약을 깨는 breaking change 가 아니라 모범적인
    open-string 확장 패턴이다.
  - 제안: 없음(양호, 참고 기록).

- **[INFO]** Cross-spec consistency-check(18_27_06) 이 지적한 "이전 execution TTL/idle 만료" 문구(실행엔진 무기한 보존 불변식과 문면 충돌, WARNING)는 최종 diff에서 이미 "**토큰만** TTL/idle 만료"로 수정 완료 확인 — API 계약 자체에 잔여 영향 없음
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "새 대화 (restart)" 행
  - 상세: 이 이슈는 REST/SSE 응답 스키마나 상태 코드가 아니라 "새 대화" UX 흐름의 서술 정밀도에 관한 것이라
    API 계약의 핵심 축(스키마·상태코드·인증) 자체에는 해당하지 않지만, `end_conversation`/`cancel` 커맨드가
    선택적으로만 호출되는(명시 종료 없이 세션을 버릴 수 있는) API 사용 패턴이 존재함을 문서화한다는 점에서
    참고용으로 기록한다. 최종 diff(`1-widget-app.md:1410`)는 "위젯 측 **토큰만** TTL/idle 로 만료"로 정확히
    스코프되어 있고, 실행 엔진의 `waiting_for_input` 무기한 보존 불변식과의 충돌은 해소됐다.
  - 제안: 조치 불필요(이미 반영 확인).

## API 계약 관점 체크리스트 확인

1. **하위 호환성**: `context.conversationThread` 는 순수 additive optional 필드다(신규 엔드포인트·기존 필드 제거/타입 변경 없음). 프런트 소비 경로(`threadToMessages`)도 필드 부재를 빈 배열로 graceful 처리해 구버전 위젯↔신버전 백엔드 조합에서도 안전 — breaking change 없음.
2. **버전 관리**: 본 프로젝트 EIA API 는 별도 버전 스킴 없이 spec `## Rationale` 절(R17 addendum)로 변경 이력을 남기는 기존 컨벤션을 그대로 따랐다. 필드 additive 확장은 무버저닝 상태에서도 안전한 확장 유형이라 컨벤션 위반 아님.
3. **응답 형식**: 대체로 기존 wire 계약(SSE `waiting_for_input` payload)과 parity 를 맞춰 일관성 있으나, "키 생략 vs null" 관례가 같은 `context` 객체 안에서 필드별로 갈리는 점(위 INFO #1)과 대기 NodeExecution 부재 시 `context` 전체가 조용히 `null` 로 드롭되는 edge case(위 INFO #2)는 스키마 완전성 관점에서 사소하지만 실존하는 간극이다.
4. **에러 응답**: 이번 diff 로 신규 에러 시나리오·상태 코드는 추가되지 않았다. 기존 `410 Gone`(EIA-IN-12, interact 전용)·`404 EXECUTION_NOT_FOUND`·`401`(jti blacklist vs 만료 구분 불가 → 낙관적 refresh 1회) 처리 로직은 무변경으로 유지된다.
5. **요청 검증**: `GET /api/external/executions/:id` 는 read-only 조회이고 이번 diff 로 신규 요청 파라미터/바디가 추가되지 않았다 — 해당 없음.
6. **URL/경로 설계**: 신규 엔드포인트·경로 변경 없음. 기존 RESTful 리소스 경로(`/api/external/executions/:id`) 그대로 재사용 — 문제 없음.
7. **페이지네이션**: 목록 API 변경 없음. 다만 `conversationThread.turns[]` 는 execution 이 `waiting_for_input` 상태로 무기한 보존될 수 있다는 실행 엔진 불변식과 결합하면 이론상 매우 긴 대화의 전체 turn 배열을 단일 REST 응답으로 반환하게 될 잠재적 여지가 있다. 이번 3라운드 코드 리뷰·consistency-check 어디에서도 이를 blocking 이슈로 지적하지 않았고(SUMMARY.md 상 "payload truncation" 관련 INFO 는 본 PR 범위 밖 pre-existing 으로 명시), 실사용 대화 길이가 매우 길어지는 시나리오가 현재 스코프 밖이라는 판단으로 보인다 — 다만 향후 장기 실행 대화가 실제로 누적되면 응답 크기 상한/truncation 정책을 검토할 필요가 있다는 점만 참고로 남긴다(차단 사유 아님).
8. **인증/인가**: `InteractionGuard`(`iext_*`/`itk_*` 토큰 ↔ URL `:executionId` 바인딩)가 이번 diff 로 전혀 변경되지 않았고, 신규로 노출되는 `conversationThread` 데이터도 이미 동일 execution 에 대해 SSE `waiting_for_input` 이벤트로 공개되던 것과 동일 wire shape 라 인가 경계 밖 데이터 노출(IDOR)은 발생하지 않는다(security.md 리뷰 근거와 일치).

## 요약

이번 changeset 의 API 계약 관련 핵심 변경은 `GET /api/external/executions/:id`(EIA `getStatus`) 응답에
`context.conversationThread` 를 durable 스냅샷으로 조건부 additive 노출한 것과, `wc:event conversationEnded.data.reason`
을 열린 문자열로 확장·문서화한 것 두 가지다. 둘 다 기존 클라이언트를 깨뜨리지 않는 순수 확장이며, 신규 엔드포인트·
경로·요청 파라미터·에러 코드·인증 메커니즘 변경이 없다. 3라운드에 걸친 선행 코드 리뷰(Critical 0, WARNING 8건 전량
반영)와 cross-spec consistency-check(WARNING 1건 — 실행엔진 보존 불변식과의 문구 충돌 — 이미 "토큰만" 한정어로
수정 완료)가 이미 이 표면을 상세히 검증했고, 독립 재검토 결과 새로운 CRITICAL/WARNING 급 API 계약 위반은 발견되지
않았다. 잔여 관찰사항은 모두 INFO 수준으로 (1) `conversationThread` 필드의 "키 생략 vs null" 관례가 형제 필드와
다르다는 점(Swagger 상 미문서화 포함), (2) 대기 NodeExecution 부재라는 극단 edge case 에서 `context` 전체가
조용히 드롭되는 동작이 spec 본문에 명문화·테스트로 고정되어 있지 않다는 점, (3) 장기 보존되는 대화의
`conversationThread.turns[]` 배열 크기 상한이 아직 정책화되어 있지 않다는 점(현재 스코프 밖)이다. 모두 조치를
강제할 사유는 아니다.

## 위험도
LOW
