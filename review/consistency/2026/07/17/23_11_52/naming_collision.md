# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

`--impl-done` 모드, 선언된 target 은 `spec/conventions/` 이나, 실제 diff
(`git diff origin/main...HEAD`, merge-base `099f63ccadfdf9ce99d42c7dae0253d2557ae86d`)
를 확인한 결과 **이번 PR 은 `spec/` 하위 파일을 전혀 변경하지 않는다**:

```
M  codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts
A  plan/in-progress/interaction-type-guard-comment-false-negative.md
A  review/consistency/2026/07/17/19_54_00/*  (이전 --impl-prep 세션 산출물)
```

즉 이번 변경의 실질 내용은 **테스트 파일 내부의 가드 구현 교체**(정규식 grep →
TypeScript AST 파싱, PR #968 이 실측한 주석 false-negative 차단)와 그 배경을
기록한 plan 문서 1건뿐이다. `spec/conventions/interaction-type-registry.md` 는
diff 상 미변경(주석에서 참조만 됨) — 신규 식별자를 정의하는 spec 변경이 아니다.

## 발견사항

신규 식별자 충돌 관점(요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키·
파일 경로) 에서 검토한 결과, 실제로 도입된 신규 식별자는 아래 뿐이다:

- 함수 `collectCodeStringLiterals` (신규, 테스트 파일 로컬 스코프)
- `describe("collectCodeStringLiterals", ...)` 테스트 스위트명 (자기 자신에
  대한 self-test, 같은 파일 내)
- 테스트 픽스처 문자열 `"real_literal"` / `"real_template"` / `"ghost_*"` 6종
  (fixture 내부 값, export 되지 않음)
- plan 파일 `plan/in-progress/interaction-type-guard-comment-false-negative.md`

이들 전부를 `git -C <worktree> grep` 으로 저장소 전역 검색했으며, 모두
해당 테스트 파일 내부(정의 1곳 + 호출 3곳)로 국한되고 다른 모듈·spec·plan
파일과 이름이 겹치지 않는다. plan 파일명도 `plan/in-progress/` 내 다른 항목과
충돌 없다.

- **없음** — 요구사항 ID 충돌: 이번 diff 는 신규 요구사항 ID 를 부여하지 않는다.
- **없음** — 엔티티/DTO/인터페이스명 충돌: 신규 엔티티·DTO 선언 없음(테스트 헬퍼
  함수 1개뿐, 프로덕션 코드 export 아님).
- **없음** — API endpoint 충돌: 해당 없음.
- **없음** — 이벤트/메시지명 충돌: 해당 없음.
- **없음** — 환경변수·설정키 충돌: 해당 없음.
- **없음** — 파일 경로 충돌: 신규 spec 파일 없음. plan 파일 경로는 기존 명명
  컨벤션(`plan/in-progress/<name>.md` + frontmatter `worktree`)을 따른다.

## 요약

target 으로 지정된 `spec/conventions/` 스코프는 이번 diff 에서 실제로 변경되지
않았고(merge-base 대비 `spec/**` 변경 0건), 유일한 실질 변경은 프런트엔드 테스트
파일 내부의 가드 구현 방식 교체(regex → TS AST) 와 이를 설명하는 plan 문서
1건이다. 새로 도입된 식별자(`collectCodeStringLiterals` 및 테스트 픽스처
문자열들)는 모두 해당 테스트 파일 내부에 국한되며 저장소 전역 검색 결과 다른
곳에서 다른 의미로 쓰이는 동일 이름이 없다. 신규 식별자 충돌 관점에서 지적할
사항이 없다.

## 위험도
NONE
