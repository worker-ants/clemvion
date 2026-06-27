STATUS: OK

# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/7-channel-web-chat/3-auth-session.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-27

---

## 발견사항

### 1. [WARNING] `GET /api/external/executions/:id` 응답 코드 불일치 — `410 Gone` vs `200 + status`

- **target 위치**: `spec/7-channel-web-chat/3-auth-session.md` §3.1 재로드 복원 시퀀스 step 2
  > `GET /api/external/executions/:id` 로 상태 확인: `200`(진행 중) → … / `410 Gone`(종료/만료) → storage 정리 후 `[ended]`

- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §5.3 단발 상태 조회
  > `GET /api/external/executions/{executionId}` 는 completed/failed/cancelled 상태의 execution 도 `200 OK` 를 반환하며 `status` 필드로 종료 상태를 전달한다. `410 Gone` 은 §5.1(EIA-IN-12)에서 `/interact` 명령 엔드포인트에 한정 적용되며, GET 상태 조회 엔드포인트의 `410` 응답은 EIA spec 어디에도 정의돼 있지 않다. `404 Not Found`(`EXECUTION_NOT_FOUND`)는 executionId 자체가 없을 때만 반환된다.

- **상세**: target 은 재로드 복원 시퀀스에서 GET 상태 조회가 `410` 을 반환하는 경우를 "종료/만료" 에 대응시킨다. 그러나 EIA §5.3 의 정의에 따르면 동일 엔드포인트는 completed/failed/cancelled execution 에 대해 `200 OK + { status: "completed" | "failed" | "cancelled" }` 를 반환한다. 위젯이 `410` 을 기다리면 종료된 execution 을 정상 종료로 인식하지 못하고, `200` 으로 내려온 종료 상태(`status=completed`)를 `[ended]` 처리하는 별도 분기가 없으면 재로드 복원 로직이 오동작한다. 실제 `410` 이 반환될 수 있는 시점은 엄밀히 executionId 자체가 DB 에서 삭제된 경우(현재 spec 상 미지원)뿐이다.

- **제안**: 
  1. `spec/7-channel-web-chat/3-auth-session.md` §3.1 step 2 를 EIA §5.3 정의와 정합하도록 수정:
     - `200 OK + status ∈ {completed, failed, cancelled}` → `[ended]`
     - `200 OK + status ∈ {waiting_for_input, running, pending}` → SSE 재연결
     - `401` → 낙관적 refresh 시도 (현행 §R4 로직 유지)
     - `404`(executionId 없음) → `[ended]`
  2. 또는 EIA §5.3 에 `410` 반환 조건을 추가하고 EIA-IN-12 의 적용 범위를 GET 엔드포인트까지 확장. 이 경우 EIA spec 수정 필요.

---

### 2. [INFO] webhook 응답 봉투 언랩 위치 — target 에서 `webhook §3.1` 을 SoT 로 참조, 실제 SoT 는 API 규약 §5

- **target 위치**: `spec/7-channel-web-chat/3-auth-session.md` §3 step 2 주석 및 §R5
  > "전역 TransformInterceptor 가 모든 성공 응답을 { data } 로 래핑 (webhook §3.1). 위젯은 res.data 를 언랩해 읽는다."

- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §4.1, §5 서두
  > EIA spec 은 동일 규약을 설명하면서 `([Webhook §3.1](./12-webhook.md#31-webhook-수신-엔드포인트) / [API 규약 §5](./2-api-convention.md#5-응답-형식))` 로 두 곳을 동시에 참조한다. TransformInterceptor 규약의 canonical SoT 는 `spec/5-system/2-api-convention.md §5` 이며, webhook §3.1 은 2차 설명이다.

- **상세**: 의미 충돌이 아니라 참조 정확도의 문제다. target 이 "webhook §3.1 SoT" 라고 명시하나, 실제 횡단 규약의 SoT 는 API 규약 §5 다. 현재 내용이 맞으므로 작동에는 영향이 없으나 새 독자가 spec 탐색 시 webhook 을 최종 권위로 오독할 수 있다.

- **제안**: §R5 의 SoT 참조를 `spec/5-system/2-api-convention.md §5` (primary) + `12-webhook §3.1` (예시) 순으로 기재하거나, EIA §5 서두 방식처럼 두 링크를 병기한다. 오류는 아니므로 선택적 동기화.

---

### 3. [INFO] `per_execution` 토큰 만료 시간(1h) 명시 여부 — target 에서 "단명" 으로만 기술

- **target 위치**: `spec/7-channel-web-chat/3-auth-session.md` §2, §3
  > "단명 `iext_*` 토큰", "단명 토큰", "만료 30분 이내 … 토큰 갱신" — 기본 만료 시간 수치 미기재.

- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §3.3 EIA-AU-02
  > "`per_execution` — 단일 execution scope 의 단명 JWT (`iext_*`, 기본 1h)"

- **상세**: 충돌이 아니라 target 이 구체 수치를 생략한 정보 갭이다. EIA 는 "기본 1h" 를 명시, target 은 "단명" 으로만 기술해 refresh 창(30분 이내 — EIA-AU-05 와 일치)은 언급하나 절대 만료 시간이 없다. 위젯 개발자가 target 만 읽으면 토큰 수명을 추론할 수 없다.

- **제안**: `spec/7-channel-web-chat/3-auth-session.md` §2 또는 §3 에 "(EIA §3.3 — 기본 1h)" 를 각주로 추가하거나, §3 step 2 이후 `POST .../refresh-token` 설명에 "만료 30분 이내(= EIA-AU-05, 기본 1h 토큰 기준)" 문구를 보강한다.

---

## 요약

`spec/7-channel-web-chat/3-auth-session.md` 는 EIA(`spec/5-system/14-external-interaction-api.md`)·Webhook(`spec/5-system/12-webhook.md`)·데이터 모델(`spec/1-data-model.md`)과 전반적으로 정합하며 주요 설계 결정(per_execution 단일 지원·sessionStorage·낙관적 refresh·봉투 언랩)이 다른 영역의 정의와 모순 없이 서술돼 있다. 단 하나의 실질적 WARNING 이 존재한다: 재로드 복원 시퀀스에서 `GET /api/external/executions/:id` 가 `410 Gone` 을 반환하는 것으로 기술돼 있으나 EIA §5.3 은 해당 엔드포인트가 종료된 execution 에 대해서도 `200 OK + status` 를 반환한다고 정의한다. 위젯이 `410` 만 `[ended]` 처리하고 `200 + status=completed` 는 처리하지 않는다면 재로드 후 종료된 대화를 정상으로 오인하는 버그가 된다. target 또는 EIA spec 중 한쪽을 수정해 응답 코드 계약을 통일해야 한다.

---

## 위험도

MEDIUM
