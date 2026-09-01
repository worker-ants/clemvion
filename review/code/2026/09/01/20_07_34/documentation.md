# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `plan/complete/` 로 이동하며 새로 추가된 파일 안에 죽은 상대링크가 생겼다 (이동 자체가 고치려던 결함과 같은 클래스)
  - 위치: `plan/complete/spec-draft-avatar-storage-key.md:381`
  - 상세: 이 파일은 `plan/in-progress/spec-draft-avatar-storage-key.md`(파일 11, 삭제됨)가 `plan/complete/`로 이동하며 새로 생성된 것이다. 상단 배너는 "`plan/complete/spec-update-avatar-upload-implemented.md:39`가 `./` 상대경로로 complete/ 안에 있을 것을 전제한 링크를 갖고 있어 그동안 깨져 있었다"는 것을 이번 이동으로 고쳤다고 명시적으로 서술한다. 그런데 바로 같은 파일의 `## 관련` 절(381행) `[spec-sync-user-profile-gaps.md](./spec-sync-user-profile-gaps.md)` 링크는 **반대 방향으로 같은 결함**을 새로 만들었다 — 이 파일은 `plan/complete/`로 옮겨졌지만 `spec-sync-user-profile-gaps.md`는 여전히 `plan/in-progress/`에 있다(`ls plan/in-progress/spec-sync-user-profile-gaps.md`로 확인, `plan/complete/spec-sync-user-profile-gaps.md`는 존재하지 않음). 즉 `./spec-sync-user-profile-gaps.md`는 dangling 링크다.
  - 추가로 382행 `[spec-update-avatar-upload-implemented.md](../complete/spec-update-avatar-upload-implemented.md)`는 파일이 이제 `plan/complete/` 안에 있으므로 `../complete/`가 우연히 `plan/complete/`로 되돌아와 **결과적으로는 깨지지 않지만**, 새 위치 기준으로는 더 이상 관용적 형태가 아니다(`./spec-update-avatar-upload-implemented.md`가 맞다). 이동 후 outgoing 링크를 일괄 점검하지 않았다는 같은 원인을 가리킨다.
  - 근거: `.claude/docs/plan-lifecycle.md` §5 "이동 commit 자가 점검"은 "형제 plan 을 가리키던 상대링크를 `../complete/<name>` 으로 정정했는가... **인입 링크**도 함께 본다"를 명시하지만, 이 build guard(`plan-frontmatter.test.ts`)의 상대링크 검사는 §4에 따르면 **top-level `plan/in-progress/*.md`에만 적용**되고 `plan/complete/**`는 대상이 아니다 — 즉 이 링크는 자동 가드로 잡히지 않는다.
  - 제안: 381행을 `../in-progress/spec-sync-user-profile-gaps.md`로 정정. 382행도 `./spec-update-avatar-upload-implemented.md`로 단순화 권장. D-4/이동 자가점검 섹션에서 "인입 링크"뿐 아니라 이동되는 문서 **자신의 outgoing 링크**도 재계산해야 한다는 점을 이번 계기로 체크리스트에 반영할 가치가 있다.

- **[WARNING]** "실측"으로 이전 결론을 정정한 배너가 인접한 잘못된 사실(도입 커밋 오귀속)을 재검증 없이 그대로 인용·강화한다
  - 위치: `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md:35`, `:76`, `:116` (35·116은 이번 diff에서 새로 추가된 내용, 76은 "정정 대상 — 원문 보존"으로 남긴 기존 문장)
  - 상세: 76행(보존된 원문) "도입 커밋은 `4afab7ca1` (#1237) — 이 spec 파일을 신설한 커밋이다"는 사실과 다르다. 저장소에서 직접 확인함:
    - `git log --oneline --diff-filter=A -- codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` → 결과는 `8ff827ef6`(#1233) 하나뿐. 파일을 **신설**한 커밋은 `8ff827ef6`이지 `4afab7ca1`이 아니다.
    - `git show 4afab7ca1 -- codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts`를 열어 보면 이 커밋은 해당 파일에 **독스트링 문단 7줄만 추가**했을 뿐, 파일 신설도 아니고 TS2677을 낸 타입 술어(`entry is [string, new (message: string) => ExpressionError]`) 도입과도 무관하다 — 그 술어는 `8ff827ef6` 시점부터 이미 있었다.
    - 그런데 이번 diff가 새로 추가한 정정 배너(35행)는 "CI `packages-checks` @ `4afab7ca1`(**도입 커밋**) — Test (jest) 스텝 | 실제로 실행됐고 success"라고 적어 이 잘못된 귀속을 "실측 표"의 항목으로 재확인 없이 채택했고, 새로 추가된 §CI 관측(116행)도 "도입 커밋 `4afab7ca1` 이 그 경로를 건드린 마지막 커밋이다"라고 같은 전제를 반복한다.
  - 왜 문제인가: 이 문서 자체가 "선재 확정의 근거가 틀렸다"며 **실측으로 재검증**하는 것이 골자인데, 그 실측 표가 인용하는 커밋 식별자 자체가 검증되지 않은 채 넘어갔다. 다음 사람이 "이 spec 파일이 언제 어떤 커밋으로 깨지게 됐는가"를 다시 조사할 때 `4afab7ca1`을 기준점으로 삼으면 잘못된 시작점에서 출발하게 된다. `git log`가 30초 내로 반증 가능한 종류의 오류라 특히 아쉽다.
  - 제안: 76행의 "이 spec 파일을 신설한 커밋이다"를 `8ff827ef6`(#1233)으로 정정하고, 35·116행의 "(도입 커밋)"/"그 경로를 건드린 마지막 커밋" 서술도 함께 재확인할 것. (부가: 116행 "마지막 커밋"이라는 서술 자체는 이 PR 자신의 커밋(`8b0ee1741`, package.json lint 글롭 수정)이 뒤따르며 이미 사실 관계가 바뀌었다는 점도 후속 갱신 시 함께 고려.)

## 요약

이번 변경분의 대다수(6개 `package.json`의 lint glob 따옴표 수정, `expression-engine/src/parser.ts`의 `no-case-declarations` 대응 인라인 주석, `error-shape.spec.ts`의 타입 유도 독스트링)는 문서화 관점에서 모범적이다 — 특히 `error-shape.spec.ts`의 신규 독스트링은 "왜 명시 배열이 아니라 런타임 발견 + 타입 유도인가"를 TS2677 근본 원인까지 정확히 설명하고, `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md`의 체크리스트에 남긴 진단 메모와도 일관된다. 다만 plan 문서 두 건에서 실제 결함을 발견했다: (1) `plan/complete/`로 옮기며 새로 만든 `spec-draft-avatar-storage-key.md`가, 스스로 "죽은 링크를 고쳤다"고 자평하는 바로 그 배너 아래에서 반대 방향의 죽은 링크를 새로 만들었고 이는 `plan/complete/**`가 상대링크 build guard 범위 밖이라 자동으로 잡히지 않는다. (2) `expression-engine-error-shape-spec-broken-on-main.md`의 "실측" 정정 배너가, 검증하지 않은 채 남겨 둔 인접 문장("도입 커밋 = 4afab7ca1")을 근거로 재사용했는데 `git log --diff-filter=A`로 30초 내 반증되는 사실 오류다. 두 건 모두 코드/스펙/API 문서가 아닌 내부 plan 트래커에 국한되어 빌드·CI에는 영향이 없지만, 이 저장소가 문서 정합성(특히 plan 이동 시 링크 정정, "실측" 주장의 신뢰성)에 두는 비중을 감안하면 병합 전 정정할 가치가 있다.

## 위험도
MEDIUM
