### 발견사항

---

#### [WARNING] 1. 영향받는 연관 문서 내부 self-consistency 오기 — §3 인덱스 변경 누락

- **target 위치:** draft 문서 하단 "영향받는 연관 문서" 섹션, `spec/1-data-model.md` 항목
- **충돌 대상:** DRAFT 1D (`spec/1-data-model.md §3`)
- **상세:** 영향받는 연관 문서에 "`spec/1-data-model.md` §2.10, §3 (인덱스는 미변경, 본문만 보강)"이라 기재되어 있다. 그러나 DRAFT 1D는 §3 인덱스 테이블에 두 가지 변경을 명시한다: (1) `(workspace_id, status)` 행의 설명 확장, (2) `(install_token) WHERE install_token IS NOT NULL` 신규 행 추가. "인덱스는 미변경"이라는 표현이 DRAFT 1D 내용과 직접 모순된다.
- **제안:** 영향받는 연관 문서를 다음으로 수정 — "`spec/1-data-model.md` §2.10 (status enum·install_token·status_reason 보강), §3 (install_token 부분 인덱스 추가 + workspace_id,status 설명 보강)"

---

#### [WARNING] 2. `Resource` → `카테고리` 용어 교정 범위 불완전 — `0-common.md` 2개 파일 누락

- **target 위치:** DRAFT 2H (`spec/2-navigation/4-integration.md §14.2`, `spec/4-nodes/4-integration/4-cafe24.md:337`, `spec/conventions/cafe24-api-metadata.md §6`)
- **충돌 대상:** `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/3-ai/0-common.md`
- **상세:** 실제 조회 결과, UI grouping 맥락의 "Resource 단위 grouping" 표현이 DRAFT 2H가 다루는 3개 파일 외에 2개 파일에 추가로 존재한다. `spec/4-nodes/4-integration/0-common.md`("Resource/Operation 검증")와 `spec/4-nodes/3-ai/0-common.md`("Resource 단위 grouping — enabledTools")가 그것이다. 또한 `spec/1-data-model.md` §2.6 Node.type 표의 cafe24 설명 `"Resource × Operation 동적 폼"`도 UI 컨텍스트 표현이다. `spec/conventions/cafe24-api-metadata.md §6` 용어 정의 추가만으로는 이 파일들과의 용어 불일치가 해소되지 않는다.
- **제안:** 아래 파일을 영향받는 연관 문서에 추가하거나, "카테고리" 교정 대상에서 제외한다는 명시적 결정을 draft에 기록한다.
  - `spec/4-nodes/4-integration/0-common.md` — "Resource/Operation" 표현 검토
  - `spec/4-nodes/3-ai/0-common.md` — "Resource 단위 grouping" 표현 검토
  - `spec/1-data-model.md` §2.6 cafe24 Node.type 설명 — "Resource × Operation" 표현 검토

---

#### [WARNING] 3. `credentials_unreadable` status_reason — §10.4 에러 매핑 누락

- **target 위치:** DRAFT 1C (`spec/1-data-model.md §2.10`), DRAFT 3B (`spec/data-flow/integration.md §3.2`)
- **충돌 대상:** DRAFT 2G (`spec/2-navigation/4-integration.md §10.4`)
- **상세:** DRAFT 1C에서 "`credentials_unreadable`은 pre-existing 분기(integrations.service.ts:845)로 본 개정 범위 외이나 정합성 유지를 위해 §10.4 / data-flow §3.2에 동시 명시"라 기술한다. DRAFT 3B는 data-flow §3.2에 `credentials_unreadable`을 `error` 상태 후보값으로 추가한다. 그러나 DRAFT 2G §10.4 에러 매핑 표에는 `credentials_unreadable` 케이스가 포함되어 있지 않다. draft 자체가 "§10.4에 동시 명시"를 공약했으나 §10.4 표에 해당 행이 빠져 있다.
- **제안:** DRAFT 2G §10.4 표에 `credentials_unreadable` 케이스를 추가하거나, "이 케이스는 기존 동작 그대로이며 §10.4 표 범위 외"임을 DRAFT 1C 주석에서 명확히 수정하여 자기 모순을 제거한다.

---

#### [INFO] 1. `token_exchange_failed` 명명 도메인 중복 — `spec/2-navigation/10-auth-flow.md §5.4`

- **target 위치:** DRAFT 2I Rationale "status_reason `oauth_token_exchange_failed`…" 항목
- **충돌 대상:** `spec/2-navigation/10-auth-flow.md §5.4` OAuth 에러 처리
- **상세:** auth-flow.md §5.4에서 소셜 로그인 OAuth callback 에러를 URL 파라미터 `error=token_exchange_failed` (lowercase, no prefix)로 전달한다. 통합 callback의 status_reason은 `oauth_token_exchange_failed` (`oauth_` prefix)다. Rationale에서 도메인 분리를 설명하고 있으나, 코드 grep 시 두 도메인이 혼동될 여지가 있다. 현재 draft 설계는 의도적 분리로 충분히 명시된다.
- **제안:** 추가 조치 불필요. 향후 다른 provider integration callback 에러 추가 시 동일 `oauth_` prefix 규약을 따를 것.

