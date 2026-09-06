# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-review-citations-enforcement.md`

## 검토 방법

target 은 `spec/conventions/review-citations.md` 와 `spec/conventions/spec-impl-evidence.md` 를
정정하려는 planner 턴 plan draft 다. 두 대상 규약 파일 전문을 직접 열어 대조했고, target 이
인용하는 기술적 근거(가드 코드·git blame·git log·frontmatter 스키마)를 실측으로 검증했다.

검증한 항목과 결과:

- `spec-impl-evidence.md:81` 의 `code` 필드 정의 — target 의 줄 인용·인용문 정확 (실측 일치).
- `review-citations.md` Rationale 첫 문장의 저작자 — `git blame` 결과 `90c1751e8`
  (2026-09-05, `docs(spec):` 커밋)이 확인됨. target 의 "developer 가 쓴 예고가 아니다" 판단과
  부합 → CLAUDE.md 자기-반증형 소정정 조건 1 미충족이라는 target 의 결론이 근거 있음
  (developer 우회 없이 planner 턴을 여는 것이 정당).
- `dto-jsdoc-citation-guard.ts` 가 `swagger-dto-contract-guard.ts` 의 `isResponseDtoFile()`
  (`/dto/responses/` 경로 포함 여부만 검사)을 재사용한다는 target 의 §3 강제 범위 표(DTO
  됨/컨트롤러 안 됨) — 코드 확인 결과 정확.
- 변경안 (B) 의 `dto-jsdoc-citation*.ts` glob — 저장소에 `dto-jsdoc-citation-guard.ts` ·
  `dto-jsdoc-citation.spec.ts` 두 파일이 실존해 `status: implemented` 의 "글로브 ≥1 매치"
  요건(`spec-impl-evidence.md` §3)을 만족.
- `dto-jsdoc-citation-guard.ts` 최초 도입 커밋(`4529812c6`)이 실제로 현재 브랜치
  (`claude/user-entity-column-defense`)에서 이뤄졌음 — frontmatter `worktree:
  user-entity-column-defense` 와 일치.
- `spec_impact` 필드 — 리스트 형식(bare string 아님), 두 경로 모두 실존 — Gate C 스키마
  (`spec-impl-evidence.md` R-8, `plan-lifecycle.md` §5)에 부합. (완료 전이므로 아직 강제
  대상은 아니지만 선제적으로 규격을 지킴.)
- 변경안 (A) 의 취소선 + `> **정정 (YYYY-MM-DD)**:` 패턴 — `spec-impl-evidence.md` 본문에
  이미 같은 패턴(§4.2 `spec-link-integrity.test.ts` 행의 "2026-08-27 정정"·"2026-07-16 정정")
  이 실제로 쓰이고 있어, target 의 서식이 이 저장소의 기존 관례와 일치.
- bare `hh_mm_ss` 인용(`13_06_22` W1·W2, `13_06_22` INFO#3) — `review-citations.md` §3 표는
  `plan/**` 문서를 명시적으로 **"대상 아님"** 으로 규정("인용하는 라운드와 같은 세션에서
  쓰이고, 문서 자체가 그 맥락을 담는다"). target 은 plan 문서이므로 이 bare 인용은 §2 위반이
  **아니다** — 같은 문서 안에서 이미 전체 경로로 한 번 확립한 세션(`review/consistency/
  2026/09/06/13_06_22`)을 재인용한 것이라 규약 취지에도 부합.
- 체크리스트 헤딩 `## 종결 조건` — 자매 plan `spec-draft-nullable-notation-followups.md` 도
  동일 헤딩을 쓴다. 저장소 관행과 일치(강제 규약은 아니나 참고).

## 발견사항

- **[INFO]** 변경안 (C) 는 취소선+정정 패턴을 쓰지 않는다
  - target 위치: `## 변경안 (C)` 섹션 (105~108행)
  - 위반 규약: 엄밀한 "위반"은 아님 — CLAUDE.md 의 취소선 요구(`원문은 취소선으로 남기고`)는
    "자기-반증형 소정정"(developer 예외) 절차에 한정된 조건이고, 이 문서는 planner 턴이라
    그 조건에 구속되지 않는다. 다만 `spec-impl-evidence.md` 자신이 같은 종류의 정정에
    이미 취소선+`> 정정 (날짜)` 서식을 두 차례 써 온 로컬 관례(§4.2 `spec-link-integrity.test.ts`
    행)가 있다.
  - 상세: 변경안 (A)는 이 로컬 관례를 따라 `~~...~~` + `> **정정 (2026-09-06)**:` 로 정정
    이력을 남기는 반면, 변경안 (C)는 괄호 안 선례 인용문을 취소선 없이 바로 새 문장으로
    바꾼다. 강제 규약 위반은 아니지만, 같은 문서(target 이 함께 편집을 제안하는 두 절)
    안에서 정정 표기 방식이 갈리면 "이 필드가 왜 지금 이 값인가"를 나중에 추적하기가
    (A)보다 어렵다.
  - 제안: 규약 갱신은 불필요 — target 실행 시 (C)의 괄호 문구도 (A)와 동일하게
    `~~주석 형태를 강제하는 가드가 없다~~ > **정정 (2026-09-06)**: …` 형태로 맞추면 문서
    내부 일관성이 올라간다. 다만 이는 스타일 제안이며 종결 조건에 추가할 필요는 없다고
    판단.

## 요약

target 은 `review-citations.md`·`spec-impl-evidence.md` 두 정식 규약 문서를 정정하려는
planner 턴 plan draft 다. (1) developer 가 아니라 planner 가 원문을 썼다는 절차적 판단을
`git blame` 으로 검증했고 실제로 일치했다. (2) 제안하는 정정 내용(§3 DTO/컨트롤러 강제
여부 분리, `code:` 글로브 확장, 선례 인용 축소)은 대상 규약 파일의 필드 정의·라이프사이클
스키마(`spec-impl-evidence.md` §2.1·§3)와 `code:` 글로브 매칭 규칙에 부합하며, 기술적
근거(가드 코드의 `isResponseDtoFile()` 범위, glob 이 실제 파일에 매치되는지, 커밋 이력)도
실측으로 확인된다. (3) 인용 형식(전체 경로 vs bare 시각)은 `review-citations.md` §3 의
`plan/**` 문서 면제 규정에 부합해 위반이 없고, (4) 취소선+정정 날짜 서식은 대상 문서의
기존 로컬 관례와 일치한다(단, 변경안 C 만 이 서식을 안 써 사소한 내부 일관성 편차가
있음 — INFO). CRITICAL·WARNING 급 정식 규약 위반은 발견되지 않았다.

## 위험도

NONE
