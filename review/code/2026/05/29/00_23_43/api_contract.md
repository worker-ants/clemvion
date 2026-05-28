# API 계약(API Contract) 리뷰 — triggers-auth-column

리뷰 대상: `/triggers` 목록 "인증" 컬럼 + 무인증 웹훅 경고
리뷰 일시: 2026-05-29

---

## 발견사항

### [INFO] `/auth-configs` 추가 호출 — 하위 호환성 영향 없음, 요청 검증 불요
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` — `useAuthConfigs()` 훅 추가 (diff +526 라인 근처)
- 상세: 트리거 목록 페이지가 기존 `/triggers`, `/workflows` 외에 `/auth-configs` 를 추가로 GET 한다. 이 호출은 읽기 전용이며 백엔드 DTO(`TriggerDto.authConfigId`)는 이미 존재한다(백엔드 변경 없음). 기존 API 클라이언트는 영향을 받지 않으며, 신규 엔드포인트가 아닌 기존 엔드포인트를 추가로 소비하는 형태이므로 breaking change 없음.
- 제안: 없음.

### [INFO] `authConfigId` 필드 — `TriggerDto` 에 이미 존재, 프론트 매핑만 추가
- 위치: `page.tsx` diff — `RawTrigger` 인터페이스 및 매핑 함수에 `authConfigId?: string | null` 추가
- 상세: 백엔드 응답 스키마(`TriggerDto`)에 `authConfigId` 가 이미 포함되어 있으며 프론트엔드가 이를 무시하다가 이번에 처음 소비하는 것이다. 기존 응답 소비자는 영향 없음. `null` 폴백(`t.authConfigId ?? null`)이 올바르게 처리됨.
- 제안: 없음.

### [INFO] 테스트 모의(mock) — `/auth-configs` 응답 형식이 실제 API 계약과 일치
- 위치: `triggers-page.test.tsx` — `mockTriggersResponse` 함수, `{ data: { data: authConfigs } }` 형태
- 상세: 실제 `/auth-configs` API가 `{ data: { data: [...] } }` 래퍼 구조를 반환한다는 전제로 mock이 작성되어 있다. `useAuthConfigs` 훅이 이 구조를 올바르게 unwrap한다면 계약 정합이다. mock 형식과 실제 응답 shape가 일치하는지는 `auth-config-select.tsx` 구현에 의존하므로, 훅이 리팩토링될 경우 mock 불일치 위험이 있다. 그러나 현재 변경 내에서 문제를 일으키지는 않는다.
- 제안: 없음 (현재 변경 범위 내 위험 없음).

### [INFO] `AUTH_CONFIG_TYPE_LABEL_KEYS` fallback — 알 수 없는 타입 처리
- 위치: `page.tsx` diff — `AUTH_CONFIG_TYPE_LABEL_KEYS[cfg.type] ?? "authentication.typeApiKey"` (diff +560 라인 근처)
- 상세: AuthConfig 타입이 `AUTH_CONFIG_TYPE_LABEL_KEYS` 맵에 없을 경우 `"authentication.typeApiKey"` 로 폴백한다. 이는 API가 새로운 타입 값을 반환할 때 "API Key" 라벨로 잘못 표시될 수 있다. 그러나 이는 표시 레이어의 graceful degradation이며, API 계약 자체를 위반하지는 않는다.
- 제안: (선택적) 폴백을 `"authentication.typeApiKey"` 대신 `cfg.type` 원문 혹은 중립적인 "Configured" (`triggers.authConfigured`) 로 변경하면 미지 타입 노출 시 더 정직한 표현이 된다. 현재 수준에서는 차단 불필요.

---

## 요약

이번 변경은 전적으로 프론트엔드 표시 레이어 증분이다. 백엔드 API 엔드포인트, 응답 스키마, HTTP 상태 코드, 인증/인가 정책에 신규 변경이 없으며 기존 API 계약을 소비만 한다. `TriggerDto.authConfigId` 는 이미 백엔드 응답에 포함되어 있어 하위 호환성 파괴가 없고, `/auth-configs` 는 기존 엔드포인트를 추가로 읽는 것뿐이다. API 계약 관점에서 심각한 문제는 발견되지 않았으며, 발견사항 4건 모두 INFO 수준이다.

---

## 위험도

NONE
