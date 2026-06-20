# RESOLUTION — review/code/2026/06/20/15_02_56

리뷰 결과: RISK=LOW, CRITICAL=0, WARNING=3. Critical 없음. WARNING 중 본 변경에서 비롯된 2건 + 보완 INFO 1건 조치, 나머지는 범위 밖으로 보류.

## 조치 항목

| SUMMARY # | 발견 | 조치 | 파일 |
|---|---|---|---|
| WARNING #1 (Testing) | `plan-frontmatter.test.ts` sentinel 파일명 하드코딩 — 그 파일이 `complete/` 로 이동하면 재차 깨지는 fragility | sentinel 의 특정 파일명 의존 제거 → discovery 가 `plan/in-progress` 의 실제 `.md` 만 반환하는지 구조 검증으로 대체 | `codebase/frontend/.../plan-frontmatter.test.ts` |
| WARNING #2 (Documentation) | `backend/README.md` 스크립트 표에 `lint:fix` 누락 + `lint` report-only 전환 미반영 | `lint` 설명을 report-only 로 수정 + `lint:fix` 행 추가 | `codebase/backend/README.md` |
| INFO #5 (Testing) | demote 후 `*.spec.ts` 의 방어적 `as T` 에서 warn 노이즈 가능 | `*.spec.ts`/`*.e2e-spec.ts` override 에 `no-unnecessary-type-assertion: off` 추가 (프로덕션 코드는 warn 유지) | `codebase/backend/eslint.config.mjs` |

## TEST 결과
- lint: 통과 (PASS)
- unit: 통과 (PASS — backend 7140 + frontend/web-chat/channel-web-chat 전 패키지)
- build: 통과 (PASS — docker 이미지 빌드 포함)
- e2e: 통과 (PASS — 205 tests)

## 보류·후속 항목
- **WARNING #3 (Dependency — `jsonwebtoken` 9.0.3 정확 고정)**: 본 diff 범위 밖 기존 설정(`package.json` line 219, lint 툴링과 무관). 본 PR 미조치 — 별도 dependency 백로그.
- **INFO #1 (SPEC-DRIFT — `plan-lifecycle.md §5 Gate C` 의 `spec_impact` 형식 명세 불완전)**: 코드(`exec-single-node.md`)는 올바른 리스트로 수정됨. spec 본문 명문화는 `project-planner` 영역 → developer PR 범위 밖, 별도 위임.
- **INFO #7 (`backend/README.md` 의 `npm` → `pnpm` 미반영)**: 테이블 전반의 pnpm 전환 누락(기존 이슈). 본 PR 은 `lint`/`lint:fix` 행만 갱신, 전수 `npm`→`pnpm` 은 별도.
- 기타 INFO (gray-matter 클라이언트 번들 확인, swagger pin 등): 비차단 advisory, 미조치.
