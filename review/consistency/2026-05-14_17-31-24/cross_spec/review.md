충분한 데이터를 확보했습니다. 종합 분석을 수행하겠습니다.

---

## 발견사항

### WARNING 1 — DRAFT 2K 섹션 레이블 오류: "§4.2 Overview" → 실제 타깃은 §4.3 Security

- **target 위치**: `plan/in-progress/spec-draft-cafe24-pending-polish.md` DRAFT 2K 헤더 + 첫 번째 diff
- **충돌 대상**: `spec/2-navigation/4-integration.md §4.3 Security 탭` (line 253)
- **상세**: DRAFT 2K 제목이 "§4.2 Overview 탭 Reauthorize 행"이라 명시되어 있으나, 첫 번째 diff에서 수정되는 `| Reauthorize (OAuth) | [Reauthorize] 버튼 →...` 행은 **§4.3 Security 탭**에 존재한다. §4.2 Overview 탭의 Quick actions 수정은 두 번째로 나와 실제로는 §4.2에 해당하지만, 헤더가 두 섹션을 혼합 표기해 패치 적용자가 §4.2에서 첫 번째 diff를 찾다가 실패할 수 있다.
- **제안**: DRAFT 2K 헤더를 "§4.3 Security 탭 Reauthorize 비활성 조건 추가 + §4.2 Quick actions 보강"으로 정정하거나, 두 수정을 별도 DRAFT 항목(2K-a/2K-b)으로 분리.

---

### WARNING 2 — DRAFT 2J-1 적용 후 `spec/4-nodes/4-integration/4-cafe24.md §9.4 step 4` 텍스트 stale

- **target 위치**: DRAFT 2J-1 (§9.4 step 3 URL만 수정)
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §9.4 step 4 현재 텍스트 (line 384)

  > *"4. **App URL 처리** — 백엔드가 HMAC 을 검증하고, `mall_id` + `app_type=private` 로 `pending_install` Integration 을 조회한 뒤 OAuthState 를 생성하고..."*

- **상세**: DRAFT 2J-1은 step 3의 URL을 `GET /oauth/install/cafe24/:installToken?...` 으로 업데이트하지만, step 4 prose는 구식 식별 전략("mall_id + app_type=private 로 조회")을 그대로 서술한다. DRAFT 2J-2는 §9.8만 갱신하므로 §9.4 step 4는 path에 `:installToken`이 포함된 URL을 받았는데 "mall_id 스캔"을 한다는 모순 상태로 남는다.
- **제안**: DRAFT 2J-1 또는 DRAFT 2J-2에 §9.4 step 4 텍스트 수정을 포함:

  ```diff
  - 4. **App URL 처리** — 백엔드가 HMAC 을 검증하고, `mall_id` + `app_type=private` 로 `pending_install` Integration 을 조회한 뒤 OAuthState 를 생성하고 ...
  + 4. **App URL 처리** — 백엔드가 path 의 `install_token` 으로 단일 `pending_install` Integration 을 조회하고, 그 row 의 `client_secret` 으로 HMAC 을 1회 검증한다. 검증 통과 시 OAuthState 를 생성하고 ...
  ```

---

### WARNING 3 — `spec/2-navigation/4-integration.md §5.8` credentials 필수 표시와 `pending_install` 상태 불일치 (드래프트 미수정)

- **target 위치**: DRAFT 1B/1C — `spec/1-data-model.md §2.10` 에 `pending_install` 상태 공식화
- **충돌 대상**: `spec/2-navigation/4-integration.md §5.8 Cafe24` credentials JSONB 스키마 (lines 503–504)

  | 필드 | 타입 | 필수 | 설명 |
  |------|------|------|------|
  | `access_token` | string | **✓** | OAuth access token |
  | `refresh_token` | string | **✓** | OAuth refresh token |

