# 보안(Security) 코드 리뷰

## 대상 개요

이번 diff 는 `codebase/backend/src/repo-guards/__tests__/` 계열의 **저장소 정적 분석 가드**(감사 로그
바인딩·엔진 에러코드 앵커·마스킹 우회 호출자·nullable 타입 거짓말 캐스트·redis fail-open 카탈로그)와
그 공용 유틸 `common/__test-utils__/source-scan.ts` 를 리팩터링한 것이다. 다섯 개의 중복 디렉터리
워커(`walkTsFiles`/`listSourceFiles`/`listProductionSources`/`collectScanTargets`/
`collectSourceFiles`)를 `collectTsFiles()` 하나로 통합하고, `nullable-type-lie-cast-guard.ts` 에
`.spec.ts` 안의 낡은 `null as unknown as` 캐스트를 잡는 `widenedEntityFields`/`findStaleSpecCasts`
를 신설했다. 나머지 하나는 `plan/in-progress/entity-nullable-column-type-mismatch.md` 문서 갱신.

**모든 대상 코드는 CI/테스트 하네스에서만 실행되는 개발 도구(빌드타임 정적 스캐너)이고, 스캔
대상(`root`/`srcDir`/`repoRoot`)은 전부 하드코딩된 상수 또는 저장소 자체 경로다** — 사용자 입력,
네트워크 요청, DB 쿼리, 인증/세션 로직 어디에도 닿지 않는다. 그래서 OWASP Top 10 급 공격 표면
(인젝션·인증우회·평문전송 등)이 원천적으로 존재하지 않는다.

### 발견사항

- **[INFO]** 정규식 backtracking 특성 — 이론적 검토만, 실질 위험 없음
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:83` (`stripLiterals`),
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:135`
    (`WIDENED_DECL`)
  - 상세: 두 정규식 모두 `(?:[^X]|\X...)* ` 형태의 "괄호/구분자로 시작하는 대안 vs 그 외 문자"
    분기다. 분기가 **prefix-disjoint**(한쪽은 구분자로 시작 불가, 다른 쪽은 구분자로 시작 필수)라
    전형적인 `(a+)+` 류 catastrophic backtracking 조건(모호한 중첩 분할)은 성립하지 않는다.
    다만 이 저장소는 과거 `MULTILINE+\s` 조합에서 실측으로 이차 시간 복잡도가 드러난 이력이 있어
    (`feedback_static_shape_judgement_vs_benchmark`), 정적 형태 판단만으로 완전히 안전하다고
    단정하지는 않는다. 그러나 입력이 **신뢰된 저장소 소스 파일**(공격자가 값을 주입할 경로가
    없음)이라 설령 다항 시간이더라도 실질적 DoS 벡터가 아니다 — 익스플로잇하려면 이미 저장소
    쓰기 권한(커밋 권한)이 있어야 하고, 그 경우 이 스캐너를 우회하는 것보다 훨씬 쉬운 공격
    경로가 이미 열려 있다.
  - 제안: 별도 조치 불필요. 다만 대상 파일 크기가 앞으로 크게 늘어난다면(예: 자동 생성된 초대형
    `.ts` 파일이 스캔 루트에 포함되는 경우) 벤치마크로 재확인을 권장.

