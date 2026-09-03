# 보안(Security) 코드 리뷰

## 대상 개요

이번 diff 는 두 축으로 구성된다.

1. `codebase/backend/src/repo-guards/__tests__/` 5개 저장소 정적 분석 가드(감사 로그 바인딩·
   엔진 에러코드 앵커·마스킹 우회 호출자·nullable 타입 거짓말 캐스트·redis fail-open 카탈로그)에
   중복돼 있던 디렉터리 재귀 walker 를, 공용 유틸 `codebase/backend/src/common/__test-utils__/source-scan.ts`
   의 `collectTsFiles()` 로 통합한다.
2. `nullable-type-lie-cast-guard.ts` 에 `.spec.ts` 안의 낡은 `null as unknown as` 캐스트를
   잡는 신규 가드(`widenedEntityFields`/`findStaleSpecCasts`)를 추가한다.

나머지 변경분(`plan/in-progress/entity-nullable-column-type-mismatch.md`, 그리고
`review/code/2026/09/04/01_48_39/`·`01_49_18/`·`02_12_38/`·`02_35_22/` 하위의 이전 리뷰
라운드 산출물 — meta.json/RESOLUTION.md/SUMMARY.md/각 관점 리포트)는 문서·리뷰 아티팩트이며
실행 코드가 아니다. 후자는 이 저장소 관례상 `review/` 가 gitignore 대상이 아니어서 커밋되는
정상 산출물이고, 내용도 이미 지나간 리뷰 라운드의 자기 보고서라 보안 관점에서 별도로 스캔할
표면(비밀값·주입 등)이 없음을 확인했다(grep 으로 자격증명 패턴 없음 확인).

**핵심 판단**: 대상 코드 전부가 CI/테스트 하네스에서만 실행되는 개발용 정적 스캐너다. 파일
탐색 루트(`SRC_ROOT`/`MODULES_DIR`/`ENGINE_DIR`/`srcDir`/`rootDir`)는 전부 하드코딩된 상수
또는 `path.resolve(__dirname, …)` 로 계산된 저장소 내부 경로이며, 어디에도 사용자 입력·HTTP
요청·DB 쿼리·인증/세션 로직이 개입하지 않는다. `child_process`/`exec`/`spawn` 류 호출도 전
대상 파일에 없음을 직접 grep 으로 확인했다(`RegExp.exec()` 호출 3건만 존재, 프로세스 실행
아님).

## 발견사항

- **[INFO]** 신규 `WIDENED_DECL`/`stripLiterals` 정규식의 이론적 backtracking 특성 — 실질 위험 없음
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` `stripLiterals`
    (`export function stripLiterals`), `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`
    `WIDENED_DECL` 상수 정의부
  - 상세: 두 정규식 모두 "구분자로 시작하는 대안 vs 그 외 문자" 형태의 분기이고, 분기가
    prefix-disjoint 라 전형적인 `(a+)+` 류 catastrophic backtracking 조건은 성립하지 않는다.
    다만 입력이 신뢰된 저장소 소스 파일(공격자가 값을 주입할 경로가 없음)이므로, 설령
    다항 시간이더라도 익스플로잇하려면 이미 저장소 커밋 권한이 필요하고 그 경우 훨씬 쉬운
    공격 경로가 이미 열려 있어 실질적 DoS 벡터가 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `masked-reject-callers-guard.ts` 의 스캔 범위가 `.d.ts` 를 항상 제외하도록 변경됨 — 오늘은 무해함이 실측으로 확인됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    (`listSourceFiles` → `collectTsFiles(rootDir, { includeSpec: true })`),
    `codebase/backend/src/common/__test-utils__/source-scan.ts` (`collectTsFiles` 의
    `!entry.name.endsWith('.d.ts')` 조건)
  - 상세: 리팩터 전 이 가드의 `listSourceFiles` 는 `.ts` 확장자만 보고 `.d.ts` 도 스캔에
    포함했다. 통합된 `collectTsFiles` 는 `.d.ts` 를 항상 제외한다. 이 가드는
    `resolveTriggerParameters`(마스킹 우회 위험이 있는 base 함수) 직접 호출자를 허용목록으로
    제한하는 보안 관련 가드이므로, 스캔 대상이 좁아지면 이론적으로 탐지 사각지대가 생긴다.
    다만 `.d.ts` 는 타입 선언만 담고 실행 코드(함수 호출부)가 있을 수 없는 파일 종류이고,
    `find codebase/backend/src -name '*.d.ts'` 로 직접 재확인한 결과 대상 트리에 `.d.ts` 가
    0개라 오늘은 동작 불변이다. 판정 로직 자체(`importsBaseFn`, TypeScript AST 기반)는 이번
    diff 로 건드리지 않았다.
  - 제안: 이미 plan 문서와 `source-scan.ts` docstring 양쪽에 실측 근거로 문서화된 의도적
    변경이라 추가 조치 불요. 다음 사람이 `src/` 에 `.d.ts` 를 실제로 추가하는 시나리오가
    생기면 이 가드의 커버리지 가정을 재검토해야 한다는 점만 인지하면 된다.

- **[INFO]** `findStaleSpecCasts` 가 `stripComments`→`stripLiterals` 순서로 상속하는 기존 blind spot
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`
    (`findStaleSpecCasts` 의 `stripLiterals(stripComments(...))` 호출)
  - 상세: `stripComments` 는 문자열 리터럴 내부의 `//` 도 주석으로 잘라내는 기존 한계가 있고
    (모듈 자체 docstring 이 이미 명시), 신규 가드도 그 순서를 그대로 상속한다. 이론적으로
    URL 문자열과 같은 줄에 낡은 캐스트가 있으면 검출을 놓칠 수 있으나, 이 가드는 코드
    품질/타입 정합성 판정용이지 인증·인가·민감정보 마스킹을 지키는 보안 가드가 아니고,
    방향도 "과탐지가 아닌 저탐지"(놓치는 쪽)라 조용히 fail-open 될 뿐 공격 표면을 만들지
    않는다.
  - 제안: 참고 기록. 조치 불요.

