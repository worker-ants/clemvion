# 정식 규약 준수 검토 — convention_compliance (라운드 4)

검토 모드: `--impl-done` (scope=`spec/conventions/`, diff-base=`origin/main`)

`spec/conventions/**` 자체의 델타는 이번에도 0파일이다(정상 — 이 브랜치는 conventions 문서를
바꾸지 않는다). 프롬프트 번들의 `## 구현 변경 사항`(diff)이 예산 절단으로 누락돼 있어, 지시된
대로 HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/guide-identifier-existence`,
CWD 와 동일)에서 `git diff origin/main...HEAD` 를 직접 대조했다. 대상은 이전 3라운드와 동일한
5파일이다:

- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (삭제)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (삭제)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (신규, 316줄)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (신규, 214줄)
- `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (4줄 수정)
- 부수: `CHANGELOG.md`·`PROJECT.md` 가드 카탈로그 문구 동기화, `plan/in-progress/
  guide-identifier-existence.md`(신규), `plan/in-progress/
  spec-draft-nullable-notation-followups.md`(트래커 갱신)

라운드 3(`review/consistency/2026/09/13/15_23_53`) 이후 코드 변경은 커밋 `b75fe0ace1` 한 건뿐이다
— `/ai-review`(`15_24_12`) W#1(밑줄-최소-1개 설계 결정을 겨누는 판별 fixture 부재)을 고치려
`guide-identifier-existence.test.ts` 에 테스트 케이스 하나를 추가한 것이 전부다. 이번 라운드는
(1) 라운드 3 이 남긴 두 WARNING 이 여전히 유효한지, (2) 이 마지막 커밋이 신규 위반을 만들지 않았는지
두 가지를 재확인하는 방식으로 진행했다.

## 발견사항

### 1. [WARNING] `user-guide-evidence.md §2`/frontmatter 가 가드 가족을 여전히 등재하지 않는다 (선재, 추적 중 — 라운드 1부터 반복)

- target 위치: `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" 표
  (`impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·`triggers-coverage.test.ts`
  3건만 나열) + frontmatter `code:` 목록(7개 경로, `guide-identifier-*` 2파일과
  `guide-sanitized-message-parity.test.ts` 없음).
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` = "본 spec 이 약속한 surface
  의 구현 경로") 의 취지 + CLAUDE.md "정보 저장 위치(단일 진실 원칙)". 신규/변경 코드
  (`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`)의 헤더 주석이 스스로
  `SoT: spec/conventions/user-guide-evidence.md (가드 가족)` 이라 지목하고, `PROJECT.md` 의
  동일 가드 행도 `SoT: spec/conventions/user-guide-evidence.md §2` 로 인용하는데, 정작 그 문서
  §2/frontmatter 에는 이 가드가 없다 — 코드가 가리키는 SoT 와 그 SoT 문서의 실제 내용이 어긋난다.
- 상세: gap 자체는 이번 PR 이 만든 것이 아니다 — `#1330`(구 `guide-error-code-existence.test.ts`)
  시점부터 있었고, `--impl-prep`(`review/consistency/2026/09/13/12_33_41`)에서 이미 3-checker
  수렴 WARNING 으로 잡혔다. 이번 diff(리네임 + 스코프 확장)는 gap 을 없애지 않았지만 넓히지도
  않았다 — 참조 이름(`guide-identifier-*`)만 갱신됐다.
- 처분 확인 (라운드 1~4 동일): `spec/` 쓰기 권한이 없는 developer 는 직접 고치지 않고(자기-반증형
  소정정 대상 아님 — 이 표는 developer 자신이 쓴 예고 문장이 아니라 §user-guide-evidence 라는
  타 문서의 구조다) `plan/in-progress/spec-draft-nullable-notation-followups.md`(현재 라인
  ~3398)에 planner 항목으로 등재돼 있다. 새 파일명(`guide-identifier-*`)·"등재 시 새 이름을
  쓸 것"·"허용목록 없음 원칙 번복의 Rationale 도 함께 등재하라"는 지시까지 최신 상태로
  갱신돼 있어, CLAUDE.md 의 "developer 는 멈추고 project-planner 위임" 원칙을 그대로 따른다.
- 제안: target 문서(`user-guide-evidence.md`) 자체는 여전히 미준수 상태이므로 이번 라운드에도
  반영한다(사용자 메모 "consistency WARNING 은 BLOCK:NO 여도 반영"). 후속 planner 턴에서 §2
  표에 2행(`guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`) 추가
  + frontmatter `code:` 에 관련 경로(스캐너 포함 3개) 추가 + `## Rationale` 에 "허용목록 없음"
  원칙 번복 근거 기록.

### 2. [WARNING] `cafe24-api-metadata.md §4` 가 node-output envelope 정의처를 오인용 (선재, 이 PR 과 무관)

