# Convention Compliance Report

**검토 모드**: --impl-done  
**Target spec**: `spec/2-navigation/4-integration.md`  
**Diff base**: origin/main  
**Context**: Pure mechanical refactor — `DangerTab` extracted verbatim from `page.tsx` into new sibling `danger-tab.tsx` to comply with Next.js App Router rule (page.tsx may only export the default Page component).

---

## 발견사항

발견된 CRITICAL 또는 WARNING 항목 없음.

### [INFO] `@internal` JSDoc 태그 제거됨 — 의도된 변경

- target 위치: `codebase/frontend/src/app/(main)/integrations/[id]/danger-tab.tsx` (신규 파일, 전체)
- 위반 규약: 해당 없음 (위반 아님)
- 상세: 원래 `page.tsx` 의 `DangerTab` 에는 `/** @internal exported for unit testing (danger-tab.test.tsx) only. */` JSDoc 이 붙어 있었다. 추출 후 `danger-tab.tsx` 의 export 에는 이 태그가 없다. 이는 올바른 처리다 — 전용 파일로 분리됐으므로 `@internal` 표시는 더 이상 적용되지 않는다 (공개 sibling 모듈 export 가 정상 상태). 규약 위반이 아니라 리팩터의 자연스러운 결과.
- 제안: 현 상태 유지. 추가 조치 불필요.

### [INFO] `spec/2-navigation/4-integration.md` frontmatter `code:` 갱신 불필요 확인

- target 위치: `spec/2-navigation/4-integration.md` frontmatter `code:` 항목
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2`, §3
- 상세: frontmatter 의 `code:` 에 `codebase/frontend/src/app/(main)/integrations/[id]/**` glob 이 이미 등재되어 있다. 신규 파일 `danger-tab.tsx` 는 이 glob 에 포함되므로 frontmatter 수정 없이 `spec-code-paths.test.ts` 가드가 통과된다.
- 제안: 현 상태 유지. frontmatter 변경 불필요.

---

## 요약

이번 변경은 `DangerTab` 컴포넌트를 `page.tsx` 에서 전용 `danger-tab.tsx` 파일로 verbatim 추출한 순수 기계적 리팩터다. 파일 명명(`danger-tab.tsx`)은 동일 디렉터리의 기존 sibling 패턴(`scope-tab.tsx`, `delete-blocked-dialog.tsx`, `cafe24-app-url-card.tsx`)과 완전히 일치하며, spec frontmatter `code:` glob 은 신규 파일을 이미 포괄한다. 출력 포맷·API 엔드포인트·에러 코드·Swagger 데코레이터·DTO 명명 등 다른 규약 영역과 접점이 없다. 정식 규약 위반 사항이 발견되지 않았으며 BLOCK 대상 없음.

## 위험도

NONE
