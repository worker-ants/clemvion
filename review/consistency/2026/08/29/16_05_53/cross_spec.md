# Cross-Spec 일관성 검토 — spec/conventions/ (--impl-done)

## 실측 근거

이 검토 요청의 target 은 `spec/conventions/` 로 지정되어 있고 프롬프트에는 해당 디렉터리
전체(및 관련 spec 다수)가 번들되어 있으나, 실제 `origin/main` 대비 diff 를 워킹트리에서
직접 확인한 결과 **`spec/**` 하위에는 변경분이 전혀 없다**:

```
git -C .../eslint10-upgrade-5e3cf9 diff --stat origin/main -- spec/
(출력 없음 — 0 files changed)
```

이번 브랜치(`eslint10-upgrade-5e3cf9`)의 실제 diff 는 다음으로 한정된다 (`git diff --stat origin/main`):

- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (+143/-변경) — spec 마크다운 링크
  스캐너의 멀티라인 링크 매칭 로직 개선 (테스트 도구, spec 본문 아님)
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` (신규, +151) — 위 변경의 회귀 테스트
- `plan/in-progress/harness-review-gate-followups.md` — 트래커 갱신, 프론트매터에 **`spec_impact: none`** 명시
- `review/code/2026/08/29/**` — 선행 `/ai-review` 라운드 산출물 4세트 (RESOLUTION/SUMMARY/기타 리뷰어 파일)

즉 이 PR 이 실제로 건드린 것은 **spec 마크다운 문서 안의 링크를 찾아내는 프론트엔드 테스트
유틸리티**(`extractLinks`)이며, `spec/conventions/*.md` 를 포함해 `spec/**` 의 어떤 본문도
수정하지 않았다. 프롬프트에 첨부된 `spec/conventions/secret-store.md` 등 전체 번들은
"draft" 가 아니라 **현재(불변) 상태**의 참고 자료다 — 이 세션의 판정 대상이 되는 신규
서술이 아니다.

## 발견사항

이 세션에서 cross-spec 관점으로 평가할 **신규 target 서술이 없다.** 요청받은 관점
(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 은 모두 target 문서가
"무엇을 새로 선언하는가" 를 전제로 하는데, 이번 diff 의 target 영역(`spec/conventions/`)
에는 아무 선언도 추가/변경되지 않았다.

참고로 실제 코드 변경(`spec-links.ts`)이 검사하는 대상은 spec 문서 간 마크다운
링크(`[text](target)`)의 존재·앵커 무결성이며, 이는 이미 존재하는 `plan/in-progress/*`
서술(뮤테이션 실측 3행 표, 회귀 스캔 결과)로 근거가 충분히 뒷받침된다. 이 변경 자체가 새
cross-spec 충돌을 만들 표면(엔티티/API/RBAC/상태 전이/계층 책임 정의)을 갖지 않는다 —
링크 찾기 정규식/파서 로직일 뿐 spec 서술을 생성·수정하지 않는다.

## 요약

target 으로 지정된 `spec/conventions/` 는 이 브랜치에서 실제로 변경되지 않았다
(`git diff --stat origin/main -- spec/` 가 빈 결과). 실 diff 는 spec 마크다운 링크
무결성을 검사하는 프론트엔드 테스트 유틸리티(`spec-links.ts`/`.test.ts`)와 plan 트래커
갱신에 한정되며, plan 프론트매터도 `spec_impact: none` 을 명시하고 있어 spec 변경 의도
자체가 없었음을 뒷받침한다. 따라서 Cross-Spec 일관성 관점에서 검토할 신규/변경된 target
서술이 존재하지 않고, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느
축에서도 다른 spec 영역과 충돌할 여지가 없다.

## 위험도

NONE
