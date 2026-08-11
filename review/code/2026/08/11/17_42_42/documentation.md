# 문서화(Documentation) 리뷰 결과 — 델타 라운드 (`17_42_42`)

## 검증 방법

이번 델타(잔여 13건 `@ApiForbiddenResponse` 부착 + `llm-model-config.controller.ts` 주석 정정 +
`1-auth §3.2` 인용 정정 + `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` 대폭 추가)를
지시받은 4개 확인 항목 순서로 재현·대조했다. `review/`·`spec/`·`codebase/` 를 실제로 `Read`/`Bash` 로 열어
직접 재현했고, 저장소는 전혀 수정하지 않았다(`git restore`/`checkout` 미사용).

### 1. plan 의 새 서술이 전부 사실인가

**"세 리뷰어가 6/3/12 로 갈렸고 내 실측은 13" — 전부 검증됨.**

- `review/code/2026/08/11/17_21_33/security.md` WARNING 이 나열한 위치를 직접 세면
  `workflow-assistant.controller.ts`(create/update/remove/sendMessage = 4) +
  `agent-memory.controller.ts`(listScopes/listMemories = 2) = **6건**, security 자신이 쓴
  "6" 과 일치.
- `review/code/2026/08/11/17_21_33/api_contract.md` WARNING 은 "동종 갭 **3건**" 이라 쓰고
  "위치 1/2/3" 세 그룹(위치 2 는 listScopes+listMemories 2개 핸들러를 한 그룹으로 묶음)을
  나열한다 — plan 이 인용한 "api_contract 3" 은 api_contract 자신이 쓴 숫자를 그대로
  옮긴 것으로 정확하다(핸들러 단위로 세면 4가 되는 내부 표기 방식이지만, 이는 api_contract
  리포트 자체의 셈법이며 plan 의 인용 오류는 아니다).
- `review/consistency/2026/08/11/17_21_43/convention_compliance.md` 는 "잔여 **12곳**" 을
  나열한다 — 항목별로 세면 workflow-test-datasets(3) + workflows::graphWarnings(1) +
  workflow-assistant(4) + knowledge-base::uploadDocument(1) +
  executions::simulateExecutionRunRedeliveryForTest(1) + agent-memory(2) = **12**, 일치.
- 이번 라운드 diff(파일 1·6·10·16·17·19)를 역할별 설명 문자열(`'viewer 이상 권한 필요'`
  `'editor 이상 권한 필요'` `'owner 이상 권한 필요'`, 즉 51건에 쓰인 `'워크스페이스 멤버가
  아님'` 이 아닌 것)로 직접 재분류하면:
  agent-memory(2, viewer) + executions 테스트훅 2종(2, owner) +
  knowledge-base uploadDocument(1, editor) + workflow-assistant(4, editor) +
  workflow-test-datasets(3, editor) + workflows graphWarnings(1, viewer) = **정확히 13건**,
  plan 의 표(§"리뷰 라운드가 잡은 것" 아래 6행 표)와 파일명·건수·역할 모두 일치.
  convention_compliance 의 12건과 내 13건의 차이는 `executions.controller.ts` 의
  `triggerStuckRecoveryForTest`(owner) 한 건을 convention_compliance 가 놓친 것으로,
  diff 상 실제로 두 test-hook 라우트 모두 이번에 부착됐다.

**뮤테이션 3줄 표 — 리뷰어 보고와 모순 없음(재현은 요구되지 않아 안 함).**
plan 의 "| 350 단독(멀티라인) GREEN | 350 단독(한 줄) RED | 398 단독 RED |" 표는
`testing.md`·`RESOLUTION.md`·`SUMMARY.md` 세 파일의 동일 표와 문구까지 일치한다.

**"멀티라인 링크 6건/6파일" — 직접 세어 검증됨.**
`spec-links.ts` 의 `extractLinks()`(한 줄 단위 `LINK_RE`, fence/inline-code 제거 후)를 그대로
재현하는 스크립트로 `spec/**/*.md` 전수를 스캔했다. 현재 HEAD(= `swagger.md` 의 인스턴스가
이미 이번 PR 로 한 줄로 펴진 상태)에서 검출된 멀티라인 링크는 정확히 5건/5파일:
`4-nodes/4-integration/2-database-query.md:413-414` · `5-system/1-auth.md:783-784` ·
`7-channel-web-chat/4-security.md:100-101` · `conventions/secret-store.md:361-362` ·
`data-flow/12-workspace.md:345-346`. 여기에 plan 이 "(이번에 해소)" 로 명시한
`conventions/swagger.md`(수정 전 348-350행, 이번 diff 로 이미 한 줄로 펴짐)를 더하면
**정확히 6건/6파일** — plan 이 나열한 파일 목록과 **철자까지 완전히 일치**한다.

