# Plan 정합성 검토 — `spec/2-navigation/4-integration.md`

검토 모드: 구현 착수 전 (`--impl-prep`, scope=`spec/2-navigation/4-integration.md`)
검토 일시: 2026-05-16

---

## 발견사항

- **[INFO]** consistency-check 의무 절차 미완료
  - target 위치: `plan/in-progress/cafe24-app-url-detail.md` §Step 0–3, Step 3 체크박스
  - 관련 plan: `plan/in-progress/cafe24-app-url-detail.md`
  - 상세: 착수 전 의무 절차 목록의 `/consistency-check --impl-prep spec/2-navigation/4-integration.md` 항목이 아직 미체크(`[ ]`) 상태다. 지금 이 checker 가 바로 그 검토이므로, 착수 자체는 가능하지만 plan 에 결과 반영이 필요하다.
  - 제안: 본 consistency-check 완료 후 `cafe24-app-url-detail.md` Step 3 체크박스를 체크하고, 본 세션 경로(`review/consistency/2026/05/16/11_56_28/`)를 plan 에 기록한다.

- **[INFO]** `cafe24-app-url-3rdparty-shorten.md` — spec 수정 완료, 구현 PR 미머지 상태로 동일 spec 파일 참조
  - target 위치: `spec/2-navigation/4-integration.md` §9.2, §10.1, §3.2 (install/callback 경로 표기)
  - 관련 plan: `plan/in-progress/cafe24-app-url-3rdparty-shorten.md` Phase 3 (worktree: `cafe24-3rdparty-url-503aa0`)
  - 상세: `cafe24-app-url-3rdparty-shorten` plan 이 `spec/2-navigation/4-integration.md` 의 API 경로 섹션을 이미 갱신했고 PR 은 아직 머지 대기 중이다. 두 worktree(`cafe24-3rdparty-url-503aa0`, `cafe24-app-url-detail-a7c3f4`) 가 서로 다른 파일(`integration-oauth.service.ts`, `integrations.service.ts`)을 수정하므로 직접 코드 충돌은 낮지만, 두 PR 을 순서 없이 머지하면 `buildCafe24InstallUrl` 헬퍼 참조 경로나 `PublicIntegration.appUrl` 타입 시그니처가 불일치할 수 있다.
  - 제안: `cafe24-app-url-3rdparty-shorten` PR 이 먼저 머지된 뒤 본 PR 을 rebase 하거나, `cafe24-app-url-detail.md` 의 의존성 절에 순서 의존을 명시한다.

- **[INFO]** `spec-update-cafe24-app-url-reuse.md` — install_token persistent 정책이 target spec 에 이미 반영됨, plan 은 여전히 in-progress
  - target 위치: `spec/2-navigation/4-integration.md` §6 (`install_token` 보존 전이 표기), §9.2 App URL handler 분기, Rationale "Cafe24 App URL 재호출 흐름"
  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` (worktree: `cafe24-app-url-reuse-f9a2e3`)
  - 상세: target spec 은 `install_token persistent` + post-install navigation 분기(`connected → /integrations/<id>` 302)를 이미 포함하고 있다. `spec-update-cafe24-app-url-reuse.md` 의 "spec 갱신" 후속 작업 체크박스가 아직 미체크 상태이지만, spec 본문에는 해당 내용이 Rationale "Cafe24 App URL 재호출 흐름"으로 이미 기재되어 있다. plan 과 spec 이 실제로는 동기화되었을 가능성이 높으나 plan 이 확인·체크되지 않아 불분명하다.
  - 제안: `spec-update-cafe24-app-url-reuse.md` 의 "spec 갱신" 체크박스를 완료 처리하거나, 아직 spec 에 반영되지 않은 항목이 있다면 명시한다. backend/frontend 구현 체크박스 완료 여부도 확인 후 plan 상태를 갱신한다.

- **[INFO]** `cafe24-pending-polish.md` — 동일 spec 파일 영역 수정 plan, worktree 분리되어 있으나 PR 머지 대기 상태
  - target 위치: `spec/2-navigation/4-integration.md` §4.2, §4.3 Reauthorize 비활성 조건
  - 관련 plan: `plan/in-progress/cafe24-pending-polish.md` (worktree: `cafe24-pending-polish-7fdb7e`)
  - 상세: `cafe24-pending-polish` plan 이 `spec/2-navigation/4-integration.md` 의 Reauthorize 비활성 조건과 `meta.appType` 필드 추가를 다루고 있다. target spec 의 §4.2/§4.3 에 이 조건들이 이미 기재되어 있어 spec 은 동기화된 것으로 보이나, frontend 구현 체크박스(변경 1)는 여전히 미체크다. PR #18 머지 대기 중 표기가 있어 코드 충돌보다는 의미 의존이 존재한다.
  - 제안: `cafe24-app-url-detail.md` 의 `Cafe24AppUrlCard` 에 `meta.appType` 응답 필드를 참조하는 코드가 있다면 `cafe24-pending-polish` PR 머지 여부를 확인 후 착수한다.

---

## 요약

`spec/2-navigation/4-integration.md` 는 Cafe24 Private 통합의 최근 변경(install_token persistent, post-install navigation, 3rd-party URL 네임스페이스, HMAC 진단)을 모두 반영한 최신 상태로 유지되고 있다. 현재 진행 중인 `cafe24-app-url-detail.md` plan 과 target spec 간에 미해결 결정 우회나 직접적인 worktree 코드 충돌은 발견되지 않는다. 다만 복수의 in-progress plan 이 동일 spec 파일을 참조하고 있고 일부 PR 이 머지 대기 중이어서, `cafe24-app-url-3rdparty-shorten` PR 의 선행 머지 여부와 `spec-update-cafe24-app-url-reuse` plan 의 완료 체크 여부를 착수 전 확인하는 것이 권장된다. 발견된 항목은 모두 INFO 등급으로, 구현 차단 요소는 없다.

---

## 위험도

LOW
