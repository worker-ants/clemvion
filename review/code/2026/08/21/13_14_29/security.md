# 보안(Security) Review — masked-marker-contract-7d2e14 (라운드5, 13_14_29)

## 검토 방법

이번 diff(95개 항목, `origin/main...HEAD` 5커밋)의 대부분(파일 24~94)은 이전 4회 코드 리뷰
라운드(`11_27_29`/`11_53_49`/`12_25_15`/`12_50_37`)와 2회 consistency-check 라운드의 산출물
자체다. 실질 보안 표면은 (a) 신규 공유 패키지 `@workflow/masked-markers`(파일 15~20),
(b) backend/frontend 재export shim(`sanitize-error-message.ts`/`masked-markers.ts`, 파일 8·14),
(c) 신규 미러 소멸 repo-guard 4개(파일 6·7·12·13, diff 가 프롬프트에서 생략돼 `Read` 로 원본
전문을 직접 확인), (d) CI/Docker 배선 8곳(파일 1~5·9~11)이다.

diff 로만 판단하지 않고 다음을 원본 파일에서 직접 재확인했다:
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` 전문 — `SECRET_LEAK_PATTERNS`·
  `CREDENTIAL_KEY_PATTERN`·`deepRedactCore`/`deepRedactObject` 재귀 walk·`MAX_REDACT_DEPTH` 비교
  연산자가 이관 전후 **바이트 단위로 동일**함(정규식 패턴 자체는 이번 diff 의 변경 대상이 아님,
  import/export 문만 재배선).
- `codebase/frontend/src/lib/utils/masked-markers.ts` 전문 — `scanForMarker` 의 "값 검사 먼저,
  깊이 검사 다음" 순서와 `MAX_MASK_DEPTH` 비교가 이관 전후 동일.
- `codebase/packages/masked-markers/src/index.ts` 전문 — `VALUE_MASK_MARKER='***'`,
  `KEY_MASK_MARKER='[REDACTED]'`, `DEPTH_MASK_MARKER='[REDACTED_DEPTH]'`, `MAX_MASK_DEPTH=10`,
  이관 전 리터럴과 일치.
- **직전 라운드(`12_50_37`) 가 WARNING 으로 남긴 항목이 이번 커밋에서 실제로 해소됐는지** —
  `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:141` 과
  `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:143-144` 를
  나란히 `Read` 로 대조. 양쪽 모두 이제
  `relPath === SOT_DIR(정규화) || relPath.startsWith(\`${SOT_DIR(정규화)}/\`)` 로 **동일한
  경계 조건**을 쓴다 — round4 지적("backend 만 고쳐지고 frontend 는 옛 무경계
  `startsWith(SOT_DIR)` 그대로")이 해소됨을 직접 확인했다. 두 테스트 스위트
  (`masked-marker-mirror.spec.ts:133-158`, `masked-marker-mirror.test.ts:146-165`) 모두
  "SoT 와 접두가 겹치는 형제 패키지(`masked-markers-extra`)는 탐지 대상" 캐너리를 갖고 있어
  이 경계를 기계로 고정했다.

## 발견사항

없음 — Critical/Warning 급 신규 보안 결함을 찾지 못했다.

- **[INFO]** 신규 미러 소멸 가드가 저장소 소스 트리 전체를 읽어 TypeScript AST 로 파싱한다 —
  공격 표면이 아님(확인 기록)
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 함수
    `findMirrorRedeclarations`/`findRedeclaredSymbols`, `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 동일 함수.
  - 상세: `fs.readFileSync` + `ts.createSourceFile(..., ts.ScriptKind.TSX)` 로 저장소 내
    `.ts`/`.tsx` 전 파일을 파싱한다. 입력이 외부 사용자 데이터가 아니라 저장소 자신의
    커밋된 소스(신뢰 경계 내부)이고, 실행 위치도 `__tests__`/`repo-guards` 경로라 프로덕션
    빌드·런타임에 포함되지 않는다(직전 라운드가 `production-build-devdep` 가드로 36/36
    GREEN 확인 완료). TS 컴파일러 API 는 파싱 전용으로만 쓰이고 `eval`/`exec` 류 동적 실행은
    없다. 조치 불요.
- **[INFO]** `MASKED_MARKERS.includes(v)` 정확 일치 판정과 `CREDENTIAL_KEY_PATTERN`/
  `SECRET_LEAK_PATTERNS` 정규식은 이번 diff 에서 값·로직 변경이 없음 — egress 마스킹의 실제
  방어력에는 이번 PR 이 영향을 주지 않는다(긍정적 확인).
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:42-66,112-113` — 정규식
    본문은 diff 미포함 구간, 대신 원본을 직접 `Read` 로 대조해 확인.
  - 상세: 이번 PR 의 목적이 "마커 값을 손 복제에서 공유 패키지 재export 로 바꾸는" 순수
    이관이라는 점과 일치한다. ReDoS·마스킹 우회 가능성이 있는 정규식 변경은 diff 안에 없다.
  - 제안: 없음.
- **[INFO]** `@workflow/masked-markers/package.json` 의 `prepare` 스크립트가 `node -e` 인라인
  JS 로 `child_process.execSync('tsc', ...)` 를 실행한다 — 신규 위험 아님(선례 그대로 복제)
  - 위치: `codebase/packages/masked-markers/package.json` (`scripts.prepare`)
  - 상세: 이 저장소의 다른 8개 내부 패키지(`ai-end-reason` 등)에 이미 동일한 문자 그대로의
    스크립트가 있고, 이번 패키지는 그 관행을 그대로 복제한 것이다. 입력값이 하드코딩된
    고정 문자열이라 인젝션 표면이 아니며, `devDependencies` 라이프사이클 훅이라 프로덕션
    아티팩트에 포함되지 않는다.
  - 제안: 없음(범위 밖 — 유지보수성 리뷰가 이미 별도로 다룸).

## 요약

이 PR 은 backend/frontend 에 손으로 복제되던 자격증명 마스킹 마커 상수(`'***'`/
`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)와 깊이 상한(`MAX_MASK_DEPTH=10`)을
`@workflow/masked-markers` 공유 패키지로 추출하는 **동작 무변경 리팩터**다. 직접 원본 파일을
대조한 결과 실제 마스킹 로직(`SECRET_LEAK_PATTERNS`·`CREDENTIAL_KEY_PATTERN`·재귀 depth walk·
`isMaskedMarker` 정확 일치 판정)은 값·순서·비교 연산자까지 이관 전후 동일해 새로운 인젝션·
인증/인가 우회·평문 전송·안전하지 않은 암호화·에러 메시지 정보 노출 표면이 생기지 않았다.
하드코딩된 시크릿은 없다(마커 문자열은 자격증명이 아니라 자격증명이 *제거됐음을 표시*하는
placeholder). 가장 중요한 확인은 **직전 라운드(`12_50_37`)가 WARNING 으로 남긴 미러 소멸
가드 자체의 결함**(frontend `SOT_DIR` 접두 경계가 backend 와 달리 옛 무경계 형태로 남아
"이름이 `masked-markers`로 시작하는 형제 패키지"를 SoT 자신으로 오인해 탐지에서 조용히
제외할 수 있었던 fail-open 가능성)이 이번 커밋(`4dca96cc4`)에서 실제로 backend/frontend
양쪽 동일한 경계 조건으로 수정됐고, 그 경계를 직접 묻는 캐너리(형제 디렉터리 fixture)가
양쪽 테스트 스위트에 모두 추가돼 회귀를 기계로 고정했다는 점이다 — 서술과 실제 코드 상태가
이제 일치한다. 나머지 CI/Docker 배선 8곳은 신규 내부 workspace 패키지 등록을 위한 기계적
한 줄 추가이며 외부 비밀·시크릿 노출과 무관하다. 차단 사유가 될 보안 결함은 없다.

## 위험도
NONE
