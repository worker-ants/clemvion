# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** `buttonId` 에러 메시지에 사용자 입력값 포함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/button-interaction-98791d/codebase/backend/src/modules/execution-engine/button-interaction.service.ts` — `resolveButtonInteraction()` 내 `throw new Error(\`INVALID_BUTTON_ID: Button ${buttonId} not found\`)`
  - 상세: `buttonId` 는 클라이언트가 전송한 값이다. 해당 문자열이 에러 메시지에 그대로 포함되면, 에러가 로그·클라이언트 응답으로 전파될 때 원본 입력이 노출된다. 현재 구현에서는 에러를 상위에서 어떻게 처리하는지(응답 직렬화 여부)가 이 파일 범위 내에서는 확인되지 않으나, 잠재적 정보 노출(CWE-209) 경로다.
  - 제안: 에러 메시지에서 실제 `buttonId` 값 제거. `throw new Error('INVALID_BUTTON_ID')` 만으로 충분하며, 상세 디버그 정보는 서버 측 로거(별도 채널)에 기록하는 방식으로 분리.

- **[INFO]** `payload as ButtonClickPayload` 강제 캐스트 — 런타임 입력 검증 부재
  - 위치: `processButtonResumeTurn()` 내 `resolveButtonInteraction(payload as ButtonClickPayload, …)`
  - 상세: `payload: unknown` 이 TypeScript 레벨에서만 캐스트되고, 런타임에서는 `isButtonClickPayload()` 가 `payload.type === 'button_click'` 만 확인한다. `buttonId` 필드 자체는 `string | undefined` 로 선언되어 있고, `resolveButtonInteraction` 내부에서 `payload.buttonId!` (non-null assertion) 로 사용된다. 만약 continuation-bus 가 외부 입력(예: 외부 채널, 웹소켓 메시지)을 직접 전달한다면, `buttonId` 가 `string` 이 아닌 값(객체, 배열 등)일 때 `buttons.find((b) => b.id === buttonId)` 비교에서 예상치 못한 동작이 발생할 수 있다.
  - 제안: `resolveButtonInteraction` 진입 시 `typeof buttonId !== 'string'` 또는 길이/패턴 검증을 추가. `buttonId` 가 외부 비신뢰 소스에서 온다면, 캐스트 이전 상위 레이어(컨트롤러/게이트웨이)에서 Joi/class-validator 스키마 검증을 먼저 적용하는 것이 권장된다.

- **[INFO]** `outputItems[itemIndex]` — 배열 인덱스 범위 미검증
  - 위치: `resolveButtonInteraction()` 내 `outputItems[itemIndex]`
  - 상세: `buttonItemMap[buttonId]` 값이 `outputItems` 배열 범위를 초과하는 경우 `selectedItem` 은 `undefined` 가 되어 조건부 spread 로 제외된다. 악성 클라이언트가 `buttonItemMap` 을 임의 조작할 수 없다는 전제(buttonItemMap 은 서버 측에서 계산된 값)가 유지된다면 실질 위험은 낮다. 단, 해당 전제가 무너지는 경로(외부 입력이 buttonItemMap 에 도달하는 경우)가 존재하면 배열 밖 접근 의도에 대한 검증이 필요하다.
  - 제안: `buttonItemMap` 이 서버 사이드에서만 생성됨을 아키텍처 문서에 명시. 외부 입력 경로가 추가될 경우 `itemIndex >= 0 && itemIndex < outputItems.length` 명시적 검증 추가.

- **[INFO]** `node.config` 가 `appendPresentationInteraction` 에 전달 — 민감 설정 노출 가능성
  - 위치: `processButtonResumeTurn()` 내 `this.conversationThreadService.appendPresentationInteraction(context, { node: { …, config: node.config }, … })`
  - 상세: `node.config` 는 워크플로 설계 시점의 설정 객체 전체를 포함할 수 있다. 이 데이터가 ConversationThread 를 통해 AI Agent 컨텍스트로 주입되거나 외부 채널로 전달되면, 내부 설정(예: API 엔드포인트, 내부 ID 등)이 의도치 않게 노출될 수 있다. 현재 코드만으로는 `node.config` 의 구체적 내용을 확인할 수 없으나, 데이터 흐름 상 잠재 리스크다.
  - 제안: ConversationThread 에 전달되는 `node.config` 필드가 민감 정보를 포함하지 않는지 검토. 필요시 allowlist 기반 필터링 적용.

## 요약

이번 변경은 `resolveButtonInteraction` 와 `buildResumedStructuredOutput` 순수 함수 추출 및 관련 단위 테스트 추가가 핵심이다. 신규 코드에는 SQL 인젝션·XSS·커맨드 인젝션·하드코딩 시크릿·인증 우회·암호화 문제가 없다. 의존성도 새로 추가된 것이 없다. 지적된 사항은 모두 INFO 등급으로, 에러 메시지에 사용자 입력 `buttonId` 가 그대로 포함되는 점과 외부 payload 에 대한 런타임 타입 검증 부재가 주요 개선 여지다. 이 두 가지는 continuation-bus 의 신뢰 경계가 명확히 서버 내부라면 즉각적 위협은 아니지만, 외부 채널(웹소켓, REST) 입력이 직접 `payload` 로 유입되는 경우 방어적 코딩이 필요하다. 전반적으로 보안 위험도는 낮다.

## 위험도

LOW