- **상세**: §5.8에서 `access_token`/`refresh_token`이 무조건 필수(✓)로 마킹되어 있으나, `pending_install` 상태의 Integration은 이 필드들을 갖지 않는다. 드래프트가 `pending_install`을 spec에 공식화하면서 §5.8 필수 표시를 수정하지 않으면, 구현자가 schema validation 로직에서 혼란을 겪거나 `pending_install` row 생성 시 validation 실패가 발생할 수 있다.
- **제안**: DRAFT 2에 §5.8 credentials 스키마 패치 추가:

  ```diff
  - | `access_token` | string | ✓ | 🔒 | OAuth access token (2시간 유효) |
  - | `refresh_token` | string | ✓ | 🔒 | OAuth refresh token (14일 유효) |
  + | `access_token` | string | ✓* | 🔒 | OAuth access token (2시간 유효). `pending_install` 상태에서는 absent — callback 성공 시 채워짐 |
  + | `refresh_token` | string | ✓* | 🔒 | OAuth refresh token (14일 유효). 동일 |
  ```

---

### INFO 1 — `spec/data-flow/integration.md §1.2` parent diagram의 stale OAuth 경로 (기존 불일치, 드래프트 미수정)

- **target 위치**: DRAFT 3C (§1.2에 sub-diagram 추가)
- **충돌 대상**: `spec/data-flow/integration.md §1.2` main diagram line 49 (`GET /api/integrations/oauth/:service/start`)
- **상세**: 기존 §1.2 parent diagram이 `GET /api/integrations/oauth/:service/start`를 사용하지만, integration spec §9.2는 `POST /api/integrations/oauth/begin`이다. 이 불일치는 드래프트 이전부터 존재. DRAFT 3C의 sub-diagram은 올바른 경로(`POST /oauth/begin`)를 사용하지만 parent diagram을 수정하지 않아, 같은 §1.2 안에 두 다른 경로가 공존한다.
- **제안**: DRAFT 3C에 parent diagram의 `GET /api/integrations/oauth/:service/start` → `POST /api/integrations/oauth/begin` 수정도 포함.

---

### INFO 2 — DRAFT 2D-pre 노트 삽입 위치 모호 + DRAFT 2D와의 중복

- **target 위치**: DRAFT 2D-pre (§6 노트 추가), DRAFT 2D (§6 노트 replace)
- **상세**: DRAFT 2D-pre는 삽입 위치를 "§6 본문 마지막 노트 바로 위 **또는** §2.2 더보기(⋮) 정의에"라고 모호하게 기술한다. 동시에 DRAFT 2D가 같은 §6의 마지막 노트를 replace하므로 "바로 위 삽입"이 replace와 순서 충돌 가능성이 있다. 내용적으로는 DRAFT 2K(§4.3 Reauthorize 비활성 조건)와 DRAFT 2D 전이 표(W5 행)에서 이미 동일 정보가 커버된다.
- **제안**: DRAFT 2D-pre의 내용을 DRAFT 2D §6 마지막 노트 확장 안에 통합(별도 삽입 불필요).

---

### INFO 3 — 카테고리/Resource 용어 정규화 방향 올바름, 컨벤션과 일치

- **target 위치**: DRAFT 2H (§14.2), DRAFT 2J-2 (4-cafe24.md §8.3 line 337)
- **상세**: `spec/conventions/cafe24-api-metadata.md §6`은 이미 "카테고리 단위 grouping"이라는 표현을 사용 중이다. 드래프트가 integration spec §14.2와 cafe24.md §8.3의 "Resource" 표현을 "카테고리"로 교정하는 것은 기존 컨벤션과 **일치**한다. 적용 방향이 올바름.

---

## 요약

드래프트는 `pending_install` 상태 정비, `install_token` path 식별 승격, callback 실패 시 status 보존 정책, TTL 24h expired 전이의 일관된 확장 설계를 5개 spec 파일에 걸쳐 잘 구조화하고 있다. 직접적인 spec 간 모순(CRITICAL)은 발견되지 않았다. 주요 우려는 **WARNING 2**(§9.4 step 4 텍스트 stale — 적용 후 동일 문서 내 step 3↔step 4 불일치 발생)와 **WARNING 3**(§5.8 credentials 필수 표시 미수정 — 구현 시 validation 혼란 가능)이며, **WARNING 1**(DRAFT 2K 헤더 오류)은 패치 적용 시 실수를 유도할 수 있다. 세 WARNING을 드래프트에 반영한 후 spec 적용을 진행하는 것을 권장한다.

## 위험도

**MEDIUM**