- target 위치: `spec/conventions/cafe24-api-metadata.md` §4 "용어 주의" 박스 — "CONVENTIONS
  Principle 7 의 **노드 출력 envelope** (`{config, output, meta, port}`) 와 무관한 별개
  개념이다."
- 위반 규약: `spec/conventions/node-output.md` 자체의 Principle 번호 체계. envelope 5필드
  (`{config, output, meta?, port?, status?}`, `## Principle 0 — NodeHandlerOutput의 5필드는
  불변`)의 정의처는 **Principle 0** 이고, Principle 7 은 "config echo 원칙"(별개 주제)이다.
  직접 `node-output.md` 를 읽어 재확인했다 — 인용된 필드 목록도 4개(`config, output, meta,
  port`)뿐이라 `status` 가 누락돼 있다.
- 상세: 라운드 1(`--impl-prep`)이 `git log -S` 로 2026-05-16 최초 작성 시점부터의 오인용임을
  이미 확인했다. 이번 브랜치는 `spec/conventions/` 를 전혀 건드리지 않았으므로 이번 diff 와
  완전히 무관한 선재 결함이며, 재넘버링 탓도 아니다.
- 처분 확인: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 별도 planner
  항목(`cafe24-api-metadata.md §4 가 노드 출력 envelope 정의처를 오인용한다`)으로 등재돼 있고,
  "선재·`#1331` 과 무관·developer 권한 밖" 이 명시돼 있다.
- 제안: 이번 PR 범위에서 처리할 사안이 아니다(이미 올바르게 추적 중). target 문서 자체가
  여전히 미준수 상태라는 사실만 재확인 차원에서 기록한다.

## 라운드 3→4 사이 변경분 고유 검토 — 신규 위반 없음

라운드 3 이후의 유일한 코드 변경(`b75fe0ace1`)은 `guide-identifier-existence.test.ts` 에
"밑줄 없는 대문자 약어는 안 집는다" 판별 fixture 테스트 하나를 추가한 것이다.

- **명명 규약**: 추가된 테스트 설명(`it(...)`)·변수명 모두 기존 파일의 명명 패턴(한국어 설명
  + `[비대상]`/`[경계]` 태그)을 그대로 따른다. 신규 식별자 없음(기존 `UPPER_SNAKE` 정규식·
  `tokens()` 헬퍼 재사용).
- **금지 항목(review-citations.md)**: 추가된 주석이 인용하는
  `` `/ai-review` `review/code/2026/09/13/15_24_12` testing WARNING#1 `` 은 전체 경로 형태
  (§2 "권장")다. 전수 grep(`[0-9]{2}_[0-9]{2}_[0-9]{2}` 앞에 경로 구분자 없는 형태)으로
  재확인한 결과 `guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`·
  `guide-sanitized-message-parity.test.ts` 어디에도 bare `hh_mm_ss` 위반이 없다(라운드 2 의
  CRITICAL 은 라운드 2~3 사이에 이미 해소됐고 이후 재발 없음). `plan/in-progress/
  guide-identifier-existence.md` 의 진행 라운드 표(`14_41_14`/`15_03_06`/`15_24_12` 등)는
  bare 로 보이지만 `review-citations.md §3` 이 **`plan/**` 문서를 명시적으로 규약 대상 밖**
  으로 규정한다("인용하는 라운드와 같은 세션에서 쓰이고, 문서 자체가 그 맥락을 담는다") — 위반
  아님.
- **역할 경계**: 이 커밋도 `spec/conventions/**` 를 건드리지 않았다(delta 계속 0) — developer
  가 spec 을 직접 고치지 않고 필요한 갱신은 전부 planner 항목으로 유지했다.
- **문서 구조 / API 문서 규약**: 해당 커밋은 테스트 파일만 수정 — spec 구조·Swagger/DTO 와
  무관.

## 요약

이번 diff(5파일)는 `spec/conventions/**` 를 전혀 수정하지 않았고(델타 0, 정상), 라운드 2에서
지적된 bare 세션 인용 CRITICAL 은 라운드 3에서 정정된 채 유지되고 있으며, 라운드 3→4 사이의
유일한 변경(판별 fixture 테스트 1건 추가)은 명명·인용·역할 경계 어느 축에서도 신규 위반을
만들지 않았다. 남아 있는 두 건(WARNING — `user-guide-evidence.md §2` 가드 가족 미등재,
`cafe24-api-metadata.md §4` Principle 7/0 오인용)은 모두 라운드 1부터 동일하게 관측돼 온
target 문서 자체의 선재 미준수 상태이며, 둘 다 developer 권한 밖(`spec/**`)이라
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 정확히
등재·최신화돼 있다 — CLAUDE.md 가 정한 "developer 는 멈추고 project-planner 위임" 원칙을 4개
라운드에 걸쳐 일관되게 따른 처리다. 이번 diff 가 새로 만든 정식 규약 위반은 없다.

## 위험도

LOW
