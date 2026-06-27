# Cross-Spec 일관성 검토 — spec/conventions/swagger.md

검토 모드: impl-done (scope=spec/conventions/, diff-base=origin/main)
검토 대상 변경: `spec/conventions/swagger.md` — `ApiOkPaginatedResponse` wire shape 정정 + `TransformInterceptor` pass-through 설명 추가 + §5 Rationale 추가

---

## 발견사항

### [INFO] api-convention §11.4의 "모든 응답 래핑" 문구가 pass-through 예외를 미언급
- target 위치: `spec/conventions/swagger.md` §2-5·§5 Rationale — pass-through 예외를 명시
- 충돌 대상: `spec/5-system/2-api-convention.md §11.4` — "모든 응답은 전역 `TransformInterceptor` 가 `{ data: ... }` 로 래핑한다"
- 상세: swagger.md 는 "반환 객체에 이미 top-level `data` 키가 있으면 추가 래핑 없이 pass-through" 라는 예외를 명문화했다. api-convention §11.4의 해당 문장은 webhook 202 응답 문맥(페이지네이션 없음)에 한정된 진술이므로 사실상 정확하지만, 텍스트 자체는 예외 없이 "모든 응답"이라 표현한다. 기능적 모순은 없고 webhook 응답이 pass-through 대상이 아니기 때문이다.
- 제안: 필수 아님. api-convention §11.4 또는 §5 서두에 "단, `PaginatedResponseDto`처럼 top-level `data` 키를 이미 가진 반환 객체는 pass-through — swagger.md §2-5 참조"를 주석으로 추가하면 독자 혼동을 예방할 수 있다.

### [INFO] api-convention §5 본문이 pass-through 메커니즘을 설명하지 않음
- target 위치: `spec/conventions/swagger.md` §5 Rationale — pass-through 동작 근거 상세 기술
- 충돌 대상: `spec/5-system/2-api-convention.md §5.2` — 목록 응답 shape `{ data: [...], pagination: {...} }` 를 결과만 보여주고 이유는 미기술
- 상세: api-convention §5.2 는 올바른 단일 래핑 shape 를 예시하지만 왜 `{ data: { data: [], pagination: {} } }` 가 아닌지 설명이 없다. swagger.md Rationale §5 가 그 이유를 `TransformInterceptor` pass-through 로 설명하므로 두 문서 간 기술 깊이 차이가 생긴다. 모순은 없다.
- 제안: api-convention §5.2 에 "(pass-through 동작 상세: swagger.md §5 Rationale)" 링크 주석을 추가하면 독자가 원인을 단일 spec 내에서 추적 가능하다.

### [INFO] spec/7-channel-web-chat/3-auth-session.md의 "전 REST 성공 응답" 일반 문구
- target 위치: `spec/conventions/swagger.md` §2-5 — pass-through 예외 명시
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/spec/7-channel-web-chat/3-auth-session.md` 87행 — "전 REST 성공 응답은 전역 `TransformInterceptor` 가 `{ data }` 로 래핑한다"
- 상세: 위 문장도 예외 없는 표현이지만, channel-web-chat 도메인에서 소비하는 API 응답이 모두 단일 객체 응답(`{ data: {...} }`)이라 pass-through 경로를 실질적으로 밟지 않는다. 기능적 충돌 없음.
- 제안: 필수 아님. swagger.md §2-5 를 SoT 로 cross-ref 하는 주석 추가 옵션.

---

## 핵심 사전 관찰 (충돌 해소 확인)

이번 변경의 주된 효과는 **기존 충돌 해소**다:

- 구 swagger.md §5-2 테이블이 `ApiOkPaginatedResponse` 반환 shape 를 `{ data: { data: <Dto>[], pagination: {...} } }` (double-wrap)으로 선언했는데, 이는 `spec/5-system/2-api-convention.md §5.2` 의 `{ data: [...], pagination: {...} }` (single-wrap)과 직접 모순이었다.
- 신규 swagger.md §5-2 테이블은 `{ data: <Dto>[], pagination: {...} }` 로 정정되어 api-convention §5.2 와 일치한다.
- `spec/2-navigation/4-integration.md` 843행("성공: `{ data: ... }` 또는 `{ data: ..., pagination: ... }`")도 single-wrap 방향을 가리키므로 일관성이 확보됐다.

---

## 요약

`spec/conventions/swagger.md` 의 이번 변경은 `ApiOkPaginatedResponse` wire shape 를 double-wrap `{ data: { data:[], pagination:{} } }` 에서 single-wrap `{ data:[], pagination:{} }` 로 정정함으로써, 기존에 존재하던 `spec/5-system/2-api-convention.md §5.2` 와의 직접 모순을 해소한다. 신규 도입하는 정의나 엔티티가 없고, 변경 자체가 다른 영역 spec 과의 정합성을 개선하는 방향이다. 잔여 INFO 항목 3건은 모두 api-convention·channel-web-chat spec 의 "예외 없는 래핑" 일반 문구가 pass-through 예외를 미언급하는 문서 깊이 차이로, 기능적 모순이 아니라 선택적 동기화 사항이다.

---

## 위험도

LOW
