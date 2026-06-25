# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep`
대상: refactor 03 m-3 — `integrations/new/page.tsx` behavior-preserving 분할
검토 일시: 2026-06-25

---

## 발견사항

### [WARNING] hook 식별자 명명 불일치 — plan m-3 `useDraftRestore` vs 구현 계획 `useUnsavedChangesWarning`

- **target 위치**: 구현 범위 기술 — `lib/integrations/useUnsavedChangesWarning` (§3.6 이탈복원 가드)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` (`id:` 식별자 안정성), CLAUDE.md 단일 진실 원칙
- **상세**: `plan/in-progress/refactor/03-maintainability.md` §m-3 개선 방안 2번 및 옵션 A 설명은 §3.6 이탈·복원 훅 이름을 `useDraftRestore`로 명시한다. 구현 계획 payload 는 같은 책임에 `useUnsavedChangesWarning` 을 사용한다. 두 이름은 의미 도메인이 달리 읽힌다 — `useDraftRestore`는 "이탈 후 복원(draft 복원)"을, `useUnsavedChangesWarning`은 "이탈 경고(`beforeunload`)" 를 가리킨다. 실제 `page.tsx` §3.6 구현(lines 340-353)은 `beforeunload` 경고만 수행하며 draft 복원 로직이 없다(스펙 §3.6 "입력한 자격 증명은 보안상 복원하지 않음"). 따라서 구현 계획의 `useUnsavedChangesWarning`이 실제 기능을 더 정확하게 기술하지만, plan 문서와 식별자가 어긋난다. 단일 진실 원칙상 plan이 식별자 SoT 인데 현재 두 곳이 다른 이름을 사용한다.
- **제안**: plan/in-progress/refactor/03-maintainability.md §m-3 의 `useDraftRestore` 를 `useUnsavedChangesWarning` 으로 갱신하거나, 구현 계획을 plan 의 `useDraftRestore` 로 일치시켜 단일 진실을 확보한다. spec §3.6이 "이탈 경고"만 정의하고 draft 복원은 명시적으로 제외하므로 `useUnsavedChangesWarning` 쪽이 스펙 언어에 더 가깝다.

---

### [WARNING] plan §m-3 컴포넌트 목록과 구현 계획 불일치 — `SaveStep` 누락 / `Cafe24PrivatePendingStep`·`MakeshopPendingStep` 신설

- **target 위치**: 구현 범위 기술 — 추출 컴포넌트 목록
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1`, CLAUDE.md 단일 진실 원칙
- **상세**: `plan/in-progress/refactor/03-maintainability.md` §m-3은 `components/integrations/steps/` 대상을 `AuthStep` / `TestStep` / `SaveStep` 3개로 열거한다. 구현 계획 payload 는 `AuthStep`(+`Cafe24ExtraFields`·`MakeshopExtraFields`) / `TestStep` / `Cafe24PrivatePendingStep` / `MakeshopPendingStep` 로 달리 설계한다 — `SaveStep` 없음, `Cafe24PrivatePendingStep`·`MakeshopPendingStep` 신설. Step 3(Test) 이후 Save 버튼이 같은 화면에 있는 실제 `page.tsx` 구조(`createMutation`, `goToStep("test")` 후 save CTA)를 보면 `SaveStep`이 독립 컴포넌트로 존재하지 않는 것이 현실과 맞고, Private/MakeShop pending 화면을 별도 컴포넌트로 분리하는 것도 `page.tsx` 현 구조(`privatePending`·`makeshopPending` 조건 분기)에 타당하다. 그러나 plan 이 이전 설계를 반영하고 있어 구현 계획과 어긋난다.
- **제안**: plan §m-3 컴포넌트 목록을 실제 구현 계획(`Cafe24PrivatePendingStep`·`MakeshopPendingStep` 추가, `SaveStep` 제거)으로 갱신한다. plan 이 미착수 상태(`[ ] 미착수`)이므로 갱신 부담이 낮다. plan이 설계 SoT 역할을 유지하도록 일치시킨다.

