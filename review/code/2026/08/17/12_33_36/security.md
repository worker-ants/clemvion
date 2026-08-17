# 보안(Security) 리뷰 — eia-masking-round2-53afc8

## 발견사항

- **[INFO]** 부분-매치(partial-match) 마스킹 결과는 프리필 가드가 감지하지 못한다 (의도된 설계 경계, 신규 아님)
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:371` (`isMaskedMarker`)
  - 상세: `isMaskedMarker` 는 `MASKED_MARKERS`(`"***"` / `"[REDACTED]"` / `"[REDACTED_DEPTH]"`) 와의
    **정확 일치**만 검사한다. backend `sanitize-error-message.ts` 의 URI-userinfo 패턴
    (`/(?<=:\/\/)[^/\s:@]+:[^/\s@]+(?=@)/gi`, `codebase/backend/src/shared/utils/sanitize-error-message.ts:51`)은
    `scheme://user:pass@host` 를 `scheme://***@host` 로 **부분** 치환하므로 값 전체가 마커가
    아니고, 이 가드는 그런 값을 감지하지 못해 그대로 프리필한다. 다만 **자격증명 부분은 이미
    서버에서 제거된 뒤**이므로 이 갭이 새로운 정보 노출을 만들지는 않는다 — 남는 것은 "마스킹
    산물이 재입력값으로 조용히 되쓰인다"는 데이터 무결성 성질뿐이다. 이 경계는 코드
    JSDoc(`dynamic-form-ui.tsx:361-369`), 캐너리 테스트
    (`dynamic-form-ui.test.tsx:646` `it("[캐너리] 부분 치환된 값...")`), 직전 라운드
    RESOLUTION(`review/code/2026/08/17/12_06_12/RESOLUTION.md` §3)에서 이미 식별·검토되었고
    "포함-매치로 넓히면 `a***b` 같은 정상 값까지 지워 오탐 비용이 미탐 비용을 초과한다"는
    근거로 **의도적으로 유지**하기로 판단되었다. 새 결함이 아니라 이미 문서화·테스트로 고정된
    잔여 경계이므로 등급을 유지한다.
  - 제안: 현행 유지 가능(비차단). 추후 `token=` 등 키워드 패턴이 확장되면 이 왕복-오염 범위도
    함께 넓어진다는 점만 계속 인지할 것(plan 파일이 이미 명시: "그 확장은 이 PR 에 넣지 않는다").

- **[INFO]** 마스킹 마커 집합이 backend/frontend 양쪽에 수동 복제되어 있고, 어긋나면 프런트
  가드가 **조용히 fail-open** 한다 (신규 아님, 이번 라운드에서 명명 불일치는 이미 해소됨)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:96-100,128-136`
    (`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS`/`isMaskedMarker`, SoT) ↔
    `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339-373`
    (`MASKED_MARKERS`/`isMaskedMarker`, 미러)
  - 상세: 이번 diff 는 직전 라운드 WARNING(#6, 명명 불일치로 grep 동기화 실패)을 해소해
    양쪽 이름을 `MASKED_MARKERS`/`isMaskedMarker` 로 일치시켰다(확인됨). 다만 여전히 **값 자체를
    비교하는 자동 계약 테스트는 없다** — 누군가 backend 쪽 마커 문자열을 바꾸고 frontend 미러를
    갱신하지 않으면, 마스킹된 값이 감지되지 않고 프리필 가드가 조용히 뚫린다(이 실패 모드는
    사용자에게 에러 없이 마스킹 마커가 실제 입력값으로 재제출되는 형태로 나타난다). 직전 라운드
    SUMMARY 도 이를 INFO(#7)로 이미 등재해 두었다.
  - 제안: 비차단. 여력이 되면 두 상수 집합을 비교하는 경량 계약 테스트를 추가(이미 트래커에
    저비용 후속으로 기록됨).

- **[INFO]** (긍정 확인) 신규 코드에서 인젝션·시크릿 하드코딩·인증 우회 없음
  - 상세: `isMaskedMarker`/`initialValueFor`/힌트 렌더링은 전부 정적 문자열 Set 비교와 React
    JSX(`{t("editor.runResults.formMaskedDefaultHint")}`) 출력으로, `dangerouslySetInnerHTML` 이나
    사용자 입력을 그대로 DOM/쿼리/커맨드에 꽂는 경로가 없다(React 는 텍스트 노드를 자동
    이스케이프). `sanitize-error-message.ts` 변경분은 `VALUE_MASK_MARKER` 등 상수 3개와 그
    JSDoc 블록의 **위치만** `MAX_REDACT_DEPTH` 아래에서 `MASKED_MARKERS` 바로 위로 옮긴 것이고,
    `SECRET_LEAK_PATTERNS`/`redactSecrets`/`deepRedactSecretsPreserving`/정규식 자체는 전수
    확인 결과 무변경이다 — 새로운 ReDoS·우회 경로 없음. `plan/in-progress/eia-masked-prefill-roundtrip-guard.md:36-37`
    의 `sk-live-XYZ`/`sk-live-ABC` 는 무수정 프로브 결과를 보여주는 **예시(합성) 토큰**이며 실제
    발급된 자격증명이 아니다(저장소 전체에서 다른 위치에 등장하지 않음, 접미사가 명백히
    placeholder). 그 외 커밋에 포함된 `review/code/**`·`review/consistency/**` 산출물(메타
    JSON/문서)에도 실제 시크릿 패턴은 검색되지 않았다.

## 요약

이번 라운드는 EIA §R17 마스킹이 폼 `defaultValue` 프리필을 통해 왕복 오염되는(마스킹 마커가
실제 제출값이 되는) 문제를 정확 일치 기반 가드(`isMaskedMarker`)로 닫는 방어적 변경이며, 인젝션·
인증 우회·하드코딩 시크릿·안전하지 않은 암호화 등 새로운 보안 결함은 없다. `sanitize-error-message.ts`
변경은 로직 무변경(JSDoc/상수 재배치)임을 원문 대조로 확인했다. 남은 두 항목 — (1) URI 내장
자격증명처럼 부분-매치로 마스킹된 값은 여전히 정확-일치 가드를 통과해 프리필된다는 점(단, 자격증명
부분 자체는 이미 서버에서 제거된 뒤라 신규 노출은 아님), (2) backend/frontend 마커 상수 미러에
자동 계약 테스트가 없어 값이 어긋나면 가드가 조용히 fail-open 한다는 점 — 은 둘 다 이번 diff 가
새로 만든 리스크가 아니라 직전 리뷰 라운드에서 이미 식별·문서화(JSDoc 캐비엇 + 캐너리 테스트 +
RESOLUTION 근거)된 의도적 트레이드오프이므로 INFO 로 유지한다.

## 위험도
LOW
