# 보안(Security) 리뷰 결과

## 발견사항

- **[WARNING]** 마스킹 왕복-오염 가드가 "전체 값이 마커와 정확히 일치"하는 경우만 감지하고, 문자열 일부만 마스킹된 경우(부분 치환)는 감지하지 못한다 — 이 PR 이 닫으려는 바로 그 클래스의 결함이 부분적으로 남는다.
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:357-359` (`isMaskedValue` — `MASK_MARKERS.has(v)` 정확 일치), `codebase/backend/src/shared/utils/sanitize-error-message.ts:51` (URI userinfo 패턴), 참고로 `:35`/`:42`/`:118`/`:120` 도 동일 클래스(값 전체가 아니라 부분 문자열만 매칭될 수 있는 패턴)
  - 상세: `redactSecrets`(`sanitize-error-message.ts:67-74`)는 `SECRET_LEAK_PATTERNS`를 순회하며 매치된 **부분 문자열만** `***`로 치환한다. 예컨대 URI-내장 자격증명 패턴(`:51`, `(?<=:\/\/)[^/\s:@]+:[^/\s@]+(?=@)`)은 `scheme://user:pass@host` 중 `user:pass` 부분만 치환해 `scheme://***@host`가 되고, `Authorization:` 패턴(`:42`)이나 `Bearer` 패턴(`:35`)도 값이 다른 텍스트에 둘러싸여 있으면(예: `"연결 문자열: https://admin:pw@api.example.com/v1"`, 또는 어떤 정상 문장 안에 자격증명이 섞인 경우) 전체 문자열이 정확히 `'***'`가 되지 않는다. 새로 추가된 `isMaskedValue`(및 이를 쓰는 `initialValueFor`)는 `typeof v === "string" && MASK_MARKERS.has(v)` 로 **정확 일치**만 검사하므로(`dynamic-form-ui.tsx:357-359`, 신규 테스트 `dynamic-form-ui.test.tsx`의 "마커를 *포함*할 뿐인 문자열은 마스킹 산물이 아니다 — 정확 일치만 건다" 케이스가 이 설계를 명시적으로 고정), 이런 부분-마스킹 결과 문자열(`scheme://***@host` 등)은 "마스킹 산물이 아님"으로 판정돼 그대로 프리필되고, 사용자가 손대지 않으면 그 손상된(마커가 섞인) 값이 그대로 제출된다 — 이 PR 이 명시적으로 막으려는 "조용한 데이터 오염" 그 자체가 non-credential-키 필드의 URL/복합 문자열 `defaultValue`에서는 여전히 발생한다. 백엔드의 `isMaskedMarker`(같은 파일, 재마스킹 방지용)도 동일하게 정확 일치만 쓰므로 두 계층이 서로 모순되진 않지만, 이번에 추가된 프런트 가드가 커버하는 범위는 "키 이름 기반 전체-값 치환"(`CREDENTIAL_KEY_PATTERN` 매치 시 `VALUE_MASK_MARKER` 전체 대체) 및 "값 전체가 우연히 패턴과 정확히 일치하는 경우"로 국한된다.
  - 제안: (a) 정확 일치 대신 "마커 문자열을 부분 문자열로 포함하는지" 검사로 넓히거나(단, 오탐 위험 — 정상 텍스트에 `***`가 우연히 포함될 수 있으므로 신중한 트레이드오프 필요, `a***b` 같은 정상값 보존 요구사항과 충돌), (b) 최소한 이 잔여 범위를 스코프 밖으로 명시적으로 문서화(스펙/JSDoc에 "부분 마스킹 결과는 미탐지"라고 캐비엇 추가) — 이미 plan 파일에 유사 취지("`token=` 패턴 확장은 왕복 오염 범위를 넓히므로 가드가 선 뒤에")가 있으나, 기존에 이미 활성화된 부분-매치 패턴(URI userinfo, Authorization 등)에 대한 잔여 갭은 별도로 명시되어 있지 않음.

