# 신규 식별자 충돌 검토 — Chat Channel Rules Cleanup (scope: `spec/5-system/`)

## 검토 방법

target payload 는 `spec/5-system/15-chat-channel.md` 전문을 bundle-file 로 실었으나, 실측 결과
**이 파일은 `origin/main` (`8964a7114`) 대비 diff 0** 이다 (`git diff origin/main -- spec/5-system/15-chat-channel.md` 무출력). 즉 이번 target 은 spec 에 **어떤 새 식별자도 도입하지 않는다** — 전체가 이미
여러 선행 PR (`#1311`~`#1324`)을 거쳐 병합·검토된 기존 내용이다.

실제 변경 주체는 같은 세션의 `plan/in-progress/chat-channel-rules-cleanup.md` (`spec_impact: none`)이며,
그 plan 이 도입을 예고하는 코드 수준 신규 식별자는 다음 2개뿐이다 (대상 파일: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`):

1. `throwInvalidField(field, message)` — 반복되는 `BadRequestException({code:'VALIDATION_ERROR', details:{field, code: ErrorCode.INVALID_FIELD}})` 패턴 11곳 치환용 헬퍼
2. `hasField` — 이중 캐스팅(`chatChannel as unknown as Record<string, unknown>`) 2곳(L100·L145) 치환용 헬퍼

이 둘에 대해 저장소 전체(`codebase/`, `spec/`)를 grep 하여 기존 사용처와의 충돌 여부를 확인했다.

## 발견사항

없음 — CRITICAL/WARNING 없음.

- **[INFO]** `hasField` 와 기존 `hasFields`(복수형) 의 표면적 유사
  - target 신규 식별자: `hasField` (예정, `chat-channel-input-rules.ts` 파일-scope 헬퍼)
  - 기존 사용처: `codebase/frontend/src/components/editor/expression/variable-picker.tsx:188` 의 지역 변수 `hasFields` — "노드 outputSample 이 필드를 하나라도 가지는가" 를 뜻하는 boolean, 표현식 에디터 UI 도메인
  - 상세: 이름이 단수/복수만 다르고 형태가 비슷하지만, (a) frontend 지역 변수 vs backend 모듈-scope 함수로 컴파일 단위가 완전히 분리되어 있어 실제 충돌(동일 스코프 내 의미 상충)은 발생하지 않는다. (b) 의미도 다르다 — 예정된 `hasField` 는 "이 객체에 특정 키가 존재하는가"(단일 필드 존재 판별, PATCH 차단 가드의 이중 캐스팅 제거용)이고 기존 `hasFields` 는 "필드 목록이 비어있지 않은가"(UI 렌더 분기). 실질 위험은 없음
  - 제안: 조치 불요. 굳이 구별하고 싶다면 `hasChatChannelField` 처럼 도메인 접두를 붙일 수도 있으나, 파일-scope 비공개 헬퍼이고 export 계획도 없어(plan 상 표 항목 "이중 캐스팅 2곳" 치환용) 비용 대비 효용이 낮다.
- **[INFO]** `throwInvalidField` 는 저장소 전체에서 grep 0건 — 신규 도입에 충돌 없음
  - target 신규 식별자: `throwInvalidField`
  - 기존 사용처: 없음 (`grep -rn "throwInvalidField" codebase/ spec/` → 0건). 인접 패턴으로 `throwIfAny` (`codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:91`) 가 있으나 다른 도메인(트리거 파라미터 검증)·다른 시그니처(단일 인자)라 혼동 가능성 낮음
  - 상세: 없음(충돌 없음을 확인하는 것이 이 항목의 목적)
  - 제안: 그대로 진행 가능

## 그 외 점검 관점 (모두 해당 없음)

- **요구사항 ID 충돌**: target 이 신규 부여하는 요구사항 ID 없음 (spec diff 0)
- **엔티티/타입명 충돌**: 신규 DTO/인터페이스 없음. `ChatChannelInput`/`ChatChannelInputMode` 등은 이미 `#1319`에서 도입되어 병합된 기존 타입
- **API endpoint 충돌**: 신규 endpoint 없음. plan 의 `@ApiNotFoundResponse`/`@ApiOkWrappedResponse` 추가는 이미 존재하는 `POST /api/triggers/:id/chat-channel/rotate-bot-token` (기 구현, `#1324`) 에 swagger 데코레이터(기존 공용 데코레이터, `codebase/backend/src/common/swagger/api-wrapped.ts`)를 붙이는 문서화 작업일 뿐, 새 데코레이터/엔드포인트 도입이 아님
- **이벤트/메시지명 충돌**: 해당 없음 (webhook/queue/sse 이벤트 신설 없음)
- **환경변수·설정키 충돌**: 해당 없음
- **파일 경로 충돌**: 신규 파일 생성 없음 (plan §2 설계판단이 명시적으로 "파일을 쪼개지 않는다"를 이번 턴 결정으로 못박음). 기존 파일(`chat-channel-input-rules.ts`/`.spec.ts`, `chat-channel-rejection-messages.const.ts`, `dto/chat-channel-config.dto.ts`, `triggers.controller.ts`)만 수정 대상

## 요약

target(`spec/5-system/15-chat-channel.md`)은 `origin/main` 과 diff 0 — 새로 도입하는 요구사항 ID·엔티티·endpoint·이벤트·설정키·파일 경로가 전혀 없다. 실질 변경은 같은 세션 plan(`spec_impact: none`)의 순수 backend 리팩터(`chat-channel-input-rules.ts` 내부 헬퍼 2종 추출)뿐이며, 두 후보 식별자(`throwInvalidField`, `hasField`) 모두 저장소 전체 grep 으로 기존 사용처와 대조했을 때 실질 충돌이 없다(`hasField`는 frontend 의 `hasFields` 와 표면적으로만 유사하고 스코프·의미가 분리되어 있어 INFO 수준). 신규 식별자 충돌 관점에서 이번 target 은 위험이 없다.

## 위험도

NONE
