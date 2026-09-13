# Rationale 연속성 검토

## 검토 범위 참고

`scope(spec/conventions/)` 델타는 0개 파일이다(이번 라운드도 spec 미변경, 코드 전용 커밋
`1a2e78519` — 라운드 7). 구현 diff(`git diff origin/main...HEAD -- codebase/`, 절대경로
워킹트리에서 직접 확인: `guide-error-code-{existence,scan}.ts` 삭제 + `guide-identifier-
{existence,scan}.ts` 신규, 총 5파일)는 과거 PR(`#1330`)이 세운 설계 원칙 하나를 명시적으로
번복하고 있고, 그 번복이 spec `## Rationale`로 승격됐는지가 본 검토의 핵심 대상이다. 이
항목은 `review/consistency/2026/09/13/{12_33_41 … 16_56_35}`에서 이미 6라운드 연속 WARNING으로
잡혀 있었고, 라운드 7 커밋도 이를 건드리지 않았으므로 계속 유효하다.

## 발견사항

- **[WARNING]** "허용목록 없음" 원칙 번복이 spec `## Rationale`에 여전히 없다 (7라운드 연속 미해소)
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
    상단 "## 허용목록을 둔다 — 그리고 그 결정의 대가를 적는다"(44~51행) 및
    `GUIDE_EXTERNAL_VOCABULARY` 정의(245~255행). 자매 테스트
    `guide-identifier-existence.test.ts`의 "외부 어휘 허용목록 — 은폐 수단이 되지 않도록"
    describe 블록(157행~)이 이 번복을 4개 강제 조건(외부 시스템명 의무·상한 5·인용 여부·
    기준집합 부재)으로 코드에 못박는다. `PROJECT.md`(가드 카탈로그)도 이번 커밋에서 갱신돼
    "SoT: `spec/conventions/user-guide-evidence.md §2`"라고 계속 주장한다.
  - 과거 결정 출처: spec `## Rationale`에는 원래도 없다 — 이것이 지적의 핵심이다. `#1330`이
    "허용목록 없음"을 설계 원칙으로 세운 근거는 그 파일 자신의 docstring에만 있었고,
    `spec/conventions/user-guide-evidence.md`(이 가드 가족이 자칭하는 SoT, `## Rationale`
    R-1~R-5)에는 이 가드 자체가 언급조차 없다 — §2 "Build-time 가드 (3건)" 표는 여전히
    `impl-anchor-existence`·`integrations-coverage`·`triggers-coverage` 3건만 열거하고,
    frontmatter `code:` 목록(7개 경로)에도 `guide-identifier-*` 3파일이 없다(직접 확인).
    즉 원칙도 그 번복도 spec 층에는 한 번도 승격된 적이 없다.
  - 상세: 코드 자체의 근거는 매우 상세하다 — 문맥 게이팅(`#1330`)이 이 가드를 만들게 한
    원래 결함(`MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL` 오기, `#1328`)을 못 잡는다는
    실측표, "전수 열거+허용목록 없음" 대 "허용목록 채택" 두 대안의 트레이드오프, 은폐 방지
    4강제까지 — criterion 3("결정의 무근거 번복")의 "새 Rationale 부재"에 정확히 해당하지만
    "무근거"는 전혀 아니다. 문제는 이 풍부한 근거가 spec 문서가 아니라 code 주석·plan
    트래커에만 산다는 것이다. `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (약 3247~3267행)이 이 정확한 갭을 planner 항목("`user-guide-evidence.md §2.1` 관계표에
    새 가드 2건이 빠져 있다")으로 등재해 두었고, "함께 등재할 Rationale: `#1330`이 세운
    '허용목록 없음' 원칙을 `#1331`이 실측으로 번복했다 … 표·frontmatter·Rationale을 한 턴에
    처리해야 한다"고 명시한다. 이 체크박스는 여전히 `- [ ]` (미완료)다.
  - 완화 요인 (판정에 반영): 이 PR 자신의 plan(`plan/in-progress/guide-identifier-existence.md`
    3~13행)이 `spec_impact: none`을 명시하면서 "`user-guide-evidence.md §2` 등재는 필요하고
    **developer 권한 밖**이라 planner 항목으로 등재돼 있다"고 스스로 정확히 인지·위임하고
    있다. `--impl-prep`(`12_33_41` WARNING#2)에서도 동일 항목이 "같은 planner 항목에 한 턴으로
    묶어 등재"로 처분됐고, 이후 라운드들이 코드를 계속 고치면서도(라운드 3~7) 이 항목에는
    손대지 않은 것은 **devloper 권한 경계를 정확히 지킨 결과**이지 은폐가 아니다. 즉 이것은
    투명하게 추적된 기술 부채이며, 매 라운드 반복 확인되는 것은 (a) developer 세션이 계속
    코드만 고치고 있고 (b) 아직 project-planner 턴이 오지 않았기 때문이다.
  - 제안: `codebase/` 쪽 추가 조치는 없음(developer 권한 밖, 이미 올바르게 위임됨). 다음
    project-planner 턴에서 `spec-draft-nullable-notation-followups.md`의 해당 체크박스를
    처리할 때 반드시 **한 턴**에: (1) `user-guide-evidence.md §2` 가드 표 3→5건 확장 +
    §2.1 관계표에 `guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`
    행 추가, (2) 같은 문서 frontmatter `code:`에 `guide-identifier-scan.ts`·
    `guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts` 3파일 추가,
    (3) 신규 `## Rationale` 항목("왜 허용목록 없음 원칙을 포기했는가" — 문맥 게이팅이 등재
    근거였던 결함 자체를 못 잡는다는 실측 + 은폐 방지 4강제)을 명문화할 것. 이 세 가지를
    분리 처리하면 plan이 이미 자기반증한 대로 "두 번 좁게 등재"가 재발한다.

## 요약

이번 라운드(커밋 `1a2e78519`, 라운드 7)는 스캐너의 정규식 경계 결함(CRITICAL 1건)을 고치는
코드 전용 변경으로, spec Rationale 연속성 관점에서 이전 6라운드 대비 새로운 결함을 만들지도,
기존 결함을 해소하지도 않았다. 유일한 지속 항목은 `#1330`이 세운 "허용목록 없음" 설계 원칙을
`#1331`(본 브랜치)이 실측 근거로 명시적으로 번복하면서도, 그 원칙과 번복 어느 쪽도 spec
`## Rationale`에 한 번도 승격되지 않았다는 점이다. 번복 자체는 근거가 충실하고(실패 재현
테스트·트레이드오프 비교·은폐 방지 4강제까지 코드에 명문화), developer가 spec 쓰기 권한이
없음을 정확히 인지해 planner 백로그 항목으로 명시적으로 위임한 상태이므로 은폐가 아니라
추적된 지연이다. 다만 지금 `spec/conventions/`만 보는 사람은 이 가드 가족의 존재도, 허용목록
채택 이유도 알 수 없다 — 이는 6라운드 연속 반복 확인된 것과 동일한 미해소 항목이다.

## 위험도

MEDIUM
