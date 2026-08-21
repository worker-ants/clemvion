# 부작용(Side Effect) Review — masked-marker-contract-7d2e14

## 발견사항

- **[INFO]** frontend `MASKED_MARKERS` 의 공개 타입이 `ReadonlySet<string>` → `readonly string[]` 로 바뀌었다 (Set 고유 메서드 소비자에 대한 잠재적 인터페이스 파손)
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:22-26` (`import { isMaskedMarker, MASKED_MARKERS, MAX_MASK_DEPTH } from "@workflow/masked-markers";`) 및 `:56` (`export { isMaskedMarker, MASKED_MARKERS };`)
  - 상세: 기존에는 이 파일이 `export const MASKED_MARKERS: ReadonlySet<string> = new Set([...])` 를 직접 선언했으나, 이번 PR 로 `@workflow/masked-markers` 패키지의 `MASKED_MARKERS`(`readonly string[]`, `Object.freeze` 된 배열)를 재export 하는 형태로 바뀌었다. 심볼 이름과 판정 함수(`isMaskedMarker`)의 시그니처·동작은 그대로지만, `MASKED_MARKERS` 자체의 **타입 형태(Set→Array)** 는 실질적으로 변경됐다. `grep` 으로 저장소 전체 소비처(`rerun-modal.tsx`, `dynamic-form-ui.tsx`, `editor-toolbar.tsx`, `dynamic-form-ui.test.tsx`)를 확인한 결과 `MASKED_MARKERS` 를 직접 참조하는 곳은 테스트 파일 한 곳(`[...MASKED_MARKERS]` 스프레드)뿐이고 이는 Set/Array 양쪽에서 동작하므로 **현재는 런타임 파손이 없다.** 다만 `.has()` 같은 Set 전용 메서드를 쓰는 신규/외부 소비자가 생기면 TypeScript 컴파일 시점에 잡히긴 하지만(런타임 조용한 파손은 아님), 문서(JSDoc)에는 이 타입 변경이 명시돼 있지 않다.
  - 제안: 현재 위험은 낮음(컴파일 타임에 걸러짐, 실 소비처 없음) — 조치 불필요. 다만 이 심볼이 "공개 재export 표면" 이라는 점을 감안해 JSDoc 에 "이제 `readonly string[]` 이며 `Set` 이 아니다" 한 줄을 남겨두면 향후 회귀 진단 비용이 줄어든다.

- **[INFO]** 신규 워크스페이스 패키지 추가가 무관한 기존 패키지(`eslint-config-next`)의 pnpm peer-dependency 해석 키를 바꿨다 (lockfile 부수효과)
  - 위치: `pnpm-lock.yaml` (diff 가 프롬프트에서 생략돼 게이트 없음 — `git diff origin/main...HEAD -- pnpm-lock.yaml` 로 직접 확인. `importers` 절의 `codebase/frontend.devDependencies.eslint-config-next.version` 및 `snapshots` 절의 `eslint-config-next@16.3.0(...)` 키)
  - 상세: `@workflow/masked-markers` 를 새 workspace 멤버로 추가한 것만으로 `eslint-config-next` 의 해석 키가 `16.3.0(@typescript-eslint/parser@8.67.0(...))( eslint@...)(typescript@...)` 에서 `16.3.0(eslint@...)(typescript@...)` 로 바뀌었고, 그에 딸린 `eslint-import-resolver-typescript`/`eslint-plugin-import` peer 조합도 함께 재작성됐다. 이는 이 PR 이 의도한 변경이 아니라 pnpm 의 peer dedup 알고리즘이 새 workspace 멤버 추가로 재계산된 결과다 — 실제 설치되는 패키지 버전 자체는 동일해 기능적 회귀 가능성은 낮다.
  - 제안: 이미 직전 리뷰 라운드(`review/code/2026/08/21/11_27_29/RESOLUTION.md` "미조치 INFO")에서 같은 항목이 식별·저위험 판정됐다. 재조치 불필요 — carry-forward 로만 기록.

- **[INFO]** `frontend-checks.yml` 의 트리거 경로가 `codebase/channel-web-chat/**` 로 넓어져, web-chat 전용 PR 도 이제 (더 크고 무관해 보일 수 있는) frontend 잡 전체를 돈다
  - 위치: `.github/workflows/frontend-checks.yml:44-48`
  - 상세: 마커 미러 소멸 가드가 `codebase/*/src` 전체를 훑는 frontend-checks 잡에 있는데, web-chat 전용 워크플로는 `channel-web-chat/**` 만 설치해 이 가드를 못 돌리므로 트리거를 넓혔다는 인라인 근거가 있다. 의도된 CI 이벤트 표면 확장이지만, 부작용 관점에서는 "web-chat 만 바꾼 PR 이 이제 frontend 잡 전체(빌드·타입체크 등)를 추가로 돈다" 는 새로운 부수 실행이 생긴다는 점을 명시해 둔다.
  - 제안: 조치 불필요 — 문서화된 트레이드오프(가드의 fail-closed 커버리지 vs CI 비용).

- **[INFO]** 두 신규 repo-guard 테스트가 `os.tmpdir()` 에 합성 fixture 디렉터리를 생성·삭제한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` (`fs.mkdtempSync`/`fs.writeFileSync`/`fs.rmSync` 사용 테스트 2건) 및 `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts` (동형 테스트 2건)
  - 상세: `findMirrorRedeclarations` 의 실제 탐지 동작을 검증하기 위해 OS 임시 디렉터리 아래 `codebase/backend/src/*.ts`(또는 `codebase/packages/masked-markers-extra/src/*.ts`) 형태의 합성 파일을 만들고 검사한 뒤 `try/finally` 로 확실히 `rmSync` 한다. 저장소 트리 밖(OS tmp) 에서만 쓰고 지우므로 **저장소에 대한 예상치 못한 파일시스템 부작용은 없다.**
  - 제안: 조치 불필요 — 정상적인 격리된 fixture 패턴.

- **[INFO]** backend `sanitize-error-message.ts` 의 공개 상수·함수가 로컬 선언에서 패키지 재export 로 전환 — 이름·타입·값은 보존되지만 모듈 초기화 시점 의존성이 새로 생김
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:10-17`(import), `:128`(`export const MAX_REDACT_DEPTH = MAX_MASK_DEPTH;`), `:130-137`(`export { VALUE_MASK_MARKER, KEY_MASK_MARKER, DEPTH_MASK_MARKER };`), `:167`(`export { MASKED_MARKERS };`), `:176`(`export { isMaskedMarker };`)
  - 상세: 값(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`/`10`)과 함수 시그니처(`isMaskedMarker(v: unknown): boolean`)는 패키지(`codebase/packages/masked-markers/src/index.ts`)와 정확히 일치해 **기존 호출자 관점에서 동작 회귀는 없다.** 다만 이 파일이 이제 `@workflow/masked-markers` 의 성공적 module resolution 에 의존하게 됐다 — egress 마스킹(에러 메시지 sanitize)이라는 hot-path 모듈의 로드가 새 외부 패키지 로드에 묶인다는 점은, 패키지 빌드(`prepare`/`tsc`)가 어떤 이유로든 실패하면 값이 틀리는 게 아니라 **모듈 자체가 로드 실패**하는 방향으로 실패 모드가 바뀌었음을 뜻한다.
  - 제안: 조치 불필요 — 이것이 이 PR 의 의도된 설계(SoT 단일화)이고, `production-build-devdep` 가드·Dockerfile COPY·CI 패키지 체크가 이미 빌드 실패를 별도로 포착한다(RESOLUTION.md 검증 로그 확인).

## 요약

이번 diff 는 backend/frontend 에 손으로 복제돼 있던 마스킹 마커 상수·판정 로직을 `@workflow/masked-markers` 공유 패키지로 추출하고, 양쪽 파일을 재export shim 으로 바꾸는 리팩터다. 값(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`/깊이 상한 `10`)과 함수 시그니처(`isMaskedMarker`)는 정확히 보존돼 기존 호출자에 대한 실질적 동작 회귀는 없으며, 새로 추가된 미러 소멸 가드(backend/frontend 양쪽)는 저장소 트리 밖 OS tmp 디렉터리에서만 파일을 쓰고 `finally` 로 정리해 저장소에 대한 예상치 못한 파일시스템 부작용이 없다. 전역 변수 도입, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다. 실질적으로 짚을 만한 부작용은 네 가지 저위험 항목뿐이다 — (1) frontend `MASKED_MARKERS` 의 타입이 `Set`→`Array` 로 바뀌었으나 현재 소비처 중 Set 전용 메서드를 쓰는 곳이 없어 즉시 파손은 없음(TS 가 향후 오용을 컴파일 타임에 잡음), (2) 새 workspace 패키지 추가가 무관한 `eslint-config-next` 의 pnpm peer 해석 키를 흔들었으나(이미 직전 라운드에서 저위험으로 triage 됨), (3) `frontend-checks.yml` 트리거 확장으로 web-chat 전용 PR 이 이제 frontend 잡 전체를 추가로 도는 CI 비용 증가(의도된 트레이드오프), (4) `sanitize-error-message.ts` 의 모듈 로드가 새 외부 패키지 resolution 에 의존하게 된 실패 모드 변화(값 자체는 불변, 빌드 가드로 별도 방어됨). 넷 다 문서화됐거나 실측으로 무해함이 확인돼 차단 사유가 아니다.

## 위험도
LOW
