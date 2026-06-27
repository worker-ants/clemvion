# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
대상 영역: `spec/7-channel-web-chat/`
diff base: `origin/main`

---

## 발견사항

### 1. [INFO] `1-widget-app.md §3.1` 표 — sessionStorage 참조 갱신 완료 확인

- target 위치: `spec/7-channel-web-chat/1-widget-app.md §3.1` "페이지 새로고침/이동" 행
- 충돌 대상: 없음
- 상세: 위젯 SPA spec 의 `1-widget-app.md §3.1` 은 이미 `sessionStorage(같은 탭 reload 는 유지·탭 종료 시 소거, [3-auth-session §R6])` 로 올바르게 기술돼 있다. 구현 diff(`session-store.ts` `localStorage → sessionStorage`)는 이 spec 본문과 정합하며, spec 과 구현 간 충돌이 없다.
- 제안: 없음 (동기화 완료).

### 2. [INFO] `4-security.md §1` 보안 정책 요약 표 — sessionStorage 참조 갱신 완료 확인

- target 위치: `spec/7-channel-web-chat/4-security.md §1` "토큰 노출" 행
- 충돌 대상: 없음
- 상세: 보안 spec 도 `단명 토큰은 sessionStorage 저장 → 탭 종료 시 자동 소거(defense-in-depth, [3-auth-session §R6])` 로 이미 sessionStorage 를 명시하고 있다. 구현과 일치.
- 제안: 없음.

### 3. [INFO] `5-admin-console.md R3` — localStorage vs sessionStorage 구분 명확

- target 위치: `spec/7-channel-web-chat/5-admin-console.md §4` 및 `R3`
- 충돌 대상: `spec/7-channel-web-chat/3-auth-session.md §R6`
- 상세: `5-admin-console.md` 는 **외형(appearance) 편집 draft 캐시**에 `localStorage` 를 명시적으로 사용한다(R3: "미저장 편집 캐시, sessionStorage(탭 닫으면 소실)보다 적합"). 이는 세션 토큰 저장의 `sessionStorage` 선택(`3-auth-session §R6`)과 별개 레이어이며, 용도가 다르므로 충돌이 아닌 의도된 이원화다. 두 스토리지 선택의 근거가 각각 spec 에 인라인으로 문서화돼 있어 혼동 위험이 낮다.
- 제안: 없음. 이원화는 스펙에 명시되고 의도된 것.

### 4. [INFO] `system-status.e2e-spec.ts` — `workspace-invitations-pruner` 큐 추가

- target 위치: `codebase/backend/test/system-status.e2e-spec.ts` (`EXPECTED_QUEUE_NAMES`)
- 충돌 대상: `spec/data-flow/0-overview.md §4` 큐 카탈로그
- 상세: diff 가 `workspace-invitations-pruner` 를 e2e 기대 목록에 추가했다. `spec/data-flow/0-overview.md §4` 의 큐 카탈로그(17개 큐)에 `workspace-invitations-pruner` 가 이미 등재돼 있으므로, 이 수정은 스테일했던 e2e 기대 목록을 spec SoT 에 수렴시키는 정합 복구다. 충돌 없음.
- 제안: 없음.

### 5. [INFO] `2-sdk.md §3` `resetSession` 명령 — sessionStorage 참조 일치

- target 위치: `spec/7-channel-web-chat/2-sdk.md §3`
- 충돌 대상: `spec/7-channel-web-chat/3-auth-session.md §R6`
- 상세: SDK spec `2-sdk.md §3` 의 `resetSession` 설명이 `sessionStorage`([3-auth-session §R6])를 정확히 인용한다. 구현 변경 후에도 참조 경로가 올바르다.
- 제안: 없음.

---

## 요약

이번 diff 의 핵심 변경은 `codebase/channel-web-chat/src/lib/session-store.ts` 에서 세션 토큰 저장소를 `localStorage` 에서 `sessionStorage` 로 교체한 것이다. `spec/7-channel-web-chat/` 의 6개 파일 전체를 교차 검토한 결과, `3-auth-session.md §3·§3.1·§R6`, `1-widget-app.md §3.1`, `4-security.md §1`, `2-sdk.md §3` 이 이미 `sessionStorage` 를 SoT 로 명시하고 있으며, 구현은 이 spec 들과 완전히 정합한다. `5-admin-console.md` 가 외형 draft 캐시에 `localStorage` 를 별도로 사용하는 것은 용도가 다른 의도된 이원화이며 충돌이 아니다. e2e 큐 목록 수정도 `spec/data-flow/0-overview.md` 의 큐 카탈로그 SoT 와 일치한다. 다른 영역(`spec/5-system/14-external-interaction-api.md` EIA, `spec/1-data-model.md`, `spec/0-overview.md`, `spec/conventions/`) 과의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 충돌은 발견되지 않았다.

---

## 위험도

NONE
