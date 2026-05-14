§13 데이터 모델 요약과 §6 상태 전이 다이어그램의 현황, PRs 상태를 확인했습니다.

---

## Plan Coherence Check — 결과 (--impl-prep)

**Target**: `spec/2-navigation/4-integration.md`  
**Scope**: `cafe24-3rdparty-url-503aa0` worktree Phase 2 구현 착수 전

---

### 발견사항

---

**[WARNING] §13 데이터 모델 영향 요약에 신규 필드 3종 누락**

- **target 위치**: `spec/2-navigation/4-integration.md` §13 (line 840–843)
- **관련 plan**: `cafe24-pending-polish-followup.md` Group F — "§13 데이터 모델 요약에 `install_token` 누락 보완" (미해결 체크박스)
- **상세**: §13은 현재 `status_reason`, `last_used_at`, `last_rotated_at`, `last_error` 4개 필드만 나열. 이후 추가된 `install_token_issued_at` (V044), `mall_id` plain column (V045), `install_token` 자체가 모두 누락. 또한 현재 Phase 2는 `install_token` 형식을 hex→base64url로 바꾸는 변경이어서, §13을 읽는 독자에게 `install_token`의 존재 자체가 보이지 않는 상태. `cafe24-pending-polish-followup.md` Group F에 이미 오픈된 항목이나, 활성 worktree가 없어 "떨어지는" 위험이 있음.
- **제안**: Phase 2 작업 scope에 `spec/2-navigation/4-integration.md` §13 갱신(`install_token`, `install_token_issued_at`, `mall_id` 행 추가)을 명시하거나, `cafe24-app-url-3rdparty-shorten.md` plan의 Phase 2 체크리스트에 이 항목을 추가. `cafe24-pending-polish-followup.md` Group F의 해당 체크박스는 완료 처리.

---

**[WARNING] `Cafe24PrivatePendingStep` 컴포넌트 — 병렬 worktree 편집 가능성**

- **target 위치**: `cafe24-app-url-3rdparty-shorten.md` Phase 2 프론트엔드 항목 — "`Cafe24PrivatePendingStep` i18n 안내문: '100자를 넘지 않습니다.' 명시"
- **관련 plan**: `cafe24-pending-polish.md` 변경 1 (미체크) — `Cafe24PrivatePendingStep`에 `useQuery` 폴링 + 연결 전이 + statusReason UI + 10분 타임아웃 추가. `cafe24-pending-polish-followup.md` PRs #18–#21 "머지 대기"
- **상세**: `cafe24-pending-polish-7fdb7e` worktree의 PR #18이 git log 상 아직 merge 되지 않았다. 이 worktree가 변경 0의 일환으로 `Cafe24PrivatePendingStep` 또는 그 status-badge 진단 UI를 이미 손댄 상태일 수 있어, 현재 worktree에서 같은 컴포넌트를 추가 편집하면 merge conflict 발생 가능.
- **제안**: Phase 2 착수 전 PR #18 merge 여부 확인. 미merge 상태라면 PR #18의 해당 파일 변경 범위를 확인 후, i18n 안내문 변경을 PR #18 이후(또는 그 브랜치 위)에서 수행할지 직렬화 계획을 plan에 명시.

---

**[INFO] Group D swagger — 구 컨트롤러 참조가 신 컨트롤러로 재지향 필요**

- **target 위치**: Phase 2 — `swagger 갱신 (@ApiOperation, @ApiResponse)`
- **관련 plan**: `cafe24-pending-polish-followup.md` Group D — "신규 에러 코드 2종 `@ApiResponse` 데코레이터: `CAFE24_INSTALL_INVALID_TOKEN(404)`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)`"
- **상세**: Group D 항목은 기존 `IntegrationsController`(`/api/integrations/oauth/...`)에 데코레이터를 추가하는 것으로 작성되었는데, Phase 2에서 해당 핸들러를 삭제하고 신규 `3rd-party` 컨트롤러를 만든다. 구 컨트롤러가 사라지면 Group D 항목은 자연 소멸되지만, 신 컨트롤러에 동일 에러코드 swagger가 빠질 수 있음.
- **제안**: Phase 2 swagger 갱신 체크리스트에 `CAFE24_INSTALL_INVALID_TOKEN(404)`, `CAFE24_INSTALL_INVALID_HMAC(403)`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` 세 에러코드를 신 컨트롤러에 명시적으로 포함. 작업 완료 후 `cafe24-pending-polish-followup.md` Group D 해당 체크박스를 완료 처리.

---

**[INFO] §6 상태 전이 다이어그램 — `install_token` callback 실패 시 보존 명시 부재**

- **target 위치**: `spec/2-navigation/4-integration.md` §6 mermaid (line 552–571)
- **관련 plan**: `cafe24-pending-polish-followup.md` Group F — "§6 mermaid `install_token` 보존 정책 명시"
- **상세**: §6 mermaid 다이어그램에 callback 실패 루프는 표기되어 있으나 "install_token은 실패 시 소거되지 않는다 → 재시도 가능"라는 텍스트 레벨 보강이 없음. §10.4 표와 §6 표에는 이미 관련 정보가 있어 기능적 정합성은 유지되지만, 다이어그램 단독으로 읽을 때 오독 여지. 이 항목은 현재 active worktree 없음.
- **제안**: blocking 아님. `cafe24-pending-polish-followup.md` Group F 항목 처리 시 함께 보완. 현 Phase 2 scope에 포함할 필요 없음.

---

### 요약

Phase 1 spec 개정은 정상 완료 — `/api/3rd-party/...` namespace, 16바이트 base64url 토큰, Rationale 모두 spec에 반영돼 있다. Phase 2 구현 착수를 막는 **Critical 위배는 없다**. 다만 두 가지 WARNING을 사전에 정리하는 것이 권고된다: ① §13 데이터 모델 요약에 `install_token`·`install_token_issued_at`·`mall_id` 세 필드가 빠져 있고 Phase 2 이후에도 수습 plan이 명확하지 않은 점, ② PR #18(`cafe24-pending-polish-7fdb7e`)이 미merge 상태일 경우 `Cafe24PrivatePendingStep` 동시 편집 충돌 가능성.

### 위험도

**LOW** — Critical 없음. WARNING 두 건 모두 Phase 2 착수 전 5분 내 확인·기록으로 해소 가능한 수준.