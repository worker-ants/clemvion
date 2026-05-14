모든 관련 spec 파일과 plan 문서를 파악했습니다. 검토 결과를 정리합니다.

---

## 발견사항

### [WARNING] DRAFT 1C: `credentials_unreadable` 에러 추가 — 비위임 scope 확장
- **target 위치**: `spec-draft-cafe24-pending-polish.md` DRAFT 1C — `status_reason` 의 `error` 분기에 `credentials_unreadable` 추가
- **관련 plan**: `plan/in-progress/spec-update-cafe24-pending-polish.md` §A (commission 문서) — C1/C2만 명시, `credentials_unreadable` 언급 없음. `plan/in-progress/cafe24-pending-polish.md` 변경 0-5 어디에도 이 에러 코드를 발생시킬 구현 작업 없음
- **상세**: commission 문서는 `error.status_reason` 확장을 요청하지 않았다. `credentials_unreadable` 을 추가하면 backend의 AES-256-GCM 복호화 실패 경로에서 이 값을 set 하는 로직도 필요한데, 변경 0-5 어디에도 해당 경로 처리가 없다. spec에만 존재하고 구현에 없으면 dead spec이 된다.
- **제안**: DRAFT 1C에서 `credentials_unreadable` 을 제거하거나, `cafe24-pending-polish.md` 에 "변경 6 — credentials 복호화 실패 시 `status_reason='credentials_unreadable'` 기록" 항목을 추가해 구현 scope를 명시한다.

---

### [WARNING] DRAFT 3D: `integration_oauth_state` 스키마 확장 — 비위임 항목
- **target 위치**: `spec-draft-cafe24-pending-polish.md` DRAFT 3D — `integration_oauth_state` 에 `integration_id`, `mode`, `requested_scopes`, `provider_meta (encrypted JSONB, V041)` 추가
- **관련 plan**: `plan/in-progress/spec-update-cafe24-pending-polish.md` 전체 — `integration_oauth_state` 스키마 갱신 요청 없음
- **상세**: commission 문서가 요청하지 않은 항목이다. `provider_meta` 컬럼이 V041 마이그레이션으로 이미 존재한다면 documentation catch-up이라 무해하지만, 미적용 상태라면 이번 PR 범위 밖 마이그레이션이 암묵적으로 추가된다. `cafe24-pending-polish.md` 변경 2의 `handleInstall` 에서 OAuthState 생성 시 `provider_meta` 사용 여부에 따라 V041 마이그레이션 의존성이 생긴다.
- **제안**: `provider_meta (V041)` 가 이미 실제 DB에 존재하는지 확인. 미적용이면 DRAFT 3D에서 해당 컬럼을 제거하거나, `cafe24-pending-polish.md` 에 "변경 6 — V041 마이그레이션 확인/적용" 항목을 추가한다.

---

### [INFO] DRAFT 2I Rationale 약속 항목이 `cafe24-pending-polish.md` 에 미등록
- **target 위치**: `spec-draft-cafe24-pending-polish.md` DRAFT 2I — "영구 폐기 시점은 `plan/in-progress/cafe24-pending-polish.md` 의 후속 항목으로 추가" 명시
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` — 해당 후속 항목 없음 (비포함 섹션에도 미기재)
- **상세**: 옛 경로(`/oauth/install/cafe24`) 의 410 Gone 응답은 임시 완충이고, 영구 폐기는 운영 데이터·외부 URL 확인 후 별도 결정이라고 spec에 명시했다. 하지만 이 follow-up이 어느 plan에도 체크박스로 추적되지 않는다.
- **제안**: 이 draft가 spec에 반영될 때 `cafe24-pending-polish.md` 마지막 섹션에 "[ ] Legacy install path (`/oauth/install/cafe24`) 영구 폐기 시점 결정 및 제거" 를 추가한다.

---

### [INFO] DRAFT 2K §4.2 Reauthorize 비활성 조건에 `credentials.app_type='private'` 참조
- **target 위치**: `spec-draft-cafe24-pending-polish.md` DRAFT 2K — `credentials.app_type='private'` 를 UI 비활성 조건으로 명시
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` 변경 1 — FE 구현 범위
- **상세**: `credentials` 는 encrypted JSONB다. Frontend가 이 조건을 평가하려면 backend Integration 응답에 `appType` 이 복호화된 형태로 포함되어야 한다. 현재 API spec(§9.1)이 credentials를 어떻게 redact/expose 하는지 명확하지 않다. 구현 시 별도 확인 필요.
- **제안**: DRAFT 2K 텍스트에 "※ `credentials.app_type` 는 backend 응답에서 `meta.appType` 등으로 별도 노출되어야 한다 — §9.1 참고" 한 줄을 추가해 구현자에게 힌트를 남긴다.

---

### [INFO] §6 다이어그램 형식 변경 (ASCII → Mermaid)
- **target 위치**: DRAFT 2D — `spec/2-navigation/4-integration.md §6` 의 ASCII 다이어그램을 Mermaid 로 교체
- **관련 plan**: 해당 없음
- **상세**: 순수 표현 변경이고 정합성에 무해하다. 단, 렌더러가 Mermaid를 지원하지 않는 환경(일부 wiki/PDF export)에서는 깨질 수 있다. 프로젝트 내 다른 spec 파일들이 이미 Mermaid를 사용하고 있다면(`spec/data-flow/integration.md` §1.2 등) 무방하다.

---

## 요약

본 draft는 `spec-update-cafe24-pending-polish.md` 의 모든 위임 항목(C1, C2, C3, C4, W1, W3, W5, W7)을 포함하며, `cafe24-pending-polish.md` 의 실행 전제 조건(BLOCK 해소)으로서 구조적으로 정합하다. worktree 충돌 없고, 다른 in-progress plan과 동일 영역을 충돌 없이 다룬다. 다만 commission 문서가 요청하지 않은 두 항목 — `credentials_unreadable` 에러 코드(구현 없는 dead spec 위험)와 `integration_oauth_state` 스키마 확장(V041 의존성 미확인) — 이 추가 scope로 포함되어 있어 확인이 필요하다. 후속 follow-up(`/oauth/install/cafe24` 영구 폐기) 추적도 plan에 등록해야 한다.

## 위험도

**LOW** — 핵심 정합성은 확보됐고 발견된 이슈는 scope 명확화와 follow-up 추적 수준이다. Critical 차단 사유 없음.