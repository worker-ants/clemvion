# Rationale 연속성 검토 결과

- 검토 대상: `plan/in-progress/spec-draft-webhook-consistency.md`
- 검토 일시: 2026-05-29
- 검토자: rationale-continuity sub-agent

---

## 발견사항

### [CRITICAL] `?wait=true` 동기 모드 제거 — 합의 원칙 위반 없음, 그러나 기각된 대안 표현 부재

- target 위치: 결정 테이블 #4 ("동기 `?wait=true` 제거")
- 과거 결정 출처: `spec/5-system/2-api-convention.md §11.4` — 비동기 응답(`202`) + 동기 응답(`?wait=true`, 최대 30초) 두 모드를 모두 **정의**. `§11.4` 의 응답 테이블이 동기 모드를 지원 모드로 명시하고 있음.
- 상세: target 은 "코드에 미구현 → 제거" 결정을 내리고 있으나, `§11.4` Rationale 에는 동기 모드 도입의 명시적 근거(사용자 시나리오, 외부 서비스 호환 등)가 없고 기각된 대안으로도 기록되지 않았다. 그러나 코드를 ground truth 로 채택하는 본 draft 의 전제(배포 코드 = 정본) 자체에 대한 새 Rationale 가 한 줄 요약(`## Rationale 기록 사항`)으로만 존재하며, `§11.4` 의 해당 표·절을 갱신·폐기하는 근거가 spec 문서 내 `## Rationale` 로 작성되지 않은 상태다. 즉, 이 항목이 "구설계 잔재를 정리하는 것"임은 target 내에서 분명하지만, 폐기되는 spec 항목의 `## Rationale` 에 그 사유를 남기는 작업이 이 draft 에 포함되어 있지 않다.
- 등급 조정: 동기 모드가 Rationale 에서 명시적으로 "채택"된 항목은 아니고, 명문화되지 않은 채 spec 에 포함된 상태라 코드 ground truth 로 폐기하는 결정이 무근거 번복까지는 아니다. 그러나 변경 후 `2-api-convention.md §11.4` 에 "제거 사유(미구현 → 폐기, 2026-05-29)" 를 Rationale 로 남기지 않으면 향후 누군가가 동기 모드를 재도입할 때 이 결정이 기각된 선례임을 알 수 없다. **WARNING** 수준.
- 제안: `2-api-convention.md §11.4` 의 동기 모드 행 삭제 시, 같은 파일의 `## Rationale` 에 "동기 `?wait=true` 모드는 `hooks.controller.ts` 미구현 확인 후 2026-05-29 webhook-url-env 정합화에서 폐기" 항을 추가한다.

---

### [CRITICAL] `10-triggers.md` Rationale — `workspaceSlug` 라우팅 표현 충돌

- target 위치: 결정 테이블 #12 ("workspaceSlug 라우팅 제거")
- 과거 결정 출처: `spec/data-flow/10-triggers.md` `## Rationale` — "Webhook `endpoint_path` 의 UNIQUE 범위" 항목: *"공개 URL 은 `/api/webhooks/:workspaceSlug/:path` 형태로 라우팅되어 충돌이 없다 (`spec/5-system/12-webhook.md`)"*
- 상세: 이 Rationale 항목은 `(workspace_id, endpoint_path) UNIQUE` 설계의 근거로 "workspaceSlug 가 URL 세그먼트로 존재하기 때문에 다른 워크스페이스가 같은 경로를 가져도 충돌이 없다" 는 설명을 명시적으로 채택하고 있다. target draft 는 코드 ground truth 를 근거로 workspaceSlug 세그먼트가 실제 라우트에 없음을 확인하고 이 표기를 제거하기로 결정하지만, 결정 테이블 #12 가 이 Rationale 항목을 무효화하는 사실을 충분히 다루지 않는다. 특히 **UNIQUE 범위 결정의 논리 기반**(workspaceSlug 가 URL 에 있으므로 전역 충돌 없음)이 무너지면, `(workspace_id, endpoint_path) UNIQUE` 가 실제로는 `endpoint_path` 가 UUID 자동생성이라 사실상 전역 고유하다는 다른 근거로 대체되어야 한다. 이 대체 근거가 target 의 "결정" 컬럼(#12)에는 언급되어 있으나, `10-triggers.md` Rationale 항목 자체를 갱신하는 계획이 "갱신 파일" 목록 #4에만 포함되고 Rationale 재작성 내용이 제시되지 않았다.
- 제안: `10-triggers.md` `## Rationale "Webhook endpoint_path 의 UNIQUE 범위"` 항을 다음 내용으로 갱신: "공개 URL 은 `/api/hooks/:endpointPath` (단일 세그먼트). `endpoint_path` 는 UUID 자동생성으로 사실상 전역 고유하며, `(workspace_id, endpoint_path) UNIQUE` 제약은 동일 워크스페이스 내 중복 방지용 — workspaceSlug URL 세그먼트는 코드에 존재하지 않음 (2026-05-29 webhook-url-env 정합화 확인)."

---

