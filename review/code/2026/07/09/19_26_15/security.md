# 보안(Security) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침 히스토리
> 복원. 핵심 변경 파일: `interaction.service.ts`(REST 응답 확장), `use-widget.ts`(신규 `endConversation` +
> gen guard), `conversation.ts`/`eia-types.ts`(wire source→role 매핑), `panel.tsx`(헤더 컨트롤+confirm UI).

## 발견사항

- **[INFO]** `GET /api/external/executions/:id` 응답에 durable `conversationThread` 신규 노출 — 인가 경계 무변경, 실질적 신규 민감 표면 아님
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:238-311` (`getStatus`)
  - 상세: 이 엔드포인트는 `InteractionGuard`(`interaction.guard.ts`)가 `iext_*`(토큰 `sub` == URL `:executionId`) /
    `itk_*`(URL `:executionId` 검증) 로 요청을 실행 단위로 스코핑하는 기존 인가 메커니즘을 그대로 사용하며,
    이번 diff 는 그 가드·라우트·인증 방식을 전혀 건드리지 않는다. 신규로 응답에 실리는
    `context.conversationThread` 데이터는 **동일 execution 에 대해 이미 SSE `waiting_for_input` 이벤트로
    공개되던 것과 동일 wire shape**이므로, REST 채널에 추가 노출한다고 해서 인가 범위를 벗어난 execution 의
    데이터를 노출하거나 새로운 IDOR 를 만들지 않는다(직접 코드 확인: `interaction.guard.ts:101-145` 가
    `req.params.executionId` 를 토큰과 매칭). "노드 핸들러가 민감 정보를 `outputData`/turn 텍스트에 남기면
    안 된다"는 기존 컨벤션이 JSDoc 으로 명문화(24-233행)됐으나, 이는 여전히 **코드 레벨 강제가 아닌 문서적
    계약**이라는 사전 한계가 그대로 유지된다.
  - 제안: 조치 불필요(위험 수준 무변화). 향후 노드 핸들러가 우발적으로 민감 데이터를 conversation turn
    텍스트에 기록하는 걸 막는 서버측 redaction/allowlist 를 도입하면 방어심화가 되지만, 이는 이번 PR 범위
    밖의 기존 설계 결정(이미 plan/RESOLUTION 에 backlog 로 추적 중)이라 이번 diff 의 신규 취약점은 아니다.

- **[INFO]** 위젯 메시지 렌더는 React 텍스트 노드로만 구성 — `conversationThread` 복원 경로에도 XSS 벡터 없음
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` (메시지 리스트 렌더, `{m.text}`),
    `codebase/channel-web-chat/src/lib/conversation.ts` (`roleOf`/`threadToMessages`)
  - 상세: 새로고침 복원 경로로 흘러드는 `conversationThread.turns[].text`(서버 durable 데이터, 임의 사용자
    입력 포함 가능)는 `dangerouslySetInnerHTML` 이 아닌 JSX 텍스트 자식(`{m.text}`)으로 렌더돼 React 가 자동
    이스케이프한다. `[user-input]…[/user-input]` strip 은 문자열 슬라이스일 뿐 HTML 파싱이 아니라 인젝션
    경로가 되지 않는다. (참고: 별도 모듈 `safe-html.ts` 가 DOMPurify+marked 로 template presentation 을
    렌더하는 경로는 존재하나 이번 diff 대상이 아니며 무변경.)
  - 제안: 없음(양호, 참고 기록).

- **[INFO]** `endConversation` 실패 시 `console.warn(e.message)` — 브라우저 로컬 콘솔 한정, 서버/제3자 노출 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:434-441`
  - 상세: 종료 명령(`interact`) 실패 시 에러 메시지를 브라우저 devtools 콘솔에만 출력한다(기존 파일의
    다른 `console.warn` 호출과 동일 패턴, 예: L92/L195/L244/L567). 서버로 재전송되거나 호스트 페이지 DOM 에
    노출되지 않으며, 대상 사용자 본인의 브라우저 콘솔이라 정보 노출 위험이 없다.
  - 제안: 없음.

- **[INFO]** optimistic 로컬 종료 — 서버측 명령 실패와 무관하게 클라이언트가 `[ended]`로 전이(가용성/정합 트레이드오프이지 인가 문제 아님)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:399-441` (`endConversation`)
  - 상세: `endConversation` 은 SSE 를 먼저 닫고 로컬 상태를 `ended` 로 전이한 뒤, best-effort 로 서버 종료
    명령(`end_conversation`/`cancel`)을 발사한다. 명령이 네트워크 실패·410 등으로 실패해도 서버 execution
    은 `waiting_for_input`/`running` 상태로 잔존할 수 있다. 이는 인증/인가 우회가 아니라(호출 자체는 여전히
    유효한 토큰으로 스코핑됨) 상태 정합성/자원 정리(orphan execution) 관점의 트레이드오프이며, spec
    §3.1 에 명시적으로 문서화되고 plan 잔여 항목("반복 '새 대화'로 인한 orphan 축적")으로 이미 추적 중이다.
    보안 심각도로 볼 사안은 아니다(다른 리뷰 축의 side_effect/architecture 영역이 더 적합).
  - 제안: 이번 PR 범위 밖. 기존 backlog(GC/아카이브 정책) 로 충분.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 전체 diff
  - 상세: API 키, 토큰, 비밀번호, 인증서 리터럴이 diff 전체에 존재하지 않는다. 세션 토큰은 기존
    `sessionRef.current.token` 을 그대로 재사용할 뿐 신규 하드코딩 지점이 없다.
  - 제안: 없음.

## 요약

이번 변경의 보안 표면은 두 갈래다. (1) 백엔드 `getStatus` REST 응답에 durable `conversationThread` 를
추가 노출하는 것은 기존 `InteractionGuard` 인가 경계(토큰↔executionId 바인딩) 내에서 이미 SSE 로 공개되던
동일 데이터를 additive 로 재노출하는 것이라 신규 인가 취약점이 아니며, 노드 핸들러의 민감정보 미기록
컨벤션도 JSDoc 으로 명확히 재확인됐다. (2) 프런트 위젯의 헤더 세션 컨트롤(새 대화/대화 종료)과 wire
source→role 매핑은 순수 UI/렌더 로직으로, 메시지 텍스트는 React 텍스트 노드로 렌더돼 XSS 벡터가 없고
신규 엔드포인트나 요청 스키마 도입도 없다(기존 `interact` 커맨드 재사용). 인젝션·하드코딩 시크릿·인증
우회·안전하지 않은 암호화·민감정보 에러 노출 등 CRITICAL/WARNING 급 항목은 발견되지 않았다.

## 위험도
NONE
