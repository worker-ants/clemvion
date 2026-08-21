# 문서화(Documentation) 리뷰 — masked-marker-contract-7d2e14

## 발견사항

- **[INFO] spec 문서의 SoT 서술·`code:` 프론트매터가 이번 이관을 아직 반영하지 못함(의도적 이월)**
  - 위치: `spec/5-system/14-external-interaction-api.md:1624` ("마커 집합은 backend `sanitize-error-message.ts` 가 SoT 이고 프런트가 미러한다 — 어긋나면 가드가 조용히 뚫리므로 양쪽을 함께 갱신한다.") 및 같은 파일 frontmatter `code:` 목록(6~20행) — `codebase/packages/masked-markers/**` 미등재.
  - 상세: 실제 SoT 는 이번 PR 로 `@workflow/masked-markers` 패키지로 이동했고 backend/frontend 파일은 재export shim 이 됐다. spec 본문의 "backend 가 SoT" 문장과 frontmatter `code:` 목록은 이 사실을 반영하지 못해 stale 하다. 다만 이는 누락이 아니라 `plan/in-progress/masked-marker-shared-package.md` 의 `## 작업` 체크리스트에 "spec R17 정정 (planner 턴 필요)" 로 명시적으로 남겨진 의도적 이월이다 — `developer` 는 `spec/` read-only 라 이 정정을 이번 PR 범위에서 집행할 수 없다는 프로젝트 규약(CLAUDE.md "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임")을 그대로 따른 것이다. 두 차례의 `/consistency-check --plan` (10_45_52, 10_58_25) 도 이미 이 갭을 WARNING 으로 잡아 트래커에 반영돼 있다.
  - 제안: 조치 불필요(이미 추적됨). 다음 planner 턴에서 R17 문장을 "SoT 는 `@workflow/masked-markers`" 로 갱신하고 `code:` 목록에 패키지 경로를 추가할 것 — plan 문서가 "라인번호 대신 `masked-markers.ts` 항목 옆" 이라는 텍스트 앵커까지 이미 남겨 뒀으므로 그대로 집행하면 된다.

- **[INFO] 재export 지점의 개별 JSDoc 이 SoT(패키지) 문서와 별도로 유지되는 구조 — 이 PR 이 없애려는 "미러"의 문서판**
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `export { … }` 블록(약 130~137행, `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 각각에 개별 JSDoc), 그리고 167행 `export { MASKED_MARKERS };` 위 JSDoc, 176행 `export { isMaskedMarker };` 위 JSDoc. 대응하는 원본 문서는 `codebase/packages/masked-markers/src/index.ts` 에 있다.
  - 상세: 값·상수 자체는 이제 패키지 하나로 합쳐져 "두 스택이 같은 것을 본다"는 계약이 기계로 보장된다(이 PR 의 핵심 성과). 그런데 각 심볼의 **설명(JSDoc)** 은 여전히 패키지 원본과 backend 재export 지점 두 곳에 따로 적혀 있고(내용은 지금은 서로 보완적이나 문구가 겹치지 않게 분업돼 있음), 둘 중 하나만 갱신되면 텍스트 수준의 드리프트가 생길 수 있다 — 값의 미러는 없앴지만 설명의 미러는 남은 형태다. 기능적으로는 문제없고(재export 소비처가 이 파일의 JSDoc 을 보게 하려는 의도적 설계로 보임 — 소비처 5곳의 import 경로를 그대로 두기 위해서라고 plan 문서가 명시), 심각도도 낮다.
  - 제안: 조치 불필요(현재도 두 JSDoc 이 서로 다른 관점 — 패키지=계약의 이유, backend=로컬 별칭 관계 — 을 다뤄 실질적 중복은 적음). 다만 다음에 값 자체(마커 리터럴·깊이 상한 의미)가 바뀌면 패키지 JSDoc 뿐 아니라 이 재export 지점들의 JSDoc 도 함께 훑어야 한다는 점을 인지해 둘 필요는 있다.

- **[INFO] frontend `masked-markers.ts` 에서 `MASKED_MARKERS` 가 `isMaskedMarker` 전용 JSDoc 블록 아래 함께 export 돼 자체 설명이 없음**
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:56` — `export { isMaskedMarker, MASKED_MARKERS };` 바로 위 28~55행 JSDoc 블록.
  - 상세: 이 JSDoc 블록의 내용("이 값이 egress 마스킹의 산물인가", "정확 일치만 잡는다" 등)은 명백히 `isMaskedMarker` 함수 하나를 설명하는 글이다. 같은 `export {}` 문으로 `MASKED_MARKERS` 도 함께 재export 되지만 이 블록이 `MASKED_MARKERS` 자체(마커 3종 집합이라는 사실)를 설명하지는 않는다 — 참고로 backend `sanitize-error-message.ts:167` 는 `MASKED_MARKERS` 를 별도 `export {}` 문으로 분리해 전용 JSDoc 을 붙였다(동일 패키지의 동일 심볼인데 두 재export 지점의 문서화 세분도가 다르다). 심각도는 낮다 — `MASKED_MARKERS` 의 실질 의미는 패키지 원본(`@workflow/masked-markers`)과 backend 파일 양쪽에 이미 명시돼 있어 이 파일만 봐도 크게 헷갈리지는 않는다.
  - 제안: (선택) `export { isMaskedMarker, MASKED_MARKERS };` 를 backend 파일처럼 두 개의 `export {}` 문으로 나누고 `MASKED_MARKERS` 위에 한 줄짜리 JSDoc("마커 전체 집합 — 상세는 `@workflow/masked-markers` 참조" 등)을 붙이면 문서화 세분도가 backend/frontend 양쪽에서 일치한다.

## 요약

이 PR 은 문서화 관점에서 이례적으로 충실하다 — 새 공유 패키지(`@workflow/masked-markers`)에 README·JSDoc 이 모두 준비돼 있고, 값 이관과 함께 backend/frontend 재export 지점의 JSDoc 도 "SoT 는 패키지" 로 정확히 갱신됐으며, 신규 미러-소멸 가드(`masked-marker-mirror-guard.ts`/`.test.ts`)는 스코프 결정 배경(왜 리터럴이 아니라 심볼인가)까지 상세히 남겼다. `.github/workflows/packages-checks.yml` 의 "N 개를 전부 등록" 주석도 5→6 으로 정확히 갱신됐고(흔히 놓치는 stale-comment 패턴을 오히려 정확히 회피), `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 이월 트래커 두 항목(`:373`, `:757`)도 이번 커밋과 같은 턴에 `[x]` + 대체 근거로 닫혀 두 차례 `/consistency-check --plan` 라운드(10_45_52, 10_58_25)에서 지적된 WARNING/CRITICAL 이 전부 최종 diff 에 반영돼 있다(frontmatter 3필드, 캐너리 스코프 명시, 라인번호 대신 텍스트 앵커 등). 남은 것은 전부 INFO 수준이다: (1) spec 본문의 "backend 가 SoT" 서술과 frontmatter `code:` 목록이 아직 이관을 반영하지 못했으나 이는 `developer` 의 `spec/` read-only 제약 때문에 plan 문서에 planner 턴 항목으로 명시적으로 이월된 것이고, (2) 값의 미러는 없앴지만 재export 지점마다 개별 JSDoc 을 남겨 설명 텍스트 수준의 경미한 중복이 남아 있으며, (3) frontend 파일에서 `MASKED_MARKERS` 가 `isMaskedMarker` 전용 JSDoc 블록에 얹혀 export 돼 문서화 세분도가 backend 와 살짝 다르다. 셋 다 차단 사유가 아니다.

## 위험도
NONE
