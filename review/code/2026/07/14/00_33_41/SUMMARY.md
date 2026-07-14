# 코드 리뷰 SUMMARY — backend 프로덕션 이미지 슬림화 (pnpm deploy injected)

- 대상 범위: `--range HEAD~1..HEAD` (커밋 `360d41f6` — `codebase/backend/Dockerfile`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `plan/in-progress/pnpm-migration-followups.md`)
- 실행 reviewer 6종 (fallback 평문 Agent fan-out): dependency, security, documentation, side_effect, scope, testing
  - router 강제 화이트리스트(dependency·documentation·security) 포함. performance·architecture·requirement·maintainability·concurrency·database·api_contract·user_guide 는 이 순수 빌드/인프라 변경과 무관해 미실행(라우팅 판단).

## 종합 위험도: **MEDIUM** (Critical 0 / Warning 8 / Info 다수)

| reviewer | 위험도 | Critical | Warning | 비고 |
|---|---|---|---|---|
| dependency | MEDIUM | 0 | 2 | injectWorkspacePackages 전역성 · pnpm 필드 무시 보안핀 |
| side_effect | MEDIUM | 0 | 3 | injectWorkspacePackages 전역성 · frontend symlink 전제 · dev hot-reload |
| security | LOW | 0 | 1 | pnpm 필드 무시 → 보안핀 lockfile 관성 의존 (OWASP A06/A08) |
| documentation | LOW | 0 | 1 | PROJECT.md 버전 핀 정책이 pnpm 필드 무시 사실과 불일치 |
| testing | LOW | 0 | 2 | devDeps/프런트 스택 부재 CI 스모크 가드 부재 · cron-parser 커버리지 우연 |
| scope | NONE | 0 | 0 | injectWorkspacePackages 추가는 injected deploy 필수 전제로 정당 |

**차단 사유 없음** (Critical 0). 8개 Warning 은 아래 3개 클러스터로 수렴하며 전부 처리(fix 또는 근거 있는 defer)했다 — 상세는 같은 디렉터리 `RESOLUTION.md`.

## Warning 클러스터 & 처분 요약

1. **injectWorkspacePackages 전역 영향** (dependency×1, side_effect×3) — 실측 반증 + 문서화로 해소. 일반 `pnpm install`(frozen)은 backend·frontend·web-chat-sdk 모두 `@workflow/*` symlink 유지(검증), 실효 영향은 `pnpm deploy` 한정. frontend Next standalone 빌드도 이 설정 하에서 통과. `pnpm-workspace.yaml` 주석·plan 에 근거 기록.
2. **pnpm 필드 무시 → 보안핀 거버넌스 공백** (dependency×1, security×1, documentation×1) — 본 diff 유발이 아닌 기존 이슈(발견·추적됨). 중간 안전장치로 `PROJECT.md` 버전 핀 정책에 경고 각주 추가. overrides→`pnpm-workspace.yaml` 정식 이전은 §2 와 디커플한 우선 후속으로 plan 격상(별도 PR).
3. **프로덕션 이미지 위생 CI 가드 부재** (testing×2, = plan §1 후속 b) — `.claude/test-stages.sh` 에 `_cmd_backend_image_hygiene_smoke` 추가로 **본 PR 에서 해소**. 프런트/테스트 스택 부재 + dist/main.js + cron-parser v5 해소 assert.

## Info 처분

- `pnpm deploy` 에 `--frozen-lockfile` 미지정 (dependency/security INFO) — builder 스테이지의 고정 그래프 위에서 실행되므로 실질 위험 없음, pnpm deploy 미지원 가능성. 미조치.
- README `file:` → `workspace:*` 표기 (documentation INFO, pre-existing) — 본 diff 범위 밖, 미조치(opportunistic 백로그).
- runner 이미지 `pnpm run` ops 경로 문서화 (documentation/side_effect INFO) — 현재 어떤 문서도 이 경로를 약속하지 않아 미조치, k8s 런북 작성 시 백로그.
