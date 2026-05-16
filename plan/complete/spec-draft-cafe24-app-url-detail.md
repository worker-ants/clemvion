---
worktree: cafe24-app-url-detail-a7c3f4
started: 2026-05-16
owner: project-planner
spec_files:
  - spec/data-flow/integration.md
  - spec/2-navigation/4-integration.md
---

# Spec Draft — Cafe24 App URL 상세 페이지 노출 + data-flow drift 정정

본 draft 는 `/consistency-check --spec` 의 검토 대상이다. Critical 0 건 확인 후 spec 본문에 반영한다.

인계 plan: `plan/in-progress/spec-update-cafe24-app-url-detail.md` (developer 가 작성)
관련 consistency 세션 (impl-prep): `review/consistency/2026/05/16/11_56_28/` (BLOCK: YES, Critical 1건)

---

## 변경 1 — `spec/data-flow/integration.md` §1.2.1 시퀀스 line 90 정정 (Critical)

**파일**: `spec/data-flow/integration.md`
**위치**: §1.2.1 sequence diagram 의 토큰 교환 성공 분기 (현재 line 90)

**옛 텍스트**:
```
Svc->>PG: UPDATE integration SET status=connected, install_token=NULL, credentials ENC, token_expires_at, last_rotated_at
```

**새 텍스트**:
```
Svc->>PG: UPDATE integration SET status=connected, credentials ENC, token_expires_at, last_rotated_at<br/>(install_token 및 install_token_issued_at 보존 — post-install navigation 식별 키)
```

**근거**: `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상" (2026-05-15) 과 `spec/4-nodes/4-integration/4-cafe24.md` §9.4 step 5 의 "install_token 은 **보존**" 가 이미 일관. data-flow spec 만 옛 NULL 처리 표현이 누적되어 직접 모순. 코드 동작은 이미 보존 정책이므로 본 변경은 doc drift 정정. `install_token_issued_at` 도 함께 보존됨 — 24h TTL 스캐너는 `status='pending_install'` row 만 대상으로 하므로 (`spec/data-flow/integration.md` §1.4 `pending-install-ttl` 잡 참조) connected 전이 후의 `install_token_issued_at` 값이 보존되어도 잘못된 만료 처리가 일어나지 않는다.

### 변경 1-b — `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 정정 (Warning 동반 해소)

**파일**: `spec/2-navigation/4-integration.md`
**위치**: Rationale "install_token TTL 24h (2026-05-14)" 항 (`### TTL 기준 (2026-05-15 갱신)` 단락 안)

**옛 텍스트** (해당 단락 중):
> callback 성공 시 `install_token` 과 함께 `install_token_issued_at` 도 NULL 로 비워진다.

**새 텍스트**:
> callback 성공 시 `install_token` 과 `install_token_issued_at` 모두 **보존**된다 — post-install navigation 의 식별 키이며, 24h TTL 스캐너는 `status='pending_install'` row 만 대상으로 하므로 connected 전이 후의 값이 잘못된 만료 처리에 영향을 주지 않는다. NULL 처리는 `pending_install → expired (install_timeout)` 만료 경로에서만 발생한다.

**근거**: Cafe24 App URL 재호출 흐름 — install_token persistent 격상(2026-05-15) 결정이 install_token 만 다루었으나 동행 컬럼 `install_token_issued_at` 의 처리 정책이 옛 NULL 표기로 잔존. consistency-check 2026-05-16T12_06_18 WARNING #1 해소.

---

## 변경 2 — `spec/2-navigation/4-integration.md` §4.2 Overview 탭 — App URL 카드 행 추가 (Warning)

**파일**: `spec/2-navigation/4-integration.md`
**위치**: §4.2 표 (현재 line 245-250, 4 행 표) 의 마지막 행 다음

**기존 표 마지막 행 (참고)**:
```
| 별칭 편집 | 인라인 편집, `PATCH /api/integrations/:id` |
```

**추가할 행 (`별칭 편집` 행 바로 아래)**:
```
| App URL 카드 (Cafe24 Private 한정) | `service_type='cafe24' AND credentials.app_type='private'` 일 때만 표시. **App URL** (`${APP_URL}/api/3rd-party/cafe24/install/:installToken`) 과 **Redirect URI** (`${APP_URL}/api/3rd-party/cafe24/callback`) 를 복사 버튼과 함께 노출. Cafe24 Developers Console 의 "앱 URL" 갱신용 — App URL HMAC 검증 실패 에러 페이지가 안내하는 비교 대상이 본 카드다. 결정 근거는 Rationale "Cafe24 App URL 상세 페이지 표시" 항 참조. |
```

**근거**: 에러 페이지 (`renderInstallErrorHtml`) 가 "통합 상세 페이지에 표시된 URL 과 일치하는지 확인하세요" 라고 안내하지만 옛 상세 페이지에는 URL 이 노출되지 않아 안내가 실효성을 잃었다 (2026-05-16 사용자 보고).

---

## 변경 3 — `spec/2-navigation/4-integration.md` §9.1 GET 응답 shape 보강 (Warning)

**파일**: `spec/2-navigation/4-integration.md`
**위치**: §9.1 표 (현재 line 668-678) 의 `GET /api/integrations/:id` 행

**옛 텍스트**:
```
| GET | `/api/integrations/:id` | 상세 조회 (credentials는 마스킹) |
```