### 2. `1-auth §3.2` 인용 정정 — 정확함

`spec/5-system/1-auth.md:373` 실제 표: `| Workflow 실행 | ✅ | ✅ | ✅ | — |`
(헤더: Owner/Admin/Editor/Viewer, 366행). 정정된 두 문서 모두 이제 verbatim 인용 대신
표-참조 서술을 쓴다:
- `spec/3-workflow-editor/3-execution.md:178` — "권한 매트릭스의 `Workflow 실행` 행
  (Owner/Admin/Editor ✅, Viewer —)"
- `spec/conventions/node-cancellation.md:63` — "[1-auth §3.2](../5-system/1-auth.md)
  권한 매트릭스의 `Workflow 실행` 행"

둘 다 실제 표 내용과 정확히 일치하고, 이전 라운드 cross_spec 이 지적한 "따옴표로 감싼
non-verbatim 인용" 문제(그 문자열로 `1-auth.md` 를 grep 하면 안 나오는 문제)가 해소됐다 —
현재 서술 어디에도 인용부호로 감싼 paraphrase 가 남아 있지 않다.

### 3. `llm-model-config.controller.ts` 새 주석 — 코드·규약과 일치

`codebase/backend/src/modules/llm/llm-model-config.controller.ts:118-148` 를 직접 열어 확인:

- 주석(118-122행)은 "`@Roles` 미적용은 의도적(Viewer+)" + "다만 `@ApiForbiddenResponse` 는
  둔다 — `RolesGuard` 가 `@Roles()` 유무 무관 멤버십을 검증" + "`swagger.md §5-4`,
  2026-08-08 확장" 이라 서술한다.
- 실제 코드: `listModels`(140줄대) 는 `@Roles()` 없이 `@WorkspaceId()` 를 소비하고(153행),
  `@ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })` 가 141행에 **실재**한다
  — 주석의 "둔다" 서술과 정확히 일치.
- `spec/conventions/swagger.md:397` 헤딩이 정확히 `### §5-4 확장 배경 —
  \`@WorkspaceId()\` 소비 라우트로 확대 (2026-08-08)` — 주석이 인용한 "§5-4,
  2026-08-08 확장" 과 날짜·섹션 번호까지 일치.

코드-주석-규약 3자가 모두 정합. 종전 주석("역할 제한이 없어 두지 않는다")이 옛 opt-in
전제였다는 서술도 실제로 `swagger.md §397-398` 의 "종전 §5-4 는 opt-in 가드 모델을
전제로 적혔다" Rationale 과 대응한다.

### 4. 자매 자리(옛 정책 전제 주석) — 뜻 기준 전수 훑음, 추가 발견 없음

다음 방식으로 교차 검증했다:
- 정확 문구("Viewer+", "@Roles 미적용이 의도적", "역할 제한이 없어") 저장소 전수 grep →
  `llm-model-config.controller.ts:118` 단 1건(이미 정정됨).
- 의미 변형 문구("가드가 담당", "가드가 처리", "인증 계층", "멤버십…책임") grep → 0건.
- `@WorkspaceId()` 를 소비하면서 파일 전체에 `@Roles()` 가 **전혀 없는** 컨트롤러 5개
  (`statistics`, `dashboard`, `workflow-versions`, `background-runs`, `notifications`)를
  개별 확인 → 관련 주석 자체가 없거나(대부분) 있어도 라우트 선언 순서·헤더 우선순위 등
  무관한 내용뿐, 옛 ApiForbiddenResponse 정책을 전제한 주석 없음.
- `@Roles()` 를 일부 라우트에만 쓰는 컨트롤러(= `llm-model-config` 와 같은 "혼합" 패턴)
  전수에서 "Viewer+"/"미적용" 계열 코멘트 재검색 → 추가 히트 없음.

