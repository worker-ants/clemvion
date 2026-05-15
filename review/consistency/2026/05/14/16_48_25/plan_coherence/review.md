spec 파일과 plan을 모두 읽었습니다. 정합성 검토를 수행합니다.

---

## Plan Coherence Check 결과

**검토 대상**: `spec/2-navigation/4-integration.md`
**검토 모드**: `--impl-prep` (구현 착수 전)
**참조 plan**: `plan/in-progress/cafe24-pending-polish.md`

---

### 발견사항

---

- **[CRITICAL]** 변경 4의 `pending_install → expired` 전이가 spec §6 상태 머신과 직접 충돌
  - **target 위치**: `plan/in-progress/cafe24-pending-polish.md` §변경 4 — "status='expired', statusReason='install_timeout'"
  - **관련 spec**: `spec/2-navigation/4-integration.md` §6 상태 머신 다이어그램 + 전이 테이블
  - **상세**: 현재 spec §6는 `pending_install`의 TTL 만료 결과를 명시적으로 **`(삭제)`** 로 정의한다 (`install timeout / manual delete ──▶ (삭제)`). plan은 이를 `status='expired', statusReason='install_timeout'`으로 변경하려 하는데, 이는 spec이 정의한 삭제 동작과 정면 충돌한다. 또한 현재 spec에서 `expired` 상태는 오직 `connected` Integration의 OAuth 토큰 만료에만 사용되며, `pending_install` Integration에 `expired` 전이가 추가되면 §6 note("pending_install은 노드·AI Agent에서 사용할 수 없다")의 적용 범위가 `expired` 상태에도 확장되어야 한다는 점도 spec에 미명시.
  - **제안**: 구현 전에 `project-planner` 가 spec §6를 다음 세 가지를 반영해 갱신해야 한다: (a) `pending_install → expired` 자동 전이 추가, (b) 기존 `→ (삭제)` 동작이 manual delete에만 남도록 수정, (c) `expired` 상태 note에 `pending_install` TTL 만료 케이스 명시. plan이 이미 "spec §6 갱신 필요"를 인식하고 있으나 CRITICAL로 분류한 이유는 **현재 spec과 구현 의도가 반대 방향**이기 때문이다 — spec대로 구현하면 삭제, plan대로 구현하면 expired.

---

- **[CRITICAL]** 변경 2의 installToken 경로 URL이 spec §9.2 / §3.2와 직접 충돌
  - **target 위치**: `plan/in-progress/cafe24-pending-polish.md` §변경 2 — `@Get('oauth/install/cafe24/:installToken')` + appUrl 변경
  - **관련 spec**: `spec/2-navigation/4-integration.md` §9.2 (GET `/api/integrations/oauth/install/cafe24`) + §3.2 Private 앱 응답 예시 (`"appUrl": "https://.../oauth/install/cafe24"`)
  - **상세**: 현재 spec §9.2는 `GET /api/integrations/oauth/install/cafe24`(토큰 없는 경로)를 명시하며, §3.2 응답 예시의 `appUrl`도 토큰이 없다. plan은 경로를 `oauth/install/cafe24/:installToken`으로, appUrl을 `${appUrl}/api/integrations/oauth/install/cafe24/${installToken}`으로 변경하려 한다. 기존 경로 제거(410 Gone) 시 이미 Cafe24 Developers에 등록한 App URL이 있는 사용자는 즉시 파손된다. plan이 "spec 갱신 필요(§9.2 / §9.4 / §9.8)"를 인식하고 있으나 spec 갱신 전 구현 착수는 불가.
  - **제안**: `project-planner` 가 spec §9.2 경로, §3.2 응답 예시(`appUrl` 값), §9.4 에러 응답 테이블을 갱신한 뒤 구현 착수. 기존 경로 제거가 외부 사용자에게 미치는 영향(Cafe24 Developers에 등록된 App URL) 정책도 spec에 명시 필요.

---

