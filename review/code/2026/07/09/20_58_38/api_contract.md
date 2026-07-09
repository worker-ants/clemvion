# API 계약(API Contract) 리뷰

## 범위 확인
실제 diff(`git diff main -- spec/`)는 `spec/` 4개 파일(`5-system/14-external-interaction-api.md`,
`7-channel-web-chat/1-widget-app.md`, `7-channel-web-chat/2-sdk.md`, `7-channel-web-chat/3-auth-session.md`,
`conventions/conversation-thread.md`)뿐이며 **`codebase/` 변경은 없다** — 이번 changeset 은 이미 병합된 구현
(`256bba3f0` 새로고침 히스토리 복원 및 후속 ai-review 반영 커밋들, `interaction.service.ts` `getStatus()`)을
사후 문서화하는 **spec-only 정합화**다. 리뷰는 이 문서가 기술하는 API 계약(주로 `GET /api/external/executions/:id`
응답 확장, `wc:event conversationEnded` SDK 페이로드 서술 변경)을 대상으로 한다.

## 발견사항

- **[INFO]** `context.conversationThread` 부재 표현이 형제 필드와 다른 관례(키 생략 vs `null`)
  - 위치: `spec/5-system/14-external-interaction-api.md` §5.3 / R17("durable thread 가 없는 경우…키를 생략")
  - 상세: `ExecutionStatusDto.context`(`currentNode`/`result`/`error` 등)는 부재 시 `null` 관례를 쓰는데, 신규
    `conversationThread` 만 "형제 필드의 `null` 관례와 달리 키 부재"로 명시적으로 다르게 설계했다. SSE wire 와의
    present-when-available 정합을 위한 의도적 선택으로 근거는 타당하나, 같은 엔드포인트 응답 스키마 안에서
    2가지 "부재" 표현 방식이 공존하게 되어 클라이언트가 `context.conversationThread === null` 체크와
    `'conversationThread' in context` 체크를 혼동할 위험이 있다(테스트(`interaction.service.spec.ts`)는 `not.toHaveProperty` 로
    정확히 검증하고 있어 구현 자체는 견고함).
  - 제안: 위젯 SDK 소비 코드(`eia-client`/`use-widget.ts`)가 `?.conversationThread` optional chaining 만으로 두
    케이스를 모두 안전하게 처리하는지 재확인하고, 가능하면 EIA 응답 스키마 컨벤션 문서(예: swagger 컨벤션)에 "부재
    표현 규칙" 자체를 한 곳에 명문화.

