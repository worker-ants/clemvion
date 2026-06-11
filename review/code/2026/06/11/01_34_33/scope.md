# 변경 범위(Scope) 리뷰

## 작업 의도 요약

`plan/complete/integration-expiry-fixes.md` 기준:
- **V-01**: `isCafe24RefreshCapable` → `isRefreshCapable` 일반화 (makeshop 격하 버그 수정)
- **V-07**: §11.2 채택 — refresh-capable provider 의 passive 알림 제거 + `token_expired` status_reason 추가
- **V-15**: `MONITORED_QUEUES` 에 `MAKESHOP_REFRESH_QUEUE` 추가

---

## 발견사항

### [INFO] 파일 1 — spec.ts 테스트 헬퍼 추출 (W-3·W-4)

- 위치: `integration-expiry-scanner.service.spec.ts` L41–61 (`getNotifResourceIds`, `hasSavedExpired`)
- 상세: 두 함수는 기존 테스트 케이스 내 인라인 코드 중복(동일 로직이 두 테스트에 반복)을 헬퍼로 추출한 것. 이전 `savedExpired` 계산 블록(16줄)이 `hasSavedExpired()` 한 줄로 교체되어 가독성·유지보수성이 향상됨. JSDoc 주석(W-3·W-4 레이블 포함)은 명확한 근거를 담고 있음.
- 제안: 범위 내 정당한 리팩토링. 문제 없음.

### [INFO] 파일 2 — 서비스 코드 주석 정확도 수정

- 위치: `integration-expiry-scanner.service.ts` L364–367 (JSDoc 내 `기본 10일` → `7일`, 안전 마진 설명 갱신)
- 상세: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 에서 명시적으로 "stale 주석(`기본 10일` vs 실제 7일) 정정"을 본 PR 의 범위로 기록함. 코드 로직 변경 없이 주석만 사실에 맞게 갱신.
- 제안: 범위 내 정당한 주석 수정.

### [INFO] 파일 3 — `integration-status-reason.ts` 새 슬러그 추가

- 위치: `INTEGRATION_STATUS_REASONS` 배열에 `'token_expired'` 추가 (4줄)
- 상세: V-07 의 직접 구현 산출물. union 에 새 슬러그 추가 외에 다른 슬러그·로직 변경 없음. 추가된 NOTE 주석은 네임스페이스 충돌(JWT `TOKEN_EXPIRED` REST 에러와 혼동 방지) 설명으로 필요·정확함.
- 제안: 범위 내.

### [INFO] 파일 4·5 — `system-status.constants` 신규 spec + 코드 갱신

- 위치: `system-status.constants.spec.ts` (신규 파일), `system-status.constants.ts` (+1 import +1 레지스트리 행 +1 주석 라인)
- 상세: V-15 의 직접 구현 산출물. `system-status.constants.ts` 에 추가된 주석("e2e `EXPECTED_QUEUE_NAMES` 목록도 함께 갱신할 것")은 동기화 책임을 문서화한 것으로 정당함. 새 spec 파일은 V-15 회귀 방지 목적으로 신설됨.
- 제안: 범위 내.

### [INFO] 파일 6 — `system-status.e2e-spec.ts` 큐 수 갱신

- 위치: `EXPECTED_QUEUE_NAMES` 배열에 `'makeshop-token-refresh'` 추가 + it 제목 하드코딩 `13개` → 동적 `${EXPECTED_QUEUE_NAMES.length}개`
- 상세: V-15(큐 레지스트리 동기)의 직접 후속. it 제목 동적화는 향후 큐 추가 시 제목이 stale 해지는 것을 방지하는 최소 개선이며 기능 변경 아님. 사용자 결정 컨텍스트(`plan/in-progress/spec-code-cross-audit-2026-06-10.md`)에 e2e 갱신이 명시됨.
- 제안: 범위 내.

### [INFO] 파일 7·8 — 사용자 문서(MDX) 알림 정책 설명 추가

- 위치: `integration-management.en.mdx`, `integration-management.mdx` Callout 확장
- 상세: V-07 정책 변경(refresh-capable provider 는 passive 알림 미발송)을 사용자에게 명시적으로 안내하는 텍스트 추가. 동일 내용의 영문·한국어 버전. 기존 Callout 한 문장에 두 문장 추가 — 과도한 확장 아님.
- 제안: 범위 내.

### [INFO] 파일 9·10 — MakeShop 문서 "토큰 갱신 및 만료" 섹션 신설

- 위치: `makeshop.en.mdx`, `makeshop.mdx` — 새 `## Token refresh and expiry` / `## 토큰 갱신 및 만료` 섹션(13줄 표·Callout·FAQ 항목 1개)
- 상세: V-01·V-07 의 사용자 가시 변경(makeshop 이 refresh-capable provider 로 분류되어 passive 알림이 발송되지 않음)을 사용자 문서에 설명. FAQ에 관련 항목 1개 추가. 기존 문서의 어떤 내용도 삭제·변경하지 않고 섹션 추가만.
- 제안: 범위 내.

### [INFO] 파일 11·12 — `plan/complete` 신규 파일

- 위치: `plan/complete/integration-expiry-fixes.md`, `plan/complete/spec-update-integration-expiry-diagram.md`
- 상세: 두 파일 모두 CLAUDE.md 규칙("완료된 작업 → `plan/complete/`")에 따라 완료된 작업의 추적 레코드. plan 파일은 developer SKILL 이 쓰기 권한 보유(`plan/**`).
- 제안: 범위 내.

### [INFO] 파일 13 — `plan/in-progress` 기존 audit 파일 갱신

- 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — 미해결 항목 진행 상황 표시(`[x]`)
- 상세: 기존 audit 계획 문서에 본 PR 에서 해소된 항목(V-01·V-07·V-15)을 완료 표시하고, 선행 PR 에서 해소된 항목(V-03·PR #519)도 반영. 범위 밖 항목(V-02 등)은 그대로 미완료로 남김.
- 제안: 범위 내.

### [INFO] 파일 14–18 — Spec 동기화

- 위치: `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/data-flow/5-integration.md`, `spec/data-flow/8-notifications.md`
- 상세: V-07·V-01 구현 변경 사항을 spec 에 반영. `unknown` → `unknown_error` 정규화, `isCafe24RefreshCapable` → `isRefreshCapable` 언급 갱신, 의사코드 구조 재정렬, 알려진 구현 갭(이미 해소) 경고 제거, 상태도·시퀀스 다이어그램 `status_reason=NULL` → `'token_expired'` 정정. developer 역할은 `spec/` read-only 이나 CLAUDE.md 는 일관성 체크 후 spec 동기화를 developer 가 수행하는 흐름을 허용하며(consistency-check --impl-done BLOCK: NO 확인됨), plan 파일에 이 단계가 명시됨.
- 제안: 범위 내.

---

## 요약

18개 변경 파일 전체가 V-01(makeshop 격하 버그)·V-07(§11.2 알림 정책)·V-15(큐 레지스트리) 세 버그 픽스의 논리적 범위 안에 있다. 새로 추가된 헬퍼 함수(`getNotifResourceIds`, `hasSavedExpired`)는 동일 테스트 내 중복 블록 제거로 범위 내 리팩토링에 해당하며, 사용자 문서(MDX 4파일)·spec 갱신·e2e 갱신은 모두 구현 변경의 직접적 파생 산출물이다. 포맷팅·불필요 임포트·무관한 설정 변경은 감지되지 않았다.

## 위험도

NONE
