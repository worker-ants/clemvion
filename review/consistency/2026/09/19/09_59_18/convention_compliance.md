# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-data-model-fk-actions.md`

## 검토 범위와 방법

target 은 `spec/1-data-model.md` §2/§3 과 `spec/2-navigation/4-integration.md` §11.2 를 고치는 **spec draft plan** 이다
(`--spec` 모드). `spec/conventions/**` 전수 중 이 변경과 실제로 맞닿는 항목을 대조했다:

- `spec/conventions/spec-impl-evidence.md` (frontmatter lifecycle) — `_prompts` 번들에서 컨텍스트 예산 초과로
  절단되어 있어 저장소 원본을 직접 읽어 대조했다.
- `spec/conventions/migrations.md` (V번호 명명·인용) — 동일하게 원본을 직접 읽었다.
- `spec/conventions/review-citations.md` (문서 내 인용 형식)
- `spec/conventions/swagger.md` (API/DTO 계약 — target 이 건드리는 `finish_reason` 이 wire 로 노출되는 필드라 곁가지로 대조)
- `spec/conventions/audit-actions.md` (명명 규약 문서화 패턴의 선례로서 참고)

FK 삭제 동작·컬럼 존재·유니크 키의 **사실관계**(값이 실제 DB 와 맞는지)는 본 검토의 대상이 아니다 — 그건 별도
fact-check 관점의 몫이고, 여기서는 표기·구조·명명이 `spec/conventions/**` 와 어긋나는지만 본다.

## 발견사항

- **[INFO]** §2 FK 삭제 동작 괄호 삽입 위치가 대상에 따라 다르다 (front-insert 규칙의 예외 2건)
  - target 위치: `## 변경 — spec/1-data-model.md` §A 표, 431행(Entity.`last_seen_chunk_id`)·448행(Relation.`evidence_chunk_id`)
  - 위반 규약: 없음 — `spec/conventions/**` 에 FK 삭제 동작 표기 형식을 규정한 문서가 존재하지 않는다. 아래는 target
    문서가 **자기 자신이 §"방법" 절에 선언한 규칙**과 어긋나는 자기-일관성 지적이며, 정식 규약 위반은 아니다.
  - 상세: target 은 "기존 괄호가 있으면 그 안 **맨 앞**에 `동작 · ` 을 넣는다" 고 명시했다. 대부분 행(예: 131·145·221·246·333·354)은
    이 규칙대로 `(SET NULL · 정리용)`, `(CASCADE · 출력 노드)` 처럼 동작을 맨 앞에 둔다. 그런데 431·448행은 `(FK → DocumentChunk)`
    → `(FK → DocumentChunk · SET NULL)` 로, 동작을 **맨 뒤**에 붙였다. 두 행은 "FK → Entity" 자체가 괄호 **안**에 있는 다른 구조라
    ( `마지막 등장 청크 (FK → DocumentChunk)` 처럼 한글 설명이 먼저 오고 괄호 안에 FK 표기가 들어가는 형태) 규칙을 문자 그대로 적용하면
    `(SET NULL · FK → DocumentChunk)` 가 되어 다른 75행 전부가 지키는 "FK → Entity 가 괄호 열자마자 먼저 보인다" 는 가독성 관행이
    깨진다 — 즉 예외가 의도적일 가능성이 높지만, target 본문에는 이 두 행이 왜 규칙에서 빠지는지에 대한 언급이 없다.
  - 제안: 정식 규약 위반이 아니므로 반드시 고칠 필요는 없다. 다만 "방법" 절의 규칙 문장에 "단, `FK →` 가 괄호 안에 오는
    431·448 은 괄호 끝에 붙인다" 한 줄만 보태면 리뷰어·후속 편집자가 규칙-예외 여부를 다시 조사하지 않아도 된다.

- **[INFO]** FK 삭제 동작 표기에 대한 정식 규약 부재 — 이번 확장으로 표기 스타일 4종이 75행으로 늘어남
  - target 위치: `## 비대상` 첫 항목 ("표기 통일")
  - 위반 규약: 없음 — 현재 `spec/conventions/**` 어디에도 FK 삭제 동작 주석 표기 형식(`(CASCADE)` vs `(ON DELETE CASCADE)` vs
    `(cascade 삭제)` vs `**SET NULL** — …`)을 규정하는 문서가 없다. 따라서 이번 target 이 그 규약을 어기는 것은 아니다.
  - 상세: target 은 이 파편화를 스스로 실측·기록했다("이미 적은 26행은 … 섞여 있다") 하고 "사실이 맞으므로 손대지 않는다" 고
    명시적으로 범위를 좁혔다 — 이는 정당한 스코프 결정이다. 다만 이 저장소는 같은 상황(도메인이 늘수록 산문 표기가 표류)을 이미
    한 번 정식 규약으로 승격한 선례가 있다 — `audit-actions.md` 의 Rationale "왜 시제를 한 규약으로 묶는가": "도메인이
    늘수록(…) 산문 규약은 누락·표류하기 쉬워, 전 도메인 규칙을 단일 conventions 문서로 통합했다". FK 삭제 동작 표기도 같은
    궤적(26→75행, 4가지 형)을 밟고 있다.
  - 제안: 이번 PR 범위는 아니지만, 후속 plan 항목으로 "FK 삭제 동작 표기를 `spec/conventions/` 문서로 승격할지" 를
    트래커에 남겨 둘 만하다 (강제 아님, 제안).

