STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) Review — masked-marker-contract-7d2e14 (라운드 9, `14_39_29`)

## 검토 방법

이 PR 은 이미 8라운드 코드 리뷰(`11_27_29`~`14_19_12`)를 거쳤고, 직전 `requirement` 라운드
(`14_19_12`)는 Critical/Warning 0으로 수렴한 상태였다. 라운드8 처분(커밋 `85197720e`)은
`masked-markers.test.ts` JSDoc/테스트명 정정뿐(순수 문서, 기능 코드 무변경)이었음을
`git show --stat`/`git show` 로 직접 확인했다. 이번 라운드는 과거 라운드 서술을 그대로
신뢰하지 않고 핵심 산출물을 다시 `Read`/`grep`/`git diff origin/main...HEAD` 로 재검증했다:

- `codebase/packages/masked-markers/src/index.ts` (SoT) 전문
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` / `codebase/frontend/src/lib/utils/masked-markers.ts` (재export shim) 전문
- 양쪽 `masked-marker-mirror-guard.ts` / `.spec.ts` / `.test.ts` 전문 (line-level 대조)
- `spec/5-system/14-external-interaction-api.md` R17 절 diff
- `plan/in-progress/masked-marker-shared-package.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 체크리스트
- CI 배선 8곳(`test-stages.sh`, `packages-checks.yml`, `frontend-checks.yml`, `backend-checks.yml`, 두 Dockerfile, 두 package.json)
- `MASKED_MARKERS` 소비처 전수 grep(`.has()` 잔존 여부 — 타입이 `Set`→배열로 바뀐 뒤 남아있으면 런타임 TypeError)

## 발견사항

없음 (Critical/Warning 0건).

### 기능 완전성 · 반환값 · 데이터 유효성 · 에러 시나리오

