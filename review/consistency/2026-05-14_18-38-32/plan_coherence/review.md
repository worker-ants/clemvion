spec 파일을 전체 읽었습니다. plan과의 정합성을 분석합니다.

---

## 발견사항

### [WARNING] CAFE24_PRIVATE_APP_ALREADY_CONNECTED HTTP 상태 코드 불일치

- **target 위치**: `spec/2-navigation/4-integration.md` §9.4 공통 응답 포맷
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` — 변경 3 체크박스 `[ ] 동일 (workspaceId, mall_id) 에 connected 가 이미 있으면 CAFE24_PRIVATE_APP_ALREADY_CONNECTED (400) 반환`
- **상세**:
  - plan 변경 3은 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 를 **400** 으로 명시
  - spec §9.4는 동일 에러 코드를 **409** 로 정의하고, swagger 규약 `spec/conventions/swagger.md §2-4` 를 근거로 409 를 선택했다는 Rationale 포함
  - 개발자가 plan 을 따르면 400 으로 구현하여 spec과 API Contract 불일치 발생
- **제안**: plan 변경 3 의 `(400)` → `(409)` 로 정정 필요. spec 이 결정의 주(主) 문서이므로 plan note를 맞춤.

---

### [WARNING] 변경 3 uniqueness 조건 범위 불일치

- **target 위치**: spec §9.2 `POST /api/integrations/oauth/begin` 설명
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` — 변경 3 `동일 (workspaceId, mall_id) 에 connected 가 이미 있으면`
- **상세**:
  - plan은 `(workspaceId, mall_id)` 가 connected 일 때 거부로 기술
  - spec §9.2은 `(workspaceId, mall_id, app_type='private')` 에 connected 존재 시 거부로 기술 — `app_type='private'` 조건이 추가됨
  - 조건이 다르면 public 앱과 private 앱이 동일 mall_id를 가질 때 의도치 않게 차단될 수 있음 (또는 허용될 수 있음)
- **제안**: plan 변경 3의 유일성 조건을 spec의 `(workspaceId, mall_id, app_type='private')` 로 동기화.

---

### [INFO] 변경 2 plan이 §9.8 을 참조하지만 spec에 §9.8 없음

- **target 위치**: spec §9 전체 — §9.1~§9.4 까지만 존재
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` — 변경 2 마지막 줄 `spec 갱신 적용 완료 (...§9.8/data-flow §1.2.1...)`
- **상세**: plan 이 spec 갱신 완료 근거로 "§9.8" 을 참조하나 spec에는 해당 섹션이 없음. install_token 라우트 내용이 §9.2 안에 인라인으로 통합된 것으로 보임.
- **제안**: plan 변경 2 의 `§9.8` 참조를 `§9.2` 로 정정하거나 제거.

---

### [INFO] 변경 0 / 변경 2 spec 갱신 체크박스가 미체크 상태이나 spec 내용은 이미 반영됨

- **관련 plan**: 변경 0 `[ ] spec 갱신 (...§6/§10)...project-planner 위임 후 consistency-check 통과` / 변경 2 `[ ] spec 갱신 적용 완료 (...project-planner 위임 완료...)`
- **상세**:
  - spec §6 에 `pending_install → pending_install (callback 실패 보존)` 전이 및 TTL 만료 전이가 모두 존재
  - spec §10.2 step 6, §10.4 에 callback 실패 시 auto-close 지연·status 보존 정책 명시
  - spec §9.2/§9.4 에 install_token 라우트 및 에러 코드 반영
  - 즉 step 0 ("BLOCK 해소") 는 이미 완료된 상태. 체크박스 미체크는 plan 문서 유지보수 누락.
- **제안**: 두 체크박스를 `[x]` 로 처리하여 plan 상태를 실제와 동기화.

---

## 요약

`spec/2-navigation/4-integration.md` 의 핵심 내용(§6 상태 머신, §10.2/10.4 callback 실패 처리, §9.2/9.4 install_token 라우트·에러 코드, §2.2/4.3 reauthorize 비활성 조건)은 `cafe24-pending-polish.md` 의 구현 의도와 전반적으로 정합한다. 단, **plan 변경 3이 CAFE24_PRIVATE_APP_ALREADY_CONNECTED 를 400 으로 명시하고 있는 반면 spec §9.4는 409** 로 확정되어 있어, 개발자가 plan 을 그대로 따르면 API contract 불일치가 발생한다. uniqueness 조건 범위(`(workspaceId, mall_id)` vs `(workspaceId, mall_id, app_type='private')`) 도 동일하게 정정이 필요하다. 두 항목은 구현 착수 전 plan 문서를 spec 에 맞춰 수정해야 한다.

## 위험도

**MEDIUM** — 구현 차단 수준은 아니지만, plan의 상태 코드 및 조건 기술이 spec과 다르므로 변경 3 구현 전에 plan 정정이 필요하다.