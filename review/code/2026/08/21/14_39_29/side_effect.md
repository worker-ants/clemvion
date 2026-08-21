STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — masked-marker-contract-7d2e14 (라운드 9, 14_39_29)

## 검토 범위 및 방법

이 PR 은 9라운드째 리뷰를 거치는 중이며, 이전 side_effect 라운드(`11_27_29`, `13_55_59`)가
이미 이 변경의 부작용 표면을 상세히 검토해 INFO 3건(무관한 `pnpm-lock.yaml` peer-dep 재정렬 ·
프런트 `MASKED_MARKERS` 타입이 `ReadonlySet<string>` → `readonly string[]` 로 바뀐 것 ·
repo-guard 캐너리의 `os.tmpdir()` 임시파일 사용)만 남기고 Critical/Warning 0 으로 수렴시켰다.
이번 라운드는 그 판정을 재확인하지 않고 그대로 믿는 대신, 현재 저장소 상태를 직접 `Read`/
`Bash`(grep, git diff)로 다시 열어 아래를 재검증했다.

- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전문
- `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전문 (backend 쌍둥이와 대조)
- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` 전문
- `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts` 전문
- `git diff origin/main...HEAD -- codebase/backend/src/shared/utils/sanitize-error-message.ts codebase/frontend/src/lib/utils/masked-markers.ts` 실측
- `grep -rln "MASKED_MARKERS" codebase/frontend/src codebase/backend/src` 로 전체 소비처 재확인

## 발견사항

없음 (Critical/Warning 0건). 아래는 확인 기록(INFO)이다.

- **[INFO]** 프런트 `MASKED_MARKERS` 의 런타임 타입이 `ReadonlySet<string>` → `readonly string[]` 로 바뀐 것은 이번에도 파손 없음을 재확인
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:56` (`export { isMaskedMarker, MASKED_MARKERS };` — `@workflow/masked-markers` 재export)
  - 상세: `grep -rln "MASKED_MARKERS" codebase/frontend/src codebase/backend/src` 로 전체 소비처를 다시 나열한 결과 정의 파일(`masked-markers.ts`/`sanitize-error-message.ts`) 외에는 `dynamic-form-ui.test.tsx`·`masked-markers.test.ts`·`masked-marker-mirror.test.ts`·`sanitize-error-message.spec.ts`·`masked-marker-mirror.spec.ts` 뿐이고, `dynamic-form-ui.test.tsx:601` 은 `const MARKERS = [...MASKED_MARKERS];` 로 스프레드만 사용해 `Set`/배열 양쪽에서 동일하게 동작한다. `.has(` 형태의 소비처는 여전히 0건이다. `isMaskedMarker` 시그니처(`(v: unknown): boolean`)와 판정 로직(`typeof v === "string" && MASKED_MARKERS.includes(v)`)도 이전 라운드와 동일하게 유지돼 있다.
  - 제안: 조치 불요.

- **[INFO]** repo-guard 가드 두 쌍(backend/frontend) 모두 `fs.mkdtempSync(os.tmpdir())` 로 임시 디렉터리를 만들어 쓰는 캐너리 테스트가 있으나, 저장소 소스 트리 밖에서 `try/finally` 로 정리돼 실제 파일시스템 부작용이 없음을 재확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:94-165` (두 개 `it`, `fs.mkdtempSync`→`fs.writeFileSync`→단언→`finally { fs.rmSync(tmp, { recursive: true, force: true }) }`) 및 동일 구조의 `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts:109-172`.
  - 상세: 두 파일 모두 `finally` 블록에서 무조건 `fs.rmSync` 를 호출하므로 단언 실패 시에도 임시 파일이 남지 않는다. `resolveScanDirs`/`listSourceFiles`/`findMirrorRedeclarations` 자체는 저장소를 **읽기만** 하고(`fs.existsSync`/`fs.readdirSync`/`fs.readFileSync`), 어떤 코드 경로도 저장소 소스 트리에 쓰거나 지우지 않는다.
  - 제안: 조치 불요.

- **[INFO]** backend `sanitize-error-message.ts` 의 모듈 레벨 `DEEP_REDACT_CACHE`(`WeakMap`)는 이번 diff 의 변경 대상이 아님을 `git diff` 로 확인
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:202` (`const DEEP_REDACT_CACHE = new WeakMap<object, unknown>();`)
  - 상세: `git diff origin/main...HEAD -- codebase/backend/src/shared/utils/sanitize-error-message.ts` 로 확인한 실제 변경분은 (1) `@workflow/masked-markers` import 추가, (2) `MAX_REDACT_DEPTH`/`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS`/`isMaskedMarker` 를 로컬 선언에서 재export 로 전환, (3) JSDoc 문구 정정뿐이다. `DEEP_REDACT_CACHE`·`deepRedactSecrets`·`deepRedactSecretsPreserving`·`deepRedactCore`·`redactSecrets`·`redactSecretsInJsonString`·`sanitizeLastErrorMessage` 의 로직·시그니처는 diff 밖(무변경)이며, 이번 리팩터가 새로 만든 공유 상태가 아니다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 backend `sanitize-error-message.ts` 와 frontend `lib/utils/masked-markers.ts` 에 손으로 복제돼 있던 마스킹 마커 상수·판정 함수·깊이 상한을 `@workflow/masked-markers` 공유 패키지로 추출하고, 두 소비처는 **이름과 시그니처를 그대로 유지한 채 재export** 로 배선한다. `isMaskedMarker(v: unknown): boolean` 등 기존 공개 함수 시그니처는 diff 전후로 동일해 `interaction.service.ts`·`reject-masked-resubmission.ts`·`dynamic-form-ui.tsx` 등 기존 소비처에 재컴파일 이상의 영향이 없다. 신설된 backend/frontend 미러 재발 가드(`masked-marker-mirror-guard.ts`/`.spec.ts`/`.test.ts`)는 저장소를 읽기만 하며, 유일한 파일시스템 쓰기(캐너리의 `os.tmpdir()` 임시 fixture)는 `try/finally` 로 완전히 정리돼 실제 부작용이 없다. 전역 상태·환경 변수 읽기/쓰기·네트워크 호출·이벤트/콜백 배선 변경은 이 diff 어디에도 없다. CI/Docker/package.json 8곳의 신규 내부 패키지 등록은 전부 기계적 한 줄 추가로 부작용 관점에서 중립이다. 이전 8개 라운드(`11_27_29`~`14_19_12`)가 반복해 지적·수정한 실질 결함은 전부 architecture/maintainability/testing/documentation 관점이었고 side_effect 관점에서는 라운드 1(`11_27_29`)의 INFO 3건 외에 새로 발견된 것이 없다 — 이번 라운드도 그 수렴을 재확인했을 뿐 새 발견은 없다.

## 위험도
NONE