`@workflow/masked-markers` 는 plan "무엇을 옮기나" 표가 명시한 6개 심볼
(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS`/`isMaskedMarker`/
`MAX_MASK_DEPTH`)을 전부 export 하고, 이관 전 리터럴 값과 완전히 동일하다(`index.ts:27-33,81`).
`isMaskedMarker`(`index.ts:55-57`)는 `typeof v === "string" && MASKED_MARKERS.includes(v)`
로 non-string(`number`/`null`/`undefined`/`object`/`array`) 입력에 `false` 를 반환하며,
패키지 spec(`index.spec.ts:76-84`)이 다섯 타입 전부를 `it.each` 로 고정한다.
`redactSecrets`/`sanitizeLastErrorMessage`(`sanitize-error-message.ts:82,342`)도 non-string·
빈 문자열 입력을 그대로 반환하는 기존 가드를 그대로 유지한다.

### 타입 변경(`ReadonlySet<string>` → `readonly string[]`)의 소비처 안전성

`MASKED_MARKERS` 가 이관 전 `Set` 에서 `Object.freeze([...])` 배열로 바뀌었다(`index.ts:43-47`,
freeze 가 `Set` 내부 슬롯에 안 닿는 문제의 실측 근거를 주석에 남김). `.has()` 호출이 남아 있으면
컴파일 타임 에러가 나야 정상이지만, `grep -rn "MASKED_MARKERS"` 로 backend/frontend 전 소비처를
확인한 결과 전부 `isMaskedMarker()` 판정 또는 `[...MASKED_MARKERS]` 스프레드(`dynamic-form-ui.test.tsx:601`,
`masked-markers.test.ts`)만 사용해 배열/Set 어느 쪽이든 동일하게 동작한다 — 파손 없음.

### 엣지 케이스 — 깊이 상한 off-by-one

`hasMaskedMarkerLeaf`/`scanForMarker`(`masked-markers.ts:94-111`)는 "값 검사 먼저, 깊이 검사
나중" 순서를 유지한다. backend `deepRedactCore`(`sanitize-error-message.ts:259-272`)는
`depth >= MAX_REDACT_DEPTH` 에서 서브트리를 마커로 치환하므로 마커는 정확히 `depth === 10`
자리에 놓이고, 프런트 스캐너는 그 깊이에서 값 검사를 먼저 수행한 뒤에야 하강을 멈춘다 — 순서가
바뀌면 상한 지점 마커를 검사 없이 지나치는 fail-open 이 되는데, 현재 순서는 그 실패를 막는다.
`MAX_MASK_DEPTH`(SoT)와 backend `MAX_REDACT_DEPTH`(지역 별칭, `sanitize-error-message.ts:128`)가
같은 상수를 참조해, 과거 "두 리터럴이 각자 10 을 손으로 유지"하던 미러 위험이 구조적으로
사라졌다. `MAX_SANITIZE_DEPTH`(websocket, `depth > 10`→깊이 11)는 실측 근거(비교 연산자가
다르고 프런트 스캐너가 WS 페이로드를 스캔하지 않음)로 의도적으로 미통합 — 통합하면 오히려
근거 없는 WS 마스킹 깊이 변경(11→10)이 되므로 현재 분리가 맞다.

### TODO/FIXME

`codebase/packages/masked-markers/`, 양쪽 `masked-marker-mirror-guard.ts`/`.spec.ts`/`.test.ts`,
`sanitize-error-message.ts`, `masked-markers.ts` 전수에 `TODO`/`FIXME`/`HACK`/`XXX` 없음
(직접 grep 재확인).

### 의도와 구현 간 괴리 — 미러 소멸 가드의 대칭성

backend/frontend 두 가드 파일을 라인 단위로 대조했다 — `SOT_SYMBOLS` 파생(모듈 interop 산물
`default`/`__esModule` 필터링 포함), `resolveScanDirs` 2단계 스캔(`codebase/<stack>/src` +
`codebase/packages/<pkg>/src`), `findRedeclaredSymbols`(AST 기반 변수/함수/클래스 선언만
탐지), `findMirrorRedeclarations` 의 SoT 자기 제외 경계(`relPath === sotPrefix ||
relPath.startsWith(sotPrefix + '/')`)가 양쪽에서 동일하다. 캐너리도 대칭이다 — 함수 선언
재선언 탐지, SoT 와 경로 접두가 겹치는 형제(`masked-markers-extra`) 탐지, 심볼별 재선언
탐지(`it.each(SOT_SYMBOLS...)`), 정상 형태(재export/지역 별칭/주석/문자열/무관 리터럴/접두
겹치는 다른 식별자) 오탐 방지 케이스까지 두 파일이 문자 그대로 대응한다. 직전 라운드들이
반복 지적했던 "backend 만 고치고 양쪽 다 고쳤다고 적는" 비대칭은 현재 스냅샷에서 재현되지
않는다.

### CI 배선 — 등록 표면 8곳 실측 대조

`.claude/test-stages.sh`(`INTERNAL_PACKAGES`) · `packages-checks.yml`(pathspec + matrix 6개 +
주석 "6개" 일치) · `frontend-checks.yml`(`codebase/channel-web-chat/**` 추가로 3번째 스택도
미러 가드 실행 경로에 포함) · `backend-checks.yml`(`codebase/packages/**` 이미 포함되어 신규
패키지 자동 커버) · 양쪽 `package.json` workspace 의존 · 세 Dockerfile COPY(backend/frontend/
frontend playwright-e2e) 전부 실측 대조했다. `packages-checks.yml` matrix 목록(6개: ai-end-reason,
masked-markers, expression-engine, graph-warning-rules, node-summary, chat-channel-validation)이
헤더 주석의 "6개를 전부 등록" 과 정확히 일치한다.

### 관련 spec 본문 일치 여부 (spec fidelity)

관련 spec 은 `spec/5-system/14-external-interaction-api.md` R17 절 하나다(전수 grep 으로
`MASKED_MARKERS`/`isMaskedMarker`/`MAX_MASK_DEPTH`/`MAX_REDACT_DEPTH` 를 참조하는 다른 spec
문서 없음 재확인). frontmatter `code:` 목록에 `codebase/packages/masked-markers/src/index.ts`
가 정확히 추가돼 있고, 본문은 *"마커 집합과 깊이 상한의 SoT 는 공유 패키지
`@workflow/masked-markers` 다 … backend/프런트는 재export shim 이라 갱신할 미러가 없다"* 로
정정돼 있다 — 실제 구현(두 소비처가 순수 재export/지역 별칭만 갖고, 값·판정 로직은 패키지에만
존재)과 line-level 로 일치한다. spec 자체의 결함이나 SPEC-DRIFT 는 발견되지 않았다.

### 작업 완결성 (plan 체크리스트)

`plan/in-progress/masked-marker-shared-package.md` "## 작업" 8개 항목 중 `/ai-review`(이번
라운드 자체, 완료 시 체크될 항목)를 제외한 7개가 전부 `[x]` 이고 실제 코드 상태와 일치한다.
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 두 정본 트래커 항목(`:373`,
`:757`)도 `[x]` + 대체 근거로 확인된다. "후속(이 PR 밖)" 두 항목(가드 로직 재추출, backend
깊이 경계 테스트)은 defer 사유가 명시돼 있고 이 PR 의 요구사항 범위를 넘지 않는다.

## 요약

`@workflow/masked-markers` 추출은 plan 이 명시한 6개 심볼을 리터럴 값 변경 없이 이관했고,
소비처(backend `sanitize-error-message.ts`, frontend `masked-markers.ts`)는 import 경로를
유지한 채 재export/지역 별칭으로만 배선을 바꿔 기존 backend 소비 파일 다수와 frontend 3개
소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드) 모두 동작 무변경임을 직접 확인했다. `Set`→
배열 타입 변경은 전 소비처가 `isMaskedMarker`/스프레드만 써서 파손이 없다. 이관을 지키는 신규
미러 소멸 가드(backend·frontend 쌍둥이)는 8라운드에 걸쳐 지적된 실질 결함(경로 게이팅
사각지대·감시 목록 자체가 미러·스캔 범위 누락·SOT_DIR 접두 경계 비대칭·완료형 서술 오류)이
전부 현재 소스에서 해소돼 라인 단위로 대칭임을 재확인했다. CI 배선 8곳은 plan 이 사전에
실측한 표와 diff 가 정확히 대응한다. 관련 spec(`14-external-interaction-api.md` R17)은 새
아키텍처를 line-level 로 정확히 반영하고, plan 체크리스트도 실제 구현 상태와 일치한다.
값-마스킹 핵심 로직(정규식 패턴·재마스킹 금지 불변식·깊이 상한 off-by-one 방지 순서)은
이관 전후 완전히 동일해 회귀가 없다. TODO/FIXME 없음, 반환값 누락 없음, 에러 시나리오
(non-string/빈 입력) 처리 유지. 신규 발견사항 없음 — 요구사항 충족 관점에서 이 PR 은 완결
상태다.

## 위험도
NONE