- **[정보 없음]** 문서 구조·명명·API 문서 규약 — 위반 없음
  - `spec/1-data-model.md` 는 `spec-impl-evidence.md` §1 `EXCLUDE_BASENAMES` 에 등재된 파일이라 frontmatter
    lifecycle 의무(id/status/code 매치) 대상이 아니다 — target 이 frontmatter 를 건드리지 않는 것이 맞다(실측:
    파일이 이미 `id: data-model` / `status: implemented` 를 갖고 있지만, 이건 자발적 기재이지 가드 의무가 아니다).
  - `spec/2-navigation/4-integration.md` 는 frontmatter 의무 대상이지만 target 은 본문(§11.2) 텍스트만 고치고
    frontmatter(`status: implemented`, `code:`)는 그대로 둔다 — 이 변경은 새 surface 약속이 아니라 이미 구현된 동작의
    서술 오류 정정이므로 status 전이가 필요 없다. 규약 위반 아님.
  - target 자신(`plan/in-progress/spec-draft-data-model-fk-actions.md`)의 frontmatter — `worktree`/`started`(ISO)/
    `owner` 모두 존재, `spec_impact` 는 실재하는 spec 경로 2개의 리스트(bare `none` 아님) — Gate C·plan-frontmatter 요건을
    선제적으로 충족한다.
  - 본문에 인용된 세션 경로(`review/consistency/2026/09/19/08_33_13`)는 전체 경로 + 날짜 형태로, `review-citations.md`
    §2 의 "권장" 형태를 따른다(다만 `plan/**` 문서는 애초에 이 규약의 적용 대상이 아니다 — §3 표).
  - `finish_reason` 값 목록에 `error`/`auto_resume_pending` 을 추가하는 §D 변경은 DTO/Swagger 계층을 건드리지 않는다 —
    target 은 "§2 의 값 목록 전수 대조는 하지 않았다" 고 스스로 스코프를 명시했다. `swagger.md` §5-1 의 "형제 DTO 가 같은
    enum 을 공유하면 `*.literal.ts` 로 뺀다" 규칙은 코드 레이어 규약이라 이 spec 문서 정정 자체와는 직교이며, target 이
    이를 위반하지 않는다.
  - 마이그레이션 버전 인용(`V005`·`V009`·`V012`·`V020`·`V109` 등)은 `migrations.md` 의 V번호 형식과 일치하며, 새 마이그레이션
    파일을 만들지 않으므로 §1~§6 의 명명·단조성 규약 대상이 아니다.

## 요약

target 문서가 실제로 건드리는 범위(§2 FK 삭제 동작 서술·§2 누락 컬럼·§2.22 enum 값·§3 인덱스 표·§11.2 유니크 키 서술)에
대해 `spec/conventions/**` 상 명시적으로 규정된 명명·출력 포맷·API 문서 규약은 없으며, 위반도 발견되지 않았다.
`spec/1-data-model.md` 는 spec-impl-evidence.md 의 frontmatter 예외 목록에 있어 frontmatter 무변경이 맞고,
`spec/2-navigation/4-integration.md` 의 본문 정정도 status 전이를 요구하지 않는다. target 자신의 plan frontmatter 도
plan-frontmatter 요건(worktree/started/owner/spec_impact 리스트)을 충족한다. 유일한 지적은 두 건의 INFO 수준
제안이다 — (1) §A 표 431·448행이 target 스스로 선언한 "괄호 앞쪽 삽입" 규칙과 다르게 뒤쪽에 삽입했다는 자기-일관성
메모, (2) FK 삭제 동작 표기가 이번으로 75행·4가지 형으로 늘었으니 `audit-actions.md` 선례처럼 향후 별도 규약 문서로
승격할 여지가 있다는 제안. 둘 다 정식 규약 위반이 아니라 참고용 제안이다.

## 위험도
NONE