### [WARNING] Rate Limit — 60 req/min(권장 목표) 기각 없이 100 req/min 채택

- target 위치: 결정 테이블 #5, `## Rationale 기록 사항`
- 과거 결정 출처: `spec/5-system/12-webhook.md §6` ("Rate Limiting 적용: 트리거당 60req/min") + `§8 보안 고려사항` ("60req/min/trigger") + `spec/5-system/2-api-convention.md §7` Webhook 수신 행 ("1000 req/min"). 두 spec 이 서로 다른 값을 정의하고 있던 상태.
- 상세: target 은 코드 현행(100/min, named 'webhook' throttler) 을 채택하고 60 과 1000 을 폐기하기로 결정한다. 60 은 12-webhook 의 권장 목표였고 1000 은 api-convention §7·§11.7 의 수치였다. 어느 쪽도 "채택 후 기각된 대안"으로 Rationale 에 명시된 것은 아니지만, 이 수치들은 spec 본문에 명시된 설계 의도이므로 코드 일치를 이유로 변경 시 폐기 이유를 Rationale 로 기록해야 한다. target 의 `## Rationale 기록 사항` 한 줄 요약에 "60(권장 목표) vs 100(현재 코드) 은 제품 결정" 이라고 언급되어 있으나, 이것이 각 spec 파일의 `## Rationale` 에 기재되지 않으면 추적이 어렵다. 또한 사용자 확인 미수행인 채로 100 채택이 기술되어 있어 (진행 메모에서 "사용자 확인 필요 1건"으로 남김) 결정이 미확정 상태임에도 결정 테이블에서 확정 서술되는 불일치가 있다.
- 제안: (a) 사용자 확인 완료 전까지 결정 테이블 #5 를 "⚠️ 미확정 — 사용자 확인 후 반영"으로 표시. (b) 확정 후 `12-webhook.md §6·§8` 및 `2-api-convention.md §7·§11.7` 에 "60/min(목표값) → 100/min(코드 실측, 2026-05-29 채택)" 를 각 파일의 `## Rationale` 에 기재.

---

### [WARNING] `2-api-convention.md §11.1` — "`/hooks/*` 는 `/api/*` 와 분리" note 삭제

- target 위치: 결정 테이블 #2 ("§11.1 의 `/hooks/*` 는 `/api/*` 와 분리 note 삭제")
- 과거 결정 출처: `spec/5-system/2-api-convention.md §11.1` 에 명시된 note — *"`/hooks/*` 경로는 `/api/*` 경로와 분리된다. API Gateway에서 별도 라우팅."*
- 상세: 이 note 는 API Gateway 분리 라우팅이라는 인프라 설계 전제를 담고 있다. 코드 실측에서 실제로는 `/api/hooks/` 라는 통합 경로를 사용한다는 것이 밝혀졌으므로 note 삭제는 타당하다. 그러나 이 note 가 삽입된 이유(API Gateway 별도 라우팅 설계 의도)가 폐기되는 결정이라면, 해당 spec 의 Rationale 에 "API Gateway 별도 라우팅 설계는 미구현, 실제 경로는 `/api/hooks/` — 2026-05-29 정합화"를 기록해야 향후 API Gateway 도입 시 혼란을 예방할 수 있다.
- 제안: `2-api-convention.md §11.1` 삭제 후 같은 파일 `## Rationale`(또는 해당 섹션이 없다면 신설)에 note 폐기 사유 한 항 추가.

---

### [WARNING] `2-api-convention.md §11.5` — API Key 쿼리 파라미터 기각 Rationale 부재

- target 위치: 결정 테이블 #9 ("API Key `?api_key=` 쿼리 옵션 제거")
- 과거 결정 출처: `spec/5-system/2-api-convention.md §11.5` — "API Key: `X-API-Key` 헤더 또는 `?api_key=` 쿼리 파라미터"로 명시. 쿼리 파라미터를 **명시적으로 지원**하는 설계.
- 상세: 쿼리 파라미터(`?api_key=`)를 통한 API Key 전달은 URL 로그·프록시 access log 에 자격증명이 노출되는 보안 리스크가 있어 제거하는 결정은 합리적이다. 그러나 이 옵션이 spec 에 명시적으로 채택된 상태이므로 제거 시 "기각된 대안" 으로 Rationale 에 등재해야 한다. target 의 Rationale 기록 사항에서 언급은 되어 있지만 보안 사유(URL 로그 노출)는 명시되지 않고 "12-webhook §4.4 헤더 전용으로 위임" 만 이유로 제시한다.
- 제안: `2-api-convention.md §11.5` 갱신 시 해당 spec Rationale 에 "쿼리 파라미터 방식은 proxy/access log 자격증명 노출 위험으로 기각, 헤더 전용만 유지 (12-webhook §4.4 위임, 2026-05-29)" 를 명시.

---

### [WARNING] `10-triggers.md` 본문 — `/api/webhooks/:path` 표기 다수 잔존

