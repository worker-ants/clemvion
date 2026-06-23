# 문서화(Documentation) Review

## 발견사항

### [WARNING] README.md 의 환경변수 표에 `NEXT_PUBLIC_WIDGET_CDN_BASE` 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/README.md` — "Deployment > 환경변수" 표 (line 125–133)
- 상세: `README.md` Deployment 섹션의 환경변수 표에는 `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `INTERNAL_API_URL`, `PORT/HOSTNAME` 만 나열되어 있다. 이번 증분 2 에서 co-deploy 경로가 실용화되면서 `NEXT_PUBLIC_WIDGET_CDN_BASE` 가 실질적으로 운영에 영향을 주는 변수로 부상했는데 README 에 반영이 없다. `.env.example` 에는 비교적 상세한 설명이 있으나, README 의 배포 표를 참조하는 독자(DevOps, CI 설정자)는 이 변수를 인지하지 못할 수 있다.
- 제안: README Deployment 환경변수 표에 `NEXT_PUBLIC_WIDGET_CDN_BASE` 행 추가. 예: `| NEXT_PUBLIC_WIDGET_CDN_BASE | build-time | 위젯 CDN base override. 미설정 시 self-origin 동봉(`/_widget`). `.env.example` 참고 |`

### [WARNING] README.md 에 `build:widget` 빌드 순서 안내 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/README.md` — Deployment 섹션
- 상세: `copy-widget.mjs` 주석(파일 상단)에는 "배포/CI 의 `next build` 앞단계"라고 명시되어 있으나, README Deployment 섹션의 `docker build` 예시에 `build:widget` 선행 실행이 언급되지 않는다. CI 파이프라인 구성자가 `build:widget` 없이 `next build` 만 실행하면 `public/_widget/` 디렉터리가 없어 라이브 미리보기가 silently unavailable 상태가 된다(타임아웃 fallback). 이 실패는 빌드 오류 없이 런타임에 나타나므로 발견이 늦다.
- 제안: README Deployment > Getting Started 또는 Docker 빌드 예시 직전에 "라이브 미리보기를 포함하려면 `next build` 전에 `pnpm --filter frontend build:widget` 을 실행해 `public/_widget/` 를 생성해야 한다"는 주의사항 한 문단 추가.

### [INFO] `plan/in-progress/web-chat-console.md` — Phase 3 체크박스 상태와 실제 구현 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/plan/in-progress/web-chat-console.md` — Phase 3 체크리스트 (line 1411–1413)
- 상세: 커밋이 contained same-origin iframe 임베드, `wc:ready`→`wc:boot` 전달, origin 검증, 타임아웃 fallback, unit 테스트 4개를 모두 구현했음에도 plan 에서 해당 항목들은 `[ ]` (미완료) 로 남아 있다. 증분 2 커밋이 실질적으로 Phase 3 의 대부분을 완료했지만 plan 체크박스는 갱신되지 않았다. 계획 파일이 진행 이력·이월 판단 근거로 쓰이는 프로젝트 규약(plan-lifecycle.md) 상 이 불일치는 후속 독자에게 혼선을 줄 수 있다.
- 제안: 구현이 완료된 항목(iframe 임베드·postMessage 흐름·unit 테스트)은 `[x]` 로 갱신하고, e2e 및 미완 항목만 `[ ]` 유지. 단, 이는 코드리뷰 범위보다 plan 관리 규약에 해당하므로 필수 차단 사항은 아님.

### [INFO] `live-preview.tsx` — `postBoot` 함수에 JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/live-preview.tsx` — `function postBoot()` (line 1080–1085)
- 상세: `postBoot` 함수는 `widgetOrigin || "*"` 조건부 targetOrigin 로직을 포함한다. `*` fallback 은 보안 상 주의가 필요한 선택인데 왜 이 fallback 이 허용 가능한지(same-origin 동봉 시 `widgetOrigin` 이 항상 채워지므로 `*` 는 CDN base 미설정 SSR 엣지케이스에만 해당) 설명이 없다. 컴포넌트 JSDoc 에 흐름 전체가 서술되어 있으나, 이 보안 관련 인라인 결정은 `postBoot` 내부 주석이나 짧은 함수 JSDoc 으로 명시하는 것이 좋다.
- 제안: `postBoot` 에 `// widgetOrigin 비어있으면 CDN base 미설정(SSR 엣지) — same-origin 동봉 정상 경로에선 항상 채워짐` 수준의 주석 추가.

### [INFO] `widget-base.ts` — `getWidgetOrigin()` JSDoc 이 CDN override 케이스를 명시하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/lib/web-chat/widget-base.ts` — `getWidgetOrigin()` (line 1182)
- 상세: 한 줄 JSDoc(`/** 위젯 iframe 의 origin — 미리보기 postMessage 송수신 origin 검증용. 동봉 self-origin 이면 배포 origin. */`)이 "동봉 self-origin" 케이스만 설명한다. `NEXT_PUBLIC_WIDGET_CDN_BASE` 가 설정된 경우에는 CDN origin 이 반환된다는 점이 언급되지 않아, 함수 동작을 처음 읽는 개발자가 두 케이스를 모두 이해하기 어렵다. 인접 함수 `getWidgetBase()` JSDoc 은 두 케이스를 명확히 기술하는데 `getWidgetOrigin()` 만 불완전하다.
- 제안: JSDoc 을 `/** 위젯 iframe 의 origin — postMessage origin 검증용. 동봉이면 배포 origin, NEXT_PUBLIC_WIDGET_CDN_BASE override 시 CDN origin. 해석 불가(SSR + 미설정) 시 빈 문자열. */` 으로 보강.

### [INFO] `copy-widget.mjs` — `run()` 함수에 짧은 주석 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/scripts/copy-widget.mjs` — `function run()` (line 408)
- 상세: `run()` 함수는 `env` 매개변수를 `process.env` 에 merge 해 실행하는 간단한 wrapper 다. 파일 전체 문서화 품질은 우수하나 이 함수만 유일하게 설명 없이 노출되어 있다. 파일 규모가 작아 읽으면 이해되지만 일관성 측면에서 짧은 한 줄 주석이 있으면 더 좋다.
- 제안: `/** @param {string} cmd shell command; cwd = repoRoot. @param {Record<string,string>} [env] env overrides merged into process.env. */` 수준의 JSDoc 추가. 차단 불필요.

## 요약

전반적인 문서화 품질은 양호하다. `copy-widget.mjs` 는 파일 상단 블록 주석으로 목적·사용법·SoT 를 모두 기술하고, `widget-base.ts` 모듈 주석과 `LivePreview` 컴포넌트 JSDoc 도 spec 섹션 참조와 흐름 설명을 갖추고 있다. `spec/7-channel-web-chat/5-admin-console.md §6.1` 신설로 boot config 전달 메커니즘이 spec 에 정식 문서화된 점도 긍정적이다. 그러나 `codebase/frontend/README.md` 의 Deployment 섹션이 새로운 `build:widget` 선행 빌드 단계와 `NEXT_PUBLIC_WIDGET_CDN_BASE` 환경변수를 반영하지 않아 CI 파이프라인 구성자에게 혼선을 줄 수 있다. `plan/in-progress/web-chat-console.md` 의 Phase 3 체크박스 불일치와 `postBoot` 함수의 보안 관련 주석 부재도 보강이 권장된다.

## 위험도

MEDIUM