- **[INFO]** OpenAPI(Swagger) 스키마가 신규 필드를 반영하지 않음(사전 존재 패턴, 이번 diff 로 악화되지 않음)
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` `ExecutionStatusDto.context`
  - 상세: `context` 는 `Record<string, unknown> | null` + `additionalProperties: true` 로만 선언돼 있어
    `buttonConfig`/`nodeOutput`/`conversationThread` 등 실제 sub-shape 이 Swagger 문서에 전혀 노출되지 않는다.
    이번 diff 는 spec(md) 문서만 갱신했고 DTO 자체는 건드리지 않아 회귀는 아니지만, 공개 REST 표면(EIA)의 응답
    스키마 정밀도가 spec 문서에만 있고 기계가 읽는 OpenAPI 스펙에는 없는 gap 이 이번 필드 추가로 한 항목 더
    누적됐다.
  - 제안: 급하지 않으나, EIA 응답 DTO 에 union/discriminated 타입을 점진 도입해 외부 통합 파트너가 Swagger 만으로
    `conversationThread` 존재를 알 수 있게 하는 후속 검토 권장.

- **[INFO]** 공개 host↔iframe SDK 계약(`wc:event conversationEnded.data.reason`)이 닫힌 값 집합에서 열린 문자열로 전환
  - 위치: `spec/7-channel-web-chat/2-sdk.md` `wc:event` 표
  - 상세: `reason` 이 "열린 문자열(닫힌 enum 아님)"로 재정의되며 `execution.completed/failed/cancelled` SSE
    terminal 이벤트명뿐 아니라 위젯 로컬 사유(`user_ended`, `gone`)까지 값으로 흘러가도록 명문화됐다. 이는
    postMessage 기반의 host 임베더용 공개 계약이라 외부 파트너 코드가 `reason` 값에 대해 어떤 형태로든 매칭
    로직을 짜 두었을 가능성이 있다. 문서가 "host 는 특정 값에 강결합하지 말라"고 advisory 로 명시했지만 이는
    런타임에서 강제되지 않는 계약(TypeScript 상 `string` 타입일 뿐 강제 검증 없음)이라 실제 강결합을 막지는
    못한다.
  - 제안: SDK 타입 정의(`.d.ts`)에서 `reason` 을 `string`(향후 값 추가 가능)으로 명시하고, 임베딩 문서/CHANGELOG 에
    "닫힌 enum 아님 — 신규 값이 향후 추가될 수 있음"을 버전 노트로 남겨 하위 호환 기대치를 관리할 것을 권장(문서
    자체에는 이미 기술돼 있으나 SDK 배포 아티팩트/타입 선언에도 동일 문구 반영 확인 필요).

- **[INFO]** `resetSession` 의 booting 구간 중복 webhook 발사 gap 이 명시적으로 backlog 로 이연됨
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "새 대화(restart)" 행, "알려진 제약(Planned)"
  - 상세: 헤더 UI 컨트롤은 `booting` 상태에서 노출되지 않아 중복 트리거를 UI 레벨에서 막지만, host 의
    `resetSession` postMessage 명령은 `booting` 중에도 호출 가능해 in-flight `start()` 와 겹쳐 중복
    `POST /api/hooks/:path` 를 발사할 수 있다고 문서가 자인한다. 이는 요청 검증/멱등성 관점의 실제 API 계약
    gap(서버 측이든 클라이언트 gen-guard 든 idempotency 보장이 없음)이나, pre-existing 이며 이번 diff 의 신규
    회귀가 아니다.
  - 제안: 별도 트래킹(문서가 이미 "host-API 측 가드/드레인은 backlog"로 명시) — 새 작업으로 별도 이슈화 권장,
    이번 PR 범위에서 fix 불필요.

## 하위 호환성 / 응답 형식 평가

`GET /api/external/executions/:id` 확장은 `waiting_for_input` 상태에서만 optional 필드
(`context.conversationThread`)를 추가하는 **순수 additive 변경**이며, 기존 클라이언트가 이 필드를 몰라도
무해하다(unknown-field-ignore 관례). `completed`/`failed`/`cancelled` 종료 상태에서는 명시적으로 노출하지 않는
scope 축소(테스트로 회귀 가드됨: `interaction.service.spec.ts` "종료(COMPLETED) execution 은 conversationThread
를 노출하지 않는다")로, 오히려 노출 범위를 최소화하는 방향이라 인가/데이터 노출 관점에서도 건전하다. `seq` 는
여전히 SSE 가 권위이고 REST 는 placeholder(`0`)를 유지한다고 일관되게 문서화돼 있어 클라이언트 혼동 여지가 적다.
인증/인가 경계는 변경되지 않았고(§R17 "이미 SSE `waiting_for_input` 으로 공개 중인 데이터의 REST 재노출"이라는
근거로 신규 민감 표면이 아님을 명시), 이 판단 자체도 타당하다.

## 요약

이번 변경은 실제로는 이미 병합된 구현(`GET /api/external/executions/:id` 의 `context.conversationThread` durable
스냅샷 동봉, 위젯 헤더 세션 컨트롤, `wc:event conversationEnded.reason` 서술)을 spec 문서에 사후 정합화하는
문서 전용(spec-only) PR 이다. API 계약 관점에서 핵심 변경(`GET /api/external/executions/:id` 응답 확장)은 상태
scope 가 좁혀진(`waiting_for_input` 한정) 순수 additive/optional 필드이고 인가 경계·에러 응답·URL 설계에는
영향이 없어 breaking risk 가 낮다. 다만 (a) 같은 응답 내 "필드 부재" 표현이 `null` 관례와 "키 생략" 관례로
혼재하는 점, (b) 공개 host SDK 이벤트(`conversationEnded.reason`)가 암묵적 닫힌 enum 에서 열린 문자열로
전환된 점은 외부 통합 파트너 관점에서 문서화·타입 선언의 명확성을 조금 더 보강할 여지가 있다. 모두 CRITICAL/WARNING
수준은 아니며 INFO 로 기록한다.

## 위험도
LOW
