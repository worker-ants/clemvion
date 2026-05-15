`spec-update-cafe24-pending-polish.md`(위임 원본)을 확인했습니다. 이제 교차 분석을 완료합니다.

---

## 발견사항

### - **[WARNING]** `markIntegrationCallbackError` 의 `connected` status 처리가 spec draft 및 위임 원본과 충돌

- **target 위치:** DRAFT 2G §10.4 표 — "코드 교환 실패 (mode=`reauthorize`, status=`connected`) → `error(auth_failed)` + `last_error` 기록"
- **관련 plan:** `plan/in-progress/cafe24-pending-polish.md` 변경 0

```
`markIntegrationCallbackError` …
`status` 는 **유지** (`pending_install` → 그대로 / `connected` → 그대로).
```

- **상세:** 위임 원본(`spec-update-cafe24-pending-polish.md` §B W1)도 명시적으로 "`connected/reauthorize` 코드 교환 실패는 `error(auth_failed)` (기존)" 이라고 분리 표기했다. spec draft와 위임 원본이 동일하게 `connected` 는 status **전이**, `pending_install` 는 status **보존** 으로 명세하는데, 구현 plan의 `markIntegrationCallbackError` 설명("status 유지 for both")은 이와 정반대다. 이 메서드를 문자 그대로 구현하면 기존의 `connected → error(auth_failed)` 전이를 깨뜨리게 된다.
- **제안:** `cafe24-pending-polish.md` 변경 0을 아래 중 하나로 수정한다.
  - (a) `markIntegrationCallbackError`를 `pending_install` 전용으로 명시("status 유지, pending_install 행에만 적용") + `connected` 의 `error(auth_failed)` 전이는 기존 코드 경로에 위임.
  - (b) 메서드를 상태 조건부로 서술("token exchange failure + connected → `error(auth_failed)`, 그 외 → status 보존 + last_error 기록").

---

### - **[WARNING]** 레거시 경로 영구 폐기 후속 항목이 implementation plan에 없음

- **target 위치:** DRAFT 2I Rationale "install_token 을 App URL path 식별 키로 승격" 단락 마지막 줄
  > "영구 폐기 시점은 `plan/in-progress/cafe24-pending-polish.md` 의 후속 항목으로 추가 (운영 데이터·외부 등록 URL 잔존 여부 확인 후 결정)"
- **관련 plan:** `plan/in-progress/cafe24-pending-polish.md` (변경 2, 전체)
- **상세:** spec draft가 이 문서를 update 대상으로 명시했지만, 현재 `cafe24-pending-polish.md`에 `/oauth/install/cafe24` 영구 폐기 결정 체크박스가 없다. spec 적용 후에도 이 항목이 빠진 채 PR이 머지되면 410 Gone 상태로 레거시 경로가 무기한 유지된다.
- **제안:** spec 적용과 함께(또는 직후) `cafe24-pending-polish.md` 변경 2 아래에 후속 체크박스 추가.

  ```markdown
  - [ ] (후속) 레거시 경로 `/oauth/install/cafe24` 영구 폐기 결정 — 운영 데이터·Cafe24 Developers 등록 URL 잔존 여부 확인 후 별도 PR.
  ```

---

### - **[INFO]** FE 변경 1에 §4.2 Reauthorize 버튼 비활성화 UI 태스크 누락

- **target 위치:** DRAFT 2K — §4.2 Reauthorize 행에 `pending_install` / `install_timeout expired` / `cafe24 private` 비활성 조건 추가
- **관련 plan:** `cafe24-pending-polish.md` 변경 1 (FE: pending step 폴링 + 목록 갱신 정책)
- **상세:** DRAFT 2K 내용은 FE 구현 범위(통합 상세 패널 UI)인데, 변경 1 체크리스트에 명시가 없어 구현 시 누락될 수 있다.
- **제안:** 변경 1에 체크박스 추가 — "§4.2 Reauthorize 버튼: `pending_install` 상태 또는 `cafe24 private` 앱 전체에서 비활성화".

---

### - **[INFO]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` HTTP 상태 코드: 위임 원본(400) vs. spec draft(409)

- **target 위치:** DRAFT 2F — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)`
- **관련 plan:** `spec-update-cafe24-pending-polish.md` C4 — `(400)` 제안
- **상세:** spec draft가 swagger 규약(중복/충돌 = 409, `INTEGRATION_IN_USE(409)` 선례)을 근거로 400 → 409로 변경했다. 의도적 개선이며 규약상 올바르나, 위임 원본을 작성한 developer가 400을 의도한 근거(예: "아직 존재하지 않는 리소스 간 충돌"이므로 400이 더 맞다는 논리)를 갖고 있을 수 있다. spec 적용 전에 developer 쪽 확인을 권장.
- **제안:** developer(cafe24-pending-polish worktree 소유자)가 409 채택에 동의하면 INFO로 종결. 이견 있으면 project-planner가 Rationale에 판단 근거 보강.

---

### - **[INFO]** 스캐너 큐 하위 호환 처리(`reason ?? 'token_expiring'`)가 변경 4에 미명시

- **target 위치:** DRAFT 3C-bis 본문 텍스트 마지막 줄
  > "하위 호환: 기존 소비자가 `reason` 미포함 메시지를 받던 경로가 있다면 `reason ?? 'token_expiring'` 으로 기본값 처리"
- **관련 plan:** `cafe24-pending-polish.md` 변경 4 (TTL 정리 스캐너)
- **상세:** 변경 4는 `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }` 메시지 포맷을 신규 도입하는데, 기존 소비자 코드에 대한 하위 호환 처리가 변경 4 체크리스트에 없다. 스캐너 consumer가 `reason` 필드를 읽는다면 기존 큐 잔존 메시지 처리 시 `undefined` 분기 오류가 발생할 수 있다.
- **제안:** 변경 4에 "기존 큐 consumer에 `reason ?? 'token_expiring'` 기본값 처리 추가" 체크박스 명시.

---

## 요약

spec draft와 implementation plan의 전반적 정합성은 양호하다. spec draft가 위임 원본(`spec-update-cafe24-pending-polish.md`)의 요구를 충실히 확장·정교화했으며, 추가 섹션(data-flow §1.2 sub-diagram, §1.4 스캐너 분기, 4-cafe24.md §9.8 식별 전략, Rationale 섹션 신설 등)도 일관성을 갖춘다. 다만 **`markIntegrationCallbackError` 의 `connected` status 처리가 구현 plan과 spec draft 사이에 실질적 충돌**을 만들고 있어, 구현 착수 전에 반드시 변경 0 설명을 수정해야 한다. 레거시 경로 후속 항목 누락(Warning 2)도 spec 적용과 동시에 implementation plan에 반영이 필요하다.

## 위험도

**MEDIUM** — Critical 없음. Warning 1이 구현 시 기존 spec 동작(`connected → error(auth_failed)`)을 무효화할 수 있는 실질적 충돌이므로, implementation plan 수정이 spec 적용 직후 선행되어야 한다.