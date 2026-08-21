# 보안(Security) Review — masked-marker-contract-7d2e14 (라운드6, 13_34_34)

## 검토 방법

이번 diff(109개 항목, `origin/main...HEAD`)의 다수(파일 24~108)는 이전 5회 코드 리뷰 라운드
(`11_27_29`/`11_53_49`/`12_25_15`/`12_50_37`/`13_14_29`)와 2회 consistency-check 라운드의
산출물 자체이며, 코드 변경이 아니라 그 라운드들의 리뷰 기록이다. 실질 보안 표면은 이전
라운드와 동일하게 (a) 신규 공유 패키지 `@workflow/masked-markers`(파일 15~20), (b)
backend/frontend 재export shim(`sanitize-error-message.ts`/`masked-markers.ts`, 파일 8·14),
(c) 신규 미러 소멸 repo-guard 4개(파일 6·7·12·13 — 프롬프트에 diff 가 생략돼 `Read` 로 원본
전문 직접 확인), (d) CI/Docker 배선 8곳(파일 1~5·9~11), (e) 신규로 파일 109 에 추가된
spec R17 SoT 서술 정정이다.

직접 원본을 `Read` 로 재확인한 내용:
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` 전문 — `SECRET_LEAK_PATTERNS`
  (Bearer/JWT/URI-userinfo/Authorization 등 6개 정규식) · `CREDENTIAL_KEY_PATTERN` ·
  `deepRedactCore`/`deepRedactObject` 재귀 walk · `MAX_REDACT_DEPTH` 비교 연산자가 이관 전후
  **바이트 단위로 동일**함(diff 는 import/export 문 재배선만).
- `codebase/frontend/src/lib/utils/masked-markers.ts` 전문 — `scanForMarker` 의 "값 검사
  먼저, 깊이 검사 다음" 순서와 `MAX_MASK_DEPTH` 비교가 이관 전후 동일.
- `codebase/packages/masked-markers/src/index.ts` 전문 — `VALUE_MASK_MARKER='***'` ·
  `KEY_MASK_MARKER='[REDACTED]'` · `DEPTH_MASK_MARKER='[REDACTED_DEPTH]'` · `MAX_MASK_DEPTH=10`
  전부 이관 전 리터럴과 일치. `MASKED_MARKERS` 는 `Object.freeze(new Set(...))` 플라시보(내부
  슬롯이라 freeze 무효)를 실제 `Object.freeze([...])` 배열로 바꿔 **오히려 불변성이
  강화**됐다(`.push()` 가 `TypeError` 로 실제 실패함을 신규 캐너리가 단언).
- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`,
  `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전문 —
  이전 라운드가 지적한 두 결함(경로 접두 무경계 `startsWith(SOT_DIR)`, 지역 변수 `sot` 가
  `import * as sot` 를 섀도잉)이 모두 해소된 상태로 확인됨: 양쪽 모두
  `relPath === sotPrefix || relPath.startsWith(\`${sotPrefix}/\`)` 형태이고, frontend 는
  `sotPrefix` 를 루프 밖에서 1회 계산한다.
- 전체 diff 텍스트(마커 리터럴·JSDoc·plan/review 문서 포함)에 하드코딩된 실제 시크릿 패턴
  (AWS access key, PEM private key, `sk-`/`ghp_` 류 API 키 리터럴 등)이 있는지 grep 으로
  전수 확인 — 매치 없음. 코드/문서에 등장하는 `admin:pw@host`, `AKIA…` 형태 언급은 전부
  정규식 패턴 설명을 위한 예시 텍스트이지 실제 자격증명이 아니다.
- `reject-masked-resubmission.ts`(EIA §R17 재제출 거부 가드)는 이번 diff 에 포함되지 않으며,
  그 소비처인 `isMaskedMarker` 의 시그니처(`(v: unknown) => boolean`)와 정확-일치 판정
  로직이 그대로 유지되므로 이 가드의 방어력에 영향이 없다(side_effect.md 11_27_29 라운드의
  grep 전수 확인과 일치).

## 발견사항

없음 — Critical/Warning 급 신규 보안 결함을 찾지 못했다. 5회 선행 라운드에서 지적된
architecture/maintainability WARNING(가드 배치의 경로 게이팅 사각지대, 감시 목록 자체가
미러, 파생 스캔 범위 누락, 완료형 서술의 거짓, 섀도잉)은 전부 **동작 결함**이었고 보안
관점에서는 "미러 소멸 가드가 조건부로 무력화될 수 있었다"는 형태로 이미 각 라운드
`security.md`/`architecture.md` 가 다뤄 처분 완료됐다 — 이번 라운드에서 재확인한 결과 전부
해소된 상태로 남아 있다.

- **[INFO]** 신규 미러 소멸 가드가 저장소 소스 트리 전체를 읽어 TypeScript AST 로 파싱한다 —
  공격 표면 아님(재확인)
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 함수
    `findMirrorRedeclarations`/`findRedeclaredSymbols`; 동일 함수가
    `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 에도 있음.
  - 상세: `fs.readFileSync` + `ts.createSourceFile(..., ts.ScriptKind.TSX)` 로 저장소 내
    `.ts`/`.tsx` 전 파일을 파싱한다. 입력이 외부 사용자 데이터가 아니라 저장소 자신의
    커밋된 소스(신뢰 경계 내부)이고, 실행 위치도 `__tests__`/`repo-guards` 경로라 프로덕션
    빌드·런타임에 포함되지 않는다. `eval`/동적 실행은 없고 TS 컴파일러 API 는 파싱 전용으로만
    쓰인다. `repoRoot` 인자는 테스트 안에서 `path.resolve(__dirname, ...)` 또는 `os.tmpdir()`
    기반 고정 값만 사용되며 외부 입력을 받지 않는다.
  - 제안: 없음.
- **[INFO]** 마스킹 실제 로직(정규식·키 패턴·깊이 walk·정확일치 판정)은 이번 diff 에서
  값·순서·연산자 변경이 전혀 없음 — egress 마스킹/재제출 거부 가드의 실제 방어력에 이번
  PR 이 영향을 주지 않는다(긍정적 확인, 재검증)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` 함수 `redactSecrets`/
    `deepRedactCore`/`deepRedactObject` (정규식·비교 연산자 자체는 diff 미포함 구간이라 원본
    `Read` 로 대조).
  - 상세: 이 PR 의 목적이 "마커 값·깊이 상수를 손 복제에서 공유 패키지 재export 로 바꾸는"
    순수 이관이라는 서술과 일치한다. ReDoS 나 마스킹 우회를 유발할 정규식 변경은 diff 안에
    없다.
  - 제안: 없음.
- **[INFO]** `@workflow/masked-markers/package.json` 의 `prepare` 스크립트가 `node -e` 인라인
  JS 로 `child_process.execSync('tsc', ...)` 를 실행한다 — 신규 위험 아님(선례 그대로 복제,
  재확인)
  - 위치: `codebase/packages/masked-markers/package.json` (`scripts.prepare`)
  - 상세: 이 저장소의 다른 8개 내부 패키지(`ai-end-reason` 등)에 이미 문자 그대로 동일한
    스크립트가 있고, 이번 패키지는 그 관행을 복제했을 뿐이다. 실행되는 명령이 하드코딩된
    고정 문자열(`'tsc'`)이라 사용자/환경 입력이 개입할 인젝션 표면이 없고, `devDependencies`
    라이프사이클 훅이라 프로덕션 아티팩트에 포함되지 않는다.
  - 제안: 없음(범위 밖 — 유지보수성 리뷰가 이미 별도로 다룸).
- **[INFO]** 신규 devDependency 8종(`@eslint/js`·`@types/jest`·`eslint`·`globals`·`jest`·
    `ts-jest`·`typescript`·`typescript-eslint`)은 전부 저장소 내 다른 workspace 패키지가
    이미 쓰는 것과 동일한 semver 라인이다 — 새 취약 버전 도입 아님(확인)
  - 위치: `codebase/packages/masked-markers/package.json` (`devDependencies`)
  - 상세: `pnpm-lock.yaml` 재계산에 딸려온 `eslint-config-next` peer-dep 해석 트리 재정렬은
    버전 자체는 불변(직전 라운드 `side_effect.md`/`scope.md` 가 이미 `git log -S` 로 확인)이고
    이번 신규 패키지가 프로덕션 의존성을 추가하지도 않는다(전부 `devDependencies`, backend/
    frontend `package.json` 에는 `@workflow/masked-markers: "workspace:*"` 하나만 추가).
  - 제안: 없음.

## 요약

이 PR 은 backend/frontend 에 손으로 복제되던 egress 마스킹 마커 상수(`'***'`/`'[REDACTED]'`/
`'[REDACTED_DEPTH]'`)와 깊이 상한(`MAX_MASK_DEPTH=10`)을 `@workflow/masked-markers` 공유
패키지로 추출하는 **동작 무변경 리팩터**이며, 실질 보안 관련 코드(`SECRET_LEAK_PATTERNS`·
`CREDENTIAL_KEY_PATTERN`·재귀 depth walk·`isMaskedMarker` 정확 일치 판정·EIA §R17 재제출
거부 가드의 소비 시그니처)는 값·순서·비교 연산자까지 이관 전후 동일함을 원본 파일 직접
대조로 재확인했다. 오히려 `MASKED_MARKERS` 컨테이너를 무효 freeze(`Set`)에서 유효 freeze
(배열)로 바꿔 런타임 불변성이 실질적으로 강화됐고, 5회 선행 라운드가 지적한 미러 소멸
가드 자체의 결함들(frontend 경로 접두 무경계, 변수 섀도잉, 세 번째 스택 무방비, 감시
목록의 손 복제)은 모두 이번 커밋 상태에서 실제로 해소돼 있음을 소스를 직접 읽어 확인했다.
전체 diff 를 grep 전수 확인한 결과 하드코딩된 실제 시크릿은 없고, 새 인젝션·인증/인가
우회·평문 전송·안전하지 않은 암호화·에러 메시지 정보 노출 표면도 발견되지 않았다. CI/Docker
배선 8곳과 spec R17 서술 정정(파일 109)은 신규 패키지 등록/문서 정합을 위한 것으로 보안과
무관하다. 차단 사유가 될 보안 결함은 없다.

## 위험도
NONE
