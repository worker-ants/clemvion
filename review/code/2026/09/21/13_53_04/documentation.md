# 문서화(Documentation) 리뷰 — `member-dup-remove` (3차 라운드, 직전 라운드 `13_28_12` WARNING 3·4 / INFO 8 조치 확인)

## 검토 방법

`origin/main...HEAD` diff 전체(31개 파일: `codebase/` 3 + `plan/` 2 + `review/code/2026/09/21/12_57_05/**` 15 +
`review/consistency/2026/09/21/12_23_48/**` 8 + `review/code/2026/09/21/13_28_12/**` 13)를 프롬프트 번들 +
`Read`/`Bash`(`git log`, `git show`, `grep -n`)로 워킹트리 원본과 대조했다. 직전 두 라운드
(`12_57_05/documentation.md`, `13_28_12/documentation.md`)가 핵심 3개 코드 파일의 JSDoc·인라인 주석·stale
주석 제거를 이미 상세히 검증했으므로, 이번 라운드는 (1) `13_28_12` SUMMARY 의 documentation/api_contract
WARNING·INFO 가 최신 커밋(`6f1113a70`)에서 정확히 조치됐는지, (2) 그 조치 자체가 새 문서화 결함을 남기지
않았는지, (3) `plan/` 문서 전체의 상태 서술과 실제 체크리스트가 계속 정합한지를 확인한다.

## 발견사항

- **[WARNING]** `plan/in-progress/member-dup-remove.md` §C 의 실행 체크박스 두 개가, 같은 문서 하단
  `## 체크리스트`가 "완료"라고 기록한 바로 그 작업인데도 여전히 미체크(`- [ ]`) 상태로 남아 서로 모순된다
  — 이번 라운드가 새로 만든 결함은 아니지만 어느 라운드에서도 지적되지 않았다
  - 위치: `plan/in-progress/member-dup-remove.md:79`(`- [ ] 위 「이미 닫혀 있다」를 **e2e 로 실증**한다. …
    아직 코드로 확인한 적이 없다.`), `:83`(`- [ ] 이것이 실제로 재현되는지 **프로브로 먼저 확인**한다.
    재현되면 별 사안으로 등재하고 …`)
  - 상세: 같은 파일 하단 `## 체크리스트`(:112)의 `:124`(`- [x] C-1 자가 탈퇴 경로가 이미 닫혀 있음을
    **실증** — 두 자가 탈퇴가 겹치면 [200, 403] … 영구 테스트로 고정했다`)와 `:127`(`- [x] C-2 owner
    승격 TOCTOU 프로브 — **재현됐다**. … 실측 status=200, rows_remaining=0`)가 각각 §C 항목 1·2 가
    완료됐음을 상세한 실측과 함께 명시적으로 기록한다. 즉 이 문서를 위에서부터 읽는 독자는 "아직 e2e 로
    실증 안 함" / "프로브로 확인 전"이라는 인상을 받지만, 40여 줄 아래에서는 정확히 그 두 작업이 실측
    결과와 함께 끝났다고 말한다. `git log -p -- plan/in-progress/member-dup-remove.md` 로 확인한 결과
    이 두 줄은 파일이 처음 만들어진 커밋 이후 단 한 번도 수정되지 않았다 — 작업이 진행되는 동안 체크박스
    갱신이 누락된 것이다.
  - 제안: `:79`·`:83` 두 체크박스를 `- [x]` 로 바꾸고, 하단 체크리스트의 해당 항목(:124, :127)을
    가리키는 짧은 참조(예: "→ 아래 체크리스트 C-1/C-2 참조")를 덧붙여 두 위치가 다시 벌어지지 않게
    한다. 이번 PR 을 막을 사유는 아니지만(plan 은 코드가 아니라 작업 기록이므로), 이 문서가
    `plan/complete/` 로 옮겨지기 전에 정리하는 것을 권장한다.

