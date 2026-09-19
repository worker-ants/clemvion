# Rationale 연속성 검토 — spec/2-navigation/ (--impl-prep)

## 검토 범위와 방법

- 번들에 완전 포함된 target: `spec/2-navigation/1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` (각 본문 + `## Rationale` 전체).
- 완전 포함된 관련 spec Rationale: `spec/0-overview.md` · `spec/1-data-model.md` · `spec/3-workflow-editor/{0-canvas,2-edge,3-execution,4-ai-assistant}.md` · `spec/4-nodes/{0-overview,1-logic/9-foreach}.md`.
- 번들이 "컨텍스트 예산 초과"로 생략한 73개 파일 중, 실제 착수 대상(`plan/in-progress/connection-test-codes-and-gaps.md`)이 지목한 두 파일은 **워크트리에서 직접 Read** 했다 — `spec/2-navigation/4-integration.md`(§5.3~5.6·§9.2·§9.4·§14.1 및 `## Rationale`의 "연결 테스트 — Database·HTTP는 실제로 접속한다…(2026-09-19)" 절) · `spec/5-system/11-mcp-client.md`(§8.2 에러 코드 vocabulary). 나머지 생략 파일은 열지 않았다 — 아래 발견사항이 그 파일들의 결정에 의존하지 않기 때문.
- `plan/in-progress/connection-test-codes-and-gaps.md`(`spec_impact: none`)를 함께 읽어, "이번에 실제로 구현될 것"이 무엇인지 확인했다 — `IntegrationTestResult.code` 를 `string` 에서 literal union/`as const` 로 좁히는 순수 타입 리팩터(동작·wire 값 불변, 사용자 결정 및 실측 근거 있음).

## 발견사항

검토 관점 4가지(기각된 대안 재도입 / 합의 원칙 위반 / 무근거 번복 / 암묵적 가정 충돌) 기준으로 **CRITICAL·WARNING 없음**.

- **[INFO] 계획된 타입 리팩터는 기존 Rationale이 이미 선언한 원칙을 코드로 굳히는 방향 — 위반 아님**
  - target 위치: `plan/in-progress/connection-test-codes-and-gaps.md` §할 것 1~2 (`ConnectionTestResultCode` union 신설, Cafe24·MakeShop `pingConnection` 반환 타입 좁히기)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` §14.1 "에러 코드 vocabulary" 표(`DB_AUTH_FAILED`/`DB_CONNECT_FAILED`/`HTTP_AUTH_FAILED`/`HTTP_SERVER_ERROR`/`HTTP_CONNECT_FAILED`/`EMAIL_CONNECT_FAILED` 행에 반복되는 "**연결 테스트 전용** — `IntegrationTestResult.code` namespace (노드 런타임 `ErrorCode` enum 과 별개)")와 `## Rationale`의 "연결 테스트 — Database·HTTP는 실제로 접속한다…" 절 "코드 이름" 항("이름이 가까운 노드 코드와 모집합이 다를 수 있다").
  - 상세: spec는 이미 "연결 테스트 코드 namespace"와 "노드 런타임 `ErrorCode`"가 서로 다른 집합이라고 여러 곳에서 산문으로 못 박아 두었다(예: `DB_CONNECT_FAILED`는 인증 실패를 빼지만 노드의 `DB_CONNECTION_ERROR`는 포함). 계획서는 이 구분을 TS 타입(`ConnectionTestResultCode`)으로 명시하고 `@ts-expect-error`로 "노드 런타임 코드를 넣으면 컴파일 에러"가 되게 하겠다고 적었다 — 이는 기존에 산문으로만 존재하던 invariant를 코드 레벨 가드로 승격하는 것이지, 그 invariant를 우회하거나 재해석하는 것이 아니다. `INTEGRATION_INCOMPLETE`처럼 HTTP 자격증명 실패·Cafe24·MakeShop 세 생산자에 걸쳐 재사용되는 코드도 §14.1·§9.4·§9.2 서술과 그대로 일치한다. 계획서의 "비대상 — spec 의 코드 표기는 문서라 리터럴이 맞다"는 문구도 spec 본문(산문 UPPER_SNAKE_CASE 나열)과 backend 타입(리터럴 union)이 표현 형식만 다를 뿐 같은 사실을 가리킨다는 것을 정확히 인지하고 있다.
  - 제안: 없음(진행 가능). 굳이 보강한다면 `spec_impact: none` 판단 근거(§14.1이 이미 이 사실의 SoT라는 점)를 `--impl-done` 시점에 한 줄 인용해 두면, 이후 검토자가 "타입을 좁혔는데 spec 변경이 없다"를 다시 의심하는 라운드를 줄일 수 있다.

## 요약

완전히 로드된 `spec/2-navigation/1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`는 자체 `## Rationale`이 이미 매우 촘촘하다 — 폐기된 대안(R-2→R-14 취소선 대체, 웹훅 `auth/rotate-secret` 미신설 후 폐기), 재정의처럼 보이나 실은 최초 확정인 사례(§2.3 태그 필터 "멀티→단일"), 서로 다른 축의 결정이 이름만 비슷한 사례(R-4 API 경로 vs R-16 drawer UI)를 모두 명시적으로 구분해 두었고, 검사 대상 `createdBy ≠ 현재 사용자`(과거 (b)안, "폐기")가 §2.3 소유 필터에서 재등장하는 것도 Rationale §1 스스로가 "그 구분은 필터가 담당"이라고 역할 분담을 밝혀 재도입이 아니다. `spec/1-data-model.md`·`0-overview.md`·`3-workflow-editor/*`·`4-nodes/*`의 완전 로드된 Rationale에서도 2-navigation과 직접 충돌하는 항목은 없었다(오히려 웹훅 `endpoint_path` 전역 유일·영구 예약 결정이 `2-trigger-list.md` §2.3.1/§3/§4.3에 이미 반영돼 있음을 확인). 이번 워크트리의 실제 착수 대상인 `connection-test-codes-and-gaps` 계획(타입 전용 리팩터, `spec_impact: none`)은 `4-integration.md` §14.1과 `11-mcp-client.md` §8.2가 이미 문서화한 "연결 테스트 코드 namespace는 노드 런타임 `ErrorCode`와 별개"라는 원칙을 그대로 따르며, 동작·wire 값 불변을 스스로 명시했다. 예산 초과로 생략된 나머지 spec 파일들은 이번 착수 대상과 무관해 보여 직접 열지 않았으나, 그 사실 자체를 "문제 없음"의 근거로 과신하지는 않는다.

## 위험도

NONE
