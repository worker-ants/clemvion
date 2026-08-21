# Plan 정합성 검토 — masked-marker-shared-package (spec/5-system/)

## 검토 범위 및 방법

target 은 `spec/5-system/` (impl-done, diff-base `origin/main`). 프롬프트에 포함된 실제 diff 는
컨텍스트 예산 초과로 생략됐으므로, 아래는 (1) 프롬프트에 전문 포함된
`plan/in-progress/masked-marker-shared-package.md`(정본 작업 plan) ·
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`(정본 트래커) 전문과,
(2) 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/masked-marker-contract-7d2e14`)를
절대경로로 직접 열어 확인한 코드·spec·타 in-progress plan 대조 결과를 근거로 한다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

## 확인한 정합성 (근거 요약)

- **선행 plan 미해소 없음** — 이 PR 이 실행하는 "마커 계약을 공유 패키지로 추출" 은
  `spec-sync-external-interaction-api-gaps.md:373`(2026-08-17 등재)이 이미 "공유 패키지 추출이
  선행돼야 값싸다 — 그래서 별건으로 남긴다" 로 지목해 둔 선행 조건의 집행이다. 실측 결과
  정본 트래커의 두 항목(`:373` "마커 미러 계약 테스트", `:757` PR #1189 이월 "마커 리터럴
  cross-stack 계약 테스트 부재") 모두 이번 구현 커밋과 같은 턴에 `[x]` + 대체 근거로 닫혀
  있음을 확인했다 (`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 2963, 3355행).
  선례(`ws-event-types-extract.md` 패턴 — "같은 결함을 가리키는 트래커 항목 전부를 같은 턴에
  닫는다")를 그대로 따르고 있다.

- **미해결 결정과의 충돌 없음** —
  - `MAX_SANITIZE_DEPTH`(websocket 마스커)를 통합 대상에서 제외한 결정은 코드로 재확인됨:
    `codebase/backend/src/modules/websocket/websocket.service.ts:80` 은 여전히
    `MAX_SANITIZE_DEPTH = 10` 독립 상수이고, 패키지 쪽 `MAX_MASK_DEPTH`(=10, `packages/masked-markers/src/index.ts:81`)와는 분리돼 있다 — plan 이 "다른 불변식" 이라 밝힌 근거와 일치.
    타 in-progress plan(`spec-draft-eia-62-waiting-payload.md:288`)이 `MAX_SANITIZE_DEPTH=10` 을
    인용하는 자리도 크기 상한 논의 맥락일 뿐 이 PR 의 결정과 충돌하지 않는다.
  - `plan/in-progress/*.md` 전체를 `MASKED_MARKERS|masked-markers|MAX_MASK_DEPTH|MAX_REDACT_DEPTH|MAX_MARKER_SCAN_DEPTH|isMaskedMarker` 로 grep 한 결과, 이 작업과 정본 트래커
    두 파일 외에 마스킹 마커를 다루는 in-progress plan 은 없다 — 다른 plan 이 "결정 필요" 로
    남겨둔 항목과 겹치는 축이 없다.

- **후속 항목 누락 없음** —
  - "후속 (이 PR 밖)" 절(미러 가드 탐지 로직 공유 test-utility 재추출 · backend
    `deepRedactSecrets` 깊이 경계 테스트)이 `plan/**` 외부(review 산출물)가 아니라 **같은 plan
    파일 안**에 등재돼 있다 — 이 저장소가 반복 지적해 온 "review/** 는 SoT 아님, 미룬 항목은
    그 턴에 plan/ 에 적어라" 원칙과 일치.
  - spec `14-external-interaction-api.md` §R17 의 "마커 집합은 backend SoT, 프런트가 미러" 구절은
    실제로 "SoT 는 `@workflow/masked-markers`" 로 정정돼 있고(spec 본문 1668행), 저장소 전체에서
    옛 문구("프런트가 미러한다")의 잔존 인용이 0건임을 grep 으로 확인 — 미러 문서 stale 없음.
  - frontmatter `code:` 목록에 `codebase/packages/masked-markers/src/index.ts` 가 이미 추가돼
    있어 spec-impl-evidence 추적선이 끊기지 않는다.
  - 등록 표면 8곳 중 수동 대조 대상(③~⑦)을 코드로 직접 재확인 — backend/frontend
    `package.json` 의 `workspace:*` 의존, 세 Dockerfile 의 COPY(frontend 는 `COPY codebase/packages
    ./codebase/packages` 와일드카드로 커버), `test-stages.sh`/`packages-checks.yml` 등록 모두 실재.
    frontend `masked-markers.ts` 는 실제로 패키지 재export shim 형태(로컬 판정 함수만 소유)로
    구현돼 있어 spec 의 "갱신할 미러가 없다" 서술과 부합한다.
  - "선례가 정확히 같은 형태" 근거로 든 `@workflow/ai-end-reason` 패키지 README 를 직접 열어
    대조 — 인용된 취지("backend 가 만들고 frontend 가 소비하는 값 도메인의 단일 진실")가
    실제 README 문구와 일치, 지어낸 Rationale 아님.

## 요약

Plan 정합성 관점에서 이번 PR(마스킹 마커 계약의 공유 패키지 추출)은 정본 트래커
(`spec-sync-external-interaction-api-gaps.md`)가 사전에 지목해 둔 선행 작업을 집행하는
형태이며, 관련 두 트래커 항목을 같은 턴에 닫고 대체 근거를 남겼다. 타 in-progress plan
어디에도 마스킹 마커·깊이 상수를 다루는 미해결 결정이 없어 충돌 가능성이 없고, spec
R17 의 SoT 서술 정정이 실제로 반영돼 있으며, PR 밖으로 미룬 두 후속 항목도 review 산출물이
아니라 plan 본문에 정확히 등재돼 있다. 코드 대조(패키지 등록 8곳·MAX_SANITIZE_DEPTH 격리·
재export shim 형태)도 plan 의 서술과 어긋나지 않는다. Plan 정합성 관점에서 결함을 찾지
못했다.

## 위험도

NONE