- **[INFO]** 직전 라운드(`13_28_12`)에서 조치된 WARNING/INFO 3건이 최신 커밋(`6f1113a70`)에서 정확히
  반영됐음을 소스 대조로 확인 — 문제 없음
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:18-24`(JSDoc), `plan/in-progress/member-dup-remove.md:94-100`, `plan/in-progress/spec-draft-nullable-notation-followups.md`(신규 `workspaces.controller.ts` 204/200 항목 + 「다섯」→비-개수 서술로 정정된 e2e frontmatter 항목)
  - 상세: (a) `documentation` WARNING 3(신규 e2e 파일이 "다섯 `*-delete-concurrency.e2e-spec.ts`" 트래커
    항목을 stale 하게 만듦) — 항목 제목을 개수·글롭에 의존하지 않는 서술("이 결함 클래스의 동시성 e2e
    파일이 어느 spec 의 `code:` frontmatter 에도 없다")로 바꾸고, 「2026-09-21 정정」 인용구로 자기
    반증 이력을 남겼다. (b) `api_contract` WARNING 4(`workspaces.controller.ts` 만 204 대신 200) —
    followups.md 에 planner 소유 신규 항목으로 실측(컨트롤러별 `HttpCode(204)` 개수 1개 vs 0개)과 함께
    등재됐다. (c) `documentation` INFO 8("형제 다섯은 전부 204" 서술 부정확) — plan 문서에서 원문을
    `~~형제 다섯은 전부 204 였으므로~~` 취소선으로 남기고 바로 옆에 정정 서술(컨트롤러별로 갈린다,
    `workspace-delete-concurrency.e2e-spec.ts` 도 이미 `[200,404]`)을 실측과 함께 붙였다 — 원문 보존 +
    국소 정정이라는 이 프로젝트의 자기-반증형 소정정 관례(`CLAUDE.md` §자기-반증형 소정정, spec 문서
    한정 규칙이지만 여기서도 같은 형태로 잘 지켜졌다)와 형태가 일치한다. 세 조치 모두 실제 코드
    (컨트롤러 `HttpCode` 데코레이터 개수)와 대조했을 때 서술이 정확하다.
  - 제안: 없음 — 확인 완료.

- **[INFO]** 리뷰 라운드 2(`13_28_12`)는 리뷰 라운드 1(`12_57_05`)과 달리 `RESOLUTION.md`·
  `_resolution_log.md`·`_resolution_state.json` 을 남기지 않았다 — 이 세션이 오늘 만든 다른 6개 리뷰
  라운드는 전부 이 3파일 세트(또는 `RESOLUTION.md` 최소한)를 갖고 있다
  - 위치: `review/code/2026/09/21/13_28_12/`(디렉터리 전체 — `RESOLUTION.md` 부재), 대조군:
    `review/code/2026/09/21/12_57_05/RESOLUTION.md`, `review/code/2026/09/21/10_54_47/RESOLUTION.md`,
    `review/code/2026/09/21/00_06_01/RESOLUTION.md`, `review/code/2026/09/21/00_56_52/RESOLUTION.md`,
    `review/code/2026/09/21/01_16_46/RESOLUTION.md`, `review/code/2026/09/21/00_37_06/RESOLUTION.md`
  - 상세: `13_28_12/SUMMARY.md` 는 WARNING 4건 · INFO 11건을 냈고, 그중 WARNING 3(documentation)·
    WARNING 4(api_contract)·INFO 8(documentation)이 실제로 커밋 `6f1113a70`에서 조치됐다(위 항목
    확인). 그런데 "무엇을 어떤 커밋으로 조치했고 무엇을 왜 유예했는지"를 표로 남기는 이 세션의 확립된
    관례(`RESOLUTION.md`)가 이 라운드에만 빠져 있어, 나중에 이 라운드의 조치 이력을 되짚으려는 사람은
    `git log` 로 커밋 메시지를 직접 뒤져야 한다(다행히 `6f1113a70` 커밋 메시지 자체가 상세해 실질적
    추적은 가능하다).
  - 제안: 이번 PR 을 막을 사유는 아니다(커밋 메시지가 조치 근거를 이미 충분히 담고 있음). 다만 이 세션의
    나머지 6개 라운드와 형식을 맞추려면 `13_28_12/RESOLUTION.md` 를 사후에라도 추가하는 것을 권장한다.

## 확인한 항목 (문제 없음)

- **핵심 소스 파일 문서화**: `workspaces.service.ts`의 `throwMemberNotFound()` JSDoc, `removeMember()`의
  동시성 보장 문장, `workspaces.service.spec.ts`의 `getAudit()` 통합·`ADMIN_REQUIRED` 테스트는 이번
  라운드(`6f1113a70`)에서 변경되지 않았고, 직전 두 라운드가 이미 실제 구현과 문구 단위로 대조 확인했다.
  재확인 결과 여전히 정확하다.
- **README/CHANGELOG/설정 문서**: 이번 커밋은 코드가 아니라 문서(e2e 주석, plan, 리뷰 산출물)만 바꾸며
  새 환경변수·설정 옵션·공개 API 형태 변경이 없다. 갱신 불요.
- **`review/consistency/2026/09/21/12_23_48/**`·`review/code/2026/09/21/12_57_05/**` 재확인**: 이전
  라운드의 리뷰/일관성 검토 산출물이 그대로 diff 에 실려 있으나, 이는 타임스탬프 찍힌 이력 아티팩트이지
  "영구 갱신되는 문서"가 아니라는 이 프로젝트의 기존 관례(직전 두 라운드도 동일 결론)와 일치한다.

## 요약

이번 라운드의 실질 변경은 문서 전용이다 — 직전 라운드(`13_28_12`)가 낸 documentation WARNING 3·
api_contract WARNING 4·documentation INFO 8을 각각 (1) 트래커 항목을 개수·글롭에 의존하지 않는 서술로
일반화, (2) `workspaces.controller.ts` 204/200 불일치를 planner 소유 신규 항목으로 등재, (3) plan 문서의
틀린 서술("형제 다섯은 전부 204")을 취소선 보존 + 실측 기반 정정으로 고쳤다. 세 조치 모두 실제 코드
(컨트롤러별 `HttpCode` 데코레이터 개수)와 대조해 정확함을 확인했다. 새로 발견한 것은 두 가지다 — (1)
`plan/in-progress/member-dup-remove.md` §C 의 실행 체크박스 두 개가 하단 `## 체크리스트`가 "완료"로 기록한
바로 그 작업에 대해 여전히 미체크 상태로 남아 문서 내부적으로 모순되는 점(WARNING, plan 을
`plan/complete/` 로 옮기기 전에 정리 권장), (2) 리뷰 라운드 2(`13_28_12`)만 이 세션의 다른 6개 라운드와
달리 `RESOLUTION.md` 조치 기록을 남기지 않은 점(INFO, 커밋 메시지가 대신 상세해 실질 추적은 가능). 둘 다
이번 PR 을 막을 사유는 아니다.

## 위험도

LOW