### 확인한 항목 (특이사항 없음)

- **인젝션**: SQL/명령/경로 인젝션 표면 없음. 모든 파일 접근(`fs.readdirSync`/`fs.readFileSync`)의
  루트 인자는 하드코딩 상수 또는 저장소 내부 경로이며 외부 입력을 받지 않는다.
  `child_process`/`exec`/`spawn` 호출 자체가 대상 파일에 없다(직접 grep 확인).
- **하드코딩된 시크릿**: 없음. 테스트 픽스처 문자열(`'UPDATE t SET x = 1 …'`, entity/spec
  합성 코드 등)은 합성 샘플일 뿐 실제 자격증명이 아니다.
- **인증/인가**: 런타임 인증 경로 미접촉. `masked-reject-callers-guard.ts` 는 보안 관련 정적
  가드이나 이번 diff 는 그 판정 로직(`importsBaseFn`, AST 기반)을 건드리지 않고 파일 수집
  방식만 공용화했다(위 INFO 항목 하나로 별도 기재).
- **입력 검증**: N/A — 사용자 입력을 받는 표면이 없다.
- **암호화**: N/A — 평문 전송·해시 알고리즘 대상 코드 없음.
- **에러 처리**: 대상 코드는 CI 로그로만 소비되는 정적 스캐너 출력이며, 민감정보(자격증명·
  개인정보)를 다루는 경로 자체가 없어 에러 메시지 노출 위험이 없다.
- **의존성 보안**: 신규 의존성 없음. `typescript` 는 기존 direct dependency 재사용.

## 요약

이번 diff 는 프로덕션 런타임 코드가 아니라 CI/테스트 단계에서만 실행되는 저장소 내부 정적
분석 도구(중복 디렉터리 워커 통합 + 신규 `.spec.ts` 낡은 캐스트 탐지 가드)와 plan/리뷰 문서
갱신으로 구성된다. 사용자 입력·네트워크·DB·인증 경로 어디와도 접촉하지 않아 인젝션·인증
우회·평문 전송 등 전통적 보안 취약점 표면이 존재하지 않는다. 유일하게 언급할 만한 점은
(1) 신·구 정규식의 이론적 backtracking 비용은 입력이 신뢰된 저장소 소스라 실질 위험이
없고, (2) 보안 관련 가드(`masked-reject-callers-guard.ts`)의 스캔 범위가 `.d.ts` 제외로
좁아졌지만 오늘 저장소에는 영향이 없음이 실측으로 확인돼 있다는 것뿐이다 — 모두 이전
리뷰 라운드(`01_49_18`, `02_12_38`)에서도 동일하게 INFO 로 분류돼 조치 없이 남은 항목이며,
이번 재검토로도 판정이 달라지지 않는다. CRITICAL/WARNING 급 보안 결함은 발견되지 않았다.

## 위험도

NONE
