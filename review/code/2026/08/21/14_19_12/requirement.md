STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) Review — masked-marker-contract-7d2e14 (라운드 8, `14_19_12`)

## 검토 방법

이 PR 은 이미 7라운드 코드 리뷰(`11_27_29`~`13_55_59`)를 거쳤고, 매 라운드 RESOLUTION 이
Critical 0 · Warning 을 순차로 해소해 왔다(MEDIUM→MEDIUM→MEDIUM→MEDIUM→LOW→LOW→LOW). 이번
라운드는 과거 라운드의 "고쳤다" 서술을 그대로 믿지 않고, 핵심 산출물을 직접 `Read` 로 현재
저장소 상태에서 재검증했다 —

- `codebase/packages/masked-markers/src/index.ts` (신규 SoT) 전문
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` / `codebase/frontend/src/lib/utils/masked-markers.ts` (재export shim) 전문
- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` / `.spec.ts` 전문
- `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` / `.test.ts` 전문 (backend 쌍둥이와 라인 단위 대조)
- `spec/5-system/14-external-interaction-api.md` R17 절 (frontmatter `code:` + 본문)
- `plan/in-progress/masked-marker-shared-package.md` 전문 (작업 체크리스트 실제 상태)

## 발견사항

없음 (Critical/Warning 0건).

### 기능 완전성 · 반환값 · 데이터 유효성 · 에러 시나리오

