---
worktree: cafe24-pending-polish-7fdb7e
started: 2026-05-14
owner: developer (작성) → project-planner (수행)
---

# Spec Update Proposal — Cafe24 Pending Install 정비

## 배경

Cafe24 private "Pending install" 멈춤 사례 분석 (`/Users/gehrig/.claude/plans/cafe24-private-piped-pudding.md`) 결과 다음 5건의 코드 변경을 한 PR 로 진행하려 한다:

- **변경 0**: callback 실패 관측성 (last_error/status_reason 기록, popup auto-close 지연)
- **변경 1**: FE pending-step 폴링 + 목록 갱신 정책
- **변경 2**: `install_token` 을 App URL 식별 키로 승격 (라우트 변경 `/oauth/install/cafe24/:installToken`)
- **변경 3**: 중복 `pending_install` 방지
- **변경 4**: `pending_install` TTL 24h 정리 (→ `expired` 전이)
- **변경 5**: 테스트 보강

`consistency-check --impl-prep spec/2-navigation/4-integration.md` (`review/consistency/2026-05-14_16-48-25/SUMMARY.md`) 가 **BLOCK: YES** 로 4 Critical + 7 Warning + 6 Info 위배를 보고했다. 본 노트는 BLOCK 해소를 위해 project-planner 가 수행해야 할 spec 갱신 작업을 모은다.

## project-planner 위임 작업

### A. spec/1-data-model.md §2.10 (Integration 엔티티)

**Critical**

- **C1**: `Integration.status` Enum 에 `pending_install` 추가. 의미: "Cafe24 Private 앱이 폼 제출은 됐으나 Cafe24 'Test Run' 콜백이 아직 성공하지 못한 상태. 노드·AI Agent 에서 사용 불가."
- **C2**: 엔티티 필드 목록에 `install_token` 컬럼 추가. 타입 `varchar(64) NULL`. 설명: "Cafe24 Private 앱 설치 흐름 식별 키. begin 시 32바이트 랜덤 발급, callback 성공 시 NULL 소거. Cafe24 private 전용."
- (선택) 인덱스 `idx_integration_pending_install_workspace_status` — `(workspace_id, status) WHERE status='pending_install'` 부분 인덱스. TTL 정리 배치 + 변경 3 중복 방지 조회 양쪽에서 사용. ※ 현행 `idx_integration_workspace_status` 가 이미 같은 (workspace_id, status) 키이므로 부분 인덱스 도입 여부는 project-planner 판단.

### B. spec/2-navigation/4-integration.md

**Critical**

- **C3** — §6 상태 머신 갱신:
  - 다이어그램에 `pending_install → expired (install_timeout, TTL 24h)` 자동 전이 추가.
  - 기존 `pending_install → (삭제)` 화살표는 **manual delete** 전용으로 한정 표기 (자동 삭제 아님).
  - 전이 표에 새 행: `pending_install → expired` 트리거 = "install_token 발급 후 24시간 내 callback 미성공 → 일일 스캐너가 자동 전이, statusReason='install_timeout'".

