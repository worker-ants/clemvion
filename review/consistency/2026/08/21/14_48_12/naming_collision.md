# 신규 식별자 충돌 검토 — target: `spec/5-system/` (impl-done, EIA masked-marker 계약 이관)

## 조사 범위

target 문서 diff 는 `spec/5-system/14-external-interaction-api.md` 10 라인뿐이다
(`git diff origin/main...HEAD -- spec/5-system/14-external-interaction-api.md`):
`code:` frontmatter 에 `codebase/packages/masked-markers/src/index.ts` 경로 한 줄 추가,
그리고 §7.5.1 근방의 한 단락을 "마커 집합·깊이 상한의 SoT 가 backend 상수에서 공유
패키지 `@workflow/masked-markers` 로 이관됐다"는 서술로 갱신한 것이 전부다.
**신규/변경 요구사항 ID 없음** — `grep -oE "EIA-[A-Z]{2}-[0-9]+"` 로 추가·삭제 라인을
비교했을 때 일치 항목 0건.

target 자체의 새 식별자 표면이 좁으므로, impl-done 규약에 따라 diff 가 실제로 도입한
코드 식별자(신설 워크스페이스 패키지 `@workflow/masked-markers` 와 그 export)를 1차
근거로 대조했다.

## 발견사항

### INFO — `MAX_MASK_DEPTH` 신설명과 기존 `MAX_SANITIZE_DEPTH` 의 표면적 유사성

- target 신규 식별자: `MAX_MASK_DEPTH` (`codebase/packages/masked-markers/src/index.ts:81`,
  `@workflow/masked-markers` re-export). 이번 PR 이 backend `MAX_REDACT_DEPTH` 와 frontend
  `MAX_MARKER_SCAN_DEPTH` 두 로컬 이름을 이 하나로 통합하며 새로 만든 "중립 이름"이다.
- 기존 사용처: `codebase/backend/src/modules/websocket/websocket.service.ts:80`
  `export const MAX_SANITIZE_DEPTH = 10;` — WS payload fanout 마스커의 깊이 상한. 값은
  같은 10 이지만 비교 연산자가 다르다(`depth > MAX_SANITIZE_DEPTH` vs 신규 패키지의
  `depth >= MAX_MASK_DEPTH`), 그리고 스캔 대상도 다르다(WS 페이로드는 프런트 마커
  스캐너가 스캔하지 않음).
- 상세: "MASK" 와 "SANITIZE" 는 둘 다 "민감정보 은닉/치환"을 뜻하는 근접 어휘라 이름만
  보고 같은 상수로 착각해 재사용할 위험이 있다(memory 교훈과 궤를 같이함 — "공유
  프리미티브를 넓히면 무관한 경로가 오염된다"). 다만 이 위험은 **이번 PR 이 새로
  만든 것이 아니다** — PR 이전에도 `MAX_REDACT_DEPTH` vs `MAX_SANITIZE_DEPTH` 로 이미
  구조적으로 동일한 근접성이 있었고, 이번 통합은 그 근접성을 늘리지도 줄이지도 않았다.
  오히려 코드는 이 위험을 능동적으로 상쇄한다 — `MAX_SANITIZE_DEPTH` 는 **이것이
  아니다** 라는 명시적 경고가 세 곳에 중복 배치돼 있다: 신규 패키지
  `index.ts:77-79`, backend 재-export 지점 `sanitize-error-message.ts:120-126`,
  그리고 `strip-external-only-fields.ts:31-32,97-98` 의 표 비교. 세 곳 모두 "별개
  불변식이므로 합치지 않는다"는 동일한 결론을 반복해 남겼다.
- 제안: 조치 불요(비차단). 문서화가 이미 충분히 두텁다. 다음에 WS 마스커 코드를
  건드리는 사람이 그 세 경고 중 하나라도 지우면 근접성 위험이 다시 드러나므로, 향후
  리뷰에서 "그 세 경고가 diff 로 삭제됐는가"만 확인하면 충분하다 — 지금 시점에 이름을
  바꾸라는 요구는 과잉이다.

### 그 외 관점 — 충돌 없음 확인

- **패키지명**: `@workflow/masked-markers` (`codebase/packages/masked-markers/package.json`).
  기존 워크스페이스 패키지 7개(`@workflow/ai-end-reason` · `chat-channel-validation` ·
  `expression-engine` · `graph-warning-rules` · `node-summary` · `sdk` · `web-chat-sdk`)와
  이름·디렉터리명 모두 겹치지 않고 동일 `@workflow/<kebab-dir>` 컨벤션을 따른다.
- **export 식별자**: `VALUE_MASK_MARKER` / `KEY_MASK_MARKER` / `DEPTH_MASK_MARKER` /
  `MASKED_MARKERS` / `isMaskedMarker` 는 기존 backend `sanitize-error-message.ts` 에
  이미 있던 이름을 그대로 패키지로 **이관**한 것이라 새 이름이 아니다. backend·frontend
  양쪽 소비 파일은 재export shim 이 되어 기존 import 경로(`@/lib/utils/masked-markers`,
  `sanitize-error-message.ts`)를 그대로 유지하므로 소비처 측 이름 충돌도 없다. 유일한
  타입 변화(`ReadonlySet<string>` → `readonly string[]`)는 naming 이 아니라 shape 문제라
  본 관점 밖이며, `grep -rn "MASKED_MARKERS"` 로 확인한 결과 `.has()` 를 호출하는
  잔존 소비처는 없다(내부 `.includes()` 만 사용).
- **API endpoint / 이벤트 / ENV var / config key**: target diff 에 신설 항목 없음 —
  이번 변경은 상수 재배치이며 REST/SSE endpoint, webhook 이벤트명, 환경변수 어느 것도
  건드리지 않는다.
- **파일 경로**: `codebase/packages/masked-markers/{package.json,tsconfig.json,
  eslint.config.mjs,README.md,src/index.ts,src/__tests__/index.spec.ts}` 구조가
  형제 패키지(`ai-end-reason`, `expression-engine` 등)의 `src/__tests__/*.spec.ts`
  컨벤션과 동일하다. Dockerfile(backend/frontend/playwright-e2e) 세 곳 모두 기존
  `COPY codebase/packages/<name>` 패턴에 맞춰 항목을 추가했다.

## 요약

target 문서(`spec/5-system/14-external-interaction-api.md`)의 실제 diff 는 요구사항
ID·엔티티·endpoint·이벤트·ENV var 어느 것도 신설하지 않는 10 라인짜리 서술
갱신이며, 그 서술이 가리키는 구현(신규 워크스페이스 패키지 `@workflow/masked-markers`)
도 패키지명·export 이름·파일 경로 컨벤션 모두 기존 사용처와 충돌하지 않는다. 유일하게
언급할 만한 것은 새로 도입된 `MAX_MASK_DEPTH` 가 기존 `MAX_SANITIZE_DEPTH` 와 어휘상
근접하다는 점인데, 이는 PR 이전부터 있던 근접성 수준을 유지할 뿐이고 코드 3곳에
"별개 불변식" 경고가 중복 배치돼 있어 INFO 로 낮춰 등재한다. CRITICAL/WARNING 급
신규 식별자 충돌은 발견되지 않았다.

## 위험도

LOW
