---
worktree: triggers-auth-column-a80393
started: 2026-05-29
owner: project-planner
---

# Spec draft — 2-trigger-list §2.1 "인증" 요소 추가 + R-15

## Overview (맥락)

`/triggers` 목록은 현재 상태·이름·유형·워크플로우·상세·최근 호출만 한 행에 노출한다.
트리거의 인증(AuthConfig) 연결 상태는 상세 드로어를 열어야만 확인 가능하다. 외부 HTTP
진입점인 webhook 트리거가 인증 미연결(`authConfigId == null`)이면 URL 을 아는 누구나
워크플로를 실행할 수 있어 취약하지만, 목록에서 이를 한눈에 식별할 방법이 없다. 본 증분은
목록 행에 "인증" 요소를 추가하고, 무인증 webhook 에 가시적 경고를 부여한다.
(작은 표시 증분이며 신규 도메인 정의가 아님.)

## 체크리스트 (spec 반영 시)

- [ ] §2.1 표에 "인증" 행 추가
- [ ] §2.2 NAV 요구사항 표에 NAV-TR-11 추가 + NAV-TR-10 인라인 필드 갱신 (`_product-overview.md`)
- [ ] Rationale R-15 추가
- [ ] 대상 spec frontmatter `pending_plans:` 에 `triggers-auth-column` 등록 (구현 plan 추적, `spec-impl-evidence.md §3`)

---

## 변경 1 — `2-trigger-list.md` §2.1 트리거 목록 항목 표

"유형 뱃지" 행 **다음**에 아래 행을 삽입:

```
| 인증 (AuthConfig 연결 상태) | 연결된 AuthConfig 의 타입 뱃지 (HMAC / Bearer / API Key / Basic Auth). 데이터 출처: 목록 응답의 `authConfigId` ([§3 GET /api/triggers](#3-api)) 와 워크스페이스 AuthConfig 목록([`GET /api/auth-configs`](./6-config.md#3-api))을 사전 조회한 `id → type` 매핑. **미설정 (`authConfigId == null`)**: `webhook` 타입은 외부 HTTP 노출 + 무인증이라 보안에 취약 → 경고 아이콘(⚠) + "인증 없음" 표시 (Rationale R-15). `schedule` / `manual` 타입은 inbound HTTP 인증이 해당 없음(N/A)이므로 `-` 로 표시 (경고 비대상). 셀의 "인증" 은 §2.3 의 "인증 설정" 상세 카드(AuthConfig binding 편집)와 동일 자원을 가리키는 목록 요약 표시다 |
```

> 열 머리글의 사용자 노출 라벨은 "인증" 으로 둔다 (i18n `triggers.authenticationLabel`). spec 내부 식별을 위해 본 표에서는 "(AuthConfig 연결 상태)" 를 병기해 §2.3 "인증 설정" 카드와 구분한다 (W-3 해소).

## 변경 2 — `_product-overview.md` §3.2 NAV 요구사항

(a) NAV-TR-10 의 인라인 인증 필드 목록을 R-14 (inline auth path 폐지) 에 맞춰 갱신:

```
| NAV-TR-10 | 트리거 상세 드로어에서 이름·`endpointPath`·인증(AuthConfig binding = `authConfigId`) 을 GUI 로 수정 가능. Schedule 트리거는 본 화면에서 cron 편집 불가 — "스케줄 관리에서 편집" 링크만 노출 | 필수 | 🚧 |
```

(b) NAV-TR-10 다음에 신규 요구사항 추가:

```
| NAV-TR-11 | 트리거 목록 행에 인증(AuthConfig) 연결 상태 표시. webhook 이 무인증이면 보안 경고 아이콘 노출 | 권장 | 🚧 |
```

## 변경 3 — `2-trigger-list.md` Rationale 신규 R-15

```
### R-15. 외부 노출 webhook 무인증 경고 표시 (2026-05-29)

§2.1 목록의 "인증" 요소는 `webhook` 트리거가 `authConfigId == null` 인 경우 경고 아이콘을 표시한다. (강제 차단이 아니라 가시적 위험 신호.)

근거:
- webhook 은 외부에 공개된 HTTP 진입점이다 ([§2.4 Webhook URL 형식](#24-webhook-url-형식)). 인증(AuthConfig) 이 binding 되지 않으면 URL 을 아는 누구나 워크플로 실행을 트리거할 수 있어 무단 실행·자원 남용·데이터 주입에 노출된다.
- `schedule` / `manual` 트리거는 외부 HTTP 진입점이 아니다 (schedule 은 내부 cron sweep, manual 은 인증된 UI/API 호출). 무인증이어도 외부 노출 위험이 없으므로 경고 비대상 — `-` (N/A) 표시.
- 경고는 차단이 아니라 신호다. [WH-SC-01](../5-system/12-webhook.md) 은 "인증 없음" 을 지원되는 공개 옵션으로 두고 `endpointPath` 의 UUID 가 사실상 capability token 역할을 겸한다고 정의한다. 본 경고는 그 결정을 바꾸지 않으며, 사용자가 무인증을 **의도적으로 선택했는지** 확인하도록 돕는 가시성 장치일 뿐이다 (강제 인증 아님). AuthConfig binding 정책 자체는 [§2.3.1 Auth Config 행](#231-필드-권한-매트릭스) + [R-14](#r-14-authconfigid-v1-격상--inline-인증-필드-제거-2026-05-28) 가 SoT.

대안:
1. (채택) 목록 행에 webhook 한정 경고 아이콘: 무인증 webhook 을 한눈에 식별. `authConfigId` 가 이미 목록 응답에 포함되어 추가 비용 낮음.
2. (기각) 생성/저장 시 무인증 차단: WH-SC-01 의 공개 옵션·신뢰 네트워크 webhook 등 정당한 use case 를 막아 과도.
3. (기각) 모든 타입에 경고 표시: schedule / manual 은 외부 HTTP 노출이 아니라 noise 만 증가.

발견 경로: 사용자 요청 (2026-05-29) — "/triggers 목록 유형 다음에 인증 항목 추가 + 외부 노출 webhook 무인증 시 경고 아이콘".
```

> **Rationale ID 번호**: 본 파일의 다음 순번 `R-15` 를 사용한다. spec 전반은 **파일별 독립 Rationale 번호** 가 확립된 컨벤션이다 (`R-2` 는 7개 파일, `R-3`/`R-5` 는 각 4개 파일에서 재사용 — `grep -rl "^### R-N" spec` 로 검증). 따라서 `spec/6-brand.md §8 R-15` 와의 전역 문자열 충돌은 by-design 이며 실제 의미 충돌이 아니다 (consistency-check C-1 = 검증된 false positive).

## frontmatter (대상 spec)

기존 `status: spec-only` 유지. `pending_plans:` 에 `triggers-auth-column` 추가 (구현 plan 추적). `code:` anchor 연결은 구현 PR 에서 처리.