---

### [INFO] `components/integrations/steps/` 신규 디렉토리 — spec `4-integration.md` `code:` 글로브 미반영

- **target 위치**: `spec/2-navigation/4-integration.md` frontmatter `code:` 목록
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로"를 명시
- **상세**: 구현 후 `codebase/frontend/src/components/integrations/steps/` 하위에 5개 컴포넌트 파일이 생성되지만, `spec/2-navigation/4-integration.md` frontmatter `code:` 에는 해당 경로를 커버하는 글로브가 없다. 현재 `code:` 글로브 중 `codebase/frontend/src/lib/integrations/*.ts` 는 hooks/util을 커버하고, `codebase/frontend/src/app/(main)/integrations/new/page.tsx` 는 page를 커버하지만, `components/integrations/steps/` 를 커버하는 항목이 없다. `spec-code-paths.test.ts` 는 `>=1 매치` 만 강제하므로 기존 글로브로 테스트는 통과하지만, spec 추적성 관점에서 주요 구현 파일군이 `code:` 에서 누락된다. 참고: 인접 컴포넌트(`approval-required-badge.tsx` 등)는 `spec/4-nodes/4-integration/4-cafe24.md` 가 `code:` 로 개별 명시한다.
- **제안**: 구현 완료 후 `spec/2-navigation/4-integration.md` `code:` 에 `codebase/frontend/src/components/integrations/steps/*.tsx` 를 추가하거나, 구현 착수 전 "spec 변경 없음" 결정의 근거를 plan 에 명기한다(기존 글로브가 page.tsx를 커버하므로 가드는 통과함). 단 spec 변경 권한은 `project-planner` 에 있으므로 developer 는 구현 완료 후 planner 에 위임 체크리스트로 남긴다.

---

### [INFO] `openOAuthPopup` util 파일명 패턴

- **target 위치**: 구현 범위 기술 — `lib/integrations/openOAuthPopup` util
- **위반 규약**: CLAUDE.md 폴더 구조 관례 (해당 디렉토리의 기존 파일: `use-*.ts`, `reauthorize.ts`, `mcp-capable-service-types.ts`)
- **상세**: `lib/integrations/` 에는 현재 hook(`use-*.ts`)과 utility(`reauthorize.ts`, `mcp-capable-service-types.ts`)가 혼재하며 hook-전용 디렉토리가 아니다. `openOAuthPopup` 을 같은 위치에 두는 것은 기존 패턴(`reauthorize.ts`)과 일치하고 규약 위반이 아니다. 단 파일명은 기존 패턴 `kebab-case.ts` (예: `reauthorize.ts`) 를 따라야 한다 — `open-oauth-popup.ts` 형식.
- **제안**: 구현 시 파일명을 `open-oauth-popup.ts` (kebab-case)로 생성한다. 식별자 `openOAuthPopup`(camelCase export)와 파일명 `open-oauth-popup.ts`의 조합은 기존 `use-cafe24-mall-id-precheck.ts` → `useCafe24MallIdPrecheck` export 패턴과 일치한다.

---

## 요약

정식 규약 준수 관점에서 구현 계획 자체(행위·UI·wire)는 `spec/2-navigation/4-integration.md §3` 스펙 경계를 보존한다. 그러나 구현 계획 payload 와 plan 문서(`03-maintainability.md §m-3`) 사이에 hook 이름(`useDraftRestore` vs `useUnsavedChangesWarning`)과 컴포넌트 목록(`SaveStep` 누락, `Cafe24PrivatePendingStep`·`MakeshopPendingStep` 신설) 두 가지 식별자 불일치가 있다. 단일 진실 원칙(CLAUDE.md) 상 plan 이 설계 SoT 역할이므로 구현 착수 전 plan 갱신이 권장된다. `components/integrations/steps/` 경로의 spec `code:` 미반영은 가드 위반은 아니나 추적성 공백이다. 신규 hook/util 파일명은 기존 kebab-case 패턴을 따르면 되며 추가 조치 불요.

## 위험도

LOW
