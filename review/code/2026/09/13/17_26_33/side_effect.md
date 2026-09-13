# 부작용(Side Effect) 코드 리뷰

## 발견사항

- **[INFO]** 리포지토리 루트 파일 시스템을 넓게 훑는 필터가 이미 좁혀져 있음을 확인 (회귀 없음)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:55-58` (`composeTexts` 산출부)
  - 상세: 이 diff 의 이전 리뷰 라운드(`review/code/2026/09/13/14_41_14` 주석·유지보수성 WARNING#2)에서 `composeTexts` 가 루트의 **모든** `.yml`/`.yaml`(`pnpm-lock.yaml` 784KB 포함)을 읽던 것이 지적됐고, 현재 HEAD 시점 코드는 `/^docker-compose.*\.ya?ml$/` 로 좁혀져 있다. 오늘 매치가 0건이라 무해했다는 기록이 있지만, "구현이 이름보다 넓다"는 클래스의 부작용(예상보다 넓은 파일 읽기 표면)이었던 것이 맞고 지금은 해소된 상태다. 새로운 부작용은 아니며 회귀도 관측되지 않는다.
  - 제안: 조치 불요 — 이미 좁혀진 최종 상태를 확인만 함.

- **[INFO]** 모듈 스코프(top-level)에서 동기 파일시스템 읽기 수행 — 기존 자매 가드와 동일 패턴
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:28-37` (`const root`, `readIfPresent`, `envExampleTexts`), 그리고 `describe` 블록 최상단의 `mdxFiles`/`sourceTexts`/`composeTexts` 산출부
  - 상세: `.env.example`(backend/frontend) 를 vitest 파일 로드(수집) 시점에 즉시 동기 읽기하고, `describe` 블록 진입 시 backend·packages 전체 소스 트리를 `walkTree`+`fs.readFileSync` 로 읽는다. 이는 부작용이라기보다 **읽기 전용** 초기화 비용이며, 삭제된 자매 가드(`guide-error-code-existence.test.ts`)에도 동일한 패턴이 있었다(`git show`로 확인). 새 파일이 프로덕션 런타임 경로가 아니라 vitest 프로세스 내부에서만 실행되므로 앱 상태·전역 변수·타 모듈에 영향이 없다.
  - 제안: 조치 불요.

- **[INFO]** 삭제된 모듈(`guide-error-code-scan.ts`)의 export 를 참조하는 외부 호출자 없음 — 시그니처/인터페이스 변경 영향 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`(삭제) → `guide-identifier-scan.ts`(신규, export 이름도 `scanErrorCodeCitations`→`scanIdentifierCitations`, `collectBackendTokens`→`collectSourceTokens`, `collectEnvDeclarations`/`GUIDE_EXTERNAL_VOCABULARY` 신규 추가)
  - 상세: `grep -rn "guide-error-code" codebase/ --include="*.ts"` 및 `grep -rn "guide-identifier-scan|scanIdentifierCitations|collectSourceTokens|collectEnvDeclarations|GUIDE_EXTERNAL_VOCABULARY" codebase/` 로 확인한 결과, 두 스캐너 모듈 모두 자신의 `*.test.ts` 파일 외에는 어떤 소비자도 없다. 함수 시그니처·export 이름이 전부 바뀌었지만(비호환) 이는 이 PR 이 파일 자체를 리네임/재설계했기 때문이고 깨지는 호출자가 존재하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 신규 exported 함수 `collectEnvDeclarations` 는 순수 함수 — 부작용 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 의 `collectEnvDeclarations` 정의부(342행 부근, `export function collectEnvDeclarations`)
  - 상세: 입력 배열을 순회해 `Set<string>` 을 새로 생성해 반환할 뿐 인자·전역·환경변수를 변경하지 않는다. `scanIdentifierCitations`/`collectSourceTokens` 도 동일하게 순수(no I/O, no mutation of input)하다. `process.env` 는 실제로 읽지 않으며(테스트 픽스처 문자열 리터럴 안에 `"process.env.SOME_FLAG"` 같은 텍스트가 있을 뿐, 실행 코드에서 `process.env` 접근 없음) 네트워크 호출·이벤트·콜백도 없다.
  - 제안: 조치 불요.

- **[INFO]** `guide-sanitized-message-parity.test.ts` 변경은 JSDoc 주석 문구 교체뿐
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16` 부근("자매 `guide-identifier-existence.test.ts`…")
  - 상세: 실행 코드·시그니처·assertion 변경 없음. 순수 문서적 교정.
  - 제안: 조치 불요.

## 요약

이번 변경 세트의 실질 코드 부분(`guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` 삭제, `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 신설, `guide-sanitized-message-parity.test.ts` 주석 1줄)은 전부 vitest 프로세스 내에서만 동작하는 순수·동기·읽기 전용 정적 텍스트 스캐너다. 전역 상태 변경, 새 전역 변수, 파일 생성·수정·삭제, 환경 변수 쓰기, 네트워크 호출, 이벤트/콜백 발생이 전혀 없으며, 유일하게 넓었던 파일시스템 읽기 표면(루트의 모든 `.yml`/`.yaml` 읽기)은 이미 `docker-compose*.ya?ml` 로 좁혀진 상태로 최종 diff 에 반영돼 있다(선행 리뷰 라운드에서 지적·수정됨, `grep` 결과 다른 소비자가 없어 이름·시그니처가 전면 교체돼도 호출자 영향이 없음을 확인). `CHANGELOG.md`/`PROJECT.md`/`plan/**`/`review/**` 변경도 문서·산출물뿐이라 부작용 표면이 없다. 종합적으로 이 diff 는 부작용 관점에서 지적할 CRITICAL/WARNING 이 없다.

## 위험도

NONE
