# 문서화(Documentation) 리뷰 결과

## 검토 범위 메모

이번 diff(24개 파일)는 실질적으로 세 부류다:

1. `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` — 깊이 상한 경계 테스트 8종
   추가(순수 테스트, 프로덕션 코드 미변경).
2. `plan/complete/{masked-marker-shared-package,mirror-guard-single-copy}.md`(신규) +
   `plan/in-progress/{같은 이름}.md`(삭제) — 이미 머지된 PR #1190/#1191 의 plan lifecycle
   승격(rename). `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 갱신분은
   `RESOLUTION.md` 기록대로 rebase 로 이 브랜치에서 드롭되어 이번 diff 에는 없음(실측:
   `git diff --name-only`에 해당 파일 없음).
3. `review/code/2026/08/22/16_07_45/**`, `review/consistency/2026/08/22/15_35_56/**` — 이전
   라운드의 리뷰·consistency-check 산출물이 신규 파일로 커밋됨(정책상 `review/**` 는 커밋 대상).

프로덕션 코드(`sanitize-error-message.ts` 등)는 이번 diff 에 포함되지 않는다. 실제 소스를 직접
열어(`Read`) 아래 사항을 대조했다.

## 발견사항

- **[INFO]** egress 마스킹 규약(마커 3종·깊이 상한 SoT·소비처별 경계 연산자)이 정식
  `spec/conventions/**` 문서 없이 코드 JSDoc 산문에만 존재하는 기존 갭
  - 위치: 관련 결정 근거는 `plan/complete/masked-marker-shared-package.md` §"canonical 이름은
    `MAX_MASK_DEPTH`" / §"`MAX_SANITIZE_DEPTH`(websocket)는 건드리지 않는다" 절 (신규 파일,
    게이트 72~93). 원 지적은 `review/consistency/2026/08/22/15_35_56/convention_compliance.md`
    WARNING #1 (게이트 11~15).
  - 상세: 새로 만든 문제가 아니라 `--impl-prep` consistency 라운드가 낸 WARNING 을
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커에 등재만 한 것으로
    보인다(단, 그 트래커 파일 자체는 이번 diff 범위 밖 — `RESOLUTION.md` 대로 드롭됨). 신설 여부는
    developer 권한 밖(project-planner 판단)이라 이 PR 에서는 정당하게 보류된 것으로 판단된다.
    같은 지적이 이전 라운드(`review/code/2026/08/22/16_07_45/documentation.md` INFO #1, SUMMARY.md
    INFO #14)에서도 이미 나왔고 이번 diff 는 그 판단을 바꿀 새 정보를 추가하지 않는다.
  - 제안: 조치 불필요. 다음 planner 턴에서 `spec/conventions/egress-masking.md`(가칭) 신설 여부만
    확인하면 된다.

- **[INFO]** 신규 테스트 설명 블록(`describe('깊이 상한 경계 (MAX_REDACT_DEPTH)', ...)` 앞,
  게이트 62~95)이 헤더(`##`/`###`)·표를 포함한 긴 Markdown 을 TS `/** */` 블록 코멘트 안에 담고
  있어, 일반 JSDoc/TSDoc 툴링(IDE hover 등)에서는 표가 정상 렌더링되지 않는다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` — 게이트 62~95
    (`describe` 앞 블록 코멘트, "## 깊이 상한 경계 — 마스커 자신의 좌표계"부터 "선언된 상한이
    **구현에 실제로 반영돼 있는가**" 까지)
  - 상세: 프로덕션 코드(`sanitize-error-message.ts`)의 기존 JSDoc 도 동일한 한국어 산문+표 스타일을
    쓰므로 저장소 관례와 일치한다. 결함이 아니라 참고용 관찰이며, 이전 라운드(`16_07_45/documentation.md`
    INFO #2)에서도 동일하게 조치 불필요로 판정됐다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 JSDoc 산문 주장을 소스와 line-level 대조 — 전부 일치 확인 (검증 근거 기록)
  - 위치: `sanitize-error-message.spec.ts` 게이트 78~87(상한 3계열 비교표), 게이트 313~321("값
    검사가 깊이 검사보다 먼저"), 게이트 351~358(JSON 파싱이 `depth+1` 을 태운다)
  - 상세: 실제 `sanitize-error-message.ts` 를 열어 확인한 결과 `deepRedactCore`(:259~272)는
    ① `typeof value === 'string'`(:264) → ② `value === null || typeof value !== 'object'`(:269)
    → ③ `depth >= MAX_REDACT_DEPTH`(:270, `VALUE_MASK_MARKER` 반환) 순서이고,
    `redactSecretsInJsonString`(:333)이 `deepRedactSecrets(parsed, depth + 1)` 로 재귀 진입하는
    것도 확인했다. 표에 적힌 세 계열(`MAX_REDACT_DEPTH` `>=`/`VALUE_MASK_MARKER`,
    `MAX_SANITIZE_DEPTH` `>`/`DEPTH_MASK_MARKER`, `stripExternalOnlyFields` `>`/서브트리 보존)도
    코드 실측과 일치한다. 즉 이번 diff 의 문서(JSDoc) 주장에 부정확한 서술은 없다.
  - 제안: 조치 불필요.

- **[INFO]** plan lifecycle rename(`in-progress` → `complete`)이 만든 상대경로 링크·상호참조
  무결성 확인
  - 위치: `plan/complete/masked-marker-shared-package.md:18`
    (`[spec-sync-external-interaction-api-gaps.md](../in-progress/spec-sync-external-interaction-api-gaps.md)`),
    `:182`(`[mirror-guard-single-copy.md](./mirror-guard-single-copy.md)`)
  - 상세: 파일이 `plan/in-progress/` → `plan/complete/` 로 이동하면서 상대경로 기준이 바뀌는데,
    두 링크 모두 새 위치에서 올바르게 해석된다 — `../in-progress/spec-sync-...` 는
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(실존 확인)를 가리키고,
    `./mirror-guard-single-copy.md` 는 같은 디렉터리(`plan/complete/`)로 함께 이동한 자매 문서를
    올바르게 가리킨다. `plan/in-progress/` 에는 두 옛 파일명이 더 이상 남아있지 않음을 확인했다
    (rename 이 깨끗하게 완료됨 — grep 0건).
  - 제안: 조치 불필요.

## 요약

이번 diff 는 프로덕션 코드 변경이 없는 순수 테스트 추가 + plan 문서 lifecycle 이동 + 이전 라운드
리뷰/consistency 산출물 커밋으로 구성된다. 신규 테스트(`sanitize-error-message.spec.ts`)에 붙은
긴 한국어 JSDoc 설명(좌표계 혼동 방지표, 값검사 vs 깊이검사 순서, JSON 재귀 진입점의 `depth+1`
보폭, 스택오버플로 회귀 크기 실측 근거)을 실제 구현과 line-level 로 직접 대조했고 전부 정확했다 —
오래된 주석이나 구현과 어긋나는 서술은 발견되지 않았다. plan 문서 rename 이 만든 상대경로 링크도
새 위치에서 모두 올바르게 해석된다. README/API 문서/CHANGELOG/환경변수 설정 문서 갱신이 필요한
신규 기능·엔드포인트는 없다. 이전 라운드(`16_07_45/documentation.md`)가 이미 낸 두 INFO(egress
마스킹 conventions 문서 부재, JSDoc 안의 Markdown 표 렌더링 한계)는 이번 diff 로도 상태가 바뀌지
않아 동일하게 유지한다.

## 위험도
NONE
