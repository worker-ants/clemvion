# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-swagger-forbidden-codes.md`

## 발견사항

- **[WARNING]** 신설 가드의 `code:` 등재에 전용 대조군(negative fixture) 이 빠짐
  - target 위치: "변경 (1) — frontmatter `code:`" 절, 추가되는 두 줄
    (`# §5-4 의 403 설명 ↔ 가드 거부 코드(...) 짝을 세는 가드(reflection, 대조군은 spec 안의 클래스).`
    / `- codebase/backend/src/repo-guards/__tests__/forbidden-response-codes*.ts`)
  - 위반 규약: `spec/conventions/swagger.md` frontmatter 자신의 기존 관례 — 같은 파일의 다른 reflection/repo-guard
    등재 3건이 전부 "가드 + 전용 `fixtures/**` 대조군"을 짝으로 `code:` 에 올린다
    (`param-uuid-pipe*.ts` + `fixtures/param-uuid-pipe/**`, `dto-class-name-collision*.ts` + `fixtures/dto-class-collision/*.ts`,
    `http-status-advertised*.ts` + `fixtures/http-status-advertised/**`). 각 항목 위 주석이 이유까지 명시한다 —
    "대조군(negative fixture) — 위 두 가드가 강제하는 **위반 형태의 실례**. 없으면 술어가 죽어도 테스트가 통과한다
    (실제로 그 상태로 한 라운드를 지났다)."(swagger.md L18-19). 같은 형태의 서술이 `spec/conventions/review-citations.md`
    에도 반복돼 이 저장소 전반의 정착된 관례임을 뒷받침한다.
  - 상세: 신설 가드는 위 셋과 같은 계열(reflection 로 데코레이터 메타데이터를 읽어 위반을 세는 저장소 가드)인데,
    draft 의 주석은 대조군을 "spec 안의 클래스"(= 실제 컨트롤러들 자체)로 삼는다고만 적고, 그 위치를 `code:` 에
    등재하지 않는다. 컴패니언 구현 plan(`plan/in-progress/forbidden-desc-codes.md` §요구 3)도 "저장소 가드 + 대조군
    (spec 안의 데코레이트된 클래스) — RED 확인(위반 129)"이라 적어, 129곳 미수정 상태의 실제 컨트롤러들을 일시적
    대조군으로 쓴 것으로 읽힌다 — 그런데 같은 plan §요구 4 가 그 129곳을 전부 교체하므로, 구현이 끝나면 "가드가
    죽어도 통과"를 실증할 고정 대조군이 저장소에 남지 않는다. 이는 sibling 항목들이 명시한 vacuous-guard 위험
    ("없으면 술어가 죽어도 테스트가 통과한다")과 정확히 같은 패턴이다.
  - 제안: (a) 다른 reflection 가드처럼 `fixtures/forbidden-response-codes/**` 류의 고정 위반 fixture 파일을 만들어
    `code:` 에 같이 등재하거나, (b) 의도적으로 전용 fixture 없이 "가드 자신의 `.spec.ts` 안에 인라인 데코레이트 클래스"로
    대신한다면 그 인라인 클래스가 진짜로 **가드가 죽으면 실패**하는지(뮤테이션으로 확인) 를 구현 plan 체크리스트에
    명시하고, `swagger.md` 의 새 주석에도 sibling 항목들과 같은 수준으로 "왜 이 가드만 전용 fixtures 디렉터리가
    없는가"를 적어 규약 텍스트 자체가 그 이탈을 설명하게 한다. 현재 문구("대조군은 spec 안의 클래스")만으로는
    다음에 이 파일을 읽는 사람이 의도된 설계인지 누락인지 구분할 수 없다.

- **[INFO]** "두 문장" 표현이 실제로는 한 문장
  - target 위치: "## 변경 (2)" 절 지시문 — "`엔드포인트도 403 을 낼 수 있다.` 뒤의 두 문장(«`@Roles()` 가 있으면 …
    통일한다 — 코드는 […](…).»)을 아래로 바꾼다."
  - 위반 규약: 없음(정식 규약 위반이 아니라 서술 정확도 문제) — 참고로만 남김.
  - 상세: `spec/conventions/swagger.md` 현재 L502-504 를 보면 "`@Roles()` 가 있으면 …" 부터 "…코드는
    [data-flow §Rationale 가드 거부의 오류 코드](...)." 까지가 마침표 하나로 끝나는 **한 문장**이다(중간의
    "명시하고,"는 쉼표로 이어지는 절이지 문장 경계가 아님). 다만 draft 가 인용한 시작·종료 지점(따옴표 안 원문)은
    정확해 실제 치환 범위에는 영향이 없다.
  - 제안: "두 문장" → "그 뒤 문장" 등으로 정정(선택 사항, 실행에는 지장 없음).

