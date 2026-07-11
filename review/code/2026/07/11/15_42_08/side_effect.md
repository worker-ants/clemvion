# 부작용(Side Effect) 리뷰 — codebase/frontend/src/lib/docs/__tests__/spec-links.ts

## 발견사항

- **[INFO]** 순수 리팩터링 — 동작 동치성 확인됨
  - 위치: `findBrokenLinksInFiles` (신규, line 385-456) + 두 export 진입점 `findBrokenLinks`(465), `findBrokenSpecLinksInSources`(527)
  - 상세: `git show 829ddceee~1`(리팩터 이전본)과 대조한 결과, 두 함수의 중복 스캔 루프를 `LinkScanOptions`(`checkSelfAnchors`, `targetFilter`)로 파라미터화한 것 외 로직 변경이 없다.
    - `findBrokenLinks`: 기존에도 same-file `#anchor` 를 자기 heading 대비 검증 + 끝에 `violations.sort(...)` 호출 — 신규 `checkSelfAnchors: true` 경로와 100% 동일.
    - `findBrokenSpecLinksInSources`: 기존 `if (target.startsWith("#") || isExternal(target)) continue;` 로 same-file anchor 를 **무조건 스킵** — 신규 `checkSelfAnchors: false` 경로에서 `if (target.startsWith("#")) { if (!options.checkSelfAnchors) continue; ... }` 로 동일하게 스킵. `pathPart === "" || !SPEC_MD_TARGET_RE.test(pathPart)` 단일 조건도 `pathPart === ""` → `targetFilter` 순차 체크로 분리됐을 뿐 결과는 동일.
  - 검증: `npx vitest run spec-link-integrity.test.ts spec-area-index.test.ts` 38/38 통과 (fixture 기반 DEAD/ANCHOR/self-anchor/targetFilter 케이스 포함).
  - 결론: 부작용 없음.

- **[INFO]** `slugCache` 스코프 — 여전히 함수-로컬, 모듈 전역 아님
  - 위치: line 390 (`findBrokenLinksInFiles` 내부 `const slugCache = new Map(...)`)
  - 상세: 리팩터 전에도 각 export 함수 호출마다 새 `Map`을 생성했고, 리팩터 후에도 `findBrokenLinksInFiles` 호출마다(즉 `findBrokenLinks`/`findBrokenSpecLinksInSources` 각 호출마다) 새 `Map`이 생성된다. 두 함수 호출 간 캐시 공유·누수 없음. 모듈 레벨 mutable state 도입 없음.

- **[INFO]** 공개 API 시그니처 무변경, 신규 helper 는 unexported
  - 위치: line 385 `function findBrokenLinksInFiles(...)` — `export` 키워드 없음.
  - 상세: `grep` 결과 이 파일을 import 하는 곳은 `spec-link-integrity.test.ts`, `spec-area-index.test.ts` 두 테스트 파일뿐이며, 둘 다 `findBrokenLinks(root)` / `findBrokenSpecLinksInSources(root)` / `collectSpecMarkdown(root)` / `collectCodebaseSources(root)` 시그니처를 그대로 사용 — 전부 unchanged. 신규 `LinkScanOptions` 인터페이스와 `findBrokenLinksInFiles` 함수는 module-private이라 외부 호출자에게 노출되지 않음. 인터페이스/시그니처 파급 없음.

- **[INFO]** 파일시스템·환경변수·네트워크·이벤트 부작용 없음
  - 상세: 변경 전후 모두 `fs.readFileSync`/`fs.existsSync`/`fs.readdirSync` 읽기 전용 호출만 존재(리팩터로 신규 추가된 fs 호출 없음). `process.env` 접근 없음. 네트워크 호출 없음. 이 파일은 CI 가드용 테스트 헬퍼(`__tests__/`)이며 프로덕션 런타임 코드 경로가 아니므로 런타임 부작용 범위가 애초에 로컬 프로세스 내 파일 스캔으로 한정됨.

## 요약

`findBrokenLinks`와 `findBrokenSpecLinksInSources`의 중복 스캔 루프를 `findBrokenLinksInFiles` + `LinkScanOptions`로 통합한 순수 내부 리팩터링이다. 두 옵션 플래그(`checkSelfAnchors`, `targetFilter`)의 동작을 리팩터 이전 버전과 라인 단위로 대조한 결과 완전히 동치이며, 신규 helper 함수는 export 되지 않아 외부 호출자 영향이 없고, 기존 공개 함수 4종(`findBrokenLinks`, `findBrokenSpecLinksInSources`, `collectSpecMarkdown`, `collectCodebaseSources`)의 시그니처도 그대로다. `slugCache`는 여전히 호출마다 새로 생성되는 함수-로컬 상태로 모듈 전역화되지 않았다. fs 읽기 전용 호출 외 파일시스템/환경변수/네트워크/이벤트 부작용은 도입되지 않았으며, 관련 vitest 스위트 38개가 전부 통과해 행동 동치성이 실측으로 확인된다.

## 위험도

NONE
