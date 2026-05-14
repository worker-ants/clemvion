`plan/in-progress/spec-draft-cafe24-pending-polish.md` 와 `plan/in-progress/` 전체를 대조해 5개 관점을 점검합니다.

---

## 발견사항

### [WARNING] 영향받는 연관 문서 섹션에 DRAFT 2K 대상 파일·섹션 누락

- **target 위치**: spec-draft 말미 "영향받는 연관 문서" — `spec/4-nodes/4-integration/4-cafe24.md` 항목
- **관련 plan**: 없음 (spec draft 내부 완결성 문제)
- **상세**: DRAFT 2K(`### 2K. §4.2 Overview 탭 Reauthorize 행`)가 `spec/4-nodes/4-integration/4-cafe24.md §4.2` 의 Reauthorize 행과 Quick actions 행을 수정하지만, 영향받는 연관 문서에는 해당 파일의 `§9.4, §9.8, §337, §10 CHANGELOG`만 열거되고 **`§4.2`가 누락**. 적용자가 §4.2 패치를 건너뛸 수 있음.
- **제안**: 영향받는 연관 문서의 `spec/4-nodes/4-integration/4-cafe24.md` 행에 `§4.2` 추가.

---

### [WARNING] 구현 plan 의 "410 Gone 또는 제거" 미결이 spec draft 에서 확정됐으나 plan 미갱신

- **target 위치**: DRAFT 2E (`GET /api/integrations/oauth/install/cafe24` Deprecated 행), DRAFT 2I Rationale "install_token 경로 승격" 단락
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` 변경 2 — "기존 토큰 없는 `/oauth/install/cafe24` 라우트 410 Gone **또는 제거** (외부 등록 URL 영향 사전 확인)"
- **상세**: 구현 plan 은 410 Gone vs. 제거를 미결로 남겼으나, spec draft 가 `CAFE24_INSTALL_LEGACY_PATH(410 Gone)` 으로 확정. spec 적용 후에도 구현 plan 에 "또는 제거" 문구가 남아 개발자가 잘못된 선택지를 고려할 수 있음.
- **제안**: spec draft 통과 직후, 구현 plan 변경 2 해당 항목을 "410 Gone 응답(`CAFE24_INSTALL_LEGACY_PATH`) — 운영 전환기 완충" 으로 단일화.

---

### [WARNING] Rationale 이 지시한 plan 후속 항목이 구현 plan 에 아직 미추가

- **target 위치**: DRAFT 2I Rationale "install_token 을 App URL path 식별 키로 승격" 마지막 문장
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md`
- **상세**: spec draft Rationale 이 "영구 폐기 시점은 `plan/in-progress/cafe24-pending-polish.md` 의 후속 항목으로 추가" 라고 명시하지만, 현재 `cafe24-pending-polish.md` 에 그 항목이 없음. spec draft 는 spec 파일만 수정하므로 plan 쪽 갱신이 별도 수작업임.
- **제안**: spec 적용 완료 직후 구현 plan 에 "옛 경로(`/oauth/install/cafe24`) 영구 폐기 시점 결정 — 운영 데이터·외부 등록 URL 잔존 확인 후" 항목을 추가.

---

### [INFO] 구현 plan 실행 순서 0 의 spec 파일 목록이 spec draft 실제 범위보다 좁음

- **target 위치**: spec draft "영향받는 연관 문서" 전체
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` 실행 순서 0
- **상세**: 구현 plan 실행 순서 0 은 갱신 파일로 `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/data-flow/integration.md §3.2` 만 열거. spec draft 는 추가로 `spec/4-nodes/4-integration/4-cafe24.md` (§4.2/§9.4/§9.8/§337/§10), `spec/conventions/cafe24-api-metadata.md §6`, `spec/data-flow/integration.md §1.2/§1.4/§2.1/§3.1` 도 포함. 개발자가 구현 복귀 시 spec 변경 범위를 과소평가할 수 있음.
- **제안**: spec 적용 후 구현 plan 실행 순서 0 의 파일 목록을 spec draft "영향받는 연관 문서" 와 일치시켜 갱신.

---

### [INFO] DRAFT 2K 의 파일 귀속이 문서 구조상 암묵적

- **target 위치**: `### 2K. §4.2 Overview 탭 Reauthorize 행` 섹션 헤더
- **상세**: DRAFT 2K 는 DRAFT 2J(`spec/4-nodes/4-integration/4-cafe24.md`) 아래에 위치하지만 자체 파일 헤더가 없어 어느 파일인지 문맥에서만 파악 가능. 적용 오류 위험은 낮으나 가독성 저하.
- **제안**: 섹션 헤더를 `### 2K. spec/4-nodes/4-integration/4-cafe24.md §4.2 — Overview 탭 Reauthorize 행 (W5)` 로 명시 권장.

---

## 요약

본 spec draft 는 `cafe24-pending-polish.md` 구현 plan 이 요구한 BLOCK 선결 조건(일관성 검사 C1~C4 전부)을 빠짐없이 해소하고 있으며, 다른 in-progress plan 과의 worktree 충돌이나 미결 결정 우회는 없다. Critical 이슈 없음 — **BLOCK 없이 spec 적용 가능**. 단, WARNING 3건(영향받는 문서 섹션의 §4.2 누락, 구현 plan 의 410/제거 미결 잔존, Rationale 이 명시한 후속 plan 항목 미추가)이 존재하며, 모두 spec 적용 직후 구현 plan 갱신 단계에서 조치할 수 있다.

## 위험도
**LOW**