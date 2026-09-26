# Rationale 연속성 검토

## 검토 범위 요약

- 실제 코드 diff(`origin/main...HEAD`)는 15개 파일 / 1185줄, 전부 `codebase/backend`(Swagger/OpenAPI 응답 스키마 광고 + `http-status-advertised` 가드 확장) + `CHANGELOG.md` + `spec/conventions/swagger.md`.
- 프롬프트에 번들된 `impl-done-scope-sa/spec` 스코프 자체의 델타는 0(정상 — 코드 전용 성격의 스코프). 실제 spec 변경은 `spec/conventions/swagger.md` 16줄이며, 이는 별도 커밋(`24084fd0e docs(spec): swagger §2-4 — 라우트는 성공 응답을 하나 이상 광고한다 · §5-2 ApiOkWrappedNullableResponse`)으로 이 브랜치 안에 존재한다.
- 예산 절단으로 프롬프트에 diff·`5-system/1-auth.md` 등 일부가 생략되어, 워킹트리를 절대경로로 직접 `git diff`/`Read`/`grep` 하여 실제 변경분을 확인했다.

## 발견사항

### [INFO] `spec/conventions/swagger.md` §2-4 Rationale 번복 — 형식은 통과하나 취소선 관례와 다름

- target 위치: `spec/conventions/swagger.md` §2-4 하단 Rationale (`«광고가 있어야 한다» 는 광고를 채운 뒤 조였다` 문단), 커밋 `24084fd0e`
- 과거 결정 출처: 같은 문서의 직전 문구 — `«광고가 있어야 한다» 는 이 규칙이 아니다. 성공 응답을 광고하지 않는 핸들러(같은 날 15곳)는 대조할 것이 없어 건너뛴다. 그쪽을 조이는 것은 광고를 채운 뒤의 별 결정이다(트래커 등재).`
- 상세: 이번 변경은 과거에 명시적으로 "이 규칙이 아니다"라고 유보했던 결정(빈 광고 라우트를 위반으로 잡지 않음)을 뒤집어, `http-status-advertised` 가드가 이제 성공 응답을 하나도 광고하지 않는 라우트(리다이렉트 제외)를 전부 실패로 잡도록 확장했다(`http-status-advertised-guard.ts`의 `unadvertised` 신설, `http-status-advertised.spec.ts`의 새 단언, `CHANGELOG.md` "저장소 가드 강화" 항목). 다만 이 번복은 **동일 문단 안에서 새 근거를 함께 서술**했다 — 이전에 유보했던 15곳 중 11곳을 실제로 채웠고, 남은 4곳은 `@ApiExcludeEndpoint()`(2) 또는 이미 302 광고 중(2)이라 예외 처리했다는 실측을 명시했다. `spec/2-navigation/2-trigger-list.md`의 R-2(폐기 처리 패턴 — `~~취소선~~` + "정정 (날짜)" 박스)와 비교하면, 이번 §2-4 개정은 원문을 취소선으로 남기지 않고 바로 교체하는 방식을 썼다는 점에서 문서 내 스타일 일관성이 약간 떨어진다. 다만 이 차이는 CLAUDE.md의 "자기-반증형 소정정"(developer 전용, 조건 4에서 취소선 요구) 예외가 아니라 `docs(spec):` 접두의 일반 planner 턴 산출물로 보이므로, 그 조건 4가 강제 적용되는 사안은 아니다.
- 제안: 향후 규약 문서에서 결정을 번복할 때는 R-2 처럼 원문을 취소선으로 남기고 "정정 (날짜)" 박스를 추가하는 편이 이력 추적에 유리하다 — 강제 사항은 아니고 문서 일관성 제안.

### [INFO] `AssistantToolCallDto.arguments`/`result` 의 열린-map 예외 근거가 스펙 `## Rationale`이 아닌 코드 주석에만 있음