**결론: 자매 자리는 이번 diff 밖에 남아 있지 않다.** 이번 정정이 유일한 사례였고,
이미 처리됐다.

## 부수 확인 (요청 항목은 아니나 새 delta 에 포함되어 함께 대조)

- `§4` 표의 `Editor+` bold → plain 정정: `spec/3-workflow-editor/3-execution.md:178` 실제로
  plain(`Editor+`, bold 마커 없음)이며 선례 `spec/5-system/13-replay-rerun.md:482`
  (`| 권한 | RR-PL-06 — 원본 시작자 + 워크스페이스 Editor+ |`, plain)와 형태가 일치한다.
  `node-cancellation.md` 의 산문형 `**Editor+ 전용**` bold 는 convention_compliance 가
  "표 행이 아니라 문장이라 자연스럽다"고 판단한 대로 그대로 남아 있어 일관됨.
- plan 후속 항목의 "§5-4 → §2-4" 정정: `spec/conventions/swagger.md:217` 의
  실제 헤딩이 `### 2-4. 상태 코드 응답 규칙` 이고 그 아래 "보호된 엔드포인트는 기본적으로
  `@ApiUnauthorizedResponse` … 를 포함합니다" 문구가 실재 — plan 이 정정한 인용이 맞다.

## 발견사항

- **[INFO]** (경미, 재확인 — 신규 문제 아님) `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md:62`
  의 `- [ ] \`/consistency-check --spec\` (spec 본문 편집이므로 의무)` 가 여전히 미체크다.
  - 상세: 이번 라운드에 실행된 consistency 는 `--impl-done`(scope=`spec/conventions`,
    `review/consistency/2026/08/11/17_21_43/meta.json` 확인) 모드다. `--spec` 전용 게이트는
    아직 실행 이력이 없다 — 직전 라운드에 이미 같은 항목을 INFO 로 남겼고 이번 델타가 그
    항목 자체를 대상으로 하지 않아 상태 변화가 없다. push 전 반드시 통과해야 하는 잔여
    의무임을 재확인 차원에서만 기록한다.
  - 제안: 조치 불요(이미 알려진 잔여 단계). 이 PR 의 나머지 워크플로 단계에서 실행할 것.

그 외에는 요청받은 4개 항목 모두 사실과 정확히 일치했고, 코드-서술 불일치·오래된 주석·
자매 문서 갭·부정확한 인용을 추가로 찾지 못했다. 억지로 발견을 만들지 않았다.

## 요약

이번 델타가 plan 에 새로 쓴 모든 정량적 서술(잔여 13건의 파일별/역할별 분해, 세 리뷰어의
6/3/12 집계, 뮤테이션 3행 결과, 멀티라인 링크 6건/6파일 목록)을 독립적으로 재현·대조한
결과 **전부 정확했다** — 특히 "13건" 은 diff 를 직접 역할별 설명 문자열로 재분류해 파일·
건수·역할까지 plan 의 표와 완전히 일치함을 확인했고, "6건/6파일" 은 `spec-link-integrity`
의 `extractLinks()` 정규식 의미론을 그대로 재현하는 스크립트로 저장소 전수를 스캔해
파일명까지 정확히 일치함을 확인했다. `1-auth §3.2` 인용은 이제 verbatim-처럼 보이는
따옴표 대신 표-참조 서술로 정확히 정정됐고 실제 표 내용과 일치한다.
`llm-model-config.controller.ts` 의 새 주석은 코드 상태(`@ApiForbiddenResponse` 실재,
`@Roles()` 부재, `@WorkspaceId()` 소비)와 `swagger.md §5-4`(날짜·섹션 번호 포함)에 정확히
부합한다. 지시받은 핵심 확인 항목(4번, 자매 자리 탐색)은 정확 문구·의미 변형·구조적
후보군(무-`@Roles()` 컨트롤러 5개, 혼합 컨트롤러) 세 갈래로 훑었으나 이번에 정정된
`llm-model-config.controller.ts` 외에 같은 옛 정책 전제 주석을 가진 자리는 발견하지
못했다 — 이번 정정이 유일한 사례였다. 새로 발견한 문서 결함은 없으며, 유일한 기록 사항은
직전 라운드부터 이어지는 미완료 체크리스트 항목(정보성) 뿐이다.

## 위험도

NONE

STATUS: OK
