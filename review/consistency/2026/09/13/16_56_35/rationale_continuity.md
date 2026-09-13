# Rationale 연속성 검토

## 검토 범위 참고

`scope(spec/conventions)` 델타는 0개 파일이다(코드 전용 PR). 그러나 구현 diff
(`codebase/frontend/src/lib/docs/__tests__/guide-{error-code→identifier}-{existence,scan}.ts`,
5파일/1112줄, `git diff origin/main...HEAD -- codebase/` 로 절대경로 워킹트리에서 직접 확인)는
**과거 PR(`#1330`)이 세운 설계 원칙 하나를 명시적으로 번복**하고 있어, 그 번복이 spec
`## Rationale` 로 승격됐는지를 본 검토 대상으로 삼았다.

## 발견사항

- **[WARNING]** "허용목록 없음" 원칙 번복이 spec `## Rationale` 에 없다 (코드·plan 에만 있음)
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
    (신규 파일) 상단 주석 "## 허용목록을 둔다 — 그리고 그 결정의 대가를 적는다"
    (diff 862~869줄) 및 `GUIDE_EXTERNAL_VOCABULARY` 정의(993~1003줄). 자매 테스트
    `guide-identifier-existence.test.ts` 의 "외부 어휘 허용목록 — 은폐 수단이 되지 않도록"
    describe 블록(521~548줄)이 이 번복을 4개 강제 조건으로 코드에 못박는다.
  - 과거 결정 출처: **spec `## Rationale` 에는 원래도 없다 — 이것이 지적의 핵심이다.**
    `#1330`(삭제된 `guide-error-code-scan.ts`)이 "허용목록 없음"을 설계 원칙으로 세운 근거는
    그 파일 자신의 docstring(`"허용목록 없음"`, `"탈출구(허용목록)를 미리 파 두면 …"`)에만
    있었고, `spec/conventions/user-guide-evidence.md`(이 가드 가족의 자칭 SoT, `## Rationale`
    R-1~R-5)에는 이 가드 자체가 언급조차 없다(§2 가드 표는 3건으로 고정돼 있고 frontmatter
    `code:` 목록에도 `guide-error-code-*`/`guide-identifier-*` 파일이 없다 — 직접 확인).
    즉 원칙도 그 번복도 spec 층에는 한 번도 승격된 적이 없다.
  - 상세: 코드 자체는 매우 상세히 이유를 남긴다 — 문맥 게이팅이 이 가드를 만들게 한 원래
    결함(`MCP_INSECURE_URL_ALLOWED` 오기, `#1328`)을 못 잡는다는 실측, "축 3 을 무조건 걷으면
    …" 대 "실패-문맥으로 좁히면 …" 두 대안의 트레이드오프, 은폐 방지 4강제(외부 시스템 명시·
    상한 5·인용 여부·기준집합 부재)까지 — criterion 3(무근거 번복)의 "새 Rationale 부재"에
    정확히 해당하지만 "무근거"는 아니다. 문제는 이 풍부한 근거가 **spec 문서가 아니라 code
    주석·plan 트래커에만** 산다는 것이다. `plan/in-progress/spec-draft-nullable-notation-followups.md:3264-3267`
    이 이미 이 정확한 갭을 planner 항목으로 등재해 두었다: "`#1330` 이 세운 *"허용목록 없음"*
    원칙을 `#1331` 이 실측으로 번복했다 … 그 근거가 지금 plan·코드 주석에만 있고 spec
    `## Rationale` 에는 없다 — **표·frontmatter·Rationale 을 한 턴에** 처리해야 한다." 이
    체크박스는 여전히 미완료(`- [ ]`)다.
  - 완화 요인 (판정에 반영): 이 PR 자신의 plan(`plan/in-progress/guide-identifier-existence.md:10-13`)
    이 `spec_impact: none` 을 명시하며 "`user-guide-evidence.md §2` 등재는 필요하고 **developer
    권한 밖**이라 planner 항목으로 등재돼 있다"고 스스로 정확히 인지·위임하고 있다. 이는
    `CLAUDE.md` 의 역할 경계("spec 변경 필요 시 developer 는 멈추고 project-planner 위임")를
    올바르게 따른 것이며, `--impl-prep`(`review/consistency/2026/09/13/12_33_41` WARNING#2)에서도
    이미 같은 방식(같은 planner 항목에 한 턴으로 묶어 등재)으로 처분됐다. 즉 **은폐가 아니라
    투명하게 추적된 기술 부채**다.
  - 제안: `codebase/` 쪽 추가 조치는 없음(developer 권한 밖, 이미 올바르게 위임됨). planner
    턴에서 `spec-draft-nullable-notation-followups.md` 의 해당 체크박스를 처리할 때, 다음을
    **한 턴에** 반영할 것(plan 이 이미 요구한 순서 그대로): (1) `user-guide-evidence.md §2`
    가드 표 3→5건 + §2.1 관계표에 `guide-identifier-existence.test.ts`·
    `guide-sanitized-message-parity.test.ts` 행 추가, (2) frontmatter `code:` 에
    `guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`·
    `guide-sanitized-message-parity.test.ts` 3파일 추가, (3) 신규 `## Rationale` 항목으로
    "왜 허용목록 없음 원칙을 포기했는가"(문맥 게이팅이 등재 근거였던 결함 자체를 못 잡는다는
    실측 + 4강제로 은폐 방지)를 명문화. plan 자신이 "두 번 좁게 등재했다"고 자기반증한 이력이
    있으므로(3268~3272줄), 이 세 가지를 분리 처리하지 않도록 주의할 것.

## 요약

이 diff 는 spec 파일을 건드리지 않지만, 그 기저 코드 변경은 과거 PR(`#1330`)이 세운 "허용목록
없음" 설계 원칙을 실측 근거로 명시적으로 번복한다. 번복 자체는 근거가 충실하고(실패 사례 재현
테스트·트레이드오프 비교표·은폐 방지 4강제까지 코드에 박혀 있음), developer 가 spec 쓰기
권한이 없다는 점을 정확히 인지해 planner 백로그 항목(`spec-draft-nullable-notation-followups.md`)
으로 명시적으로 위임한 상태다 — 은폐가 아니라 추적된 지연이다. 다만 이 원칙과 그 번복 어느
쪽도 지금 spec `## Rationale` 에 승격되어 있지 않으므로, 다음 사람이 `spec/conventions/`
만 보고 "왜 이 가드가 허용목록을 쓰는가"를 판단할 근거가 없다 — 이는 이미 6라운드 연속
`--impl-done` 이 WARNING 으로 반복 확인해 온 것과 동일한 항목이며, 이번 라운드에서도 여전히
미해소다.

## 위험도

MEDIUM