`@workflow/masked-markers` 는 plan 이 "무엇을 옮기나" 표에서 명시한 6개 심볼
(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS`/`isMaskedMarker`/
`MAX_MASK_DEPTH`)을 전부 export 하며 값이 이관 전(backend `sanitize-error-message.ts`/frontend
`masked-markers.ts`)과 리터럴까지 완전히 동일함을 직접 대조로 확인했다. `isMaskedMarker`
는 `typeof v === "string" && MASKED_MARKERS.includes(v)` 로 non-string(`number`/`null`/
`undefined`/`object`/`array`) 입력에 안전하게 `false` 를 반환한다(패키지 spec
`index.spec.ts` 가 다섯 타입 전부를 `it.each` 로 고정). `redactSecrets`/
`sanitizeLastErrorMessage` 도 non-string·빈 문자열 입력을 그대로 반환하는 가드가 유지된다.

### 엣지 케이스 — 깊이 상한 off-by-one

`hasMaskedMarkerLeaf`/`scanForMarker` 는 "값 검사 먼저, 깊이 검사 나중" 순서를 유지한다
(`masked-markers.ts:99-101`) — 이 순서가 깨지면 backend 마스커가 정확히 `depth === MAX_MASK_DEPTH`
자리에 놓는 치환 마커를 스캐너가 검사 없이 지나친다. `MAX_MASK_DEPTH`(패키지 SoT, `= 10`)와
backend `MAX_REDACT_DEPTH`(같은 값의 지역 별칭, `sanitize-error-message.ts:128`)가 이제 같은
상수를 가리켜, 과거 "두 리터럴이 각자 손으로 10 을 유지"하던 미러 위험이 구조적으로 사라졌다.
`MAX_SANITIZE_DEPTH`(websocket, `depth > 10`→깊이 11)는 plan 이 실측 근거(비교 연산자가
다르고 프런트 스캐너가 WS 페이로드를 스캔하지 않음)로 의도적으로 미통합 상태를 유지하며, 코드
주석에도 "다른 불변식이므로 합치지 않는다"고 정확히 문서화돼 있다 — 통합하면 오히려 근거 없는
WS 마스킹 깊이 변경(11→10)이 된다.

### TODO/FIXME

`codebase/packages/masked-markers/`, 양쪽 `masked-marker-mirror-guard.ts`/`.spec.ts`/`.test.ts`,
`sanitize-error-message.ts`, `masked-markers.ts` 전수에 `TODO`/`FIXME`/`HACK`/`XXX` 없음(직접
grep 확인).

### 의도와 구현 간 괴리 — 미러 소멸 가드

`findMirrorRedeclarations` 의 SoT 자기 제외 분기가 backend/frontend 양쪽에서 이제 동일한
경계 조건을 쓴다 —

```
backend  masked-marker-mirror-guard.ts:149  relPath === SOT_DIR || relPath.startsWith(`${SOT_DIR}/`)
frontend masked-marker-mirror-guard.ts:151  relPath === sotPrefix || relPath.startsWith(`${sotPrefix}/`)
```

직전 라운드들(`12_50_37`/`13_14_29`)이 반복 지적했던 "backend 만 고쳐지고 frontend 는 느슨한
`startsWith(SOT_DIR)` 로 남는" 비대칭이 현재 상태에서는 재현되지 않는다 — 양쪽 spec 파일에
"SoT 와 접두가 겹치는 형제 패키지(`masked-markers-extra`)는 탐지 대상" 캐너리가 동일하게
존재해 이 경계를 기계로 고정한다. `findRedeclaredSymbols` 는 함수 선언 형태(`export function
isMaskedMarker() {...}`)도 탐지하는 캐너리가 양쪽에 있어(`12_50_37` W3), 이관 전 실제 형태였던
"함수로 되살아나는" 회귀도 잡는다. `SOT_SYMBOLS` 파생이 모듈 interop 산물(`default`/
`__esModule`)을 걸러내는 필터도 양쪽 동일하다.

### 비즈니스 로직 — 마스킹 재적용 금지 불변식

`sanitize-error-message.ts:302` (`deepRedactObject`)의 `isMaskedMarker(v) ? v : VALUE_MASK_MARKER`
는 이관 전과 동일한 "이미 마스킹된 값은 다시 덮지 않는다" 불변식을 유지한다. 값 마스킹의
핵심 정규식(`SECRET_LEAK_PATTERNS`)·키 이름 패턴(`CREDENTIAL_KEY_PATTERN`)·`deepRedactSecrets`/
`deepRedactSecretsPreserving`/`redactSecretsInJsonString` 시그니처는 이 diff 에서 변경되지
않았다(이관 대상은 마커 상수·판정 함수·깊이 상한뿐).

### 관련 spec 본문 일치 여부 (spec fidelity)

관련 spec 은 `spec/5-system/14-external-interaction-api.md` R17 절 하나다(전수 grep 으로
`MASKED_MARKERS`/`isMaskedMarker`/`MAX_MASK_DEPTH`/`MAX_REDACT_DEPTH` 를 참조하는 다른 spec
문서 없음 확인). frontmatter `code:` 목록에 `codebase/packages/masked-markers/src/index.ts`
가 정확히 추가돼 있고(`:16`), 본문(`:1625-1631`)은 *"마커 집합과 깊이 상한의 SoT 는 공유
패키지 `@workflow/masked-markers` 다 … backend/프런트는 재export shim 이라 갱신할 미러가
없다"* 로 정정돼 있다 — 실제 구현(두 소비처가 순수 재export/지역 별칭만 갖고, 값·판정 로직은
패키지에만 존재)과 line-level 로 일치한다. 이전 라운드(`10_45_52` cross-spec WARNING)가
지적했던 "이관 후 R17 의 backend-SoT 서술이 낡는다"는 위험은 이미 커밋 `bf0618a7d`(라운드1)
로 해소된 상태를 유지하고 있다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
의 두 정본 트래커 항목(`:373`/`:757`, 라운드1 processing 당시 "닫혔다"고 처분된 항목)도 현재
파일에서 둘 다 `[x]` 로 확인된다. spec 자체의 결함이나 SPEC-DRIFT 는 발견되지 않았다.

### 작업 완결성 (plan 체크리스트)

`plan/in-progress/masked-marker-shared-package.md` "## 작업" 의 8개 항목 중 `/ai-review`
(이번 라운드 자체) 를 제외한 7개가 전부 `[x]` 이고, 실제 소스 상태가 그 체크와 일치함을
직접 확인했다(등록 8곳, 재export 유지, 미러 소멸 캐너리, spec R17 정정, 트래커 2항목 종결).
체크박스 상태와 실제 코드 상태가 어긋나는 항목은 없다.

## 신규 관찰 (비차단, 이전 라운드가 이미 INFO 로 다룬 항목의 잔존 확인)

- **[INFO]** frontend `masked-marker-mirror.test.ts` 에 이중 빈 줄이 두 곳(`:69-70`, `:86-87`)
  남아 있다 — backend 쌍둥이(`masked-marker-mirror.spec.ts`)에는 없다. `13_55_59` maintainability
  라운드가 이미 동일 위치를 지적했고 "기능 영향 없음, 병합 사유 아님"으로 판정된 채 남아 있다.
  요구사항 충족과 무관한 순수 포맷 이슈라 이번 라운드에서도 비차단으로 판정한다.

## 요약

`@workflow/masked-markers` 추출은 plan 이 명시한 6개 심볼을 리터럴 값 변경 없이 이관했고,
소비처(backend `sanitize-error-message.ts`, frontend `masked-markers.ts`)는 import 경로를
유지한 채 재export/지역 별칭으로만 배선을 바꿔 기존 5개 이상의 backend 소비 파일과 3개
frontend 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드) 모두 동작 무변경이다. 이관을
지키는 신규 미러 소멸 가드(backend·frontend 쌍둥이)는 7라운드에 걸쳐 지적된 실질 결함(경로
게이팅 사각지대·감시 목록 자체가 미러·스캔 범위가 전수처럼 보이지만 아님·SOT_DIR 접두 경계
비대칭·완료형 서술 오류)이 전부 현재 소스에서 해소돼 있음을 직접 재검증했다 — 특히 이 시리즈가
반복 겪었던 "backend 만 고치고 양쪽 다 고쳤다고 적는" 패턴이 이번 스냅샷에서는 재현되지 않는다.
관련 spec(`14-external-interaction-api.md` R17)은 새 아키텍처(공유 패키지 SoT)를 line-level
로 정확히 반영하고, plan 체크리스트도 실제 구현 상태와 일치한다. 값-마스킹 핵심 로직(정규식
패턴·재마스킹 금지 불변식·깊이 상한 off-by-one 방지 순서)은 이관 전후 완전히 동일해 회귀가
없다. TODO/FIXME 없음, 반환값 누락 없음, 에러 시나리오(non-string/빈 입력) 처리 유지. 유일한
잔존 관찰은 포맷 전용 INFO(frontend spec 파일 이중 빈 줄) 하나로, 요구사항 충족·동작에 영향을
주지 않는다.

## 위험도
NONE
