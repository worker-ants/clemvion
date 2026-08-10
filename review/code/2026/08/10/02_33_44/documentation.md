# 문서화(Documentation) 리뷰 — plan-frontmatter.test.ts

## 리뷰 범위

이번 라운드는 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 1개 파일 단독 재검토(change_type: Review, 전체 파일 컨텍스트만 제공, diff 없음). 교차검증을 위해 같은 트리의
`plan-scan.ts`, `spec-links.ts`, `.claude/docs/plan-lifecycle.md`, `spec/conventions/spec-impl-evidence.md` 를 함께 열어 이 파일의 주석·문서 참조가 실제 구현/문서와 일치하는지 대조했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 헤더 주석 블록이 매우 길다 (약 38줄, 실제 코드 대비 헤더 비중 큼)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` — 파일 상단 헤더 주석 (게이트 13~50)
  - 상세: 가드의 배경·이력·과거 ai-review 지적("문서끼리 정면으로 어긋난 상태였다", "ai-review WARNING #1" 등)을 코드 안에 그대로 남겨 두는 방식이 이 저장소의 확립된 관례이며(`plan-scan.ts`, `spec-links.ts` 도 동일 패턴), 실제로 `.claude/docs/plan-lifecycle.md §3/§4`, `spec/conventions/spec-impl-evidence.md §4.2` 와 교차 확인한 결과 서술이 구현과 정확히 일치한다. 문제라기보다 관찰 — 가드 계약이 더 안정화되면 헤더의 "현재 계약" 부분(스코프·필수 필드·sentinel 규칙)을 plan-lifecycle.md §4 로 더 흡수하고 파일에는 "왜 이렇게 짰는가"만 남기는 정리를 고려할 수 있다. 지금 시점에 강제할 사안은 아님.
  - 제안: 조치 불필요 (참고용 관찰). 추후 이 가드가 다시 손을 타는 시점에 검토.

## 교차검증 상세 (참고)

다음 주장들을 실제 소스로 대조해 모두 사실과 일치함을 확인했다 — 오래된 주석(stale comment) 없음:

1. "그 규칙의 단일 구현은 `plan-scan.ts` 의 `collectLivePlanMarkdown`" (게이트 19~20) → `plan-scan.ts` 에서 실제로 `collectLivePlanMarkdown` export, `walkPlanMarkdown(root, "in-progress", {recurse:false})` 로 top-level만 수집. 일치.
2. "`spec-links.ts` 도 같은 이름을 export 하지만 그건 하위호환 re-export" (게이트 21~22) → `spec-links.ts:302-304` 에서 `export { collectLivePlanMarkdown };` 로 재수출, 자체 순회 로직 없음. 일치.
3. "판정 로직은 `plan-scan.ts` 소관으로 갱신했다" (게이트 24~26) → `spec-impl-evidence.md:132` 에 "판정 로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크) 소관" 으로 정확히 기술. 일치.
4. "TERMINAL_PLAN_STATUSES 에 등재할 것" (게이트 200 부근 에러 메시지) → `plan-scan.ts` 에 동일 이름의 `export const TERMINAL_PLAN_STATUSES` 존재, 값 4개(`complete`/`implemented`/`applied`/`superseded`) 일치. `plan-lifecycle.md §4` 표기와도 동일.
5. "`plan-scan.test.ts` 가 합성 fixture 로 위반 3건을 심고 정확히 그 3건만 잡히는지까지 단언" (게이트 182 부근) → `plan-scan.test.ts` 에 `stale.md`/`odd.md`/`nested/deep.md` 3건 planting + `"reports exactly the planted violations (no over-reach)"` 테스트 확인. 일치.
6. "SoT: `.claude/docs/plan-lifecycle.md §4`" (게이트 15) / "`plan-lifecycle.md §3` 인접 PR 규정" (게이트 35, 49) → 문서 §3 "이동 규칙", §4 "Frontmatter 스키마" 섹션 제목·내용과 각각 대응. 일치.
7. "코드펜스 안의 링크도 실제 링크로 취급했다" 초판 결함 서술 (게이트 146~147) → `spec-links.ts` 의 현재 `extractLinks` 는 `FENCE_RE` 로 펜스 블록을 skip 하도록 구현되어 있어, 서술된 결함이 이미 고쳐진 상태로 정확히 기록됨. 일치.

새 환경변수·설정 옵션·API 엔드포인트 변경 없음(테스트/가드 전용 파일) → README·API 문서·CHANGELOG 업데이트 필요성 없음. `spec/conventions/spec-impl-evidence.md` §4.2 및 표(게이트 라인 132)에 이미 이 가드의 3가지 검사(frontmatter 필수필드/이동 시 status 모순/살아있는 plan 링크 무결성)가 등재되어 있어 spec 쪽 동반 문서도 이미 동기화된 상태.

## 요약

`plan-frontmatter.test.ts` 는 여러 차례의 ai-review 라운드를 거치며 지적된 "오래된 주석"·"단일 정본 불일치" 문제를 이미 해소한 상태이며, 이번 재검토에서 헤더 주석의 모든 핵심 주장(정본 위치, 재사용 관계, 과거 결함 서술, cross-reference 대상)을 실제 구현(`plan-scan.ts`, `spec-links.ts`) 및 문서(`plan-lifecycle.md`, `spec-impl-evidence.md`)와 대조한 결과 불일치를 발견하지 못했다. 신규 CRITICAL/WARNING 없음. 헤더 주석 분량이 큰 편이라는 관찰(INFO)만 참고로 남긴다.

## 위험도

NONE