- target 위치: `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts` (`AssistantToolCallDto.arguments`, `.result` 필드)
- 과거 결정 출처: `spec/conventions/swagger.md` §1-4 "예외 — 형태는 고정이나 SoT 이중화 회피로 여는 경우" — "이 예외를 쓸 때는 해당 DTO 의 `## Rationale` 에 … 근거를 명시해, 본 절만 읽고 §1-4 위반으로 오독되지 않게 한다."
- 상세: 새 DTO는 도구 인자·결과를 `additionalProperties: true` 로 열어 두면서 그 이유(정본이 `tool-definitions.ts`/도구 실행부에 있어 재선언 시 SoT 이중화)를 TS `//` 주석으로만 남겼다. §1-4 문구가 요구하는 "해당 DTO 의 `## Rationale`"과 형식이 다르다. 다만 같은 열린-map 패턴이 `assistant-message-request.dto.ts`·`execution-status-response.dto.ts` 등 기존 코드에도 동일한 `//` 주석 관례로 이미 반복돼 있어, 이번 diff가 새 해석을 도입한 것은 아니라 기존 관행을 그대로 따른 것이다.
- 제안: 급하지 않음 — 기존 관행과 일치하므로 이번 PR에서 처리할 필요는 없고, §1-4 문구 자체를 "DTO 의 `## Rationale` 또는 인접 주석"으로 완화하거나, 반대로 기존 DTO들을 소급 정리할지는 별도 트래커 항목으로 남길 만함.

### 확인했으나 문제 없음 (기록용)

- `triggers.controller.ts`의 `rotateNotificationSecret`/`revokePerTriggerToken` 신규 응답 DTO는 트리거 spec R-2(폐기)·R-14(authConfigId 단일화)가 다루는 "webhook 수신 인증"이 아니라 "notification 발신 HMAC"·"interaction token" 자원이라 R-2/R-14 범위와 겹치지 않는다. R-2 정정 박스가 이미 "이 절을 지우지 않는 이유"로 Chat Channel R-CC-10 대조군만 언급하고, 이번 변경은 그 축을 건드리지 않는다.
- `WebAuthnAvailabilityDto({ enabled: boolean })`는 `spec/5-system/1-auth.md` §1.4.3/§API 표의 `{ enabled: boolean }` 계약과 정확히 일치 — 응답 형태 변경 없음, 문서 추가만.
- `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse`(`data: <T> | null`)는 `spec/5-system/2-api-convention.md §5.4`(null vs 키 생략)의 "값이 없을 수 있으면 키는 있고 값이 null" 규칙과 부합.
- `http-status-advertised-guard.ts`의 리다이렉트(3xx) 예외 처리는 swagger.md 기존 문구("SSE 도 면제되지 않는다 — Nest 가 기본값을 먼저 싣는다")와 대칭되는 반대 케이스(`res.redirect`가 그 기본값을 명시적으로 덮어씀)로 새 Rationale 문단에 정확히 설명돼 있다 — 임의 예외가 아니다.
- 위 두 항목 모두 target이 과거에 명시적으로 기각한 대안(예: `/toggle` 서브경로, inline 인증 필드, rotate 응답 masked-digest 등)을 재도입하지 않았다.

## 요약

이번 diff의 실질 변경은 백엔드 OpenAPI 응답 스키마 광고(순수 문서화, 응답 자체는 불변)와 `http-status-advertised` 가드의 범위 확장(빈 광고 라우트 차단) 두 축이다. 가드 확장은 `spec/conventions/swagger.md` §2-4의 기존 문구("«광고가 있어야 한다»는 이 규칙이 아니다")를 명시적으로 뒤집는 결정 번복이지만, 같은 문단에서 실측(15곳 중 11곳 채움·나머지 4곳 예외 사유)을 근거로 새 Rationale을 함께 작성했고 CHANGELOG에도 별도 항목으로 남겨, 프로젝트가 요구하는 "결정 번복 시 새 Rationale 동반" 원칙을 충족한다. 트리거 목록·auth·api-convention 등 인접 spec의 기존 Rationale(R-1~R-17, WebAuthn 계약, null 표현 규칙)과도 충돌 없이 정합했다. 발견된 두 건은 모두 INFO 등급의 문서 스타일·근거 배치 제안이며, 기각된 대안의 재도입이나 invariant 우회는 확인되지 않았다.

## 위험도

LOW
