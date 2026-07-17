# 정식 규약 준수 검토 — interaction-type 가드 comment false-negative 차단 (impl-done)

## 검토 범위 확정 (target 재판정)

- 검토 모드: `--impl-done`, prompt 지정 scope=`spec/conventions/`, diff-base=`origin/main`.
- prompt 가 번들한 "Target 문서" 는 `spec/conventions/audit-actions.md` 와
  `spec/conventions/cafe24-api-catalog/**`(overview·application 하위 다수 entity 파일) 전체
  덤프였다. 그러나 이번 task 의 실제 코드 변경(커밋 `738271126`, `5df87d296`)은 다음 2개
  파일만 건드린다:
  - `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
  - `plan/in-progress/interaction-type-guard-comment-false-negative.md`

  `git show --stat` 로 두 커밋을 직접 확인했고, `spec/conventions/**` 하위 어떤 파일도
  diff 에 포함되지 않는다.

- prompt 상단 diff (`spec/conventions/frontend-layering.md` 148줄 삭제·`spec/0-overview.md`
  1줄 삭제로 표시된 부분)는 **reverse-diff 오염**이다. `git merge-base HEAD origin/main` =
  `099f63cca`(이 브랜치의 fork-point) 인데 `origin/main` 은 이후 `frontend-layering.md` 를
  신설한 PR #971(`29aa918a6`)까지 이미 머지돼 있다. 즉 이 브랜치가 그 파일을 "지운" 게 아니라
  애초에 가진 적이 없다 (`git log --oneline --all -- spec/conventions/frontend-layering.md`
  → `29aa918a6` 단일 커밋, 이 브랜치 히스토리엔 없음). `diff origin/main..HEAD` 는 fork 이후
  origin/main 단독 변경분을 "브랜치가 삭제"한 것처럼 보여준다 — 프로젝트 메모리에 이미
  기록된 known failure mode ("origin/main 이 base 앞서면 `git diff origin/main` 이
  reverse-diff 오염 → fork-point SHA 명시" / reaper 앵커 PR 교훈)와 동일 패턴이다. 오탐 방지
  차원에서 여기 명시해 둔다 — orchestrator 쪽 diff-base 계산은 `origin/main` 대신 이 fork-point
  SHA 를 쓰는 편이 다음 회차부터 안전하다.

- 결론: prompt 가 번들한 `audit-actions.md`/`cafe24-api-catalog/**` 덤프는 이번 PR 과 무관한
  배경 컨텍스트(직전 19:54:00 회차 impl-prep 리뷰가 이미 동일하게 판단)이고, 이번 PR 이
  실제로 건드리는 spec 문서는 **없다**. 아래 발견사항은 (a) 실제 코드 변경이 spec-link 관점에서
  일으키는 영향, (b) impl-prep 리뷰가 남긴 권고의 이행 여부에 집중한다.

## 발견사항

- **[INFO]** impl-prep 리뷰 권고(JSDoc "grep" 서술 갱신)는 이행됨 — 잔여 없음
  - target 위치: `interaction-type-exhaustiveness.test.ts` 상단 JSDoc, `ENUM_VALUES` 위 주석
  - 위반 규약: 없음(확인용 기록)
  - 상세: 직전 impl-prep 회차(`review/consistency/2026/07/17/19_54_00/convention_compliance.md`)
    가 "AST/grep guard" 표기·"This test grep-finds..."·"Known limitation: the grep matches
    backtick-quoted mentions too..." 주석이 구현 전환 후 사실과 어긋날 것이라 지적했다. 실제
    diff(`738271126`) 확인 결과 — "AST/grep guard" → "AST guard", "This test grep-finds string
    literals..." → "This test parses each registered file and asserts every enum value appears
    as a string literal **in code**", "Known limitation" 주석(이제 해소된 결함을 서술하던 부분)
    은 삭제됨. `// runs the runtime grep guard below` 주석도 "runtime AST guard" 로 갱신됨.
    권고가 정확히 반영됐다.
  - 제안: 없음(이행 확인).

- **[INFO]** `spec/conventions/interaction-type-registry.md` 의 "grep" 잔존 표현은 예상대로
  미수정 — 규약 위반 아님
  - target 위치: `spec/conventions/interaction-type-registry.md` §1.2 rule 3, §2.1
    (`system_error`/`rag` 행), §5 rule 2 — "AST 가드 (...) 매트릭스의 모든 enum 값이 **등록된
    grep 대상 파일**에 string literal 로 등장하는지 검증", "grep 검증 대상은
    ...switch 1개뿐", "AST 가드가 매트릭스 vs 코드 grep 결과를 build 단계에서 비교 fail" 등
  - 위반 규약: 없음 — impl-prep 리뷰가 이미 "비차단·선택적 후속" 으로 명시한 항목
  - 상세: `git diff 099f63cca..5df87d296 -- spec/conventions/interaction-type-registry.md` 는
    무출력 — 이번 PR 은 이 spec 문서를 전혀 건드리지 않았다. impl-prep 회차가 "지금 당장 고칠
    필요는 없으나 후속으로" 라고 명시했던 그대로 이행됐다(수정 안 함이 곧 규약 위반은 아니다 —
    선택적 권고였다). "grep" 은 문서 내에서 "AST 가드"의 하위 동작 서술어로 혼용돼 있을 뿐 별도
    공식 명칭이 아니라는 이전 판정도 여전히 유효하다.
  - 제안: 여전히 비차단. 저비용이므로 이번 PR 또는 별도 소규모 PR 에서 §1.2 rule 3 · §2.1 두
    행 · §5 rule 2 의 "grep" → "AST" 로 치환하면 구현-서술 간극이 완전히 닫힌다. project-planner
    위임이 필요한 의미 충돌이 아니므로 강제 사유는 없다.

- **[INFO]** spec-link 정합성 — `code:` frontmatter 갱신 불요, 유지됨
  - target 위치: `spec/conventions/interaction-type-registry.md` frontmatter `code:` (5번째
    항목: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`)
  - 위반 규약: 없음(확인용 기록)
  - 상세: 이번 PR 은 이 파일의 **경로를 바꾸거나 새 파일을 추가하지 않고** 기존 파일 내부
    구현만 교체했다. frontmatter 의 spec-link 는 그대로 유효하며 dangling 참조가 생기지
    않았다.
  - 제안: 없음.

- **[INFO]** 정규식 기반 가드 금지 규정 부재 — 재확인(기존 판정 유지)
  - target 위치: `spec/conventions/migrations.md`(SQL_NAME_RE/SQL_RE), `spec/conventions/
    i18n-userguide.md` §113(`ui-label-parity.test.ts` 정적 regex 파싱)
  - 위반 규약: 해당 없음(오탐 방지 기록)
  - 상세: impl-prep 회차가 이미 `spec/conventions/**` 전체에서 "정규식/grep 가드 금지, AST 만
    허용" 류의 규정이 없음을 확인했다. 이번 impl-done diff 는 그 사실관계를 바꾸지 않는다 — 두
    문서 모두 여전히 정규식 기반 정적 파싱을 스스로 채택 중이므로, `interaction-type-registry.md`
    쪽만 AST 로 전환한 것이 저장소 내 다른 관례와 상충하지 않는다.
  - 제안: 없음.

## 문서 구조 규약 / API 문서 규약 / 명명 규약

- 이번 PR 은 `spec/conventions/**` 문서를 편집하지 않으므로 Overview/본문/Rationale 3섹션
  구성, `_product-overview.md`/`0-` prefix 명명, OpenAPI/Swagger 데코레이터·DTO 명명 규약은
  적용 대상 밖이다 — 위반도 갱신 필요도 없다.
- 코드 측 신규 식별자(`collectCodeStringLiterals` 함수, `describe("collectCodeStringLiterals")`
  self-test 블록)는 기존 `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES`/`ENUM_VALUES` 명명 스타일과
  일관되며 별도 명명 규약 위반이 없다. 새 API endpoint·DTO·에러 코드·이벤트 페이로드 도입이
  없으므로 출력 포맷 규약 항목도 적용 대상이 아니다.
- 금지 항목: `spec/conventions/**` 전체 검색 결과 "정규식 가드 금지"·"comment self-description
  갱신 의무" 류의 명시적 금지 패턴을 이번 diff 가 답습한 사례는 없다.

## 요약

이번 impl-done diff(`738271126`+`5df87d296`)는 `spec/conventions/**` 를 전혀 수정하지
않으며, 유일한 관련 spec 문서인 `interaction-type-registry.md` 의 spec-link(`code:`
frontmatter)도 경로 변경 없이 그대로 유효하다. 직전 impl-prep 회차가 지적한 두 INFO 중
"실행 가능한" 항목(테스트 파일 자체의 JSDoc "grep" 서술)은 구현에서 정확히 반영됐고, "선택적"
항목(spec 문서 내 잔존 "grep" 표현)은 예상대로 비차단 상태로 남아 있다 — 이는 규약 위반이
아니라 impl-prep 이 이미 승인한 이연(defer)이다. prompt 가 번들한 `audit-actions.md`·
`cafe24-api-catalog/**` 덤프는 이 PR 과 무관한 배경 컨텍스트이며, 그 등장 자체는
origin/main 이 이 브랜치의 fork-point 보다 앞서 있어 발생한 reverse-diff 오염(known failure
mode) 때문이다. 정식 규약 준수 관점에서 CRITICAL/WARNING 은 없다.

## 위험도

NONE
