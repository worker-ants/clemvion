# 요구사항(Requirement) 리뷰 결과

**리뷰 대상**: `mc-endpoint-hardening` — `GET /api/model-configs/:id/models` `type` 쿼리 런타임 검증 + 관련 plan/spec 문서 갱신

---

## 발견사항

### [INFO] [SPEC-DRIFT] `spec/2-navigation/6-config.md §3` 엔드포인트 표에 invalid `type` → 400 케이스 미기술

- **위치**: `spec/2-navigation/6-config.md` line 283 (`GET /api/model-configs/:id/models` 행)
- **상세**: 현재 spec §3 표는 `GET | /api/model-configs/:id/models | 사용 가능한 모델 목록 조회 (chat/embedding) **(Viewer+ — 조회)**` 로만 기술한다. 코드는 `ParseEnumPipe(MODEL_TYPE_ENUM, { optional: true })` 를 적용해 `chat`·`embedding` 이외의 값을 **400 Bad Request** 로 거부하며, 이를 `@ApiBadRequestResponse` 와 CHANGELOG 에도 명시했다. 그러나 spec §3 표 자체에는 이 400 경로가 등재되지 않았다. Swagger `@ApiQuery(enum: [chat, embedding])` 는 PR #714 이후 이미 선언돼 있었으므로 런타임 강제는 선언된 계약의 집행(enforcement)이지 신규 계약 추가가 아니다. 따라서 코드는 옳고 spec 본문이 뒤처진 경우다.
- **제안**: 코드 유지 + spec 갱신. `spec/2-navigation/6-config.md §3` 표 `GET :id/models` 행 설명에 "허용값 외 `type` 파라미터 → 400 Bad Request" 를 한 줄 추가한다.

---

### [INFO] `plan/complete/web-chat-loader-queue-replay-arguments.md` — `spec_impact` 값 형식 변경

- **위치**: `plan/complete/web-chat-loader-queue-replay-arguments.md` frontmatter
- **상세**: `spec_impact: []`(빈 배열) → `spec_impact: none`(문자열)으로 변경됐다. 의미는 동일하나 다른 completed plan 파일들이 어떤 형식을 표준으로 쓰는지 스키마 일관성 문제가 있을 수 있다. 해당 파일이 이미 `plan/complete/` 에 있으며 실행에는 영향이 없다.
- **제안**: plan-lifecycle 스키마가 한쪽 형식을 강제한다면 그에 맞춰 조정. 실기능 영향 없음.

---

## 요약

이번 변경의 핵심은 `GET /api/model-configs/:id/models` 의 `type` 쿼리 파라미터에 `ParseEnumPipe(MODEL_TYPE_ENUM, { optional: true })` 를 추가해 Swagger 에 이미 선언된 `enum: [chat, embedding]` 계약을 런타임에도 강제하는 것이다. 구현은 기능 완전성·엣지 케이스·에러 시나리오·반환값 모든 측면에서 올바르다: `optional: true` 로 파라미터 생략 시 기존 동작이 유지되고, 유효하지 않은 값은 핸들러 도달 전에 400 으로 거부된다. `MODEL_TYPE_ENUM` const 객체가 파이프 인자·Swagger enum·타입 선언의 단일 소스로 기능해 세 지점의 드리프트를 구조적으로 차단한다. `PROVIDER_PROBE_THROTTLE` 상수 추출은 동일한 스로틀 정책을 3핸들러가 공유함을 명시하는 의도적 개선이다. e2e 테스트는 단위 테스트가 우회하는 파이프 배선을 실 HTTP 레이어에서 검증하는 올바른 접근이다. spec/2-navigation/6-config.md §3 표에 새 400 경로가 미반영된 것은 유일한 지적 사항이며 코드 버그가 아닌 spec 갱신 누락이다. plan 및 error-handling spec 문서 갱신은 모두 정확하다.

---

## 위험도

NONE

---

STATUS: SUCCESS