- **[INFO]** `masked-reject-callers-guard.ts` 의 스캔 범위가 `.d.ts` 를 항상 제외하도록 변경됨 —
  보안 가드의 커버리지 축소 가능성, 단 오늘은 무해함이 실측으로 확인됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:48-52`
    (`listSourceFiles`), `codebase/backend/src/common/__test-utils__/source-scan.ts:261-263`
    (`collectTsFiles` 의 `!entry.name.endsWith('.d.ts')` 조건)
  - 상세: 리팩터 전 `listSourceFiles` 는 `entry.name.endsWith('.ts')` 만 봐서 `.d.ts` 도 스캔
    대상에 포함했다. 리팩터 후 공용 `collectTsFiles` 는 `.d.ts` 를 **항상** 제외한다. 이
    가드는 `resolveTriggerParameters`(마스킹 우회 위험이 있는 base 함수) 직접 호출자를 화이트
    리스트로 제한하는 **보안 관련 가드**이므로, 스캔 대상이 좁아지면 이론적으로 탐지 사각지대가
    생길 수 있다. 다만 `.d.ts` 는 타입 선언만 담고 실행 코드가 없어 애초에 함수 호출부가 존재할
    수 없고, plan 문서(`plan/in-progress/entity-nullable-column-type-mismatch.md:238-239`)가
    "`src` 하위 `.d.ts` **0개**" 를 실측으로 명시해 오늘은 동작 불변이 확인됐다.
  - 제안: 이미 문서화된 의도적 결정이라 추가 조치는 불요. 다음 사람이 `src/` 에 `.d.ts` 를
    추가하는 시나리오가 생기면(예: 서드파티 타입 오버라이드) 이 가드의 커버리지 가정이 재검토
    대상이라는 점만 인지하면 된다.

- **[INFO]** `stripComments` → `stripLiterals` 순서로 인한 기존 blind spot 이 신설 술어에도 상속됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:182`
    (`findStaleSpecCasts` 의 `stripLiterals(stripComments(...))` 호출 순서)
  - 상세: `stripComments` 는 문자열 리터럴 내부의 `//` 도 주석으로 보고 잘라내는 기존
    한계가 있다(코드 자체 docstring 이 이미 명시). `findStaleSpecCasts` 도 이 순서를 그대로
    상속하므로, `URL 문자열과 같은 줄에 낡은 캐스트가 있는 경우` 이론적으로 캐스트가 잘려
    검출을 놓칠 수 있다. 그러나 이 가드는 "코드 품질/타입 정합성" 판정용이지 인증/인가·
    민감정보 마스킹을 지키는 보안 가드가 아니고, 우회하려면 이미 커밋 권한이 필요하며 방향도
    "과탐지 아닌 저탐지"(놓치는 방향)라 조용히 fail-open 되는 정도지 공격 표면을 만들지 않는다.
  - 제안: 기존에 이미 문서화된 한계와 동일 계열이라 이번 diff 만의 결함은 아님. 참고로만 남김.

### 확인한 항목 (특이사항 없음)

- **인젝션**: SQL/명령/경로 인젝션 표면 없음. 모든 파일 접근(`fs.readdirSync`/`fs.readFileSync`)의
  루트 인자는 하드코딩 상수(`MODULES_DIR`, `ENGINE_DIR`, `SRC_ROOT` 등)이며 외부 입력을 받지 않음.
- **하드코딩된 시크릿**: 없음. 테스트 픽스처 문자열(`'UPDATE t SET x = 1 ...'` 등)은 합성 SQL/코드
  샘플일 뿐 실제 자격증명이 아님.
- **인증/인가**: 해당 코드 경로 없음(런타임 인증 로직 미접촉). `masked-reject-callers-guard.ts` 는
  보안 관련 정적 가드이나 이번 diff 는 그 판정 로직(`importsBaseFn`)을 건드리지 않고 파일 수집
  방식만 공용화했다.
- **입력 검증**: N/A — 사용자 입력을 받는 표면이 없음.
- **암호화**: N/A.
- **에러 처리**: `readCatalogComponents` 가 파싱 실패 시 파일 내용 일부를 에러 메시지에 포함하지만,
  이는 저장소 자체 문서(`spec/5-system/_product-overview.md`)의 한 줄일 뿐이고 CI 로그로만
  노출되므로 민감정보 유출이 아님.
- **의존성 보안**: 신규 의존성 없음. `typescript` 는 기존 direct dependency(5.9.3) 재사용.

## 요약

이번 diff 는 프로덕션 런타임 코드가 아니라 CI/테스트 단계에서만 실행되는 **저장소 내부 정적 분석
도구**(중복 디렉터리 워커 통합 + 신규 spec 캐스트 잔재 탐지 가드)와 plan 문서 갱신으로 구성돼 있다.
사용자 입력·네트워크·DB·인증 경로 어디와도 접촉하지 않아 인젝션·인증우회·평문전송 등 전통적 보안
취약점 표면이 존재하지 않는다. 유일하게 언급할 만한 점은 (1) 신·구 정규식이 이론적으로 backtracking
비용을 가지나 입력이 신뢰된 저장소 소스라 실질 위험이 없고, (2) 보안 관련 가드
(`masked-reject-callers-guard.ts`)의 스캔 범위가 `.d.ts` 제외로 좁아졌지만 오늘 저장소에는 영향이
없음이 실측으로 확인돼 있다는 것뿐이다. 두 항목 모두 CRITICAL/WARNING 이 아닌 INFO 로 기록한다.

## 위험도

NONE
