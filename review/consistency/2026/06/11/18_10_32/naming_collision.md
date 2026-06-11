# 신규 식별자 충돌 검토 결과

**대상 문서**: `spec/2-navigation/6-config.md`
**검토 일시**: 2026-06-11

---

## 발견사항

### 요구사항 ID 충돌 — 없음

`6-config.md` 는 자체 요구사항 ID(NAV-CF-* 등)를 새로 부여하지 않는다. 관련 요구사항 ID 는 `_product-overview.md §3.6` 의 `NAV-CA-*` (인증 설정) 와 `§3.7` 의 `NAV-CL-*` (모델 설정) 이며, 이들은 이미 product-overview 에서 정의되어 있고 본 문서는 이를 참조만 한다. 신규 ID 부여 없음 — 충돌 없음.

### 엔티티/타입명 충돌 — 없음

- **`AuthConfig`**: `spec/1-data-model.md §2.17` 의 기존 엔티티와 동일 명칭·동일 의미로 사용. 신규 도입이 아닌 기존 정의 참조.
- **`ModelConfig`**: `spec/1-data-model.md §2.16` 의 기존 엔티티와 동일 명칭·동일 의미. `spec/1-data-model.md` 에서 `ModelInfo` 와 명시적으로 구분(`ModelConfig` = DB row, `ModelInfo` = listModels 응답 DTO). 본 문서도 동일 용어 구분을 따른다.
- **`ModelInfo`**: 본 문서가 직접 정의하지 않으며 `spec/5-system/7-llm-client.md §3.5` 의 기존 정의를 참조.

신규로 도입되는 엔티티/타입명은 없다.

### API endpoint 충돌 — 없음

본 문서가 명세하는 endpoint 는 모두 기존 spec 과 정합적이다.

| endpoint | 상태 |
|---|---|
| `GET/POST/PATCH/DELETE /api/auth-configs[/:id]` | `spec/5-system/1-auth.md`, `spec/1-data-model.md §2.17.2` 와 일치 |
| `POST /api/auth-configs/:id/regenerate` | `spec/1-data-model.md §2.17.2`, `spec/2-navigation/2-trigger-list.md` 와 일치 |
| `POST /api/auth-configs/:id/reveal` | `spec/1-data-model.md §2.17.2`, `spec/5-system/1-auth.md §4.1` 와 일치 |
| `GET /api/auth-configs/:id/usage` | 충돌 없음 (신규 정의, 다른 spec 에서 동일 경로 미사용) |
| `GET/POST/PATCH/DELETE /api/model-configs[/:id]` | `spec/5-system/7-llm-client.md`, `spec/data-flow/7-llm-usage.md` 와 일치 |
| `PATCH /api/model-configs/:id/set-default` | `spec/data-flow/7-llm-usage.md` 와 일치 |
| `POST /api/model-configs/:id/test` | `spec/data-flow/7-llm-usage.md §7-llm-usage.md:52` 와 일치 |
| `POST /api/model-configs/preview-models` | `spec/5-system/7-llm-client.md §5.5`, `spec/data-flow/7-llm-usage.md` 와 일치 |
| `GET /api/model-configs/:id/models` | `spec/data-flow/7-llm-usage.md §7-llm-usage.md:53` 와 일치 |

Deprecation 처리 중인 `/api/llm-configs`·`/api/rerank-configs` 는 alias 로 명시되어 있으며, 이는 `spec/data-flow/7-llm-usage.md §7-llm-usage.md:50` 의 "PR4 까지 `/api/llm-configs` alias 유지" 서술과 일치한다.

### 이벤트/메시지명 충돌 — 없음

본 문서는 새 webhook·queue·SSE 이벤트명을 도입하지 않는다.
`audit_log` 의 `auth_config.reveal` 액션명은 `spec/5-system/1-auth.md §4.1` 및 `spec/1-data-model.md §2.17.2` 와 완전히 일치한다.

### 환경변수·설정키 충돌 — 없음

본 문서는 새 환경변수나 설정 키를 도입하지 않는다.

