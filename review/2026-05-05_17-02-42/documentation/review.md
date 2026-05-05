### 발견사항

---

**[WARNING]** Stage 참조 주석이 코드에 직접 삽입됨
- 위치: `playwright.config.ts:5`, `e2e/a11y/smoke.spec.ts:2`, `skip-to-main.tsx:6`, `slide-drawer.tsx:57`, `run-results-drawer.tsx:289`, `layout.tsx:14`
- 상세: `Stage 10`, `Stage 10 NF-A11Y`, `Stage 10 baseline smoke` 같은 개발 단계 참조가 주석에 포함됨. 이런 참조는 단계 완료 이후 의미가 없어지며, CLAUDE.md 규약("Don't reference the current task, fix, or callers...since those belong in the PR description and rot as the codebase evolves")에도 위배됨.
- 제안: 주석에서 단계명을 제거하고 WHY(목적)만 남긴다. 예시: `"Stage 10 NF-A11Y"` → 삭제 또는 `"WCAG 2.1 AA 요건"` 수준의 스펙 참조로 대체.

---

**[WARNING]** README에 e2e 실행 방법 미반영
- 위치: `package.json` (`"e2e"`, `"e2e:a11y"` 스크립트), `playwright.config.ts`
- 상세: 새로운 Playwright 인프라가 추가되었지만 README에 실행 방법이 없음. `playwright.config.ts` 내 주석에 "dev 서버가 떠 있어야 한다"는 중요한 전제조건이 있고, `PLAYWRIGHT_BASE_URL` 환경 변수도 새로 추가됨. 이 정보가 README에 없으면 기여자가 CI/로컬에서 처음 실행할 때 반드시 실패를 겪게 됨.
- 제안: README에 다음을 추가:
  ```
  ## E2E / a11y 테스트
  # dev 서버를 먼저 기동해야 함
  npm run dev
  # 별도 터미널에서:
  npm run e2e          # 전체 e2e
  npm run e2e:a11y     # a11y smoke만
  # 커스텀 URL: PLAYWRIGHT_BASE_URL=http://localhost:4000 npm run e2e
  ```

---

**[INFO]** aria-label 일부 하드코딩 영어 (i18n 불일치)
- 위치:
  - `service-picker-modal.tsx:38` — `aria-label="Close"`
  - `mcp-server-selector.tsx:124` — `aria-label="Remove"`
  - `slide-drawer.tsx:73` — `aria-label="Close"`
- 상세: 동일한 변경 세트 내 다른 파일들(`authentication/page.tsx`, `llm-configs/page.tsx` 등)은 `aria-label={t("common.close")}` 패턴을 사용하는데, 위 세 위치는 하드코딩됨. `mcp-server-selector.tsx`의 경우 `"Remove"`에 해당하는 i18n 키가 en.ts/ko.ts에 추가되지도 않았음. i18n 딕셔너리 변경 문서(`en.ts`, `ko.ts`)와도 정합성이 어긋남.
- 제안: `t("common.close")` / `t("common.remove")` 로 통일하거나, 의도적으로 하드코딩한 경우 그 이유를 주석으로 명시.

---

**[INFO]** smoke.spec.ts의 login/register 페이지 테스트 비대칭 미문서화
- 위치: `e2e/a11y/smoke.spec.ts:64-84`
- 상세: login 페이지는 3개 테스트(critical 검사 + h1 검사 + 전체 위반 보고)인 반면, register 페이지는 2개(critical + h1)만 있음. 전체 위반 보고 테스트 생략이 의도적이라면 그 이유가 명시되어야 함. 현재 기여자가 보면 누락처럼 보임.
- 제안: register describe 블록 상단에 한 줄 주석 추가: `// 전체 위반 보고는 login 페이지와 동일 스캔 경로를 공유하므로 생략` 등.

---

**[INFO]** `CardTitle`의 `as` prop JSDoc — 실제 사용 사례 나열이 파일 외부 의존
- 위치: `card.tsx:28-34`
- 상세: JSDoc에서 "login/register 처럼 카드가 페이지 자체의 1차 콘텐츠일 땐 `as="h1"`"이라고 언급하는데, 이 예시는 컴포넌트 경계 밖의 사용처를 직접 참조함. 컴포넌트 문서는 사용처가 아니라 인터페이스를 기술해야 의도 표현이 더 오래 유효함.
- 제안: `"카드가 페이지 1차 콘텐츠일 때"` 등 일반화된 기술로 대체. 구체 파일명은 제거.

---

### 요약

이번 변경은 WCAG 2.1 AA 대응을 위한 대규모 a11y 개선으로, 신규 컴포넌트(`SkipToMain`, `SlideDrawer` FocusScope)와 Playwright e2e 인프라가 추가되었다. 코드 자체에는 목적을 설명하는 인라인 주석이 적절히 포함되어 있으나, **단계 참조(`Stage 10`) 주석이 코드베이스 전반에 산재**해 있어 장기적으로 의미를 잃을 위험이 있고, **Playwright 실행 조건(dev 서버 선행 기동, `PLAYWRIGHT_BASE_URL`)이 README에 미반영**되어 신규 기여자가 테스트 실행에 실패할 가능성이 높다. 세 곳의 하드코딩 aria-label은 i18n 일관성을 약화시키며, 이 점도 문서 정합성 차원에서 보완이 필요하다.

### 위험도

**LOW** — 기능 동작에는 영향 없음. 단, README 누락은 온보딩 마찰을 유발하고, Stage 참조 주석은 장기적으로 문서 품질을 저하시킴.