**새 텍스트**:
```
| GET | `/api/integrations/:id` | 상세 조회. credentials 는 마스킹. 응답 envelope 는 [API 규약 §5.1](../5-system/2-api-convention.md#51-단일-리소스) 의 `{ data: IntegrationDto }` 형식. `IntegrationDto` 는 `appUrl: string \| null` 필드를 포함 — Cafe24 Private 통합(`service_type='cafe24' AND credentials.app_type='private'`)은 `${APP_URL}/api/3rd-party/cafe24/install/:installToken` 값, 그 외 통합은 `null`. `install_token` 자체는 응답에 별도 필드로 노출되지 않고 App URL path segment 안에만 포함된다 — 식별자 분산 방지 (Rationale "Cafe24 App URL 상세 페이지 표시" 참조). |
```

---

## 변경 4 — `spec/2-navigation/4-integration.md` Rationale 신규 항 추가 (Warning)

**파일**: `spec/2-navigation/4-integration.md`
**위치**: `## Rationale` 섹션 (현재 line 928 부터) 안, 시간순으로 가장 최근 (= 끝) 에 추가.

**추가할 본문**:
```markdown
### Cafe24 App URL 상세 페이지 표시 (2026-05-16)

Cafe24 admin "앱으로 가기" / Cafe24 Developers "테스트 실행" 의 HMAC 검증 실패 에러 페이지(`renderInstallErrorHtml`) 는 사용자에게 "통합 상세 페이지에 표시된 URL 과 일치하는지 확인하세요" 라고 안내한다. 그러나 옛 상세 페이지에는 App URL 이 표시되지 않아 안내가 실효성을 잃었다 (2026-05-16 사용자 보고 — App URL 호출이 `CAFE24_INSTALL_INVALID_HMAC` 으로 거부됐을 때 비교 기준이 없었다).

**해결안**: 상세 페이지 Overview 탭에 `Cafe24AppUrlCard` 를 추가해 App URL/Redirect URI 를 복사 버튼과 함께 노출 (§4.2 표 참조). 백엔드는 `IntegrationDto.appUrl: string | null` 필드를 Cafe24 Private 한정으로 계산해 응답에 포함하며, `install_token` 자체는 별도 필드로 노출하지 않는다 — App URL path segment 안에 이미 포함되며 별도 필드 노출은 (a) 중복, (b) 식별자가 두 곳에 분산되어 클라이언트가 어느 값으로 비교해야 할지 혼동, (c) 향후 path 형식 변경 시 양쪽 필드 동기화 부담 세 가지 이유로 회피.

**새 등록 흐름과의 일관성**: `frontend/src/app/(main)/integrations/new/page.tsx` 의 `Cafe24PrivatePending` 컴포넌트와 동일한 복사 UX 패턴(라벨 + 모노스페이스 URL + 복사 버튼 + 1줄 안내) 을 재사용해 사용자 혼동을 줄인다.

**HMAC 검증 진단 로그 보강**: 본 변경과 함께 `handleInstall` 의 HMAC 실패 3 분기 (mall_id 불일치 / client_secret 부재 / HMAC 자체 불일치) 가 동일 `CAFE24_INSTALL_INVALID_HMAC` 으로 응답하던 옛 동작을 유지하되, `logger.warn` 로 어느 분기인지·URL mall_id 와 DB mall_id 의 일치 여부·DB app_type/status/status_reason·install_token prefix+suffix 4자 를 기록한다. `client_secret` 자체는 절대 로그에 남기지 않는다 — `SECRET_LEAK_PATTERNS` 와 일관.
```

---

## 변경 5 — `spec/4-nodes/4-integration/4-cafe24.md` §9.4 step 5 동기화 확인 (Info)

**파일**: `spec/4-nodes/4-integration/4-cafe24.md`
**위치**: §9.4 step 5 (현재 line 386)

현재 본문이 "install_token 은 **보존** (post-install navigation 의 식별 키)" 으로 일관. **변경 불필요**. 본 항은 검토 완료 확인만.

---

## 영향 없는 영역 (확인)

- `spec/conventions/cafe24-api-metadata.md` — application 메타데이터 Resource 와 `credentials.app_type` 의 용어 중복은 의도적 분리 (consistency-check INFO #6) — 변경 없음.
- `spec/conventions/swagger.md` — `/api/3rd-party/` vs `/api/auth/oauth/` 명명 컨벤션 추가 권장 (INFO #5) 은 별도 plan 으로 분리. 본 draft 범위 밖.
- `spec/2-navigation/10-auth-flow.md` — `error=token_exchange_failed` 와 `oauth_token_exchange_failed` 분리는 의도적 (INFO #7) — 변경 없음.

---

## 검증 체크리스트 (consistency-check 호출 전 self-check)

- [x] 변경 1 의 새 텍스트가 `spec/2-navigation/4-integration.md` Rationale 및 `spec/4-nodes/4-integration/4-cafe24.md` §9.4 와 정합 (모두 "보존")
- [x] 변경 2 의 새 행이 §4.2 표 schema(요소|설명 2열) 와 호환
- [x] 변경 3 의 새 텍스트가 §10/§9.4 응답 envelope 규약(`{ data: ... }`) 과 충돌 없음 — DTO 필드 추가만
- [x] 변경 4 Rationale 항의 인용(§4.2, `renderInstallErrorHtml`, `Cafe24PrivatePending`) 가 실제 파일·섹션에 존재
- [x] `install_token` 형식(22자 base64url) 와 명명 정합 (Rationale 의 "install_token 을 App URL path 식별 키로 승격")
