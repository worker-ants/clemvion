# 보안(Security) Review — masked-marker-contract-7d2e14

## 검토 방법

이번 diff(prompt 상 91개+ 파일, `review/code/**` 하위 5개 선행 라운드 산출물 포함)의 실질 코드
표면은 backend `sanitize-error-message.ts` / frontend `lib/utils/masked-markers.ts` 에 손으로
복제돼 있던 마스킹 마커 상수(`MASKED_MARKERS`/`isMaskedMarker`/`MAX_MASK_DEPTH`)를 신규 공유
패키지 `@workflow/masked-markers` 로 추출하는 리팩터, 그 등록 배선 8곳(CI/Dockerfile/
package.json/lockfile), 미러 재발 방지 repo-guard 2벌(backend/frontend), plan/spec 문서
정정이다. `review/code/2026/08/21/{11_27_29,11_53_49,12_25_15,12_50_37,13_14_29}/**` 는 같은
작업의 선행 리뷰 라운드 산출물(코드 아님)이라 참고만 하고, 실제 소스 파일은 직접 `Read`로
전문을 열어 대조했다:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (전문)
- `codebase/frontend/src/lib/utils/masked-markers.ts` (전문)
- `codebase/packages/masked-markers/src/index.ts` (전문)
- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` + `.spec.ts` (전문)
- `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` + `.test.ts` (전문)
- `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts` (전문, 기존 파일)

추가로 `git diff origin/main...HEAD` 전체를 시크릿 하드코딩 패턴(`api_key=`/`secret:`/
`password=`/`token:` 형태의 리터럴 값)으로 grep 했다.

## 발견사항

없음 — Critical/Warning 급 신규 결함 없음.

- **[INFO]** 선행 라운드(`12_50_37`)에서 지적됐던 미러 소멸 가드의 `SOT_DIR` 경로 접두 경계
  비대칭(backend 만 `=== SOT_DIR || startsWith(SOT_DIR + '/')` 로 고쳐지고 frontend 는 경계
  없는 `startsWith(SOT_DIR)` 그대로 남았던 gap)이 이번 최종 상태에서 **양쪽 모두 동일하게
  수정돼 있음**을 직접 확인했다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:149` —
    `if (relPath === SOT_DIR || relPath.startsWith(\`${SOT_DIR}/\`)) continue;`
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:144,151` —
    `const sotPrefix = SOT_DIR.split(path.sep).join("/");` 및
    `if (relPath === sotPrefix || relPath.startsWith(\`${sotPrefix}/\`)) continue;`
  - 상세: 이 가드는 자격증명 마스킹 마커(`MASKED_MARKERS`)의 손-복제(미러) 재발을 잡는 CI
    회귀 방지 컨트롤이며, 경계 없는 `startsWith`는 `masked-markers-extra` 같은 접두 겹침
    형제 디렉터리를 "SoT 자신"으로 오인해 탐지에서 조용히 제외시키는 fail-open 표면이었다.
    두 스택 모두 `it("[캐너리] SoT 와 접두가 겹치는 형제 패키지는 탐지 대상이다", ...)` 캐너리로
    이 경계를 직접 단언하고 있어(합성 fixture로 `codebase/packages/masked-markers-extra/src/x.ts`
    를 만들어 탐지 확인), 향후 재발 시 테스트가 잡는다. 조치가 필요한 잔여 결함이 아니라
    "고쳤다"는 선행 라운드 서술이 최종 diff에서 실제로 참임을 재확인한 기록.
  - 제안: 없음(확인 완료).

## 점검 관점별 결과

1. **인젝션**: 신규/변경 코드는 정적 repo-guard(파일시스템 스캔 + TypeScript AST 파싱, 경로는
   전부 저장소 내부 고정 상대경로)와 순수 문자열 상수 재배치뿐이다. 사용자 입력을 받는
   런타임 서버/클라이언트 코드 경로는 이번 diff에서 변경되지 않았다. SQL/커맨드/경로 탐색
   인젝션 표면 없음.
2. **하드코딩된 시크릿**: `git diff origin/main...HEAD` 전체를 시크릿 리터럴 패턴으로 grep한
   결과 없음. `pnpm-lock.yaml` 등에도 시크릿성 값 없음.
3. **인증/인가**: 변경 없음. auth 모듈 미변경.
4. **입력 검증**: `hasMaskedMarkerLeaf`/`scanForMarker`(frontend)는 깊이 상한(`MAX_MASK_DEPTH`,
   공유 패키지 SoT)을 그대로 유지하고 값 검사를 깊이 검사보다 먼저 수행하는 순서(off-by-one
   fail-open 방지)도 리팩터 전후 동일하게 보존된다 — 신뢰되지 않는 사용자 JSON(에디터 "Run
   with Input")에 대한 방어가 약화되지 않았다.
5. **OWASP Top 10**: 해당 표면 변경 없음.
6. **암호화**: 해당 없음(마스킹은 암호화가 아니라 표시/재제출 차단용 마커 치환이며, 그 로직·
   정규식(`SECRET_LEAK_PATTERNS`, `CREDENTIAL_KEY_PATTERN`)은 이번 diff에서 문자 그대로
   불변임을 `sanitize-error-message.ts` 전문 대조로 확인했다).
7. **에러 처리**: `sanitizeLastErrorMessage`/`redactSecrets`/`deepRedactSecrets*` 등 에러 메시지
   마스킹 함수 시그니처·동작 불변. 새로 노출되는 에러 메시지 경로 없음.
8. **의존성 보안**: 신규 워크스페이스 패키지 `@workflow/masked-markers`는 런타임 외부 의존
   0개(devDependencies만, 형제 패키지 `ai-end-reason`과 버전 완전 동일)이며 `pnpm-lock.yaml`의
   무관한 `eslint-config-next` peer 재해석은 버전 불변의 lockfile 표현 정리로 위험 없음(선행
   4개 리뷰 라운드와 동일 결론, 이번에도 재확인).

## 요약

이 PR은 backend/frontend에 손으로 복제되던 자격증명 마스킹 마커 상수·판정 로직·깊이 상한을
`@workflow/masked-markers` 공유 패키지로 추출하는 순수 리팩터이며, 마스킹 정규식(`SECRET_LEAK_PATTERNS`)·
자격증명 키 패턴(`CREDENTIAL_KEY_PATTERN`)·값 자체·판정 순서(값 검사 우선)는 이관 전후로 전부
동일함을 전문 대조로 확인했다. 새로 추가된 두 벌의 repo-guard(backend/frontend 미러 소멸
가드)는 정적 분석 CI 도구로 사용자 입력이나 프로덕션 런타임 경로를 다루지 않으며, 선행 5개
리뷰 라운드에서 반복 발견·수정된 이 가드 자체의 결함(경로 게이팅 사각지대, 감시 목록 자체가
미러, 스캔 파생 누락, 경로 접두 겹침 비대칭)은 이번 최종 상태에서 모두 해소되어 있음을 직접
소스 대조로 재확인했다. 하드코딩된 시크릿, 인젝션, 인증/인가 우회, 안전하지 않은 암호화, 민감
정보 에러 노출 등 신규 표면은 발견되지 않았다.

## 위험도
NONE
