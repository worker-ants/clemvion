## 발견사항

### [INFO] Playwright 테스트 아티팩트의 민감 정보 노출 가능성
- **위치**: `playwright.config.ts:22-23` — `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`
- **상세**: 실패 시 저장되는 trace/screenshot에는 로그인 폼 입력값, 인증 상태, 세션 관련 UI 등이 포함될 수 있음. CI 아티팩트로 업로드되는 경우 넓은 범위에 노출됨. `.gitignore`에 `test-results/`, `playwright-report/`를 추가해 커밋은 차단했으나, CI 아티팩트 보존 정책은 별도 설정 필요.
- **제안**: CI 파이프라인에서 아티팩트 retention 기간 최소화, 접근 권한 제한. 인증 관련 테스트 trace는 `retainOnFailure` 대신 CI에서만 선택적으로 수집.

### [INFO] aria-label 하드코딩 영문 문자열 (i18n 미적용)
- **위치**: `slide-drawer.tsx:70` (`aria-label="Close"`), `service-picker-modal.tsx:37` (`aria-label="Close"`), `mcp-server-selector.tsx:124` (`aria-label="Remove"`)
- **상세**: 동일한 버튼에 대해 일부 컴포넌트는 `t("common.close")` i18n 키를 사용하고 일부는 영문 리터럴을 직접 사용. 보안 취약점은 아니지만, 공격자가 스크린 리더 출력을 분석할 때 예상치 못한 UI 동작 추론에 활용될 여지가 있음 (낮은 위험).
- **제안**: `t("common.close")`, `t("common.remove")` 키로 통일.

### [INFO] `three` 의존성 핀 변경 (`^` → `~`)
- **위치**: `package.json:62`, `package-lock.json`
- **상세**: `^0.184.0`(minor 허용) → `~0.184.0`(patch만 허용)으로 좁혀짐. 보안 패치가 minor 버전 업으로 배포되는 경우 자동 갱신에서 제외될 수 있음.
- **제안**: 주기적으로 `three` 취약점 공고를 모니터링하거나 `npm audit`을 CI에 포함해 보완.

---

## 요약

이 PR은 WCAG 2.1 AA 접근성 개선(ARIA 속성 추가, 포커스 트랩, 시맨틱 마크업)을 목적으로 하며, 새로운 인증·인가 경로, 사용자 입력 처리, API 엔드포인트를 일절 도입하지 않는다. 신규 의존성(`@playwright/test`, `@axe-core/playwright`, `@radix-ui/react-focus-scope`)은 모두 `devDependencies`에 한정되어 프로덕션 번들에 포함되지 않으며, 현 버전에서 알려진 CVE도 없다. 폼 에러 메시지(`role="alert"`)에 표시되는 내용은 Zod 스키마 또는 `t()` 번역 함수의 정적 문자열이므로 XSS 경로가 없다. 발견된 사항들은 모두 INFO 수준이며 즉각적인 조치가 필요한 취약점은 없다.

## 위험도

**NONE**