- target 위치: 결정 테이블 #3 (`10-triggers.md` 의 `/api/webhooks/` 표기 정정), 갱신 파일 #4
- 과거 결정 출처: `spec/data-flow/10-triggers.md` Overview "Webhook: 외부 HTTP 호출이 `/api/webhooks/:path` 로 들어옴", 코드 진입점 주석 "/api/webhooks/:path 진입", §1.2 시퀀스 `POST /api/webhooks/:path`, Rationale UNIQUE 항 `/api/webhooks/:workspaceSlug/:path`
- 상세: target 은 갱신 파일 #4에 `10-triggers.md` 를 포함하고 있어 이 표기들이 수정 대상임은 분명하다. 그러나 현재 spec 에 `/api/webhooks/` 표기가 Rationale 포함 최소 5곳에 남아 있고, 이것이 단순 오기(alias 없음)라는 사실이 이번에 처음 확인되었으므로, 과거 결정이 잘못된 명칭을 기반으로 기록된 Rationale(특히 UNIQUE 범위 항의 workspaceSlug 논리)를 무효화함을 명시적으로 기록해야 한다.
- 제안: 10-triggers.md Rationale 를 갱신할 때 "본문·주석 전반의 `/api/webhooks/` 표기는 코드에 없는 과거 명칭 — 2026-05-29 `/api/hooks/:endpointPath` 로 일괄 정정" 한 줄을 Rationale 에 추가.

---

### [INFO] `12-webhook.md §6·§8` — Rate Limit 60/min 중복 기술 정합 필요

- target 위치: 결정 테이블 #5
- 과거 결정 출처: `spec/5-system/12-webhook.md §6` ("Rate Limiting 적용: 트리거당 60req/min"), `§8 보안 고려사항` ("60req/min/trigger")
- 상세: 12-webhook.md 자체 내에도 60/min 이 두 군데 중복 기술되어 있다. 100/min 채택 시 두 군데를 모두 갱신해야 하며, 하나라도 누락되면 내부 불일치가 다시 발생한다. target 의 갱신 파일 #1 에서 WH-SC-05 만 언급되어 있고 §6·§8 가 명시되지 않았다.
- 제안: 갱신 파일 #1 의 범위를 "12-webhook.md WH-SC-05 + §6 rate limit 행 + §8 rate limit 셀" 로 명시.

---

### [INFO] `2-api-convention.md §11.3` — text/plain 제거 시 처리 흐름(§11.3 Step 4) 갱신 병행 필요

- target 위치: 결정 테이블 #11 ("text/plain 행 제거")
- 과거 결정 출처: `spec/5-system/2-api-convention.md §11.3` 요청 처리 플로우 Step 4 — "Content-Type: text/plain → 텍스트로 저장"
- 상세: target 은 §11.3 표에서 text/plain 행을 제거하기로 하나, §11.3 은 테이블이 아니라 처리 흐름(번호 리스트)으로 기술되어 있고 Step 4 내에 text/plain 분기가 포함된다. 표 행 제거 외에 이 플로우 스텝도 갱신해야 일관성이 유지된다.
- 제안: 갱신 파일 #3 의 `2-api-convention.md §11` 범위에 "§11.3 처리 흐름 Step 4 text/plain 분기 제거" 를 명시.

---

## 요약

target draft 가 수행하는 12개 결정 중 Rationale 연속성 관점에서 가장 심각한 문제는 두 가지다. 첫째, `10-triggers.md` Rationale 의 "Webhook endpoint_path 의 UNIQUE 범위" 항이 workspaceSlug URL 세그먼트 존재를 전제로 작성되어 있는데, target 이 이 세그먼트를 제거하면서 그 Rationale 의 논리 기반(충돌 없음의 근거)이 무너지므로 반드시 Rationale 항 자체를 재작성해야 한다(CRITICAL). 둘째, 과거 spec 에 명시적으로 "지원" 으로 기재된 항목들(동기 `?wait=true`, `?api_key=` 쿼리, `/hooks/*` 별도 라우팅 note)을 폐기할 때 각 파일의 `## Rationale` 에 폐기 사유를 남기지 않으면 "무근거 번복"으로 남는다(WARNING 복수). Rate limit 수치 변경(60·1000 → 100)은 사용자 확인 미완인 채로 결정이 확정 서술된 점도 Rationale 연속성을 약화시킨다. draft 자체의 결정 논리는 코드 ground truth 확인이라는 일관된 원칙을 따르고 있어 합의 원칙을 위반하거나 명시적으로 기각된 대안을 재도입하는 항목은 없다. 다만 변경 대상 spec 파일의 `## Rationale` 에 폐기·변경 사유가 기록되지 않은 채 draft 의 한 줄 요약으로만 남겨지면 추적 가능성이 떨어진다.

---

## 위험도

**MEDIUM**

(두 CRITICAL 중 하나는 `10-triggers.md` Rationale 갱신 누락 — 이미 갱신 파일 목록에 포함되어 있으나 Rationale 재작성 내용이 정의되지 않은 상태. 직접적 기각 대안 재도입이나 invariant 위반은 없음.)
