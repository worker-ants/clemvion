# Rationale 연속성 검토 — `spec/conventions/` (impl-done)

## 조사 방법
- 번들의 실제 코드 diff (`git diff origin/main...HEAD`) 는 두 파일에 국한:
  - `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`
  - `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`
- 이 두 파일은 `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 목록에 등재되어
  §4.2 `spec-link-integrity.test.ts` family 의 판정 로직(`extractLinks`)을 구현한다.
- 변경 내용: 링크 **텍스트**가 줄을 넘는 마크다운 링크(`[첫 줄\n둘째 줄](url)`)를 종전 구현이
  줄 단위(`line.split` 후 줄마다 정규식)로 매칭해 **아예 수집하지 못하던** 결함을 고쳐, 전문을
  마스킹 후 단일 스캔하도록 재작성. 목적지(URL)는 여전히 줄을 못 넘게 좁혀 CommonMark 의미론과
  정합시킴.
- `plan/in-progress/harness-review-gate-followups.md` L59-89 에서 이 항목이 `15_01_34` 라운드에
  발견되고 `#1235` 로 해소됐음을 확인 — diff 의 배경 서술(2026-08-11 실측치, 6건/6파일 등)이
  날조가 아니라 실제 추적 이력과 일치한다.

## 발견사항

검토 관점 4가지(기각된 대안 재도입 / 합의 원칙 위반 / 결정의 무근거 번복 / 암묵적 가정 충돌)
기준으로 아래를 확인했다.

- **[INFO] AST 파서 전환 보류 결정은 새 Rationale 이 아니라 코드 주석 + 별도 backlog 항목으로만 존재**
  - target 위치: `spec-links.ts` diff, `extractLinks()` 상단 JSDoc "왜 여기만 정규식인가"
  - 과거 결정 출처: 해당 파일의 `headingSlugs()` 는 이미 AST 파서(`mdast-util-from-markdown`)를
    사용 중이라, 같은 파일 안에 "구조화된 마크다운은 AST 로, 그 외엔 정규식으로" 라는 암묵적
    선례가 있다 (단, 이 선례가 `spec/conventions/**.md` 의 명문 `## Rationale` 항목으로 존재하는
    것은 아니다 — 파일 자체의 관행일 뿐).
  - 상세: diff 는 `extractLinks` 를 AST 순회로 옮기지 않고 정규식 + 마스킹 방식을 유지하기로
    했고, 그 이유(`` [a]`code`(b) `` 를 CommonMark 와 다르게 링크로 인정하는 기존 회귀 테스트가
    있어 AST 전환이 "버그 수정이 아니라 설계 변경"이 된다)를 JSDoc 에 명시했다. 이 결정 자체는
    합리적이고 `plan/in-progress/harness-review-gate-followups.md` L145 이하에 신규 판정 항목으로
    등재되어 추적 중이다. 다만 이 규모의 설계 결정(정규식 유지 vs AST 전환)이 `spec/conventions/`
    문서의 `## Rationale` 이 아니라 코드 JSDoc + plan 항목에만 있어, "결정의 배경·근거는 spec
    문서 끝의 Rationale" (CLAUDE.md 정보 저장 위치 표) 원칙과는 결이 약간 다르다.
  - 제안: 구속력 있는 조치는 불필요 — 이 파일은 `spec-impl-evidence.md §4.2` 표에 "판정 로직"으로만
    언급되고 그 표 자체는 line-vs-AST 구현 세부를 서술하지 않으므로 stale 도 아니다. 다만 backlog
    항목(`15_01_34` W2)이 AST 전환 여부를 확정하는 시점에는, 그 결정을 `spec-impl-evidence.md` 나
    관련 spec 의 `## Rationale` 에도 한 줄 반영할 것을 권장한다(현재는 코드 주석에만 있어 spec 열람자는
    이 설계 결정의 존재를 모른다).

이 외에 아래 항목은 **문제 없음**으로 확인했다 (거짓 음성 방지를 위해 명시):

- **기각된 대안 재도입 여부**: 없음. diff 가 되살리는 과거 기각안이 없다. 오히려 diff 자체가
  "줄 단위 매칭" 이라는 **버그(의도된 결정이 아니라 결함)**를 고치는 것이며, 이 줄 단위 매칭이
  과거 어느 Rationale 에서도 의도적 채택으로 기록된 바 없다(전체 번들 검색 결과 "멀티라인"·
  "여러 줄" 관련 사전 Rationale 부재).
- **합의된 원칙 위반 여부**: 없음. `cannotContainLink` 사전 필터(성능 최적화, 114ms→56ms 실측)는
  diff 에서도 "그대로 유효" 라고 명시하며 보존됐다 — 기존 성능 결정과 충돌하지 않는다.
- **결정의 무근거 번복 여부**: 없음. 오히려 이 diff 는 `spec-link-integrity.test.ts` 가 지키는
  invariant("in-repo 링크의 존재·앵커 정합을 build 가 차단")를 **강화**한다 — 종전에는 멀티라인
  링크가 검증에서 통째로 빠져 깨진 링크가 조용히 통과했는데(spec-impl-evidence.md §4.2 표가
  선언하는 "spec 본문의 in-repo 링크 타깃 존재" 보장 범위를 실제로는 못 채우고 있었음), 이번
  수정으로 표가 선언한 범위와 구현이 정합해졌다. 이는 R-9(§4.2 family 신설 근거)가 요구하는
  "spec/plan 문서 자체의 구조·연결 무결성" 을 더 완전하게 만드는 방향이라 원칙과 정합적이다.
- **암묵적 가정 충돌 여부**: 없음. `spec-impl-evidence.md` §4.2 어디에도 "링크 텍스트는 단일 줄
  이어야 한다" 는 invariant 가 선언된 바 없어, 이번 확장이 우회하는 기존 가정이 없다.

## 요약
실제 코드 diff 는 `spec/conventions/spec-impl-evidence.md` §4.2 가 규정하는
`spec-link-integrity.test.ts` 판정 로직(`extractLinks`)의 결함 수정(멀티라인 링크 미탐지)에
국한되며, 이는 기존 Rationale 이 선언한 어떤 결정도 재도입·번복·우회하지 않고 오히려 §4.2 의
"in-repo 링크 무결성" invariant 를 문서가 약속한 범위에 더 가깝게 맞춘다. AST 파서 전환 보류라는
설계 판단은 합리적으로 문서화(코드 JSDoc + `harness-review-gate-followups.md` 신규 항목)되어
있으나, spec 문서의 정식 `## Rationale` 에는 아직 반영되지 않은 점만 경미하게(INFO) 지적한다.

## 위험도
NONE
