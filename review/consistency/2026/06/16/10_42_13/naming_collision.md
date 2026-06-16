## 발견사항

충돌 발견 없음.

`spec/2-navigation/6-config.md` 가 사용하는 모든 식별자는 기존 spec 에서 동일 의미로 이미 확립된 식별자를 **참조**하는 것이며, 새로운 식별자를 신설하거나 다른 의미로 재정의하는 사례가 없었다.

검토한 주요 식별자와 기존 SoT 대조:

| 대상 식별자 | 기존 SoT | 결과 |
|---|---|---|
| `MODEL_CONFIG_INVALID` (400) | `spec/5-system/3-error-handling.md §1.3`, `spec/conventions/error-codes.md §5` (PR4b rename 이력 등재) | 일치 |
| `FORBIDDEN` (403) | `spec/5-system/2-api-convention.md §5.3`, `spec/5-system/3-error-handling.md §1.1` | 일치 |
| `AUTH_FAILED` (401) | `spec/5-system/12-webhook.md WH-SC-04`, `spec/5-system/12-webhook.md §3.2` | 일치 |
| `auth_config.reveal` (audit action) | `spec/5-system/1-auth.md §4.1`, `spec/conventions/audit-actions.md §3`, `spec/1-data-model.md §2.17.2` | 일치 |
| `wfk_` / `wft_` / `whs_` (token prefix) | `spec/1-data-model.md §2.17.1` | 일치 |
| `totalCalls`, `periodCounts { last24h, last7d, last30d }`, `recentCalls` (usage response shape) | `spec/1-data-model.md §2.13` (AuthConfig 호출 집계 경로 SoT 주석) | 일치 |
| `sourceIp` / `responseCode` / `startedAt` (recentCalls 필드) | `spec/5-system/12-webhook.md §5 step 9` | 일치 |
| `source_ip` / `response_code` (DB 컬럼) | `spec/1-data-model.md §2.13 Execution` (V096 컬럼) | 일치 |
| `ModelConfigService.findEntity` | `spec/5-system/7-llm-client.md §8.3` | 일치 |
| `/api/model-configs/preview-models` | `spec/5-system/7-llm-client.md §5.5`, `spec/data-flow/7-llm-usage.md` | 일치 |
| `PATCH /api/model-configs/:id/set-default` | `spec/1-data-model.md §2.16`, `spec/conventions/audit-actions.md §3 model_config.set_default` | 일치 |
| `POST /api/model-configs/:id/test` | `spec/5-system/7-llm-client.md §8.3 testConnection` | 일치 |
| Rationale R-1 ~ R-6 | 문서 로컬 앵커 — 타 문서와 네임스페이스 비공유 | 충돌 없음 |

### 요약

`spec/2-navigation/6-config.md` 는 신규 식별자를 도입하지 않는다. 에러 코드(`MODEL_CONFIG_INVALID`, `AUTH_FAILED`, `FORBIDDEN`), audit action(`auth_config.reveal`), 토큰 prefix(`wfk_`/`wft_`/`whs_`), API endpoint(`/api/auth-configs/*`, `/api/model-configs/*`), DB 컬럼(`source_ip`, `response_code`), 응답 DTO 필드(`totalCalls`/`periodCounts`/`recentCalls` 등) 모두 기존 SoT(`spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/12-webhook.md`, `spec/conventions/error-codes.md`, `spec/conventions/audit-actions.md`)에 동일 의미로 등재되어 있으며, 본 문서는 이를 정합하게 참조한다. 식별자 충돌 위험 없음.

### 위험도

NONE
