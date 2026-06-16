## 발견사항

### 발견사항 없음 (충돌 0건)

신규 식별자 충돌 관점에서 아래 6개 점검 축을 전수 검토했다.

---

#### 1. 요구사항 ID 충돌

target(`spec/2-navigation/6-config.md`)은 독립 요구사항 ID를 새로 부여하지 않는다.
section anchor (`R-1`~`R-6`, `A.1`~`A.4`, `B.1`~`B.6`) 는 파일 내부 범위이고, 동일 `2-navigation/` 폴더의 다른 파일들(`2-trigger-list.md`, `5-knowledge-base.md`, `7-statistics.md` 등)도 각자 독립 `R-N` anchor를 사용하므로 cross-file 충돌이 없다.
`WH-MG-05` 는 target이 새로 부여하는 ID가 아니라 `spec/5-system/12-webhook.md` 에 이미 정의된 요구사항을 참조하는 것이다.

충돌: 없음.

---

#### 2. 엔티티/타입명 충돌

target이 참조하는 엔티티:

- **`ModelConfig`** — `spec/1-data-model.md §2.16` 에서 이미 단일 진실로 정의된 엔티티. target 은 재정의 없이 참조만 한다.
- **`AuthConfig`** — `spec/1-data-model.md §2.17` 에서 이미 정의. 참조만.
- **`ModelInfo`** — `spec/5-system/7-llm-client.md §3.5` 에서 정의된 DTO(provider `listModels` 응답 항목). `spec/1-data-model.md §2.16` 주석에서 `ModelConfig` 와 명확히 구분돼 있다. target은 `ModelInfo` 를 새로 도입하지 않고 암묵적으로 재사용하며 충돌 없음.
- **`LlmPreviewService`** / **`ModelConfigService`** — `spec/5-system/7-llm-client.md` 와 `spec/data-flow/7-llm-usage.md` 에서 이미 정의된 서비스명. target이 참조만 한다.

충돌: 없음.

---

#### 3. API endpoint 충돌

target이 정의하는 신규 엔드포인트:

**Authentication API**
- `GET/POST /api/auth-configs`
- `GET/PATCH/DELETE /api/auth-configs/:id`
- `POST /api/auth-configs/:id/regenerate`
- `POST /api/auth-configs/:id/reveal`
- `GET /api/auth-configs/:id/usage`

**Model Config API**
- `GET/POST /api/model-configs`
- `GET/PATCH/DELETE /api/model-configs/:id`
- `PATCH /api/model-configs/:id/set-default`
- `POST /api/model-configs/:id/test`
- `POST /api/model-configs/preview-models`
- `GET /api/model-configs/:id/models`

코퍼스 검색 결과:
- `/api/auth-configs` 는 `spec/5-system/2-api-convention.md §2` 에서 케밥케이스 예시로 참조되고, `spec/2-navigation/2-trigger-list.md §R-14` 에서 regenerate 경로를 교차 참조한다. 모두 6-config.md 를 SoT 로 인정하는 참조이며 별도 정의가 없다.
- `/api/model-configs/preview-models` 는 `spec/data-flow/7-llm-usage.md §1` 에서 동일 경로로 참조 — 충돌 없음.
- `spec/5-system/1-auth.md §5 API 표` 에 `/api/auth-configs/:id/reveal` 행이 아직 등재되지 않았다는 점은 plan/in-progress/auth-config-webhook-followups.md §3에서 이미 추적 중인 미비 사항이며, 본 target이 새로 도입하는 identifier 충돌은 아니다.

충돌: 없음.

---

#### 4. 이벤트/메시지명 충돌

target은 webhook·queue·SSE 이벤트 이름을 새로 도입하지 않는다. `auth_config.reveal` 은 AuditLog action 이며 `spec/conventions/audit-actions.md §3` 표에 `auth_config | 현재형 | create/update/delete/regenerate/reveal | 구현` 으로 이미 등재돼 있다.

충돌: 없음.

---

#### 5. 환경변수·설정키 충돌

target은 새 ENV var 또는 config key를 도입하지 않는다.

충돌: 없음.

---

#### 6. 파일 경로 충돌

`spec/2-navigation/6-config.md` — 기존 파일로 이미 존재하는 경로다. target은 신규 파일이 아니며 기존 파일의 내용 변경이다. 경로 충돌 없음.

---

#### INFO — `LLM_MODEL_NOT_FOUND` 미정의 코드 참조

- **target 신규 식별자**: `LLM_MODEL_NOT_FOUND` (`spec/2-navigation/6-config.md §R-1`)
- **기존 사용처**: `spec/5-system/7-llm-client.md §5.5` 에서 "미구현(Planned) — 세분화 에러 코드" 로만 언급. `codebase/backend/src/nodes/core/error-codes.ts` 및 `spec/5-system/3-error-handling.md §1.3` LLM 에러 카탈로그에 미등재.
- **상세**: target §R-1 이 "저장된 모델 ID가 런타임에 `LLM_MODEL_NOT_FOUND` 로 실패한다"고 서술하나, 이 코드는 현재 Planned 상태이며 error-codes.ts와 error catalog에 미존재. 존재하지 않는 코드를 기정사실로 서술하면 독자 혼선 유발 가능.
- **제안**: "현재는 `LLM_CONNECTION_ERROR` 로 수렴되나 향후 `LLM_MODEL_NOT_FOUND` 로 세분화 예정" 으로 서술을 정밀화하거나, 코드가 Planned 상태임을 괄호로 명시 (`LLM_MODEL_NOT_FOUND` (Planned — [LLM Client §5.5](../5-system/7-llm-client.md))).

---

## 요약

`spec/2-navigation/6-config.md` 가 도입하거나 참조하는 식별자(`ModelConfig`/`AuthConfig` 엔티티명, `/api/auth-configs`·`/api/model-configs` endpoint 계열, `auth_config.*` 감사 액션, `MODEL_CONFIG_INVALID`·`MODEL_CONFIG_NOT_FOUND` 에러 코드 등)는 모두 기존 spec의 이미 확립된 정의를 재사용하거나 단독 SoT 로 정의하며, 다른 영역에서 다른 의미로 사용되는 이름과 충돌하는 사례는 발견되지 않았다. frontmatter `id: config` 도 전체 spec 트리에서 유일하다. 유일한 INFO 항목은 §R-1 이 아직 미구현인 `LLM_MODEL_NOT_FOUND` 를 기정사실 코드처럼 서술하는 점이며, 이는 실제 충돌이 아닌 표현 정밀화 권고 수준이다.

## 위험도

NONE
