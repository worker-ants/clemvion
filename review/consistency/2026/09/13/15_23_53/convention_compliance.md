# 정식 규약 준수 검토 — convention_compliance

검토 모드: `--impl-done` (scope=`spec/conventions/`, diff-base=`origin/main`)

`spec/conventions/**` 자체의 델타는 0파일이다(정상 — 이 브랜치는 conventions 문서를 바꾸지
않는다). 프롬프트 번들의 `## 구현 변경 사항`(diff)이 예산 절단으로 통째로 누락돼 있어,
`git diff origin/main...HEAD -- 'codebase/**'` 로 워킹트리를 직접 대조했다(5파일·930줄,
번들이 예고한 수치와 일치). 대상은 다음이다:

- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (삭제)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (삭제)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (4줄 수정)
- 부수: `CHANGELOG.md`·`PROJECT.md` 가드 카탈로그 문구 동기화, `plan/in-progress/
  guide-identifier-existence.md`(신규), `plan/in-progress/
  spec-draft-nullable-notation-followups.md`(트래커 갱신)

이전 라운드(`review/consistency/2026/09/13/12_33_41`·`14_41_43`·`15_03_36`)가 이미 이 계열을
검토했으므로, 이번 라운드는 **그 지적들이 이번 커밋에서 실제로 해소됐는지 재확인**하고 그 위에서
신규 위반을 찾는 방식으로 진행했다.

## 발견사항

### 1. [해소 확인] `review-citations.md §2` bare `hh_mm_ss` 위반 — 이번 커밋에서 정정됨

- target 위치: `guide-identifier-existence.test.ts:100`
- 이전 상태: `review/consistency/2026/09/13/15_03_36` 가 **CRITICAL** 로 잡음 —
  `// (`/ai-review` `14_41_14` testing WARNING#6).` 이 `review-citations.md §2` 의 bare
  `hh_mm_ss` 금지를 위반.
- 현재 상태: `git diff`/`grep` 로 재확인한 결과 해당 줄이
  `// (`/ai-review` `review/code/2026/09/13/14_41_14` testing WARNING#6).` 로 전체 경로
  형태(§2 "권장")로 정정돼 있다. 같은 파일·인접 파일의 다른 인용
  (`review/code/2026/09/13/15_03_06`, `review/consistency/2026/09/13/11_33_51`,
  `review/code/2026/09/13/14_41_14`(`guide-identifier-scan.ts:73`))도 전수 grep
  (`[^0-9/]([0-9]{2}_[0-9]{2}_[0-9]{2})`) 결과 bare 형태가 0건이다. 인용 대상 세션 6개
  전부 `review/code|consistency/2026/09/13/` 아래 실존을 확인했다.
- 판정: 이번 라운드에서는 위반 없음 — 새 CRITICAL 로 재보고하지 않는다.

### 2. [WARNING] `user-guide-evidence.md §2`/frontmatter 가 가드 가족을 여전히 등재하지 않는다 (선재, 추적 중)

- target 위치: `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" 표
  (`impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·`triggers-coverage.test.ts`
  3건만 나열) + frontmatter `code:` 목록(7개 경로, 신규 3파일 없음).
- 위반 규약: CLAUDE.md "정보 저장 위치(단일 진실 원칙)" — 신규/변경 코드
  (`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`)가 자신의 SoT 로 이 문서를
  **명시적으로 지목**하는데(`SoT: spec/conventions/user-guide-evidence.md (가드 가족)`,
  `PROJECT.md` 의 동일 가드 행도 `SoT: spec/conventions/user-guide-evidence.md §2` 로 인용)
  정작 그 문서 §2/frontmatter 에는 이 가드가 없다.
- 상세: 리네임(`guide-error-code-*` → `guide-identifier-*`)과 스코프 확장(에러 코드 → 식별자
  전반)이 있었지만 gap 자체는 신규가 아니다 — `#1330`(구 `guide-error-code-existence.test.ts`)
  시점부터 있던 gap 이고, `--impl-prep`(`review/consistency/2026/09/13/12_33_41`)에서 이미
  3-checker 수렴 WARNING 으로 잡혔다. 이번 diff 는 그 참조 이름만 낡게 만들 뻔했으나(구 파일명
  기준 gap), 아래 처분 확인대로 올바르게 추적되고 있다.
- 처분 확인: `spec/` 쓰기 권한이 없는 developer 는 직접 고치지 않고(자기-반증형 소정정 대상
  아님 — 이 표는 developer 자신이 쓴 예고 문장이 아니다) `plan/in-progress/
  spec-draft-nullable-notation-followups.md:3247` 에 **planner 항목**으로 재등재했다. 새 파일명
  (`guide-identifier-*`)·"등재 시 새 이름을 쓸 것"·"허용목록 없음 원칙이 번복됐다는 Rationale
  까지 함께 등재하라"는 지시까지 최신 상태로 갱신돼 있어 처리 자체는 CLAUDE.md 워크플로를
  올바르게 따른다.
