# 요구사항(Requirement) Review

## 발견사항

### **[INFO]** e2e Test 1: `page.locator("pre")` 단일성 — 다중 `pre` 없음, 안전
- 위치: `console.spec.ts` L95
- 상세: `page.locator("pre")` 는 여러 `pre` 가 있으면 ambiguous 하다. 현재 `install-snippet-box.tsx` 가 유일한 `pre` 요소이며 다른 web-chat 컴포넌트에는 없음. 현재 구현 범위 내에서는 안전.
- 제안: 향후 컴포넌트 추가 시 `page.locator("pre code")` 또는 `data-testid` 로 좁히는 것을 권장.

### **[INFO]** e2e Test 1: Plain webhook 부재 검증 방식 — `toHaveCount(0)` 비엄밀
- 위치: `console.spec.ts` L92
- 상세: `page.getByText("Plain webhook").toHaveCount(0)` 은 "Plain webhook" 텍스트가 페이지 어디에도 없음을 검증한다. 이는 클라이언트 필터가 동작하는 증거로서 충분하나, "목록 영역에서만" 없음을 확인하는 것은 아니다. 현재 페이지 구조(목록 nav 외에 "Plain webhook" 텍스트가 나타날 곳 없음)에서는 실질적으로 동등.
- 제안: INFO. 변경 불요.

### **[INFO]** e2e Test 2: 워크플로우 옵션 채움 검증 — Dialog `open` 후 `workflows` 조회 시점 의존
- 위치: `console.spec.ts` L114
- 상세: `dialog.locator("select").toContainText("FAQ Bot")` 는 `useWorkflowOptions()` 가 dialog 마운트 후 API를 호출·응답 수신 후 렌더링 완료까지 기다려야 한다. Playwright `toContainText` 는 내부적으로 auto-wait 하므로 타임아웃(10s) 내에 조건이 만족되면 통과. 그러나 mock이 항상 동기로 응답하므로 실제로 문제 없음.
- 제안: INFO. 변경 불요.

### **[INFO]** spec 3-auth-session §3 step 0 — `embed-config` 엔드포인트 경로 표기 정합성
- 위치: `spec/7-channel-web-chat/3-auth-session.md` L478 (추가된 step 0)
- 상세: step 0 텍스트에서 경로가 `GET /api/hooks/:path/embed-config` 로 표기되어 있으나 4-security.md 변경 부분 및 실제 백엔드 컨트롤러는 `:endpointPath` 파라미터명을 사용한다. `:path`와 `:endpointPath`는 의미상 동일하지만 일관성 관점에서 미세한 차이.
- 제안: spec 내 용어 통일을 위해 `:endpointPath` 사용 권장(코드 버그 아님, spec 세부 정리 수준).

### **[INFO]** e2e: 라이브 미리보기 비검증 — 의도적 범위 제한
- 위치: `console.spec.ts` L56-58 (주석)
- 상세: 라이브 미리보기 iframe은 동봉 위젯 + EIA 풀스택 의존이라 mock e2e 범위 밖으로 명시. spec NAV-WC-06 이 `🚧 (증분 2)` 상태이므로 e2e 미검증이 spec과 일치.
- 제안: 변경 불요.

---

## Spec Fidelity 점검 결과

### 파일 1: `e2e/web-chat/console.spec.ts`
관련 spec: `spec/7-channel-web-chat/5-admin-console.md` (NAV-WC-01..06)

| 검증 항목 | spec | 구현/테스트 | 일치 여부 |
|---|---|---|---|
| interaction 켜진 webhook만 인스턴스 목록 노출 | §2: `type=webhook && config.interaction?.enabled` 클라이언트 필터 | Test 1: PLAIN_WEBHOOK(config:{}) 가 목록에서 제외 검증 | 일치 |
| 첫 인스턴스 자동 선택 후 스니펫 렌더 | §5: 스니펫에 `endpointPath` + `ClemvionChat('boot', ...)` | Test 1: `endpoint-uuid-abc` + `ClemvionChat('boot'` pre에서 확인 | 일치 |
| 빈 상태 안내 | §1 화면 구조, NAV-WC-02 | Test 2: empty state 텍스트 검증 | 일치 |
| "웹채팅 만들기" 버튼 (editor+, RoleGate) | §3: `editor`+ RoleGate | 테스트에서 WORKSPACE.role="owner" 로 버튼 노출 확인 | 일치 |
| 다이얼로그 내 워크플로우 NativeSelect | §3: 워크플로우 선택 step 1 | Test 2: `dialog.locator("select").toContainText("FAQ Bot")` | 일치 |

### 파일 3: `spec/7-channel-web-chat/3-auth-session.md`
추가된 step 0 — 기존 위젯 구현(`use-widget.ts:isEmbedAllowed`)의 문서화. 코드 행위와 일치:
- fail-open(allowlist 빈/enforce=false/설정 조회 실패) → spec "allowlist 빈/enforce=false 면 통과(fail-open)" 일치.
- 불일치 시 `dispatch({ type: "BLOCKED" })` → spec "[blocked] (시작 차단)" 일치.

### 파일 4: `spec/7-channel-web-chat/4-security.md`
추가된 §3-① 내용 — `GET /api/hooks/:endpointPath/embed-config`, `EmbedConfigDto { allowlist, enforce }`, `EmbedConfigService` 명시.
- 백엔드: `@Get(':endpointPath/embed-config')` → `EmbedConfigService.resolve()` → `EmbedConfigDto` 반환. 일치.
- `enforce=false` 또는 allowlist 빈 경우 fail-open: 구현 `if (!cfg || !cfg.enforce || cfg.allowlist.length === 0) return true`. 일치.
- `[3-auth-session §3 step 0]` 상호 참조 정확.

---

## 요약

4개 파일 변경(e2e 테스트 신설, plan 업데이트, spec 2건 보강) 모두 의도한 기능을 충족한다. e2e 테스트는 spec NAV-WC-02(interaction 필터), NAV-WC-05(스니펫 endpointPath·boot 콜), NAV-WC-03(빈 상태→만들기 다이얼로그·워크플로우 셀렉터) 세 핵심 요구사항을 mock API 기반으로 직접 검증한다. 비검증 항목(라이브 미리보기)은 spec NAV-WC-06이 🚧(증분 2) 상태로 일관성 있게 처리되어 있다. spec 보강(3-auth-session §3 step 0, 4-security §3-①)은 기존 위젯 구현(`use-widget.ts:fetchEmbedConfig/isEmbedAllowed`)과 백엔드(`EmbedConfigService/EmbedConfigDto`)를 정확히 반영한다. Critical·Warning 발견사항 없음.

## 위험도

NONE
