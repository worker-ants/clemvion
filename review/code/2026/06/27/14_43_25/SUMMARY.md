# Code Review 통합 보고서

## 전체 위험도
**LOW** — 보안 위험 없음. Critical 발견 없음. SPEC-DRIFT 1건(spec 갱신 필요) + 테스트 커버리지 갭 2건(WARNING). 나머지는 모두 INFO 수준 개선 사항.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] Composer 로딩 표시(spinner / aria-busy / "AI 응답 중")가 spec 에 미반영. `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행은 booting/streaming 중 비활성 정책만 규정하며 스피너·회색·aria-busy UX 는 언급 없음. 구현이 R6 입력 차단을 유지하며 UX/접근성을 의도적으로 확장한 것이므로 코드 revert 아닌 spec 갱신이 필요 | `spec/7-channel-web-chat/1-widget-app.md §2` 입력창 행 "동작" 열 | 코드 유지. `project-planner` 위임 — §2 표 "입력창" 행에 "booting/streaming 중: aria-busy=true + aria-label='AI 응답 중' + 스피너; 그 외 비활성: 중립 회색(#c7cad1)" 추가 |
| 2 | TESTING | `Composer` 컴포넌트 전용 단위 테스트 파일(`composer.test.tsx`) 부재. `loading` prop 의 (1) aria-label 전환 (2) aria-busy 유무 (3) 스피너 엘리먼트 존재 여부가 Panel 통합 경로로만 간접 검증됨. Panel loading 계산 로직 변경 시 Composer 단독 렌더 회귀 포착 지연 우려 | `codebase/channel-web-chat/src/widget/components/` (composer.test.tsx 없음) | `composer.test.tsx` 생성 — `loading=true/false/undefined` 3개 조합에 대해 aria-label·aria-busy·스피너 존재를 Composer 단독 렌더로 검증하는 3–5개 케이스 추가 |
| 3 | TESTING | `Composer` API 계약 갭 — `submit` 핸들러 가드(`!trimmed \|\| disabled`)와 버튼 `disabled` 판정에 `loading` 미포함. `loading=true, disabled=false` + 텍스트 입력 시 스피너 표시 중 전송(`onSend` 호출)이 차단되지 않음. Panel 은 항상 두 prop 을 동시에 설정하므로 현재 런타임 경로 미발현이나 독립 재사용 시 버그 | `codebase/channel-web-chat/src/widget/components/composer.tsx` L39, L17–18 | `submit` 에 `loading` 가드 추가(`if (!trimmed \|\| disabled \|\| loading) return;`) 또는 버튼 `disabled` 에 `loading` 포함. 이후 해당 케이스 테스트로 보강 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SIDE_EFFECT | `ComposerProps.loading` 옵셔널 prop 추가 — 하위 호환. 기존 사용처가 prop 생략 시 `undefined`(falsy)로 처리되어 동작 동일 | `composer.tsx` L6-8 | 변경 없음. 외부 패키지가 `ComposerProps` 타입을 직접 임포트하는 경우 export 목록 확인(현재 모노레포 내부이므로 해당 없음) |
| 2 | SIDE_EFFECT | `@keyframes wc-spin` 이 `widgetStyles` 문자열 전역에 등록되나 위젯은 iframe 내부에서 동작해 호스트 페이지 CSS 네임스페이스와 충돌 없음. `wc-` prefix 규약 준수 확인 완료 | `codebase/channel-web-chat/src/widget/styles.ts` | 변경 없음 |
| 3 | SIDE_EFFECT | `plan/complete/web-chat-composer-loading-indicator.md` 가 `in-progress` 경유 없이 직접 `complete` 상태로 생성됨. 단일 커밋 픽스이므로 실질 운영 리스크 없으나 plan 라이프사이클 이력 누락 가능 | `plan/complete/web-chat-composer-loading-indicator.md` | 핫픽스 패턴으로 허용 가능. 필요 시 `.claude/docs/plan-lifecycle.md` 에 "단일 커밋 픽스 직접 complete 허용" 케이스 명문화 |
| 4 | TESTING | `booting` 케이스 검증 범위가 `streaming` 보다 좁음. streaming 은 aria-busy·disabled·스피너·입력 비활성 4항목을 검증하나 booting 은 aria-busy 1항목만 확인 | `panel.test.tsx` L197–207 | booting 케이스에 스피너 존재·btn.toBeDisabled·입력 비활성 검증 추가 |
| 5 | TESTING | `BASE_ACTIONS` vi.fn() 이 테스트 간 `beforeEach(() => vi.clearAllMocks())` 없이 공유됨. 현재 호출 횟수 검증 없어 즉각 오류 없으나 향후 누적 호출 false-positive/negative 위험 | `panel.test.tsx` L239–244 | describe 블록 상단에 `beforeEach(() => { vi.clearAllMocks(); })` 추가 |
| 6 | TESTING | `styles.ts` CSS 변경(disabled 색상·spinner 규칙·keyframes)은 jsdom 환경에서 computed style 검증 불가. 프로젝트 전반 스타일 회귀 테스트 미정의 — 이번 PR 독립 문제 아님 | `codebase/channel-web-chat/src/widget/styles.ts` | 단기 조치 불필요. 장기적으로 시각 회귀 테스트(Chromatic/Percy) 또는 스타일 문자열 스냅샷 테스트 도입 검토 |
| 7 | DOCUMENTATION | `panel.test.tsx` 파일 상단 주석이 "Composer disabled 게이팅"만 기술하고, 신규 추가된 "AI 처리 중 로딩 표시(§R6)" describe 블록을 반영하지 않음 | `panel.test.tsx` L2 | `// W6: panel.tsx Composer disabled 게이팅 + AI 처리 중 로딩 표시(§R6) 테스트.` 로 한 줄 확장 |
| 8 | DOCUMENTATION | `ComposerProps` 인터페이스에서 `loading` 만 JSDoc 문서화됨. 기존 `disabled`·`placeholder`·`onSend` 는 JSDoc 없어 일관성 저하 | `composer.tsx` ComposerProps | `disabled?: boolean; /** 외부에서 강제 비활성(§R6 게이팅). */` 한 줄 추가 권장 |
| 9 | SCOPE | `<button>` 태그가 신규 attribute(`aria-busy`, `aria-label`) 추가로 단일 라인에서 멀티 라인으로 재포맷됨. 의미 변경 없음 | `composer.tsx` button 태그 | 무시 |
| 10 | SCOPE | `.wc-composer-send` 에 `display:inline-flex; align-items:center; justify-content:center;` 추가 — 스피너 정렬 필수이며 기존 렌더에 퇴행 없음 | `styles.ts` .wc-composer-send | 무시 |
| 11 | SECURITY | `panel.tsx` 의 `{error}` 렌더링 패턴은 백엔드 내부 정보 포함 가능성 있으나, 이번 PR 이 신규 도입한 코드 아님. 별도 태스크로 에러 문자열 정규화 검토 가능 | `panel.tsx` wc-error div | 이번 PR 범위 외. 별도 태스크 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 전 범위 이상 없음. 동적 값 모두 JSX 텍스트 자식 이스케이프, 신규 시크릿·인젝션 없음 |
| requirement | LOW | [SPEC-DRIFT] spec §R6 스피너·aria-busy UX 미반영 (WARNING 1건) |
| scope | NONE | 변경 범위가 선언 의도와 완전히 일치, 일탈 없음 |
| side_effect | LOW | 모두 INFO — loading prop 하위 호환, iframe CSS 격리, plan 라이프사이클 예외 |
| maintainability | — | 재시도 필요 (output_file 부재) |
| testing | LOW | WARNING 2건 — Composer 단위 테스트 부재, loading+disabled API 계약 갭 미검증 |
| documentation | LOW | 모두 INFO — 파일 주석·JSDoc 일관성·spec §R6 스피너 미기재 |

