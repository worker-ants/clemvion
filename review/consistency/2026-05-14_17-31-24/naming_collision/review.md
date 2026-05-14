## Naming Collision Check — 결과

**검토 대상**: `plan/in-progress/spec-draft-cafe24-pending-polish.md`  
**검토 모드**: `--spec` (spec draft 사전 검토)  
**검색 코퍼스**: 제공된 spec/, plan/in-progress/, spec/conventions/ 문서 전체

---

### 발견사항

#### [WARNING] `CAFE24_INSTALL_INVALID_HMAC` — 동일 식별자, 의미 범위 축소

- **Target 신규 식별자**: `CAFE24_INSTALL_INVALID_HMAC (403)` — HMAC 불일치만
- **기존 사용처**: 현재 `spec/2-navigation/4-integration.md §9.2` 의 `GET /api/integrations/oauth/install/cafe24` 행 — `"HMAC 검증 실패 (pending 미발견 포함 — 정보 노출 방지)"`
- **상세**: 기존 spec 에서 이 에러 코드는 "HMAC 불일치" 와 "pending Integration 미발견" 두 케이스를 의도적으로 합산했다. Draft 는 동일 이름을 유지하면서 의미를 "HMAC 불일치만"으로 좁히고, "토큰 미존재" 케이스를 `CAFE24_INSTALL_INVALID_TOKEN (404)` 로 분리한다. 식별자 자체는 충돌하지 않으나, 현재 코드·테스트·문서가 이 에러 코드를 "token 미존재" 케이스에서도 트리거되는 것으로 가정하고 있다면 회귀가 발생한다. Draft Rationale 에서 이 변경을 명시적으로 인정하고 있어 인지된 변경이나, 구현 단계의 수용 기준에 "404 케이스 대응" 테스트를 명시할 필요가 있다.
- **제안**: `cafe24-pending-polish.md` 변경 5(테스트 보강) 의 `handleInstall HMAC fail` 케이스 외에 "옛 코드에서 HMAC_INVALID 를 token-not-found 경로에서도 assert 하는 테스트가 있는지" 별도 grep 회귀 확인을 구현 착수 전 체크리스트에 추가.

---

#### [INFO] `카테고리` 용어 — `Node.category` 와 잠재적 혼동

- **Target 신규 식별자**: Cafe24 UI grouping 단위로서의 `카테고리` (spec/conventions/cafe24-api-metadata.md §6 및 4-integration.md §14.2, 4-cafe24.md)
- **기존 사용처**: `spec/1-data-model.md §2.6 Node.category` — `logic / flow / ai / integration / data / presentation` Enum 값
- **상세**: Draft 는 Cafe24 UI 에서 Resource 단위 grouping 을 `카테고리`로 표기하도록 한다. `Node.category` 는 다른 도메인(워크플로 노드 유형 분류)의 개념이며 scope 가 완전히 다르나, spec 본문을 읽는 독자가 컨텍스트 없이 "카테고리" 단어를 보면 혼동 가능성이 있다. Draft 가 `cafe24-api-metadata.md §6` 첫 단락에 `"UI grouping 단위 = '카테고리' (사용자 친화 표기) — 백엔드 메타데이터의 'Resource'와 동일 범위"` 설명을 추가하여 mitigate 하고 있으므로 위험도는 낮다.
- **제안**: `spec/2-navigation/4-integration.md §14.2` 및 `spec/4-nodes/4-integration/4-cafe24.md §9.4` 변경 시 괄호 참조(`[Spec Cafe24 API 메타데이터 §6]` 형식)를 함께 기재해 독자가 `Node.category` 와 다른 개념임을 즉시 인지하도록 유도 — Draft 이미 이 방향으로 작성되어 있으므로 확인 차원의 제안.

---

#### [INFO] 새 queue message `reason` 필드 — schema evolution (naming collision 아님)

- **Target 신규 식별자**: `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }`
- **기존 사용처**: Draft 가 "두 갈래는 별도 큐 메시지로 dispatch"라 서술하며 기존 `{ integrationId }` shape 에 `reason` 필드를 추가하는 것을 암시
- **상세**: 이는 naming collision 이 아니라 queue message schema 확장이다. 그러나 기존 `integration-expiry` 큐의 consumer 가 `reason` 필드 없이 처리하도록 구현되어 있다면 `pending_install_timeout` 분기를 조건 없이 `token_expiring` 으로 처리하는 위험이 있다. Naming 관점 위험도: NONE.
- **제안**: 구현 단계(변경 4)에서 consumer 가 `reason` 유무에 관계없이 하위 호환 처리하거나, `reason` 을 필수 필드로 강제하는 코드 변경을 명시.

---

### 요약

Draft 가 도입하는 신규 식별자(`install_token` 컬럼, `pending_install` 상태 값, `CAFE24_INSTALL_INVALID_TOKEN` / `CAFE24_INSTALL_LEGACY_PATH` / `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드, `install_timeout` / `oauth_token_exchange_failed` 등 status_reason 값)는 기존 corpus 어디에서도 다른 의미로 사용 중인 사례가 발견되지 않아 **실질적 naming collision 없음**. 유일한 주의 지점은 `CAFE24_INSTALL_INVALID_HMAC` 의 의미 범위 축소로, Draft 가 이미 Rationale 에서 명시적으로 다루고 있다. 전반적 위험도는 **LOW**.

### 위험도

**LOW**