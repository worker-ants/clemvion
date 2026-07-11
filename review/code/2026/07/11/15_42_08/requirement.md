# 요구사항(Requirement) 리뷰 — spec-links.ts DEAD/ANCHOR 스캔 코어 파라미터화

## 검토 방법
- diff 대상: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`findBrokenLinks` 와 `findBrokenSpecLinksInSources` 의 ~40줄 중복 루프를 공유 코어 `findBrokenLinksInFiles(files, options)` 로 추출하는 순수 리팩터, 커밋 829ddceee).
- `git show HEAD~1:.../spec-links.ts` 로 리팩터 이전 원본을 복원해 각 분기(same-file `#anchor`, `isExternal` 체크 순서, `pathPart`/`targetFilter` 필터, DEAD 판정, `.md` 종단 시 ANCHOR 판정, 정렬)를 라인 단위로 대조 — 두 원본 함수 각각의 동작이 `checkSelfAnchors`/`targetFilter` 옵션 조합으로 정확히 재현됨을 확인.
- 실제 리포지토리(spec/**.md 100+개, codebase 소스 100+개) 대상으로 `npx vitest run spec-link-integrity.test.ts spec-area-index.test.ts` 실행 → 38 tests 전부 green (커밋 메시지의 "13 tests 동일 green" 주장과 정합, 현재는 spec-area-index 포함 38개로 확장돼 있음).
- `npx tsc --noEmit -p .` 클린 (타입 에러 없음).

## 발견사항

- **[INFO]** 순수 동작-불변 리팩터로 확인됨 — 신규 비즈니스 로직/요구사항 없음.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:386-457` (`findBrokenLinksInFiles`), `:466-470` (`findBrokenLinks`), `:528-533` (`findBrokenSpecLinksInSources`)
  - 상세: 두 공개 함수의 시그니처(`(root: string): LinkViolation[]`)는 변경되지 않았고, 소비처(`spec-link-integrity.test.ts`)의 import 도 그대로 유효. `LinkScanOptions.checkSelfAnchors`(필수 boolean, 기본값 없음)와 `targetFilter`(optional)는 두 호출부에서 각각 명시적으로 `{checkSelfAnchors: true}` / `{checkSelfAnchors: false, targetFilter: ...}` 로 전달돼 원본의 두 갈래 동작을 정확히 재현한다. 특히 원본 `findBrokenSpecLinksInSources` 는 `target.startsWith("#") || isExternal(target)` 를 한 줄로 결합해 self-anchor 를 완전히 건너뛰었는데, 새 공유 코어는 이를 `if (target.startsWith("#")) { if (!options.checkSelfAnchors) continue; ... }` 로 분해했음에도 `checkSelfAnchors: false` 일 때 동일하게 조기 `continue` 하므로 관찰 가능한 차이가 없다. anchor 검증 시 `.md` 종단 가드(`resolved.toLowerCase().endsWith(".md")`)는 codebase-sources 경로에서 원본엔 없었지만 `targetFilter`(`SPEC_MD_TARGET_RE = /(^|\/)spec\/.+\.md$/`)가 이미 `.md` 종단을 강제하므로 항상 참 — 동작 차이 없음.
  - 제안: 없음 (변경 불필요). 실측 테스트(38/38 green, 실 리포지토리 스캔이라 vacuous 아님)와 정적 대조 모두 등가성을 뒷받침.

- **[INFO]** TODO/FIXME/HACK/XXX 주석, 미완성 표식 없음. 반환값 누락 경로 없음(모든 코드 경로가 `LinkViolation[]` 반환 또는 명시적 `continue`).

- **[INFO]** spec fidelity: 이 파일은 `spec/conventions/spec-impl-evidence.md` §4.2 에서 "evidence" 파일로 참조되며(같은 문서 :12, :15, :128 라인), 해당 spec 서술("소스 스캔은 spec/**.md 를 가리키는 링크만(비-spec 상대링크 제외) + build 출력 제외", ":128")은 이번 리팩터 후에도 `SPEC_MD_TARGET_RE`/`CODEBASE_SKIP_DIRS` 를 통해 그대로 유지된다. spec 문서는 내부 헬퍼 함수 시그니처(`LinkScanOptions` 등)까지 규정하지 않는 요약 수준 서술이라 line-level 대조 대상은 두 공개 함수의 행위(DEAD/ANCHOR 판정, 제외 범위)뿐이며 모두 일치. SPEC-DRIFT 아님 — 리팩터가 spec 서술 범위를 벗어나지 않음.

## 요약
`findBrokenLinks`(spec/**)와 `findBrokenSpecLinksInSources`(codebase 소스)의 중복 DEAD/ANCHOR 스캔 루프를 `findBrokenLinksInFiles(files, options)` 공유 코어로 추출한 순수 리팩터다. 원본과의 라인 단위 대조 결과 `checkSelfAnchors`/`targetFilter` 옵션이 두 원본 함수의 분기(동일-파일 앵커 스킵 여부, 대상 필터, `.md` 종단 가드)를 정확히 재현하며, 공개 API 시그니처·기존 소비처(vitest 스펙)·spec-impl-evidence.md §4.2 서술 모두 변경 없이 정합한다. 실제 리포지토리 스캔(spec/**.md 100+, codebase 소스 100+) 기반 38개 vitest 케이스가 전부 green 이고 tsc 도 클린해 동작 등가성이 정적 분석과 실행 양쪽에서 확인됨. TODO/FIXME 등 미완성 표식이나 반환값 누락, 에러 처리 공백은 발견되지 않았다.

## 위험도
NONE
