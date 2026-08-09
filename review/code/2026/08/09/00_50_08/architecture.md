# 아키텍처(Architecture) Review

## 조사 방법

프롬프트에 담긴 34개 항목(대부분 "프롬프트 크기 제한으로 전체 파일 미포함") 을 개별적으로
`Read` 로 열어보는 대신, 이 브랜치(`backend-lint-gate`)가 실제로 무엇을 바꿨는지 먼저
`git diff origin/main...HEAD` 로 확인했다. 프롬프트가 "전체 파일 컨텍스트"로 보여준 내용은
**변경분이 아니라 현재 상태 전체**이므로, 아키텍처 판단은 실제 diff hunk 기준으로 했다
(위치 표기 규약에 따라 게이트 숫자가 있는 파일은 그 번호를, diff 로만 확인한 파일은 함수/블록
설명으로 기재).

프롬프트에 나열된 34개 파일(`websocket.service.ts` ~ `plan/in-progress/backend-lint-gate-broken-on-main.md`)
전량에 대해 `git diff`를 대조했다.

## 변경의 성격

커밋 이력(`61645dcf8` prettier, `6501efb4f` no-unnecessary-type-assertion 자동수정,
`ba8ce35a4` 고아 import·로드베어링 assertion 정리)과 diff 내용이 일치한다. 이 배치에 포함된
33개 코드 파일의 변경은 예외 없이 다음 세 유형 중 하나다.

1. **불필요 타입 단언 제거** — `x as T` → `x` (TS 가 이미 좁혀주는 곳). 예:
   `resolve-dynamic-ports.ts`(`presentationButtonPorts`/`resolveEffectiveOutputPorts` 의
   `type: p.type as ResolvedPortType` → `type: p.type`), `node-component.registry.ts`
   (`serializeMetadata`), `conversation-context-injection.ts`(`mapTurnsToChatMessages` 5개
   케이스 + `injectConversationContext`), `websocket.service.ts`, `cafe24-api.client.ts`,
   `makeshop-api.client.ts`, `render-tool-provider.ts` 등.
2. **prettier 유니언 타입 개행 병합** — `| 'a'\n| 'b'` 형태를 한 줄로 (`shadow-workflow.ts`
   의 `ShadowToolName`, `cafe24/metadata/types.ts`·`makeshop/metadata/types.ts`·
   `cafe24/metadata/public-meta.ts`·`conversation-thread.types.ts` 등). 타입 구조·유니언
   멤버는 완전히 동일, 개행만 바뀜.
3. **고아 import 제거** — `Cafe24Method`/`MakeshopMethod` import 제거(사용처의 `as Cafe24Method`
   /`as MakeshopMethod` 단언이 함께 제거되며 타입만 참조하던 import 가 미사용이 됨).
   `cafe24.handler.ts`·`makeshop.handler.ts`.

이 배치 밖(다른 리뷰어 배치로 추정)의 `telegram-client.ts` 는 동일 계열 정리 중 유일하게
**로드베어링 assertion 을 되돌린** 사례(`no-base-to-string` 오탐 방어, 근거 주석 + eslint-disable
추가)였으나, 본 배치 파일 목록에는 없다.

## 점검 관점별 평가

1. **SOLID** — 클래스/함수의 책임, 시그니처, 생성자 의존성 주입 방식 전부 무변경. 단언 제거는
   런타임 동작에 영향이 없는 컴파일 타임 표현 변경뿐이다.
2. **결합도/응집도** — 모듈 간 import 그래프는 3건의 고아 import 제거만 있고, 이는 이미 죽은
   참조를 지운 것이라 결합도를 오히려 줄였다(순영향 없음).
3. **레이어 책임** — `AiMemoryManager`(node 레이어 오케스트레이터) ↔ `AgentMemoryService`
   (persistent I/O) 경계, `conversation-context-injection.ts`(공통 노드-무관 순수 변환) 등
   기존 레이어 분리 주석·구조 그대로 유지. 변경 없음.
4. **디자인 패턴/안티패턴** — 신규 패턴 도입도, 안티패턴 유입도 없음.
5. **순환 의존성** — import 제거만 있고 신규 import 는 없어 순환 참조 위험 없음.
6. **추상화 수준** — 인터페이스·타입 선언의 유니언 멤버·필드 구성은 100% 동일, 단지 줄바꿈
   스타일만 바뀜.
7. **모듈 경계** — 파일 간 경계·공개 API 표면 무변경.
8. **확장성** — 영향 없음.

## 발견사항

없음. (33개 코드 파일 전량이 동작 보존 컴파일-타임 전용 변경이며, 구조·책임·의존 그래프에
어떤 영향도 주지 않는다.)

## 요약

본 배치는 `backend-lint-gate` 작업의 일부로, ESLint `no-unnecessary-type-assertion` 자동수정
결과물과 그로 인해 발생한 고아 import 를 정리하고 prettier 3.9 유니언 타입 포맷을 적용한
**순수 기계적, 동작 보존(behavior-preserving) diff**다. 클래스 책임·레이어 경계·의존성 방향·
디자인 패턴·모듈 공개 표면 중 어느 것도 변경되지 않았다. 아키텍처 관점에서 검토할 실질적
표면이 없다.

## 위험도

NONE