- **[WARNING]** 변경 0의 callback 실패 시 `status` 유지 정책이 spec §6 / §10.4에 미명시
  - **target 위치**: `plan/in-progress/cafe24-pending-polish.md` §변경 0 — "`status` 는 **유지** (`pending_install` → 그대로)"
  - **관련 spec**: `spec/2-navigation/4-integration.md` §10.4 에러 매핑 테이블 + §6 상태 머신
  - **상세**: 현재 spec §10.4는 "코드 교환 실패 → reauthorize면 `error(auth_failed)`"만 명시하고, `pending_install` 상태의 Integration이 callback에서 실패했을 때 상태가 유지된다는 정책은 없다. `markIntegrationCallbackError`가 `status`를 바꾸지 않는다는 계약이 spec에 없으면 미래 구현자가 `pending_install → error`로 전이시킬 수 있다. plan이 이 항목도 "project-planner 위임 후 consistency-check 통과"로 올바르게 분류하고 있으나, 변경 0 구현 시 spec 선행 갱신 여부를 재확인해야 한다.
  - **제안**: spec §10.4 에러 매핑 테이블에 `pending_install` 상태의 callback 실패 시 동작 행을 추가 (예: "콜백 실패 (pending_install 상태) → status 유지, last_error + status_reason 기록"). §6 상태 머신 note에도 이 예외 동작 명시. 변경 0의 *코드 구현* (ErrorClass 생성, controller try/catch 변경)은 spec 갱신과 무관하게 착수 가능하나, spec 갱신 항목(`spec/2-navigation/4-integration.md §6 / §10`)은 project-planner 위임 후 착수.

---

- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드가 spec §9.4에 미등재
  - **target 위치**: `plan/in-progress/cafe24-pending-polish.md` §변경 3 — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (400)
  - **관련 spec**: `spec/2-navigation/4-integration.md` §9.4 공통 응답 포맷 에러 코드 목록
  - **상세**: 현재 spec §9.4의 에러 코드 목록(`INTEGRATION_IN_USE`, `INTEGRATION_TEST_FAILED`, `OAUTH_STATE_MISMATCH`, `OAUTH_CONFIG_MISSING`, `INSUFFICIENT_SCOPE`)에 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`가 없다. 변경 3은 이 에러 코드를 반환하는 새 분기를 추가하는데, spec에 없는 에러 코드를 구현만 추가하면 API Contract 검토자(FE 등)가 대응 처리를 알 방법이 없다.
  - **제안**: spec §9.4 에러 코드 목록에 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (400)` 추가. 변경 2/3/4의 spec 갱신 묶음에 포함.

---

- **[INFO]** 변경 4의 `installToken=null` 초기화가 spec §5.8 credentials JSONB 스키마와의 관계 불명확
  - **target 위치**: `plan/in-progress/cafe24-pending-polish.md` §변경 4 — `installToken=null`
  - **관련 spec**: `spec/2-navigation/4-integration.md` §5.8 credentials JSONB 스키마
  - **상세**: `installToken`은 spec §5.8 credentials JSONB 스키마 테이블에 정의되어 있지 않다(엔티티 컬럼으로만 존재). TTL 만료 후 `installToken=null` 처리는 구현상 명확하나, spec이 이 컬럼을 전혀 언급하지 않아 미래 참조 시 혼란 가능성 있음.
  - **제안**: 필수 변경은 아니나, spec §5.8 또는 §6 note에 `install_token` 컬럼의 라이프사이클(Private pending 생성 시 발급 → TTL 만료 시 null 처리) 한 줄 언급 추가를 권장.

---

- **[INFO]** worktree 충돌 없음 확인
  - `spec/2-navigation/4-integration.md`를 동시에 수정 중인 다른 plan이 없음. `node-output-redesign`, `ai-agent-tool-connection-rewrite`, `background-monitoring-api` 등 다른 진행 중 plan은 이 파일을 참조하지 않음.

---

### 요약

`cafe24-pending-polish` plan은 `spec/2-navigation/4-integration.md`에 대해 **두 개의 CRITICAL 충돌**을 안고 있다. 변경 4의 TTL 만료 동작(`pending_install → expired`)과 변경 2의 App URL 경로(`/oauth/install/cafe24/:installToken`)는 현재 spec과 **반대** 방향이거나 정의 자체가 없어, 구현 착수 전 `project-planner`를 통한 spec 선행 갱신이 필수다. plan이 "spec 갱신 필요"를 이미 인식하고 있다는 점은 긍정적이나, 두 CRITICAL 항목이 해소되기 전까지 **변경 2 · 변경 4 구현 착수는 차단**된다. 변경 0의 순수 코드 부분(`CallbackFailure` 클래스, controller try/catch)과 변경 1의 FE 폴링은 spec 갱신 없이 착수 가능하다.

### 위험도

**HIGH** — CRITICAL 2건이 spec과 구현 방향이 반대이거나 정의 부재. spec 선행 갱신 없이 변경 2·4를 구현하면 spec이 틀리거나 구현이 틀린 상태가 된다.