# Cross-Spec 일관성 검토 — `spec/conventions/` (impl-done)

## 조사 방법 메모

prompt_file 에 번들된 target 본문 다수가 "컨텍스트 예산 초과로 절단" 상태였고, 특히
`<git diff origin/main...HEAD -- code_areas>` 청크 자체가 절단돼 있었다. 이 diff-base 없이
번들 전체(spec/conventions/ 60여개 문서)를 "target" 으로 취급하면 기존에 이미 안정적으로
공존해 온 문서들까지 오탐 대상이 된다. 그래서 실제 SoT 인 워크트리(`doclink-guard-scope`)에서
직접 `git diff origin/main...HEAD` 를 재현해 진짜 변경분을 확정했다.

**실측 결과**: 이 브랜치가 `spec/conventions/` 안에서 건드린 파일은 **`spec-impl-evidence.md`
단 1개, 1줄 diff** 뿐이다 (`spec-link-integrity.test.ts` 가드 설명 표에 "**및 (3) 거버넌스
문서**(2026-08-27 추가) …" 절을 덧붙임). 나머지 번들 파일(conversation-thread.md,
egress-masking.md, chat-channel-adapter.md, cafe24/makeshop 카탈로그 전체 등)은 이번 diff 의
target 이 아니라 순수 참조 컨텍스트다. 이 diff 를 뒷받침하는 코드 변경(`spec-links.ts` 의
`collectGovernanceMarkdown`/`findBrokenGovernanceLinks` 신설, `spec-link-integrity.test.ts` 신규
테스트, `spec-link-checks.yml` pathspec 확장, `scripts/check-doc-links.py` 삭제, `PROJECT.md`
"문서 링크 검증" 절 재작성)도 워크트리에서 직접 대조했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

이 diff 는 이미 같은 세션에서 code-review 2라운드(`review/code/2026/08/27/17_52_44`,
`18_16_05`)를 거쳤고, 1라운드에서 지적된 정확히 이 종류의 문제 — "새 guard scope 3 가
자신을 SoT 로 지목하는 `spec-impl-evidence.md §4.2` 표에 반영되지 않아 코드/PROJECT.md/spec
SoT 3자가 어긋난다"(WARNING) — 는 2라운드에서 이미 수정 완료된 상태다. 이번 cross-spec
검토에서 그 3자(코드 `spec-links.ts`/`spec-link-integrity.test.ts` ↔ `PROJECT.md` §문서 링크
검증 ↔ `spec/conventions/spec-impl-evidence.md §4.2`)를 다시 직접 대조한 결과 서술이 정확히
일치함을 재확인했다:

- 스코프 (1) spec 본문, (2) codebase 소스 JSDoc, (3) 거버넌스 문서(루트 `*.md` 비재귀 +
  `.claude/**.md`, `worktrees`/`node_modules` 제외) — 세 문서 모두 동일 서술.
- `scripts/check-doc-links.py` 삭제 근거(미배선·기존 exit 1·오탐 2건) — `PROJECT.md`,
  `spec-impl-evidence.md`, 코드 주석 3곳 모두 동일 인용.

6가지 점검 관점 각각에 대한 판정:

1. **데이터 모델 충돌** — 해당 없음. 이 diff 는 엔티티·필드를 정의하지 않는다(순수 빌드타임
   문서 링크 가드 + CI pathspec).
2. **API 계약 충돌** — 해당 없음. endpoint/HTTP 계약 변경 없음.
3. **요구사항 ID 충돌** — 해당 없음. 새 요구사항 ID 미부여. `spec-link-integrity.test.ts` 라는
   가드 이름은 `spec/**` 전역에서 `spec/conventions/spec-impl-evidence.md` 한 곳에서만
   참조되며(`grep -rl` 확인), 다른 영역에서 동명으로 다른 의미로 쓰인 흔적 없음.
4. **상태 전이 충돌** — 해당 없음. `status:` enum(§3 spec-impl-evidence)·`AuditLog.action`
   등 다른 상태 머신과 무관.
5. **권한·RBAC 모델 충돌** — 해당 없음. 이 diff 가 건드리는 코드는 build-time vitest/CI
   워크플로일 뿐 런타임 인가 경로가 아니다.
6. **계층 책임 충돌** — 없음. `collectGovernanceMarkdown`/`findBrokenGovernanceLinks` 는
   `spec-links.ts` 내부에서 기존 `collectSpecMarkdown`/`findBrokenLinks`,
   `collectCodebaseSources`/`findBrokenSpecLinksInSources` 쌍과 대칭 구조로 추가됐고, plan
   트리 링크 수집은 여전히 `plan-scan.ts` 가 소관(§4.2 표의 기존 책임 분리 서술과 배치되지
   않음). `frontend-layering.md` 규약(`src/lib/**` ↔ `src/components/**` 의존 방향)의 대상은
   애초에 `src/test/**`/`__tests__/**` 를 규약 축 밖으로 명시 제외하고 있어 이 diff 가 얹은
   `src/lib/docs/__tests__/` 내부 신규 함수와 충돌 소지가 없다(기존 파일 확장이지 신규
   레이어 도입이 아님).

부수적으로 확인한 것 — `scripts/check-doc-links.py` 삭제 후 저장소 전체(`spec/**`, `.github/**`,
`.claude/**`, `Makefile`, 코드)에 잔존 활성 참조가 없음을 재grep 으로 확인(남은 언급은 전부
`plan/complete/**`·`review/**` 의 시점 기록). `.claude/docs/plan-lifecycle.md` 에도 이 가드에
대한 별도 미러 서술이 없어 drift 대상 자체가 없다.

## 요약

이번 diff 가 `spec/conventions/` 안에서 실제로 바꾼 것은 `spec-impl-evidence.md §4.2` 표
1셀뿐이며, 그 서술은 동반된 코드 구현(`spec-links.ts`/`spec-link-integrity.test.ts`)·
`PROJECT.md`·CI 워크플로와 정확히 일치한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·
RBAC·계층 책임 6개 관점 모두에서 다른 spec 영역과의 충돌을 찾지 못했다. 이미 2라운드 코드
리뷰가 동일한 종류의 SoT drift(문서 미반영)를 선행 라운드에서 잡아 이번 라운드에서 수정
완료한 이력이 있어, cross-spec 관점에서도 별도 조치가 필요한 잔여 항목이 없다.

## 위험도
NONE
