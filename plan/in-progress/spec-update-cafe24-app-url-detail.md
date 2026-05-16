---
worktree: cafe24-app-url-detail-a7c3f4
started: 2026-05-16
owner: developer (project-planner 인계)
spec_files:
  - spec/2-navigation/4-integration.md
  - spec/data-flow/integration.md
  - spec/4-nodes/4-integration/4-cafe24.md
---

# Spec 갱신 제안 — Cafe24 App URL 상세 페이지 노출 + data-flow drift 정정

## 컨텍스트

`/consistency-check --impl-prep spec/2-navigation/4-integration.md` (세션: `review/consistency/2026/05/16/11_56_28/`) 결과 **BLOCK: YES**. Critical 1건 + 관련 Warning 3건이 spec 갱신을 선행 요구한다.

본 worktree(`cafe24-app-url-detail-a7c3f4`)는 다음 코드 변경을 준비 중이다 (구현은 spec 갱신 완료 후 착수):

1. `IntegrationsService.toPublic` 응답에 `appUrl: string | null` 추가 (Cafe24 Private 한정), `installToken` 응답에서 제거
2. `handleInstall` HMAC 실패 3 분기 진단 로그 추가
3. 통합 상세 페이지(`/integrations/[id]`)에 `Cafe24AppUrlCard` 컴포넌트 추가 — App URL/Redirect URI 복사 버튼 + 안내 문구

이 중 #1 과 #3 이 spec 정의가 누락된 채 코드 변경을 시도하면 SDD 위반. 또한 consistency-check 의 Critical 은 본 작업과 무관하게 누적된 spec drift이지만 본 worktree 의 `appUrl` 필드 신설로 인해 도드라지게 된다.

## 요청 변경

### Critical (BLOCK 해소 — 필수)

**1. `spec/data-flow/integration.md` §1.2.1 시퀀스 다이어그램 정정** (line 90)

옛:
```
Svc->>PG: UPDATE integration SET status=connected, install_token=NULL, credentials ENC, token_expires_at, last_rotated_at
```

새 (안):
```
Svc->>PG: UPDATE integration SET status=connected, credentials ENC, token_expires_at, last_rotated_at
```
(또는 명시적으로) `install_token 보존 (post-install navigation 식별 키)` 코멘트.

**근거**: `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상" (2026-05-15) 과 `spec/4-nodes/4-integration/4-cafe24.md` §9.4 step 5 "install_token 은 **보존**" 가 이미 일관되어 있다. data-flow spec 만 옛 (NULL 처리) 표현이 남아있어 직접 모순.

### Warning (구현 전 보강 — SDD 준수)

**2. `spec/2-navigation/4-integration.md` §4.2 Overview 탭 표에 `appUrl` 카드 행 추가**

기존 표 (라인 245-250) 다음에 행 추가:

| 요소 | 설명 |
| --- | --- |
| **App URL 카드 (Cafe24 Private 한정)** | `service_type='cafe24' AND credentials.app_type='private'` 일 때만 표시. App URL (`${APP_URL}/api/3rd-party/cafe24/install/:installToken`) 과 Redirect URI (`${APP_URL}/api/3rd-party/cafe24/callback`) 를 복사 버튼과 함께 노출. Cafe24 Developers Console 의 "앱 URL" 갱신용 — Rationale "Cafe24 App URL 상세 페이지 표시" 항 참조. |

**3. `spec/2-navigation/4-integration.md` §9.1 (API 표) `GET /api/integrations/:id` 응답 shape 정식 기술**

현재 표(line 675) 의 description 이 "상세 조회 (credentials는 마스킹)" 한 줄이다. 다음으로 보강:

> 응답: `IntegrationDto` (§4.2 의 Overview 필드 + 자격 증명 상태). Cafe24 Private 통합은 `appUrl: string` 필드를 추가로 포함 (`${APP_URL}/api/3rd-party/cafe24/install/:installToken` 형식 — 통합 상세 페이지 App URL 카드용). 그 외 통합은 `appUrl: null`. `install_token` 은 응답에 직접 노출되지 않으며 path segment 로만 포함된다 (식별자 분리 — Rationale 참조).

**4. `## Rationale` 에 신규 항 추가 — "Cafe24 App URL 상세 페이지 표시 (2026-05-16)"**

본문:
> Cafe24 admin "앱으로 가기" / "테스트 실행" 의 HMAC 검증 실패 에러 페이지(`renderInstallErrorHtml`) 는 사용자에게 "통합 상세 페이지에 표시된 URL 과 일치하는지 확인하세요" 라고 안내한다. 그러나 옛 상세 페이지에는 App URL 이 표시되지 않아 안내가 실효성을 잃었다 — 2026-05-16 사용자 보고. 해결안: 상세 페이지 Overview 탭에 `Cafe24AppUrlCard` 를 추가해 App URL/Redirect URI 를 노출. 백엔드는 `IntegrationDto.appUrl` 필드를 Cafe24 Private 한정으로 계산해 응답에 포함하며, `installToken` 은 별도 필드로 응답에 노출하지 않는다 — App URL path segment 안에 이미 포함되며 별도 필드 노출은 중복 + 식별자 분산. 새 등록 흐름의 `Cafe24PrivatePending` 컴포넌트와 동일한 복사 UX 패턴을 재사용한다. 본 변경은 `spec/data-flow/integration.md` §1.2.1 의 옛 `install_token=NULL` 표기 정정 (위 Critical) 과 함께 처리한다.

**5. `spec/4-nodes/4-integration/4-cafe24.md` §9.4 step 5 동기화 확인**

현재 line 386 이 "install_token 은 **보존**" 으로 이미 일관. 추가 변경 불필요. (체크 후 확인 완료 표기만)

### Info (선택 — 즉시 불필요)

**6. `spec/conventions/swagger.md` 에 통합 callback 경로 컨벤션 추가** — `/api/3rd-party/<provider>/...` vs `/api/auth/oauth/<provider>/...` 도메인 분리. 별도 plan 으로 분리 가능.

## 인계 대상

`project-planner` skill 이 본 plan 을 읽고 spec 3건을 갱신한 뒤 다시 본 worktree(`cafe24-app-url-detail-a7c3f4`) 의 developer skill 로 복귀해 구현 진행. 갱신 완료 후 `/consistency-check --impl-prep spec/2-navigation/4-integration.md` 재호출 → BLOCK: NO 확인.

## 영향 받는 spec 파일

- `spec/data-flow/integration.md` §1.2.1 시퀀스 line 90 정정 (Critical)
- `spec/2-navigation/4-integration.md` §4.2 표 행 추가, §9.1 응답 shape 보강, Rationale 신규 항 (Warning)
- `spec/4-nodes/4-integration/4-cafe24.md` §9.4 step 5 (no-op 확인)
