# 보안(Security) 리뷰 결과 — eia-masking-round2-53afc8 (`12_57_15`)

이 diff 는 이미 두 라운드(`12_06_12`, `12_33_36`) 보안 리뷰를 거쳐 WARNING·INFO 가 처리·문서화된 상태의
코드를 포함한다 (review 산출물 자체도 diff 에 포함되어 있음 — 이는 코드가 아니라 워크플로 표준 산출물).
아래는 독립적으로 실제 소스(`dynamic-form-ui.tsx`, `sanitize-error-message.ts`)를 직접 읽어 재검증한 결과다.

## 발견사항

- **[INFO]** 프리필 왕복 가드(`isMaskedMarker`)는 값 전체가 마커와 **정확 일치**하는 경우만 잡고, backend
  의 부분-치환(URI userinfo 등) 결과는 감지하지 못한다 (의도된 설계 경계, 신규 아님 — 재확인).
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:371-373` (`isMaskedMarker`,
    `MASKED_MARKERS.has(v)` 정확 일치), `codebase/backend/src/shared/utils/sanitize-error-message.ts:47-51`
    (URI-userinfo 패턴 `/(?<=:\/\/)[^/\s:@]+:[^/\s@]+(?=@)/gi` — `scheme://user:pass@host` → `scheme://***@host`
    부분 치환)
  - 상세: 실제 소스를 직접 열어 확인했다 — `isMaskedMarker`(`dynamic-form-ui.tsx:371-373`)는
    `typeof v === "string" && MASKED_MARKERS.has(v)` 로 완전 일치만 검사한다. `redactSecrets`
    (`sanitize-error-message.ts:67-74`)가 만드는 `scheme://***@host` 류 값은 마커를 *포함*할 뿐 전체가
    마커는 아니므로 감지되지 않고 그대로 프리필된다. 다만 이 잔여는 **새로운 노출**을 만들지 않는다 —
    자격증명 부분(`user:pass`)은 이미 서버에서 제거된 뒤이고, 남는 것은 "마스킹 산물이 폼 값으로
    조용히 재사용된다"는 데이터 무결성 성질뿐이다. 이 경계는 코드 JSDoc(`:361-369`)과 캐너리 테스트
    (`dynamic-form-ui.test.tsx` — `postgres://***@db.internal/prod` 는 계속 프리필됨을 고정)로 명시적으로
    문서화·고정되어 있고, 포함-매치로 넓히면 `a***b` 같은 정상 기본값까지 지워지는 반대급부(과잉 차단)가
    있어 두 차례 리뷰 라운드에서 이미 "현행 유지"로 판단됐다. 새 결함이 아니므로 등급을 올리지 않는다.
  - 제안: 현행 유지(비차단). `token=` 등 키워드 패턴이 향후 확장되면 이 왕복-오염 잔여 범위도 함께
    넓어진다는 점만 계속 인지할 것 — `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 에 이미
    명시되어 있다.

- **[INFO]** 마스킹 마커 집합이 backend SoT 와 frontend 미러 두 곳에 수동 복제되어 있어, 값이 어긋나면
  프리필 가드가 조용히 fail-open 한다 (신규 아님 — 명명 불일치는 이번 시리즈에서 이미 해소 확인).
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95-100,128-136`
    (`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS`/`isMaskedMarker`, SoT) ↔
    `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339-373`
    (`MASKED_MARKERS`/`isMaskedMarker`, 미러)
  - 상세: 두 파일 모두 실제로 열어 대조했다 — 이름은 `MASKED_MARKERS`/`isMaskedMarker` 로 양쪽이
    정확히 일치하고(과거 라운드 WARNING #6 fix 확인), 값 집합(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)도
    동일하다. 다만 backend jest ↔ frontend vitest 스택 분리로 **두 값 집합을 자동 대조하는 계약 테스트는
    아직 없다** — `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 별건으로 등재되어 있고,
    frontend 쪽 절반(테스트가 구현 상수에서 fixture 를 파생 + 리터럴 대조)은 이미 기계화됐다.
  - 제안: 비차단, 트래커 유지 확인. 공유 패키지 추출 전까지는 이 갭이 잔존한다는 점만 인지.

- **[INFO]** (긍정 확인) `sanitize-error-message.ts` 의 diff 범위는 순수 위치 이동(JSDoc 을
  `MASKED_MARKERS` 에 정확히 귀속)뿐이며 로직·정규식·export 값 변경이 없다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95-136`
  - 상세: 실측으로 대조했다 — `VALUE_MASK_MARKER`(`'***'`)/`KEY_MASK_MARKER`(`'[REDACTED]'`)/
    `DEPTH_MASK_MARKER`(`'[REDACTED_DEPTH]'`) 세 상수 선언이 `MAX_REDACT_DEPTH` 아래에서 `MASKED_MARKERS`
    바로 위로 이동했을 뿐이고, `SECRET_LEAK_PATTERNS`(:33-52)·`redactSecrets`(:67-74)·
    `CREDENTIAL_KEY_PATTERN`(:84-85) 등 실제 마스킹 로직은 diff 밖이며 원본과 동일함을 확인했다.
    새로운 ReDoS·마스킹 우회 경로 없음.

- **[INFO]** (긍정 확인) 신규 코드에서 인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화 없음.
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339-384,471-477`,
    `.../__tests__/dynamic-form-ui.test.tsx`, `codebase/frontend/src/lib/i18n/dict/{en,ko}/editor.ts`,
    docs/spec/plan 파일 전체
  - 상세: `isMaskedMarker`/`initialValueFor`/힌트 렌더링은 전부 정적 문자열 `Set` 비교와 React JSX
    텍스트 출력(`{t("editor.runResults.formMaskedDefaultHint")}`)으로, `dangerouslySetInnerHTML` 이나
    사용자 입력을 DOM/쿼리/커맨드에 그대로 꽂는 경로가 없다(React 자동 이스케이프). `plan/in-progress/
    eia-masked-prefill-roundtrip-guard.md:36-37` 의 `sk-live-XYZ`/`sk-live-ABC` 는 무수정 프로브 결과를
    보여주는 합성(placeholder) 토큰이며 실제 발급된 자격증명이 아니다(저장소 전체 재검색 결과 다른 곳에
    등장하지 않음). 테스트 fixture(`postgres://***@db.internal/prod` 등)도 마찬가지로 이미 마스킹된
    합성 값이다. i18n·mdx·spec 변경은 전부 정적 텍스트 문자열이며 사용자 입력을 반영하지 않는다.

- **[INFO]** 이 diff 에 포함된 `review/code/**`, `review/consistency/**` 산출물(20여 개 markdown/json)은
  이전 리뷰·consistency-check 라운드의 표준 산출물이며 코드가 아니다. 전수 재검색 결과 실제 시크릿 패턴
  (`AKIA`, `-----BEGIN`, 유효해 보이는 API 키 등)은 발견되지 않았다 — 등장하는 토큰은 모두 합성 예시다.

## 요약

이번 diff 의 핵심(`DynamicFormUI.isMaskedMarker`/`initialValueFor` 가드)은 EIA §R17 값-마스킹이 폼
`defaultValue` 프리필 경로를 타고 왕복 오염(마스킹 마커가 실제 제출값으로 재사용)되는 것을 막는 방어적
변경으로, 보안 관점에서 순기능이며 새로운 인젝션·인증 우회·하드코딩 시크릿·안전하지 않은 암호화 취약점은
발견되지 않았다. `sanitize-error-message.ts` 변경은 실제 소스 대조 결과 순수 JSDoc/상수 재배치이고 로직
변화가 없다. 남아 있는 두 항목 — (1) 정확 일치만 잡아 부분-치환 마스킹 결과는 여전히 프리필되는 잔여
(자격증명 자체는 이미 제거된 뒤라 신규 노출은 아님), (2) backend/frontend 마커 상수 미러에 자동 계약
테스트가 없는 갭 — 은 둘 다 이번 diff 가 새로 만든 리스크가 아니라 이미 두 차례 리뷰 라운드에서 식별·
JSDoc/캐너리 테스트/트래커로 문서화된 의도적 트레이드오프이므로 INFO 로 유지한다.

## 위험도
LOW
