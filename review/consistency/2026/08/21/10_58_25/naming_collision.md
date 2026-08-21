# 신규 식별자 충돌 검토 — masked-marker-shared-package.md

## 검토 방법

target(`plan/in-progress/masked-marker-shared-package.md`)이 새로 도입하는 식별자를 6개 관점별로
분해하고, 실제 저장소(`codebase/`, `spec/`, `.github/workflows/`, `pnpm-workspace.yaml`,
`plan/`)를 직접 grep/Read 해 기존 사용처와 대조했다.

새로 도입되는 식별자 후보:
- 패키지명 `@workflow/masked-markers` / 경로 `codebase/packages/masked-markers/`
- 상수 canonical 이름 `MAX_MASK_DEPTH`
- (이관만 하고 이름은 유지) `VALUE_MASK_MARKER` / `KEY_MASK_MARKER` / `DEPTH_MASK_MARKER` /
  `MASKED_MARKERS` / `isMaskedMarker`
- spec R17 정정 대상 — 신규 요구사항 ID 아님(기존 R17 그대로 사용)

## 발견사항

### [WARNING] `code:` frontmatter 삽입 대상 라인 번호가 실제와 다르다

- target 신규 식별자: target 작업 목록의 지시 — *"`14-external-interaction-api.md:1624` 의 …
  SoT 를 `@workflow/masked-markers` 로 바꾸고, frontmatter `code:` 목록(같은 파일 **13행**)에
  패키지 경로를 추가한다"*
- 기존 사용처: `spec/5-system/14-external-interaction-api.md` frontmatter 실측
  ```
  6  code:
  7    - codebase/backend/src/modules/external-interaction/**
  ...
  13   - codebase/backend/src/shared/utils/sanitize-error-message.ts
  14   - codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx
  15   - codebase/frontend/src/lib/utils/masked-markers.ts
  ```
- 상세: target 이 지목한 13행은 `masked-markers.ts` 항목이 아니라 `sanitize-error-message.ts`
  항목이다(`masked-markers.ts` 는 15행). 이는 신규 식별자 자체의 충돌은 아니지만, 이 항목은
  "파일 경로 등록 표면" 편집 지시이므로 실행 시 잘못된 줄에 `codebase/packages/masked-markers/**`
  경로를 끼워 넣거나 기존 `sanitize-error-message.ts` 항목을 실수로 덮어쓸 위험이 있다(둘 다
  같은 리스트의 인접 항목이라 diff 리뷰에서도 놓치기 쉬운 위치다).
- 제안: planner 턴 집행 시 "13행" 대신 `masked-markers.ts` 항목(현재 15행, 다른 선행 편집에 따라
  이동 가능)을 **텍스트로 앵커**해 지목하거나, 최소한 실행 직전 실측 라인을 재확인하도록 target
  문구를 정정한다.

## 조사했으나 충돌 없음으로 판정한 항목 (참고)

- **패키지명/경로**: `codebase/packages/` 하위 기존 7개(`ai-end-reason`,
  `chat-channel-validation`, `expression-engine`, `graph-warning-rules`, `node-summary`, `sdk`,
  `web-chat-sdk`) 중 `masked-markers` 없음. `@workflow/masked-markers` 는 backend/frontend
  `package.json`, `pnpm-lock.yaml`, `.claude/test-stages.sh` `INTERNAL_PACKAGES`,
  `.github/workflows/packages-checks.yml` 어디에도 기존 사용 없음. `pnpm-workspace.yaml` 의
  `codebase/packages/*` glob 이 이미 신규 패키지를 자동 포함하므로 이 파일 자체는 갱신 불요.
- **`MAX_MASK_DEPTH`**: 저장소 전체(backend/frontend/packages) grep 결과 target 문서 자신
  외에는 사용처 없음. 기존 `MAX_REDACT_DEPTH`(backend)·`MAX_MARKER_SCAN_DEPTH`(frontend)·
  `MAX_SANITIZE_DEPTH`(websocket, 의도적으로 미통합)와 이름이 겹치지 않는다. 저장소에 이미
  존재하는 다른 깊이 상수군(`MAX_RECURSION_DEPTH`, `MAX_NESTING_DEPTH`×2, `MAX_CONTAINER_DEPTH`,
  `MAX_TREE_DEPTH`, `MAX_ROOT_SEARCH_DEPTH`)과도 이름이 겹치지 않는다.
- **`MASKED_MARKERS`/`isMaskedMarker`/`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/
  `DEPTH_MASK_MARKER`**: 이관만 할 뿐 새 이름이 아니며, 현재 backend/frontend 양쪽에서 이미
  동일 의미로 쓰이고 있다(추출 목적 자체가 이 중복 정의를 하나로 합치는 것) — 충돌 아님.
- **spec R17**: target 이 "정정" 대상으로 지목한 요구사항 ID는 신규 부여가 아니라
  `14-external-interaction-api.md:1392` 에 이미 존재하는 기존 R17(`getStatus` 의
  `currentNode`/`context` 실값 노출 …)이다. 새 ID 충돌 아님.
- **정본 트래커 대체 대상 문구**: target 이 `[x]` 처리하겠다고 지목한 두 항목
  (*"마커 리터럴 cross-stack 계약 테스트 부재"*, consistency `05_23_14` 등재분)은
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md:757` 등에 실제로 존재해
  대상 지목이 정확하다.
- **API endpoint / 이벤트·메시지명 / 환경변수·설정키**: target 문서가 이 범주의 신규 식별자를
  도입하지 않는다(순수 내부 상수/타입/패키지 이관).

## 요약

target 이 새로 도입하는 식별자(`@workflow/masked-markers` 패키지명·경로, canonical 상수
`MAX_MASK_DEPTH`)는 저장소 전역 실측 결과 기존 사용처와 의미가 겹치는 곳이 없다. 이관 대상
심볼(`MASKED_MARKERS`/`isMaskedMarker`/`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/
`DEPTH_MASK_MARKER`)은 새 이름이 아니라 기존 중복 정의의 통합이고, R17 은 기존 요구사항 ID
재사용이라 문제 없다. API endpoint·이벤트명·환경변수 범주는 target 의 변경 범위 밖이다. 유일한
흠은 spec frontmatter `code:` 리스트 삽입 지점으로 지목한 "13행"이 실제로는 다른 기존 항목
(`sanitize-error-message.ts`)의 줄이라는 점 — 식별자 충돌은 아니지만 후속 planner 턴에서 파일
경로 등록 표면을 잘못된 위치에 끼워 넣을 위험이 있어 WARNING 으로 기록한다.

## 위험도

LOW
