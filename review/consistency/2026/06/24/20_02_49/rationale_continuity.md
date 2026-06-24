# Rationale 연속성 검토 결과

검토 모드: --impl-prep
검토 범위: 03-maintainability M-2 — frontend API_BASE_URL 분산 정의 + 3001→3011 포트 fallback 정정

## 발견사항

### INFO: `getServerApiBaseUrl()` 분리 export — Rationale 부재, 단 spec 정합

- target 위치: `plan/in-progress/refactor/03-maintainability.md` M-2 개선 방안 2 (`auth-providers.ts` 의 `INTERNAL_API_URL` 우선 로직을 `getServerApiBaseUrl()` 별도 export 로 유지)
- 과거 결정 출처: 해당 결정을 거부한 Rationale 없음. `spec/5-system/12-webhook.md` Rationale 의 `NEXT_PUBLIC_API_URL` 우선순위 결정과도 충돌 없음 (webhook base 결정 로직과 별개).
- 상세: `auth-providers.ts:14-21` 은 이미 서버사이드 컴포넌트에서 `INTERNAL_API_URL` → `NEXT_PUBLIC_API_URL` → fallback 우선순위를 구현하고 있으며, 이 로직을 `getServerApiBaseUrl()` 로 명시 export 하는 것은 신규 패턴이다. 어떤 Rationale 에서도 이 패턴을 기각한 기록이 없으므로 번복이 아니다. 다만, 분리 export 의 근거가 plan 에 짧게만 기술되어 있고 spec 에 대응 Rationale 항목이 없다. 이 자체는 spec 변경 불요(plan 명시)로 수용 가능하다.
- 제안: 구현 시 `getServerApiBaseUrl()` 의 우선순위 (`INTERNAL_API_URL` → `NEXT_PUBLIC_API_URL` → fallback) 를 함수 JSDoc 주석으로 명시해 동일 패턴이 향후 분산 재정의되는 것을 방지. spec 갱신 불요.

---

### INFO: `ws-client.ts` 의 `NEXT_PUBLIC_WS_URL` fallback 3001 — 동일 버그 범주, plan 에 명시됨

- target 위치: `plan/in-progress/refactor/03-maintainability.md` M-2 개선 방안 3 (`grep -rn "3001" frontend/src` 0건 확인), 6파일 교체 목록에 `ws-client.ts` 포함
- 과거 결정 출처: 어느 Rationale 에서도 WebSocket URL 의 fallback 값을 3001 로 지정한 결정 없음. `codebase/frontend/.env.example:28` 는 `NEXT_PUBLIC_WS_URL="http://localhost:3011"` 을 명시.
- 상세: `ws-client.ts:4` 는 `NEXT_PUBLIC_WS_URL || "http://localhost:3001"` — `.env.example` 기준 정포트는 3011 이므로 이 fallback 도 버그다. plan 이 6파일 교체 목록에 `ws-client.ts` 를 명시하고 있어 범위 내 인식은 되어 있다. Rationale 충돌 없음.
- 제안: `constants.ts` 에 `API_BASE_URL` 과 나란히 `WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3011"` 을 함께 정의하거나, `ws-client.ts` 에서 직접 3011 로 정정해 0건 grep 검증과 일관성을 맞출 것. 어느 방향이든 Rationale 충돌 없음.

---

## 요약

M-2 의 목표(API_BASE_URL 분산 정의 해소 + 3001→3011 fallback 정정)는 어떤 spec Rationale 에서도 명시적으로 기각되거나 반대 방향으로 결정된 전례가 없다. `NEXT_PUBLIC_API_URL` 의 fallback 값 선택에 대한 과거 결정은 Rationale 에 존재하지 않으며, `.env.example` 와 docker-compose 의 3011 이 사실상 단일 진실 역할을 하고 있어 3001 fallback 이 drift 임을 plan 이 정확히 진단했다. 서버사이드 `INTERNAL_API_URL` 우선 로직의 `getServerApiBaseUrl()` 분리 export 도 기각된 대안이 아니다. 전반적으로 이 작업은 Rationale 연속성에서 위반 없는 순수 드리프트 교정 리팩터이며, spec 변경 불요 판단과도 정합하다.

## 위험도

NONE