## 명명·구조·링크 확인 (문제 없음)

- plan 파일명 `spec-draft-swagger-forbidden-codes.md` 은 `project-planner` SKILL 의 `spec-draft-<name>.md`
  명명 규약과 일치하며, 선례(`plan/complete/spec-draft-numeric-wire-convention.md` 등)와도 형태가 같다.
- frontmatter 는 `.claude/docs/plan-lifecycle.md §4` 의 top-level in-progress 필수 3필드(`worktree`/`started`(ISO)/
  `owner`)를 모두 갖췄고, `spec_impact`(선택·완료 시 의무)를 미리 선언한 것도 금지되지 않는 추가 필드다.
- 문서 구성(도입 문단 → "변경 (1)/(2)/(3)" → 말미 `## Rationale`)은 SKILL.md §작업 워크플로 3번("본문 끝에
  `## Rationale` 로 결정 근거 명시")과 일치한다. Overview/본문/Rationale 3섹션 규정은 `spec/` 문서 대상이라
  `plan/` draft 에는 강제되지 않는다.
- "변경 (1)"의 삽입 위치("`http-status-advertised` 두 줄 아래")는 실제 `spec/conventions/swagger.md` frontmatter의
  현재 마지막 두 줄(L25-26)과 정확히 일치한다. 새 주석·glob 라인의 2-space 들여쓰기·`# ` 주석 형식도 기존 관례와
  일치하며, `spec-impl-evidence.md §2.1` 이 2026-09-06 이후 "주석 뒤 항목이 안전"하다고 명시한 파서 정정과도
  합치한다.
- `../data-flow/12-workspace.md#가드-거부의-오류-코드-2026-09-25` 등 draft 가 인용하는 3개 앵커는 실제 헤딩
  ("가드 거부의 오류 코드 (2026-09-25)" 등)과 슬러그가 일치해 `spec-link-integrity.test.ts` 를 통과할 형태다.
- `NOT_A_MEMBER`/`ROLE_REQUIRED.viewer === NOT_A_MEMBER`/`EDITOR_REQUIRED` 등 draft 가 근거로 삼는 코드·상수는
  `codebase/backend/src/common/constants/workspace-roles.ts` 실제 구현과 일치하고, `UPPER_SNAKE_CASE` 표기 규약
  (`error-codes.md`)도 지킨다. "정하지 않는 것"에 든 서비스 코드 `FORBIDDEN`·`RERUN_PERMISSION_DENIED` 도 실제
  `executions.controller.ts`/`executions.service.ts` 에 존재해 인용이 정확하다.
- 제안 헬퍼 `FORBIDDEN_NOT_A_MEMBER`/`forbiddenForRole(role)`(`common/swagger`)는 기존 `common/swagger/` 의
  `Api*` 데코레이터-팩토리 명명과는 다른 계열(설명 문자열 빌더)이라 다른 캐이싱을 쓰는 것이 자연스러우며,
  swagger.md §5-2 표가 스스로 "호출형 헬퍼 함수의 인벤토리"라고 범위를 한정해 두어 이름 형식 충돌도 없다.
  이 헬퍼·`lowestRequiredRole` 파일은 이미 frontmatter 의 `codebase/backend/src/common/swagger/**` glob 에
  포괄돼 별도 등재가 필요 없다.

## 요약

target(`spec-draft-swagger-forbidden-codes.md`)는 명명·frontmatter 스키마·문서 3단 구성(도입/변경/Rationale)·
링크 앵커·인용 코드 상수 모두 `spec/conventions/spec-impl-evidence.md`·`.claude/docs/plan-lifecycle.md`·
project-planner SKILL 의 정식 규약과 정합한다. 유일한 실질적 우려는 신설 가드를 `code:` 에 등재하며 이
파일의 다른 모든 reflection/repo-guard 항목이 지켜온 "전용 negative-fixture 등재" 관례를 명시적 설명 없이
벗어난 점으로, vacuous-guard 재발을 막기 위한 이 저장소의 기존 안전장치와 어긋난다. CRITICAL 급 위반은
없다.

## 위험도

LOW
