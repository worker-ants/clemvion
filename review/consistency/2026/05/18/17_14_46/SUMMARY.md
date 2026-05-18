# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 작업 진행 가능.

- 검토 모드: spec draft 검토 (--spec)
- 대상: `spec/2-navigation/4-integration.md`
- 검토 시각: 2026-05-18T17:14:46

---

## 전체 위험도

**LOW** — Critical/BLOCK 사유 없음. WARNING 6건, INFO 23건. 문서 명확성 보강 권장 수준.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `connected → expired` 전이 경로가 §6 다이어그램에 누락 — refresh_token 없는 provider(예: GitHub PAT)의 만료 시 전이가 다이어그램에 표현되지 않음 | §6 상태 전이 다이어그램, §11.1 `connected-expiry` 잡 의사코드 | 동일 문서 §6 vs §11.1 | §6 다이어그램에 "refresh_token 없는 provider의 `connected → expired` (token_expires_at 만료 시 스캐너 전이)" 화살표 추가 |
| W-2 | Cross-Spec / Rationale | `IntegrationDto.autoRefresh` derived 필드 정의가 target과 `spec/1-data-model.md §2.10` 양쪽에 분산 — 향후 sync 탈락 위험 | §9.1 `autoRefresh` 설명 | `spec/1-data-model.md §2.10` | 어느 한쪽을 SoT 로 선언하고 나머지는 교차 참조 링크로 대체 |
| W-3 | Cross-Spec | `pending_install → pending_install (callback 실패 보존)` 전이 설명에서 §6 다이어그램이 `mode='reauthorize'` 컨텍스트를 누락 | §6 상태 전이 표 해당 행, §10.4 에러 매핑 | 동일 문서 §10.2 step 4 | §6 해당 행에 "Cafe24 Private 초기 install 흐름(OAuthState.mode='reauthorize' 재사용)에서 callback 처리 실패 시" 컨텍스트 명시 |
| W-4 | Cross-Spec / Naming | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` — 코드명이 Private 전용으로 읽히나 Public/Private 모두에 적용됨 | §9.4 에러 코드 표 | `spec/1-data-model.md §2.10` mall_id 컬럼 설명, §9.2 oauth/begin 비고 | 코드명을 `CAFE24_MALL_ALREADY_CONNECTED` 로 변경하거나 Swagger에 "public/private 무관 mall_id 기준 중복"임을 명시 |
| W-5 | Rationale | `connected-expiry` 0d 분기의 cafe24 알림 발사 서술이 §11.2 발사 정책("refresh_token 없는 provider에만 발사")과 표면상 충돌 — 어느 알림 type이 발사되는지, 정책 예외 여부가 불분명 | §11.1 의사코드 `remain <= 0d` cafe24 분기 "→ 알림" | §11.2 `integration_expired` 발사 정책 | §11.1에 알림 type 및 "§11.2 발사 정책 예외 케이스임" 명시, 또는 §11.2 텍스트에 cafe24 0d 분기 예외 단서 추가 |
| W-6 | Convention | §9.4 에러 응답 형식이 `{ code, message, details? }` 로 기술되어 API 규약 §5.3의 `{ "error": { "code", "message", "details" } }` 래퍼를 누락 | §9.4 공통 응답 포맷 "실패" 블록 | `spec/5-system/2-api-convention.md §5.3` | `{ "error": { "code": "...", "message": "...", "details": {...} } }` 형태로 수정 또는 "단축 표기"임을 규약에 명문화 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `INTEGRATION_INCOMPLETE` vs `INTEGRATION_NOT_CONNECTED` — `pending_install` 상태 거부 시 credentials 부재 오류 코드 재사용이 의미상 모호 | §9.1 비고, §14.1 에러 코드 표 | §14.1 `INTEGRATION_INCOMPLETE` 행 설명에 "pending_install(토큰 미발급)도 포함" 주석 추가 |
| I-2 | Cross-Spec | `notifyIntegrationExpiryByEmail` 채널이 `integration_action_required`에도 적용되나 데이터 모델 §2.19에 미언급 | §11.2 "채널" 항 | `spec/1-data-model.md §2.19` 또는 User 엔티티 필드 설명에 "양 알림 type에 모두 적용" 명시 |
| I-3 | Cross-Spec | `auth_type` Enum에서 `bearer_token` (데이터 모델) vs `bearer` (§5.3) 표기 혼재 | §5.3 서비스별 스키마 | §5.3의 `bearer`를 `bearer_token` (DB Enum 값)으로 통일 |
| I-4 | Cross-Spec | `request-scopes` 응답 shape이 §4.4와 §9.2에 분산 정의 — `scopesAdded` 포함 여부 기술 위치 불명확 | §4.4 분기 설명, §9.2 표 | §9.2를 SoT로 선언하고 완전한 응답 shape 명시. §4.4는 §9.2 참조로 대체 |
| I-5 | Rationale | `tryRecoverByMallId` 회복 흐름이 §9.4에서 Rationale 앵커를 참조하나 해당 항목 실존 확인 불가 | §9.2 `GET /api/3rd-party/cafe24/install/:installToken`, §9.4 `CAFE24_INSTALL_INVALID_TOKEN(404)` | Rationale "Cafe24 install_token mismatch 회복 흐름" 항 실존 확인 후 누락 시 추가 (조회 범위, 보안 전제 설명 포함) |
| I-6 | Rationale | `pending_install` §2.2 메뉴 서술 뒤 "Cafe24 Private 앱의 callback 실패 status 보존 항 참고" anchor 참조 미추가 | §2.2 메뉴 서술 | 독자 추적 편의를 위해 anchor 참조 추가 권장 |
| I-7 | Convention | `## Overview` 섹션 누락 — 권장 3섹션 중 진입 섹션 부재. blockquote 링크가 Overview를 대체하지 않음 | 문서 최상단 | 제목 아래에 `## Overview` 추가. 또는 `_product-overview.md`가 영역 진입 문서임을 명시하고 생략 의도 선언 |
| I-8 | Convention | 파일 제목 `# Spec: 통합 관리 화면` — `spec/` 하위에서 "Spec:" 접두는 의미 중복 | 파일 1번 라인 | `# 통합 관리 화면`으로 간결화 권장 (같은 영역 파일 전체 일괄 정리) |
| I-9 | Convention | §9.3 activity 응답이 `{ items[], summary }` 로 규약 `data` 키 대신 `items` 사용 | §9.3 응답 형식 | `{ data: [...], summary: {...} }`로 최상위 배열 키를 규약에 통일 |
| I-10 | Convention | `Cafe24PrecheckResultDto` 위치·파일명 패턴 미명세 | §9.2 응답 DTO | `dto/responses/cafe24-precheck-response.dto.ts` 위치 명시 또는 swagger 규약 §5-1 참조 링크 추가 |
| I-11 | Convention | Cafe24 API 카탈로그 내 `PUT` 메서드가 내부 API 규약과 혼동될 여지 | spec/conventions/cafe24-api-catalog/*.md | 카탈로그 `_overview.md`에 "이 카탈로그의 method는 외부 Cafe24 API의 것이며 내부 API 설계 규약과 무관" 한 줄 추가 |
| I-12 | Convention | `status_reason` DB 값은 snake_case, API 응답 필드명(statusReason vs status_reason) 명세 누락 | §6 상태 전이 표, §9.1 IntegrationDto | §9.1 또는 §13에서 JSON 필드명이 camelCase(`statusReason`)임을 명기 |
| I-13 | Convention | `install_token` 형식(`16바이트 base64url 22자`)이 동일 문서 3곳에 중복 기재 — 향후 정책 변경 시 부분 갱신 위험 | §3.2, §9.2(두 곳) | §5.8 또는 §13에 SoT 한 번 정의 후 다른 곳은 참조로 대체 |
| I-14 | Convention | `pending_install` 필터 파라미터 미노출이 §9.1 어디서도 명시적으로 선언되지 않음 | §9.1 `GET /api/integrations` status 허용값 | "※ `pending_install`은 필터 파라미터로 노출하지 않음 — §2.3 Rationale 참조" 한 줄 추가 |
| I-15 | Convention | `INTEGRATION_TEST_FAILED(422)`와 `pending_install` 가드의 `200 + success:false`가 §9.4에 주석 없이 공존 | §9.4 에러 코드 표 | `INTEGRATION_TEST_FAILED(422)` 행에 "단, pending_install 가드는 200 + {success:false} 반환 — §9.1 비고 참조" 추가 |
| I-16 | Plan | `plan/complete/integration-token-ui-autorefresh.md`가 미완료 체크박스를 가진 채 `complete/`에 위치 — CLAUDE.md 규칙 위반 | plan/complete/integration-token-ui-autorefresh.md | `plan/in-progress/`로 되돌리거나 체크리스트 실제 완료 여부 검증 후 미체크 항목 닫기 |
| I-17 | Plan | `cafe24-backlog-residual.md` F-2 (§6 mermaid install_token 보존 정책 명시) 미완료 — 선행 PR(restricted-scopes) 머지 여부 확인 필요 | plan/in-progress/cafe24-backlog-residual.md §F-2 | 선행 조건 확인 후 별도 worktree에서 §6 다이어그램 보강 |
| I-18 | Plan | `spec-draft-notification-dismiss.md` §4의 §11.2 dismiss 관계 수정 계획이 target 문서에 이미 부분 반영되어 있을 가능성 | plan/in-progress/spec-draft-notification-dismiss.md | 진입 시 §11.2 현행 텍스트 확인 후 already-resolved 처리 여부 판단 |
| I-19 | Plan | `spec-overview-ui-patterns-followup-2026-05-16.md` — §4.4 inline alert 패턴 참조화가 예정되어 향후 편집 필요 (현시점 충돌 없음) | plan/in-progress/spec-overview-ui-patterns-followup-2026-05-16.md | 현시점 수정 불필요. 해당 plan 착수 시 §4.4 서술과 패턴 정의 일치 확인 후 참조로 리팩터링 |
| I-20 | Naming | `Cafe24PrecheckResultDto` — `Integration` prefix 계열과 달리 `Cafe24` prefix 사용, 일관성 약화 | §9.2 응답 DTO | `IntegrationCafe24PrecheckDto` 또는 `Cafe24PrecheckDto`로 통일 검토 (필수 아님) |
| I-21 | Naming | `oauth_callback` postMessage 이벤트명 — 소셜 로그인 OAuth 흐름과 이름 공간 공유 가능성 (실질 충돌 낮음) | §3.5, §10.2 팝업 postMessage | `type: "integration_oauth_callback"`으로 구체화하거나 auth-flow spec에 소셜 로그인이 postMessage 미사용임을 명시 |
| I-22 | Naming | `appUrl` DTO 필드명이 환경변수 `APP_URL`과 동일 문서 안에서 혼재 | §9.1 IntegrationDto derived 필드 | `cafe24AppUrl` 또는 `installEntryUrl`로 구체화하거나 인라인 주석으로 "APP_URL 환경변수와 다른 개념" 명시 |
| I-23 | Naming | BullMQ 잡 이름 4종 — `spec/data-flow/5-integration.md`와 교차 확인 불가 (코퍼스 미포함) | §11.1 | `spec/data-flow/5-integration.md` 포함 시 잡 이름 일치 여부 추가 확인 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | §6 다이어그램에 refresh_token 없는 provider의 `connected→expired` 전이 경로 누락(W-1). `autoRefresh` derived 필드 이중 정의(W-2). 에러 코드명-범위 불일치(W-4). |
| Rationale Continuity | LOW | cafe24 0d 만료 분기 알림 type이 §11.2 발사 정책과 표면 충돌하며 Rationale 미갱신(W-5). `tryRecoverByMallId` Rationale 앵커 실존 불확실(I-5). |
| Convention Compliance | LOW | 에러 응답 `{ "error": {...} }` 래퍼 누락(W-6). `## Overview` 섹션 부재(I-7). `items` vs `data` 키 불일치(I-9). |
| Plan Coherence | LOW | `integration-token-ui-autorefresh.md`가 미완료 체크박스 포함한 채 `complete/` 위치(I-16, CLAUDE.md 규칙 위반). |
| Naming Collision | LOW | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드명이 실제 적용 범위(public/private 무관)와 불일치(W-4 통합). 직접 충돌하는 식별자 없음. |

---

## 본 PR 범위와의 관계

위 발견 중 본 PR 의 변경과 직접 인접한 후속 보강 후보:

- **I-1**: 본 PR 의 새 가드가 `INTEGRATION_INCOMPLETE` 를 `pending_install` 거부에 재사용 — §14.1 표 행 설명에 "pending_install(토큰 미발급)도 포함" 한 줄 보강 가능.
- **I-14**: `pending_install` 이 §9.1 filter status 허용값에 노출 안 됨을 명시 — 본 PR 의 §9.1 비고 갱신 인접.
- **I-15**: `INTEGRATION_TEST_FAILED(422)` 와 본 PR 의 `pending_install` 가드 `200 + success:false` 가 §9.4 에 공존 — 그 차이를 한 줄 명시.

나머지는 본 PR 의 변경과 무관한 사전 결함 / 분산된 spec drift — 별도 plan 으로 분리 권장.

---

## 권장 조치사항 (전체)

1. **(W-5, 즉시)** §11.2 `integration_expired` 발사 정책 텍스트에 "cafe24 0d 임계는 큐 enqueue 경로로 처리되며 발사 정책 예외" 단서 추가. §11.1 의사코드 "→ 알림" 라인에 알림 type 명시.
2. **(W-6, 즉시)** §9.4 에러 응답 예시를 `{ "error": { "code": "...", "message": "..." } }` 구조로 수정해 API 규약 §5.3과 일치시킴.
3. **(I-16, 즉시)** `plan/complete/integration-token-ui-autorefresh.md`를 `plan/in-progress/`로 복귀시키거나, 미체크 항목 전수 검증 후 완료 처리.
4. **(W-1, 단기)** §6 상태 전이 다이어그램에 "refresh_token 없는 provider의 `connected → expired`" 화살표 추가.
5. **(W-3, 단기)** §6 `pending_install → pending_install` 행에 `mode='reauthorize'` Cafe24 Private 컨텍스트 명시.
6. **(W-2, 단기)** `autoRefresh` 정의의 SoT를 target 문서 §9.1 또는 `spec/1-data-model.md §2.10` 중 하나로 선언하고, 나머지는 교차 참조 링크로 대체.
7. **(I-5, 단기)** Rationale "Cafe24 install_token mismatch 회복 흐름" 항 실존 여부 확인. 누락이면 보안 전제 설명 포함하여 추가.
8. **(W-4, 중기)** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 코드명 변경 검토(`CAFE24_MALL_ALREADY_CONNECTED`).
9. **(I-7, 중기)** 문서 최상단에 `## Overview` 섹션 추가 또는 생략 의도를 명시적으로 선언.
10. **(I-13, 중기)** `install_token` 형식 정의를 §5.8 또는 §13에 단일 SoT로 통합하고 나머지 2곳은 참조로 대체.