## 발견 없는 에이전트

- **security**: 보안 위험 없음 (이번 PR 범위 내 전 항목 이상 없음)
- **scope**: 범위 일탈 없음

## 권장 조치사항

1. **(SPEC-DRIFT)** `project-planner` 에 위임하여 `spec/7-channel-web-chat/1-widget-app.md §2` "입력창" 행 동작 열에 스피너·aria-busy·회색 비활성 UX 기술 추가 — 코드 revert 금지, spec 갱신이 올바른 경로.
2. `codebase/channel-web-chat/src/widget/components/composer.test.tsx` 생성 — `loading=true/false/undefined` 3조합에 대해 aria-label·aria-busy·스피너 렌더를 Composer 단독으로 검증하는 단위 테스트 3–5개 추가.
3. `composer.tsx` `submit` 핸들러에 `loading` 가드 추가(`if (!trimmed || disabled || loading) return;`) — 독립 재사용 시 API 계약 강제.
4. `panel.test.tsx` booting 케이스에 스피너·disabled·입력 비활성 검증 추가 (streaming 케이스와 동등 수준 맞춤).
5. `panel.test.tsx` describe 최상단에 `beforeEach(() => { vi.clearAllMocks(); })` 추가.
6. `panel.test.tsx` L2 파일 주석에 "로딩 표시(§R6)" 범위 명시 추가.
7. (선택) `ComposerProps.disabled` JSDoc 한 줄 추가 — `loading` 과 일관성.
8. `maintainability` 리뷰어 재시도 — output_file 없어 이번 통합에서 제외됨.

## 라우터 결정

라우터가 선별 실행함 (`routing=done`).

- **실행(ran)**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명 — 전원 router_safety 강제 포함)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 전원)
- **제외(skipped)**: performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync (7명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 판단 — 이번 변경(UI 스피너/CSS) 성능 영향 없음 |
| architecture | 라우터 판단 — 순수 UI prop 추가, 아키텍처 변경 없음 |
| dependency | 라우터 판단 — 신규 패키지 추가 없음 |
| database | 라우터 판단 — DB 접근 없음 |
| concurrency | 라우터 판단 — 동시성 관련 변경 없음 |
| api_contract | 라우터 판단 — 외부 API 계약 변경 없음 |
| user_guide_sync | 라우터 판단 — 사용자 가이드 영향 없음 |