---

#### [INFO] 2. `last_error.code` UPPER_SNAKE_CASE — DB 저장 컨벤션 명시 부재

- **target 위치:** DRAFT 2G §10.4, DRAFT 3C §1.2.1 sequence diagram
- **충돌 대상:** `spec/1-data-model.md §2.10` Integration.last_error 현행 정의 `{ code, message, at }`
- **상세:** 현행 spec은 `last_error.code`의 케이스 규약을 명시하지 않는다. DRAFT 2G §10.4는 `last_error.code='OAUTH_TOKEN_EXCHANGE_FAILED'` (UPPER_SNAKE_CASE)를 사용한다. `status_reason`은 snake_case, `last_error.code`는 UPPER_SNAKE_CASE — 둘 다 DB에 저장되는 값임에도 규약이 다르다. DRAFT 1C의 status_reason 설명에 이 분리 이유가 언급되어 있으나, data-model.md §2.10 `last_error` 항목 자체에는 없다.
- **제안:** `spec/1-data-model.md §2.10` Integration `last_error` 설명에 "code는 UPPER_SNAKE_CASE (API 에러 코드와 동일 표기)" 한 문장 추가를 고려한다.

---

#### [INFO] 3. V042 migration 이미 존재 — spec 기술 내용 정합 확인 필요

- **target 위치:** DRAFT 1D (`install_token` 컬럼 V042), DRAFT 3D (`provider_meta` 컬럼 V041)
- **충돌 대상:** `backend/migrations/V042__cafe24_private_app_pending_install.sql` (실제 파일)
- **상세:** 실제 조회 결과 V042가 이미 존재한다(`cafe24_private_app_pending_install`). git commit `fix(cafe24): Integration.installToken 컬럼 type 명시`를 감안하면 `install_token` 컬럼은 V042로 이미 DB에 추가된 상태다. 즉 DRAFT 1D의 "V042로 추가한다"는 미래 기술이 아닌 이미 완료된 상태다. `provider_meta` 컬럼(V041로 기술)은 V042 이전 번호인데, V042가 이미 최신이면 V041도 이미 존재하거나 V043으로 신설해야 한다.
- **제안:** developer 구현 착수 전 `backend/migrations/` 파일 목록을 확인하여, (a) `install_token`이 V042에 포함되어 있는지 ✓, (b) `provider_meta`(integration_oauth_state) 컬럼이 어느 migration에서 추가되어야 하는지 정확한 번호 확정 필요.

---

#### [INFO] 4. `spec/0-overview.md §6.3` Cafe24 spec 완료 일자 갱신 미포함

- **target 위치:** `spec/0-overview.md §6.3` 미구현 목록 — "Cafe24 통합 | spec 완료(2026-05-13)"
- **충돌 대상:** 본 draft (2026-05-14 상당 폭 개정)
- **상세:** spec/0-overview.md §6.3은 "spec 완료(2026-05-13)"로 표기되어 있다. 본 draft는 2026-05-14에 spec을 상당 폭 개정하므로, 날짜가 stale해진다. §6.3이 "latest 상태" 기술 원칙을 따른다면 업데이트가 필요하다.
- **제안:** 영향받는 연관 문서에 `spec/0-overview.md §6.3` 추가를 고려한다 — "spec 개정(2026-05-14)" 갱신. Minor한 polish이므로 필수는 아니다.

---

### 요약

cross-spec 관점에서 본 draft는 전반적으로 잘 설계되었다 — 상태 전이(DRAFT 2D ↔ DRAFT 3A), API endpoint(DRAFT 2E ↔ DRAFT 2J), 에러 코드(DRAFT 2F ↔ DRAFT 2F), DB schema(DRAFT 1 ↔ DRAFT 3)가 draft 내부에서 일관적이며 기존 spec과의 직접 모순도 없다. CRITICAL 수준의 충돌은 없으며, WARNING 3건 모두 수정 비용이 낮다. WARNING #1은 draft 자체의 영향 문서 기술 오류(수정만 필요), WARNING #2는 용어 교정 대상 파일 목록 불완전(0-common.md 2개 추가), WARNING #3은 §10.4에서 `credentials_unreadable` 행 누락이다. INFO #3(migration V042 이미 존재)만 developer 착수 전 파일 확인이 필요한 실질 액션이다.

### 위험도
**LOW**