# 문서화(Documentation) 리뷰

대상: `typescript-toolchain-followups` §1(`_shared.ts` 분리) · §2(`validateWorkspacePatterns` 분리) 구현 + 관련 plan 문서 갱신.

## 발견사항

- **[WARNING]** 리팩터 후 남은 주석이 실제 import·사용과 모순된다 — "그 둘은 `_shared` 에서만 쓴다"
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:47`
  - 상세: 이관 근거 주석이 "원래 이 모듈의 비공개 헬퍼였던 `blockRange`/`findKeyLine` 까지 끌어올리면 없던 공개 표면을 새로 만드는 셈이다 … 그 둘은 `_shared` 에서만 쓴다"(gate 44-47)라고 적는다. 그러나 바로 위 import 문(gate 32-39)에서 이 파일이 `_shared.ts` 로부터 `blockRange`·`findKeyLine` 을 직접 import 하고, 같은 파일의 `blockScalarAtPath` 함수(전체 파일 컨텍스트 기준 라인 245·247·249·254)가 그 둘을 실제로 호출한다. 즉 "`_shared` 에서만 쓴다"는 문장은 이 파일 자신의 사용을 빠뜨린 채 반증된다. 파일 최상단 헤더(gate 8-9, "YAML 서브셋 파서와 루트 탐색은 여기 없다 … 아래 import 지점의 주석이 그 경계를 설명한다")도 같은 근거를 가리키고 있어 오류가 두 지점에서 반복 참조된다.
  - 이 PR 전체의 취지가 "무관한 export 표면에 매달리면 형제 리팩터에 조용히 깨진다"는 드리프트 방지인데, 정작 이 주석 자체가 이관 직후 코드-주석 drift 예시가 됐다는 점에서 지적할 가치가 있다. 실제 동작에는 영향 없음(코드는 정상 동작) — 순수 문서 정확성 문제.
  - 제안: "그 둘은 `_shared` 에서만 쓴다" → "그 둘은 `_shared` 의 `listAtPath` 와 본 파일의 `blockScalarAtPath` 에서만 쓴다(두 가드 공개 표면에는 안 올린다)" 식으로 실제 소비처를 정확히 반영.

- **[INFO]** "그 셋" 지시어가 앞 문장에서 완전히 나열되지 않음
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:11`
  - 상세: gate 7-9 는 "워크스페이스 루트 탐색(`ROOT`)과 YAML 서브셋 리스트 추출(`listAtPath`)" 두 가지만 이름으로 언급한 뒤, 바로 다음 문단(gate 11)에서 "종전에는 그 셋을 형제 가드에서 가져왔다"라고 한다. 실제 import(gate 19: `ROOT, listAtPath, type PackageManifest`)는 셋이 맞지만, 앞 문장에 `PackageManifest` 가 이름으로 나오지 않아 "그 셋"이 무엇을 가리키는지 import 문을 따로 봐야 알 수 있다.
  - 제안: 앞 문장에 "…그리고 `PackageManifest` 타입"을 추가해 "그 셋" 참조를 자기완결적으로 만든다.

- **[INFO]** JSDoc 블록과 함수 선언 사이에 별도 plain 주석 블록 삽입
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts:203` (전체 파일 컨텍스트 기준 197-207 구간, `loadTypescriptFrom`)
  - 상세: 기존 `/** … */` JSDoc(가drop 197-202, 변경 없음) 바로 아래에 이번 diff 가 반환 타입 변경 근거를 설명하는 새 `//` 블록(gate 203-206)을 끼워 넣었다. 내용 자체는 정확하고 유용하지만, JSDoc 과 함수 선언 사이에 별도 comment block 이 끼는 형태라 IDE hover/TypeDoc 같은 JSDoc 툴링이 어느 쪽을 "그 함수의 문서"로 표시할지 일관되지 않을 수 있다.
  - 제안: 급하지 않음 — 다음에 이 함수를 만질 때 이 설명을 JSDoc 본문에 병합(`@remarks` 또는 새 문단)하는 편이 툴링 일관성 면에서 낫다.

## 요약

이번 변경은 문서화 관점에서 전반적으로 우수하다. 새 파일 `_shared.ts` 는 이관 배경·범위 기준·존재 이유를 모듈 헤더에 명확히 남겼고, `internal-package-registration-guard.ts`/`typescript-toolchain-guard.ts` 양쪽 헤더도 상호 참조를 갱신했다. `missingCompilerApi` JSDoc 의 모호한 "이 경로" 지시어를 명확한 서술로 고친 것, `validateWorkspacePatterns` 분리 근거와 mutation 실측을 JSDoc·테스트 주석에 남긴 것, plan 문서(`typescript-toolchain-followups.md`)가 실측 결과·미착수 사유·체크리스트를 동시에 갱신한 것 모두 이 저장소의 "문서-코드 정합" 규약을 잘 따른다. 다만 §1 이관 직후 `internal-package-registration-guard.ts` 의 재export 근거 주석("그 둘은 `_shared` 에서만 쓴다")이 같은 파일 내 실제 import·사용과 모순되는 점은 이 PR 이 방지하려는 바로 그 종류의 drift 예시라 정정이 필요하다. README/API 문서/CHANGELOG 갱신은 불필요(내부 테스트 전용 순수 리팩터, `spec_impact: none`과 일치).

## 위험도

LOW
