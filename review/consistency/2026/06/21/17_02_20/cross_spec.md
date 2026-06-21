# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target 영역: `spec/4-nodes/4-integration` (0-common, 1-http-request, 2-database-query, 3-send-email, 4-cafe24, 5-makeshop)

---

## 발견사항

### [WARNING] `INTEGRATION_AUTH_UNSUPPORTED` 코드가 공통 에러 코드 표에 미등재

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §4.1`, §5.8, §6 (에러 코드 표의 `INTEGRATION_*` 묶음)
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md §4.2 공통 에러 코드` 표
- **상세**: `1-http-request.md §4.1` 은 지원하지 않는 `auth_type` 에 대해 `INTEGRATION_AUTH_UNSUPPORTED` 코드를 정의하고, §6 에러 코드 표에서 이를 `INTEGRATION_*` 묶음으로 분류해 `0-common.md §4.2` 를 참조한다. 그러나 `0-common.md §4.2` 의 공통 에러 코드 표에는 `INTEGRATION_AUTH_UNSUPPORTED` 항목이 없다. `INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_NOT_CONNECTED`, `INTEGRATION_INCOMPLETE`, `INTEGRATION_CALL_FAILED`, `INTEGRATION_SERVICE_UNAVAILABLE` 5개만 정의되어 있다. 이 코드는 HTTP Request 노드 단독으로만 정의된 것임에도, §6 에러 코드 표의 묶음 설명이 "`INTEGRATION_*` ([공통 §4.2](./0-common.md#42-공통-에러-코드))" 라고 표기하여 공통 목록에 포함된 것처럼 보인다.
- **제안**: `0-common.md §4.2` 표에 `INTEGRATION_AUTH_UNSUPPORTED` 항목을 추가하고 "HTTP Request 노드 전용 — 지원하지 않는 `auth_type`" 임을 명시. 또는 `1-http-request.md §6` 에서 해당 코드를 `INTEGRATION_*` 묶음 설명 밖으로 분리해 "HTTP Request 전용 코드" 임을 명시. 어느 쪽이든 M-2 구현 전에 공통 코드 테이블과 HTTP Request 에러 코드 묶음의 참조 관계를 정렬해야 한다.

---

### [INFO] `autoRefresh=true` 대상 목록의 spec 내 표현 불일치

- **target 위치**: (간접 참조) `spec/4-nodes/4-integration/4-cafe24.md`, `spec/4-nodes/4-integration/5-makeshop.md` 가 참조하는 `spec/2-navigation/4-integration.md`
- **충돌 대상**: `spec/2-navigation/4-integration.md §9.1` 본문 vs `§Rationale "왜 derived 필드인가"`
- **상세**: `§9.1` (line 794) 은 `autoRefresh = true` 인 service_type 을 `cafe24`, `google`, `makeshop` 세 가지로 명시한다. 그러나 바로 아래 Rationale 섹션 (line 1194) 은 "현재 `cafe24`/`google` 만 true" 라고 기술해 `makeshop` 을 누락했다. 두 절이 동일 파일 내에서 모순된다. `isRefreshCapable` 정의(`service_type ∈ {cafe24, makeshop}`) 와 `connected-expiry` 잡 설명은 makeshop 을 포함하므로 본문(`§9.1`)이 사실이고 Rationale 이 오래된 서술임을 알 수 있으나, 문서 독자 기준으로는 혼란을 준다.
- **제안**: `spec/2-navigation/4-integration.md §Rationale "왜 derived 필드인가"` 의 `cafe24`/`google` 만 true 표기를 `cafe24`/`google`/`makeshop` 으로 갱신해 `§9.1` 본문과 정렬. Integration 영역 spec 에만 해당하며 target 영역 구현 착수 전 수정 권장.

---

### [INFO] `0-common.md §6` port 설명에 `send_email` 의 `out` 포트가 반영되지 않음

- **target 위치**: `spec/4-nodes/4-integration/0-common.md §6 (5필드 공통 규약)` — port 행: `'success' (또는 default 단일 출력) / 'error'`
- **충돌 대상**: `spec/4-nodes/4-integration/3-send-email.md §3.2`, §5.1 — 정상 포트가 `out` 임을 명시
- **상세**: `0-common.md §6` 표의 `port` 행은 Integration 카테고리 공통 패턴을 `'success' (또는 default 단일 출력) / 'error'` 로 기술한다. `(또는 default 단일 출력)` 이라는 괄호 표현이 `send_email` 의 `out` 포트를 포괄하려는 의도로 보이지만, `send_email` 이 `success` 가 아닌 `out` 을 success 포트로 사용한다는 사실이 공통 규약 섹션에서 명시적으로 드러나지 않는다. `§7 출력 구조 색인` 표에서도 `send_email` 행의 정상 케이스 열에 `success` 라는 단어 없이 `§5.1` 만 표기하여 `out` 임을 암시하지만, 단독으로 읽으면 다른 노드와 동일하게 `success` 포트를 사용하는 것으로 오해할 수 있다.
- **제안**: `0-common.md §6` port 행 설명을 "`'success'` / `'out'`(send_email 한정) 또는 default 단일 출력 / `'error'`" 로 갱신하거나, §7 출력 구조 색인에서 `send_email` 의 정상 케이스 열에 `§5.1 (port: 'out')` 을 명시. 직접 모순은 아니지만 동기화하면 구현자 혼란이 줄어든다.

---

## 요약

`spec/4-nodes/4-integration` 전체는 데이터 모델(`spec/1-data-model.md §2.10 Integration`), API 계약(`spec/2-navigation/4-integration.md`), 실행 엔진 계약(`spec/5-system/4-execution-engine.md §10`), 노드 Output 규약(`spec/conventions/node-output.md`) 과 명시적으로 정합한다. Integration 엔티티의 `service_type`, `auth_type`, `status`, `credentials`, `mall_id` 필드 정의와 target 영역 노드들의 사용이 일치하며, D4 에러 라우팅 결정(`port: 'error'` 단일 경로)과 SSRF 가드 공통 환경변수(`ALLOW_PRIVATE_HOST_TARGETS`) 도 인접 spec 들과 충돌 없이 기술되어 있다. M-2 구현(IntegrationOAuthService 내부 provider 별 strategy 분리)은 spec 이 명시적으로 "구현 세부 사항" 으로 위임한 범위이며 facade 명 유지 시 data-flow 다이어그램 참조 관계가 무변하므로 spec 갱신이 불필요하다. 발견된 이슈는 공통 에러 코드 표에 `INTEGRATION_AUTH_UNSUPPORTED` 가 누락된 WARNING 1건, 내부 표현 불일치 INFO 2건이며 CRITICAL 충돌은 없다.

---

## 위험도

LOW