- **C4** — §3.2 / §9.2 API 계약 갱신:
  - §9.2 의 `GET /api/integrations/oauth/install/cafe24` 엔트리를 `GET /api/integrations/oauth/install/cafe24/:installToken` 으로 교체.
  - §3.2 응답 예시의 `appUrl` 값이 `${APP_URL}/api/integrations/oauth/install/cafe24/${installToken}` 형태임을 명시.
  - 기존 토큰 없는 라우트는 **410 Gone + `CAFE24_INSTALL_LEGACY_PATH` 안내**로 응답 (운영 중인 외부 등록 URL 잔존 가능성). 영구 폐기 시점은 별도 plan.
  - 식별 절차: HMAC mall_id 스캔 (현행 in-memory 100건) 대신 `install_token` 단일 row 조회 → 그 row 의 client_secret 으로 HMAC 1회 검증.
  - §9.4 에러 코드 목록에 추가:
    - `CAFE24_INSTALL_INVALID_TOKEN` (404) — install_token 미존재 또는 이미 소비됨
    - `CAFE24_INSTALL_LEGACY_PATH` (410) — install_token 없는 옛 경로
    - `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (400) — 동일 (workspaceId, mall_id) 에 이미 connected 통합 존재 (W2)

**Warning**

- **W1** — §10.4 에러 매핑 표에 새 행 추가:
  | 에러 | 팝업 표시 | Integration 상태 |
  |------|----------|----------------|
  | callback 실패 (pending_install 상태) | provider 별 에러 메시지 (auto-close 3~5초 지연) | **status 유지(`pending_install`)**, `last_error` + `status_reason` 기록. 사용자가 cafe24 측 설정을 고치고 재시도 가능 |
  | 코드 교환 실패 (connected/reauthorize) | (기존) | `error(auth_failed)` (기존) + `last_error` 기록 |

  추가로 §10.2 처리 플로우 마지막에 "callback 실패 시에도 컨트롤러는 callback HTML(`status:'error'`)을 반환하고, integrationId 가 식별되면 `last_error`/`status_reason` 을 갱신한다 (status 자체는 보존)" 1문장 추가.

- **W3** — §2.2 (목록 카드 표시) 갱신:
  - `pending_install` 상태의 아이콘 ⏳ / 라벨 "Pending install" / 부가 설명 "Complete Cafe24 'Test Run' to activate" 명시.
  - statusReason 또는 lastError 가 채워졌으면 카드 하단에 진단 단서 노출 (예: "Last error: OAUTH_TOKEN_EXCHANGE_FAILED — Failed to exchange authorization code").
  - ⋮ 메뉴 허용 액션: Delete 만 허용 (Reauthorize/Test/Rotate 등은 비활성). Rationale: install 이 아직 안 끝났으므로 reauthorize 가 의미 없고, Cafe24 에서 "Test Run" 을 다시 누르는 흐름이 정식.
  - §2.4 "Need attention" 배너 조건에 `pending_install AND statusReason IS NOT NULL` 포함 여부 명시 (제안: 포함하지 않음 — 사용자가 cafe24 외부 흐름을 진행 중이라 attention 으로 보기 모호).

- (편의) §14.2 의 "Resource 단위 grouping" 표현이 `spec/conventions/cafe24-api-metadata.md §6` 의 "카테고리 단위 grouping" 과 상충 → "카테고리" 로 단어 1개 교정 (W7).

### C. spec/data-flow/integration.md §3.2

**Warning**

- **W5**: `expired.statusReason` 허용 값 표에 `install_timeout` 추가 (현재 `token_expired`, `refresh_failed` 만 있음).

### D. (선택) Rationale 섹션

- `spec/2-navigation/4-integration.md` 본문 끝에 `## Rationale` 섹션 신설하여 다음 결정 근거를 한 곳에 모음 (I5):
  - 왜 callback 실패 시 status 를 보존하나? — 외부 흐름(cafe24 측 설정 수정 후 재시도) 가능성을 살림. `error` 로 전이하면 사용자에게 "수동 reauthorize" 액션이 노출되지만 private 앱은 reauthorize 가 불가능하고 cafe24 "Test Run" 만 정식.
  - 왜 install_token 으로 식별 키를 옮기나? — 현행 in-memory 100건 스캔의 O(N) 비용 + 같은 mall_id 의 중복 pending_install 행 발생 시 HMAC 매칭이 비결정적이라는 운영 위험 해소.
  - 왜 24h TTL 인가? — Cafe24 Developers 등록·테스트 실행 까지 사용자 작업 텀을 최대 1일 가정. 더 길면 stale 행 누적 / 짧으면 정상 흐름 차단.

## 작업 후 재실행 명령

project-planner 가 위 갱신을 spec 본문에 반영한 뒤, 다음 명령으로 BLOCK 해소를 확인한다:

```bash
python3 .claude/skills/consistency-checker/hooks/consistency_orchestrator.py --impl-prep spec/2-navigation/4-integration.md
```

종료 코드 0 (또는 1 = Warning 만 남음) 이 되면 developer skill 의 4단계(DOCUMENTATION 업데이트) 부터 재진입한다.
