# 부작용(Side Effect) 리뷰 — masked-marker-contract

## 발견사항

- **[INFO]** `pnpm-lock.yaml` 에 이 PR 의도(마커 SoT 패키지 추출)와 무관한 `eslint-config-next` peer-dep 해석 트리 재정렬이 섞여 들어갔다
  - 위치: `pnpm-lock.yaml` — hunk `@@ -16220,33 +16253,13 @@`(예: `eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0(...))` 형태로 괄호 체인 재구성) 부근. 소스 라인 게이트가 없는(전량 삭제/재구성) 구간이라 정확한 파일 줄 번호 대신 hunk 헤더로 기재.
  - 상세: `@workflow/masked-markers` 워크스페이스 패키지 신설 후 `pnpm install` 을 재실행하며 lockfile 이 갱신됐는데, 그 과정에서 `eslint-config-next@16.3.0` 의 peer-dep 해석 체인(및 그 하위 `eslint-import-resolver-typescript`/`eslint-module-utils`/`eslint-plugin-import`)이 버전은 그대로이면서 괄호 표기 구조만 재구성됐다. `git log --oneline -- pnpm-lock.yaml` 로 확인한 직전 이력(`998210c86 build(deps-dev): Bump eslint-config-next...`)과 이번 커밋 사이에 실제 버전 변경은 없어 기능적 위험은 낮지만, "마커 패키지 추가"라는 커밋 의도와 무관한 lockfile diff 가 같은 커밋에 묻어갔다 — 리뷰 시 diff 노이즈로 실제 관련 변경(신규 workspace 항목)을 가리기 쉽다.
  - 제안: 특별한 조치는 불필요(버전 불변·`pnpm install` 의 정상 재해석 결과로 보임). 다만 향후 유사 PR 에서 lockfile diff 크기가 예상보다 크면 "의도한 패키지 추가분"과 "무관한 재정렬분"을 분리해 확인하는 습관을 남겨둔다.

- **[INFO]** 프런트 `MASKED_MARKERS` 의 타입이 `ReadonlySet<string>` 에서 `readonly string[]` 로 바뀌었다 (구조 변경이지 결함은 아님, 확인 결과 현재 소비처는 영향 없음)
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:56` (`export { isMaskedMarker, MASKED_MARKERS };` — 패키지 재export)
  - 상세: 이전에는 `export const MASKED_MARKERS: ReadonlySet<string> = new Set([...])` 로 `Set` 이었으나, 이제 `@workflow/masked-markers` 의 `readonly string[]` (`Object.freeze([...])`) 를 그대로 재export 한다. `MASKED_MARKERS.has(x)` 를 쓰는 소비처가 있었다면 컴파일 타임에 깨졌을 것이나, `grep -rn "MASKED_MARKERS" codebase/frontend/src` 로 전수 확인한 결과 현재 소비처(`dynamic-form-ui.test.tsx`, `lib/utils/__tests__/masked-markers.test.ts`) 는 전부 `[...MASKED_MARKERS]` 스프레드만 사용해 `Set`/배열 양쪽에서 동일하게 동작한다. 즉 이번 diff 안에서는 실제 파손이 없다.
  - 제안: 조치 불필요. 다만 이 파일이 `@/lib/utils/masked-markers` 라는 안정적 import 경로를 유지하는 것이 이 리팩터의 명시 목적이므로, `MASKED_MARKERS` 의 **타입**이 `Set`→배열로 바뀐 사실은 이 모듈을 새로 소비할 코드에 대해 암묵적 계약 변화로 남는다 — JSDoc 에 "이제 배열이다" 를 한 줄 남기면 향후 `.has()` 호출 시도를 컴파일 에러 이상으로 더 빨리 설명해줄 수 있다(선택 사항).

- **[INFO]** 신규 `masked-marker-mirror.test.ts` 의 캐너리 테스트가 `os.tmpdir()` 밑에 임시 디렉터리를 만들고 파일을 쓴다 — 정상적으로 격리·정리됨(문제 아님, 확인 기록)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts` (함수: `it("[캐너리] 실제 재선언을 지목한다 (합성 fixture)", ...)`)
  - 상세: `fs.mkdtempSync` → `fs.writeFileSync` → 단언 → `finally { fs.rmSync(tmp, { recursive: true, force: true }) }` 구조로, 단언이 실패해도 `finally` 가 실행되어 임시 파일이 남지 않는다. 저장소 소스 트리 밖(OS 임시 디렉터리)에서만 쓰고 지우므로 실제 파일시스템 부작용은 없다.
  - 제안: 없음(정상 패턴 확인용 기록).

## 요약

이번 변경은 backend `sanitize-error-message.ts` 와 frontend `lib/utils/masked-markers.ts` 에 손으로 복제돼 있던 마스킹 마커 상수·판정 함수·깊이 상한을 `@workflow/masked-markers` 공유 패키지로 추출하고, 두 소비처는 **이름을 그대로 유지한 채 재export**하는 방식으로 배선했다. 기존 함수 시그니처(`isMaskedMarker(v: unknown): boolean`)·값(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`/`10`)은 전부 동일해 `interaction.service.ts`·`reject-masked-resubmission.ts`·`websocket.service.ts`·`thread-renderer.ts` 등 기존 backend 소비처와 `dynamic-form-ui` 등 frontend 소비처 모두 재컴파일 외에 영향이 없다. CI 배선(`test-stages.sh` INTERNAL_PACKAGES, `packages-checks.yml` 의 `pathspecs`/matrix/주석 개수(5→6), 두 Dockerfile 의 COPY, `pnpm-lock.yaml` workspace 항목)도 서로 정합함을 직접 대조해 확인했다. 유의미한 위험은 발견되지 않았고, 위 INFO 두 건(무관 lockfile 재정렬 동반, `Set`→배열 타입 변화)은 실제 파손 없이 기록 목적으로만 남긴다.

## 위험도
LOW
