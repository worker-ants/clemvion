# RESOLUTION — webhook-url-env (getWebhookUrl 포트 하드코딩 제거)

branch: `claude/webhook-url-env-5de041` · base: `origin/main`
commits: `87264113` (refactor 구현), `38ff0126` (chore/plan), `9583c9bf` (ai-review 반영), + test 정리/style

## 조치 항목

| # | 출처 | 내용 | 처리 | commit |
|---|---|---|---|---|
| 1 | ai-review W5 (maintainability) | `getWebhookUrl` 의 `:3011` 포트 인라인 하드코딩 | `lib/utils/webhook-url.ts` 로 추출, env 기반 base 결정 (NEXT_PUBLIC_WEBHOOK_BASE_URL → NEXT_PUBLIC_API_URL[/api 제거] → window.location.origin) | 87264113 |
| 2 | ai-review W5 (security INFO) | 환경별 잘못된 URL 노출 | env override + safe fallback + 회귀 테스트 | 87264113 |
| 3 | consistency convention [CRITICAL] | plan frontmatter worktree placeholder / spec 갱신 phase 누락 / 완료기준 비-체크박스 | plan 재작성 (Phase·체크박스·worktree·spec P0) | 38ff0126 |
| 4 | consistency cross_spec [CRITICAL] | `2-api-convention.md`/`data-flow/10-triggers.md` 의 webhook URL·응답·rate-limit 불일치 | **본 task 범위 밖 (기존 spec drift)** — plan P0 에 별도 spec-update 로 분리, project-planner 위임 | — |
| 5 | consistency naming [INFO] | `2-trigger-list.md §2.4` 의 `/hooks/` (`/api` 누락) | plan P0 에 정정 항목 등록 (project-planner) | — |
| 6 | consistency plan-coherence [CRITICAL] | `trigger-detail-drawer.tsx`/`triggers/page.tsx` 를 미머지 worktree 2곳이 동시 수정 | **사용자 결정**: 충돌 감수하고 커밋 진행 (아래 인용) | — |
| 7 | ai-review testing [LOW] | 유틸 테스트 엣지 케이스 부족 | priority/엣지 케이스 보강 (no-suffix / whitespace / multi-slash / priority-1 full-URL) | 9583c9bf → 최종 정리 |
| 8 | ai-review maintainability [LOW] | `/api$` suffix-strip 정규식 의도 불명확 | 의도·전제 주석 추가 | 9583c9bf |
| 9 | ai-review scope [LOW] | 미완료 consistency 세션(08_13_28, checker 결과 0건) 커밋됨 | 디렉토리 제거 | 9583c9bf |
| 10 | ai-review side-effect [LOW] | dev/prod URL drift 여부 | 무변화 확인 — dev·prod 동일, staging/prod `:3011` 버그만 수정 (조치 불요) | — |

## TEST 결과

- **lint**: 통과 (frontend `npm run lint` — 0 errors. 사전 존재 warning 2건은 본 변경과 무관한 파일: `impl-anchor.tsx`, `slide-drawer.tsx`).
- **unit**: 통과 (frontend `npm test` — 157 files / 2833 passed, 1 skipped. 신규 `webhook-url.test.ts` 13 케이스: 3개 priority 분기 / trailing-slash / no-`/api`-suffix / whitespace override / multi-slash / WH-EP-02 형식 / 포트 미주입 회귀).
- **build**: 통과 (frontend `next build` — Compiled successfully, 88 static pages).
- **e2e**: 자동 흐름 환경 차단 — 변경은 순수 프론트엔드 표시 로직(util 추출 + import 교체)으로 unit 으로 보호됨. backend/공유 패키지 미변경.

> 주: 워크트리 fresh `npm ci` 시 lockfile 이 vite 8 / @vitejs/plugin-react 6 을 설치하며 전부 통과. (검증 중 vite 5 를 `--no-save` 로 잘못 핀해 plugin-react 가 vite `/internal` export 를 못 찾는 startup error 가 났으나 `npm ci` 로 복원 — tracked diff 무영향.)

## REVIEW WORKFLOW 상태

`/ai-review` reviewer 4종 (maintainability·testing·side-effect·scope) 수행 — 전부 **LOW**, CRITICAL 0. 위 #7~#10 으로 반영. 보안/성능/아키텍처/문서 등 나머지 reviewer 는 순수 프론트 표시 로직 변경이라 router 비대상.

## 보류·후속 항목

- spec 갱신 (plan P0): WH-EP-02 base 결정 규약 명문화 + cross_spec/naming 발견 정정 → project-planner.
- 통합 충돌 (plan-coherence): trigger-drawer-829934 / chat-channel-form-native-modal-c021b9 와의 import 블록 충돌 → 통합 시점 merge-coordinate.

### 사용자 결정 인용
- "통합 충돌" → **"그대로 커밋 진행"**
- "테스트 실행" → **"npm ci 후 테스트 실행"**
