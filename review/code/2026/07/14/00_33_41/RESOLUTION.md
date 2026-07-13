# RESOLUTION — backend 프로덕션 이미지 슬림화 리뷰 처분

세션: `review/code/2026/07/14/00_33_41` · reviewer 6종 · 0 Critical / 8 Warning (종합 MEDIUM)
구현 커밋: `360d41f6` · 리뷰 반영 커밋: `99e2c715`

## 조치 항목

| # | reviewer | Warning | 처분 | 커밋 |
|---|---|---|---|---|
| 1 | dependency / side_effect (×4) | `injectWorkspacePackages` 전역성 — frontend/web-chat-sdk symlink→injected 전환 및 dev hot-reload 미검증 | **실측 반증 + 문서화**. 일반 `pnpm install`(frozen)은 backend·frontend·web-chat-sdk 모두 `@workflow/*` symlink 유지 확인 → 실효 영향은 `pnpm deploy` 한정. frontend Next standalone 빌드도 통과. `pnpm-workspace.yaml` 주석·plan 에 근거 기록 | `99e2c715` |
| 2 | dependency / security / documentation (×3) | pnpm 10.23 이 `package.json` `pnpm.overrides`/`onlyBuiltDependencies` 무시 → 보안핀 lockfile 관성 의존 + `PROJECT.md` 안내 stale | 본 diff 유발 아닌 기존 이슈. **중간 안전장치**: `PROJECT.md` 버전 핀 정책에 경고 각주 추가. 정식 이전(→`pnpm-workspace.yaml`)은 §2 와 디커플한 **우선 후속**으로 plan 격상(별도 PR) | `99e2c715` (각주) / 후속 이관 |
| 3 | testing (×2) | 프로덕션 이미지 위생(devDeps/프런트 스택 부재) 자동 CI 가드 부재 · cron-parser 커버리지 우연 | **CI 스모크 가드 신설**: `.claude/test-stages.sh` `_cmd_backend_image_hygiene_smoke` — 프런트/테스트 스택 부재 + `dist/main.js` + cron-parser v5 해소 assert. plan §1 후속 (b) 해소 | `99e2c715` |

Info 항목(3건: deploy `--frozen-lockfile` 미지정 / README `file:`→`workspace:*` / runner `pnpm run` ops 문서화)은 실질 위험 없음·pre-existing·미약속 경로라 미조치, SUMMARY 에 사유 기록.

## TEST 결과

- **lint**: 통과 (구현 커밋 시점 · 리뷰 fix 는 eslint 대상 파일 무변경 — `.sh`/`.md`/yaml 주석)
- **unit**: 통과 (14 suites · 앱 코드 무변경)
- **build**: 통과 (재수행 — 신규 `_cmd_backend_image_hygiene_smoke` 통합 검증: `ok: 프런트/테스트 스택 부재 · dist/main.js 존재 · cron-parser v5 해소`)
- **e2e**: 통과 (253/253, 44 suites, `schedule-trigger` 포함 — 구현 커밋 `360d41f6` 의 runtime 이미지 기준). 리뷰 fix 커밋 `99e2c715` 는 test-stages 스모크 + 문서만 변경해 **런타임 이미지·앱 코드 delta 없음** → 재수행 불요, build 스모크가 동일 이미지 위생을 재확인.

## 보류·후속 항목

- **overrides/onlyBuiltDependencies → `pnpm-workspace.yaml` 정규 위치 이전 + lockfile 재생성** — 버전 변경 없는 기계적 이전. §2(swagger deep-import 교체)와 디커플한 우선 후속 별도 PR. `plan/in-progress/pnpm-migration-followups.md` §1 부수 발견에 격상 기록.
- **§3 node-linker=hoisted→strict 전환** — 별도 백로그 유지(본 작업은 `injectWorkspacePackages` 만, node-linker 불변).
- **README `file:`→`workspace:*` 표기 정정** (documentation INFO, pre-existing opportunistic).