- 제안: target 문서(`spec/conventions/user-guide-evidence.md`) 자체는 아직 미준수 상태이므로
  이번 라운드에도 반영한다(사용자 메모 "consistency WARNING 은 BLOCK:NO 여도 반영"). 후속
  planner 턴에서 §2 표에 2행 추가 + frontmatter `code:` 3경로 추가 + Rationale 에 허용목록 원칙
  번복 근거 기록.

### 3. [WARNING] `cafe24-api-metadata.md §4` 가 node-output envelope 정의처를 오인용 (선재, 이 PR 과 무관)

- target 위치: `spec/conventions/cafe24-api-metadata.md` §4 "용어 주의" 박스 — "CONVENTIONS
  Principle 7 의 **노드 출력 envelope** (`{config, output, meta, port}`) 와 무관한 별개
  개념이다."
- 위반 규약: `spec/conventions/node-output.md` 자체의 Principle 번호 체계 — envelope
  5필드(`{config, output, meta, port, status}`) 정의처는 **Principle 0**
  (`## Principle 0 — NodeHandlerOutput의 5필드는 불변`)이고 Principle 7 은 "config echo
  원칙"(별개 주제)이다. 인용된 필드 목록도 4개뿐이라 `status` 가 누락돼 있다.
- 상세: `git log -S` 로 확인한 결과 2026-05-16 최초 작성 시점부터의 오인용이며 재넘버링
  때문이 아니다. 이번 브랜치는 `spec/conventions/` 를 전혀 건드리지 않았으므로(위 diff 대상
  파일 목록에 없음) 이번 diff 와 완전히 무관한 선재 결함이다.
- 처분 확인: `--impl-prep`(`review/consistency/2026/09/13/12_33_41` WARNING#4)에서 이미
  잡혔고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 별도 planner 항목으로
  등재돼 있다(§ "`cafe24-api-metadata.md §4` 가 노드 출력 envelope 정의처를 오인용한다").
- 제안: 이번 PR 범위에서 처리할 사안이 아니다(선재·무관 결함, 이미 올바르게 추적 중). target
  문서 자체가 여전히 미준수 상태라는 사실만 재확인 차원에서 기록한다.

## 이번 diff 고유 검토 — 신규 위반 없음

- **명명 규약**: `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 는 기존
  `<subject>-existence.test.ts` / `<subject>-scan.ts` 패턴(자매 `impl-anchor-existence.test.ts`,
  구 `guide-error-code-*`)을 그대로 따른다. `GUIDE_EXTERNAL_VOCABULARY` 같은 신규 export 도
  기존 대문자 상수 명명과 일관된다.
- **금지 항목**: `review-citations.md §2`(bare 시각 금지)는 위 §1 대로 준수. `error-codes.md`
  의 소유 범위(명명원칙/rename/historical-artifact) 를 침범하지 않도록 신규 스캐너 헤더 주석이
  `error-codes.md` 를 "코드 명명·은퇴 이력" SoT 로만 인용하고 §4 예외 레지스트리 소유권을
  재선언하지 않는다 — 트래커(`spec-draft-nullable-notation-followups.md:3273`)도 "error-codes.md
  에는 적지 않는다"를 명시해 소유 경계를 지킨다.
- **역할 경계**: `spec/conventions/**` 델타 0 — developer 가 spec 을 건드리지 않고 필요한
  spec 갱신(§2 위 WARNING#2)은 전부 planner 항목으로 위임했다. 자기-반증형 소정정 조건에
  해당하지 않는 자리(가드 인벤토리 표)를 developer 가 직접 고치지 않은 것은 올바른 처리다.
- **문서 구조 규약**: 이번 diff 는 `spec/conventions/*.md` 를 새로 만들거나 구조를 바꾸지
  않으므로 Overview/본문/Rationale 3섹션 규약이나 `_product-overview.md`/`0-` prefix 규약과
  무관하다.
- **API 문서 규약**: DTO/Swagger 변경 없음 — 해당 없음.

## 요약

이번 diff(5파일·930줄)는 `spec/conventions/**` 를 전혀 수정하지 않았고(델타 0, 정상), 코드
쪽에서도 `review-citations.md §2` 를 새로 위반하던 자리(15_03_36 라운드 CRITICAL)를 전체 경로
형태로 정정했으며 자매 파일(`guide-sanitized-message-parity.test.ts`)의 상호 참조 주석도
`guide-identifier-existence.test.ts`(리네임 전 이름 병기)로 갱신해 죽은 파일명 참조를 남기지
않았다. 남은 두 건(WARNING#2 `user-guide-evidence.md §2` 가드 미등재, WARNING#3
`cafe24-api-metadata.md §4` Principle 오인용)은 모두 이번 PR 이전부터 있던 target 문서 자체의
미준수 상태이며, developer 권한 밖이라 두 건 모두 `plan/in-progress/
spec-draft-nullable-notation-followups.md` 에 planner 항목으로 정확히 등재돼 있다 — CLAUDE.md
가 정한 "developer 는 멈추고 project-planner 위임" 원칙을 그대로 따른 처리다. 이번 diff 가
새로 만든 정식 규약 위반은 없다.

## 위험도

LOW
