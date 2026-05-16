---
worktree: cafe24-mall-dup-ux-a7f2c8
started: 2026-05-16
owner: developer → project-planner 위임 예정
---

# Spec 갱신 제안 — Cafe24 Public 흐름 중복 가드 + Precheck endpoint

## 배경

`spec/2-navigation/4-integration.md` §9.2 / §9.4 errors 목록 / Rationale 모두 "Cafe24 **Private** 흐름 진입 시" 만 명시. 실제로는 Public 흐름도 동일한 V045 partial UNIQUE constraint 의 대상이며, 같은 mall_id 의 중복 추가는 app_type 무관으로 금지된다. 사용자가 Cafe24 동의까지 마친 뒤 finalize 단계에서 500 으로 빠지는 UX 결함을 해소하기 위해 begin 단계 사전 가드를 public 에도 추가.

## 변경 요청

### §9.2 OAuth begin 표 한 줄
> 옛: **※ Cafe24 Private 흐름 진입 시** 동일 `(workspaceId, mall_id)` 의 ...
>
> 신: **※ Cafe24 흐름 (app_type 무관) 진입 시** 동일 `(workspaceId, mall_id)` 의 cafe24 Integration 중 `status='connected'` 인 row 가 존재하면 begin 자체가 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 으로 즉시 거부된다. 다른 status (`pending_install` / `expired` / `error`) 는 V045 partial UNIQUE 가 finalize 단계에서 동일 409 로 변환한다 (race backstop).

### §9.2 신규 행 추가
> | GET | `/api/integrations/cafe24/precheck` | 사용자가 mall_id 입력 단계에서 호출하는 사전 중복 감지. 쿼리: `mallId` (`^[a-z0-9-]{3,50}$`). 응답: `{ conflict: bool, existingIntegrationId?: string, existingName?: string, status?: 'connected'\|'pending_install'\|'expired'\|'error' }`. 인증된 사용자의 current workspace 기준. throttle (분당 60회). |

### §9.4 errors 보강
- `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 의 설명에 "**app_type='public' 흐름의 finalize (POST /api/integrations) 단계에서도** 동일 V045 UNIQUE 위반이 본 코드로 변환된다 (race backstop)" 추가.

### Rationale 보강
신설 항목: "**Cafe24 Public 흐름의 begin-time 사전 가드 추가 (2026-05-16)**"
> Public 흐름은 begin 단계에서 Integration row 를 만들지 않으므로 V045 partial UNIQUE 가 발사되는 시점이 finalize (`POST /api/integrations`) 단계로 미뤄진다. 사용자가 Cafe24 동의 페이지까지 마친 뒤에야 충돌이 드러나는 UX 결함을 막기 위해 begin 단계에서 `status='connected'` row 를 사전 SELECT 로 검출해 409 로 즉시 거부한다. 다른 status (pending_install/expired/error) 는 정상 진행 → V045 backstop. 이로써 private 흐름의 기존 동작과 정합.

신설 항목: "**precheck endpoint — mall_id 입력 단계 사전 감지 UX**"
> 사용자가 mall_id 를 다 입력하기 전(타이핑 중)에 conflict 를 감지해 inline 경고로 보여주기 위한 read-only endpoint. begin 의 pre-check 로직과 동일한 SELECT 를 노출하되, 모든 status 정보 (connected/pending_install/expired/error) 를 함께 반환해 프론트가 케이스별 안내 메시지를 분기. 401/403 같은 인증 정보 누설을 방지하기 위해 응답에 `existingName` 만 포함 (자격 증명·토큰·timestamps 비노출). throttle (분당 60회) 로 brute-force enumeration 차단 — 정상 사용자는 350ms debounce 1~2회/입력.

## 영향 범위 점검

- `spec/2-navigation/4-integration.md` — §9.2 (begin 한 줄, precheck 행), §9.4 (error 설명 보강), Rationale 2개 항목 신설
- `spec/data-flow/5-integration.md` — `integration` 테이블 V045/V046 설명에 변경 없음 (constraint 자체 유지)
- `spec/1-data-model.md` §3 — 변경 없음
- `spec/conventions/swagger.md` §2-4 — `INTEGRATION_IN_USE(409)` 와 동일 정책

## 위임

본 변경은 spec 본문 수정이라 developer 권한 밖. project-planner 가 위 변경을 spec 에 반영해야 한다.