### **[WARNING]** Rationale anchor `R-3` — 문서 내 번복 마커와 cross-doc 참조 경로 혼동 가능성

- **target 신규 식별자**: `6-config.md` 의 `### R-3 (번복) — ModelConfig 단일 화면 통합`
- **기존 사용처**: `spec/2-navigation/5-knowledge-base.md:239` 가 `[Config R-3 번복](./6-config.md#r-3-번복--modelconfig-단일-화면-통합)` 으로 직접 링크하며, 링크 anchor 는 `r-3-번복--modelconfig-단일-화면-통합` 으로 파생된다. 해당 anchor 는 현재 `6-config.md` 에 실재하므로 dead-link 아님.
- **상세**: 각 spec 문서 내에서 `R-1`~`R-5` 는 **파일 범위 로컬 식별자**다. `_layout.md`, `10-auth-flow.md`, `2-trigger-list.md`, `5-knowledge-base.md`, `7-statistics.md`, `14-execution-history.md`, `15-system-status.md` 등 모두 각자 `R-1`, `R-3` 등을 가진다. 이는 spec 컨벤션상 정상이며 충돌이 아니다. 다만 `6-config.md` 의 `R-3` 헤딩에 `(번복)` 텍스트가 포함되어 GitHub anchor 가 `r-3-번복--modelconfig-단일-화면-통합` 형태로 길어진다. 이 anchor 를 외부에서 참조하는 `5-knowledge-base.md:239` 는 이미 정확한 full-slug 를 사용하고 있으므로 링크는 유효하다.
- **제안**: 충돌·오류는 없다. 단지 anchor slug 가 길어 타이포 시 dead-link 위험이 있으므로 `(번복)` 표기를 본문 제목 대신 헤딩 바로 아래 한 줄 bold 노트로 이동시켜 헤딩을 `### R-3. ModelConfig 단일 화면 통합` 으로 단순화하는 것을 선택적으로 검토할 수 있다. 현 상태는 기능상 문제없음.

### 파일 경로 충돌 — 없음

`spec/2-navigation/6-config.md` 는 이미 존재하는 파일에 대한 검토이며 신규 파일 생성이 아니다. `spec/2-navigation/` 내 다른 파일(`_product-overview.md`, `_layout.md`, `0-dashboard.md` 등)과 번호·이름이 겹치지 않는다. 파일명 컨벤션(`N-name.md`) 을 준수한다.

### **[INFO]** Frontmatter `id: config` — 레거시 평이한 이름

- **target 신규 식별자**: frontmatter `id: config`
- **기존 사용처**: 동일 `id` 를 사용하는 다른 spec 파일 없음 (전체 검색 확인).
- **상세**: `id: config` 는 `spec/2-navigation/` 내 다른 파일들(`id: dashboard`, `id: statistics`, `id: knowledge-base` 등)과 다르게 영역-prefix 없이 단음절이다. 현재 충돌은 없으나 향후 다른 영역에 `config` 관련 spec 파일이 추가될 경우 모호해질 수 있다.
- **제안**: `id: nav-config` 또는 `id: config-screen` 처럼 영역 prefix 를 붙이면 일관성이 높아진다. 단 현재 cross-reference 를 통한 id 검색 케이스가 없고 충돌도 없으므로 즉시 수정은 불필요하다.

---

## 요약

`spec/2-navigation/6-config.md` 는 새로운 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수를 신규로 도입하지 않는다. 모든 식별자는 `spec/1-data-model.md §2.16·§2.17`, `spec/5-system/1-auth.md`, `spec/5-system/7-llm-client.md`, `spec/data-flow/7-llm-usage.md` 의 기존 정의와 정합적으로 사용되고 있다. Rationale anchor `R-3 (번복)` 의 긴 slug 는 `5-knowledge-base.md` 에서 이미 정확한 경로로 참조되어 dead-link 없음이 확인되었다. Frontmatter `id: config` 는 현재 중복 없이 단일 파일에서만 사용된다. 식별자 충돌 관점에서 실질적 위험 사항은 없다.

---

## 위험도

LOW