- **[INFO]** 마스킹 마커 상수가 backend(`sanitize-error-message.ts`)와 frontend(`dynamic-form-ui.tsx`) 두 곳에 수동 복제된 SoT-미러 구조라 향후 마커 문자열이 한쪽만 바뀌면 이 가드가 조용히 뚫린다.
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:335-339` (`MASK_MARKERS`) vs `codebase/backend/src/shared/utils/sanitize-error-message.ts:96-100` (`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`)
  - 상세: 두 파일 모두 JSDoc으로 "변경 시 양쪽을 함께 갱신"을 명시하고 있고, 이미 이번 라운드 `/consistency-check` (`review/consistency/2026/08/17/11_38_00/`)에서 관련 구조적 이슈(WARNING #3, #4)가 식별·기록되어 있어 신규 지적은 아니다. frontend가 backend NestJS 모듈을 직접 import 할 수 없는 빌드 구조적 제약에 기인한 의도된 관용구이며, 컴파일 타임 보증이 없는 수동 동기화라는 점만 리스크로 남는다.
  - 제안: 런타임 중립 공유 패키지로 상수를 추출(이미 `DEFAULT_FILE_*`에 대해 "아키텍처 백로그 B-1"로 유사 항목이 언급됨)하거나, 최소한 e2e/통합 테스트에서 두 상수 집합이 실제로 같은 값을 갖는지 assert하는 회귀 테스트를 추가해 drift를 조기에 잡는 것을 권장.

- **[INFO]** `sanitize-error-message.ts` 변경분은 JSDoc/주석 재배치뿐이며 로직·정규식·export 값에 변경이 없음을 확인 — 보안 영향 없음.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:92-133` (diff 범위)
  - 상세: `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS`의 선언 순서와 주석 위치만 바뀌었고 값·로직은 동일. `redactSecrets`, `deepRedactCore`, `CREDENTIAL_KEY_PATTERN` 등 실제 마스킹 로직은 diff에 포함되지 않음.
  - 제안: 조치 불요.

- **[INFO]** 하드코딩된 시크릿·인젝션·인증/인가 취약점 없음.
  - 위치: 전체 diff (`codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`, `.../dynamic-form-ui.test.tsx`, `.../lib/i18n/dict/{en,ko}/editor.ts`, docs/spec/plan 파일)
  - 상세: `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 등에 등장하는 `sk-live-XYZ`/`sk-live-ABC` 문자열은 문서 내 예시/프로브 로그의 placeholder이며 실제 유효한 자격증명이 아님. 새 i18n 문자열은 정적 텍스트로 `t()` 를 통해 렌더링되어 XSS 벡터 없음. `fieldInputId`(기존 코드, 미변경)의 CSS-selector sanitize도 diff 범위 밖이나 여전히 안전하게 유지됨. 신규 테스트는 `defaultValue`/제출 payload에 마커가 남지 않는지 검증하는 회귀 테스트로 적절.

## 요약
이번 변경의 핵심은 EIA §R17 마스킹 정책이 폼 `defaultValue` 프리필 경로로 "왕복 오염"(마스킹된 credential 마커 `***`가 실제 폼 제출 값으로 되쓰이는 문제)을 일으키던 것을 프런트엔드에서 마커 감지 가드(`isMaskedValue`)로 차단하는 방어적 수정이며, 보안적으로는 순기능(데이터 무결성 개선)이다. 새로운 인젝션·인증/인가·하드코딩 시크릿·암호화 취약점은 발견되지 않았다. 다만 신규 가드가 "값 전체가 마커와 정확히 일치"하는 경우만 탐지하도록 설계되어(테스트에서도 명시적으로 고정), URI-내장 자격증명(`scheme://user:pass@host` → `scheme://***@host`)처럼 문자열 일부만 마스킹되는 기존 패턴들에 대해서는 동일 클래스의 데이터 오염이 여전히 가능하다 — 심각도는 낮지만(정보 유출이 아니라 값 손상), 이 PR이 명시적으로 해소하려는 문제의 부분적 잔여로서 WARNING으로 표기한다.

## 위험도
LOW
