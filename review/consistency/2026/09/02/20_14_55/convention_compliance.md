# 정식 규약 준수 검토 — `spec-draft-ws-badge-flip-tracker-close.md`

검토 모드: spec draft 검토 (`--spec`)
대상: `plan/in-progress/spec-draft-ws-badge-flip-tracker-close.md`
비교 대상 정식 규약: `spec/conventions/spec-impl-evidence.md`, `spec/conventions/audit-actions.md`,
`.claude/skills/project-planner/SKILL.md`(명명 컨벤션), `.claude/docs/plan-lifecycle.md`(CLAUDE.md 가 SoT 로 지목)

## 사전 검증 (실측)

target 문서가 인용하는 모든 수치·줄 번호를 원본에 대조했다.

- `spec-impl-evidence.md §3.1` "partial → implemented: 마지막 pending_plans 가 complete/ 로 이동한
  commit 안에서 승격 (가드)" — target 결정①의 인용과 **정확히 일치**.
- `spec/5-system/6-websocket-protocol.md` frontmatter — `status: partial`, `pending_plans:` 가
  `plan/in-progress/spec-sync-websocket-protocol-gaps.md` **단 1건** — target 이 "마지막
  pending_plans" 라고 부르는 전제가 실측과 일치.
  `code:` 는 이미 11개 경로를 보유해 `implemented` 승격 후에도 `spec-code-paths.test.ts`
  (≥1 매치 의무) 를 그대로 만족.
- 인용 줄 번호(`:28`, `:52`, `:876`(§4.6 표), `:1096`, `:1100`, `:1101`, `:1115`, `:1133`,
  `R-ws-socket-lifetime-binds-token` 앵커) 전부 `grep -n` 대조로 **정확**.
- `spec/5-system/2-api-convention.md §10.4` 원문 — "연결 끊김 시 지수 백오프로 재연결 (…) /
  재연결 시 마지막 수신 이벤트 ID 전달" — target 의 인용과 일치. frontmatter `status: implemented`
  로 결정②는 status 전이 규칙 적용 대상이 아님(맞게 처리 — frontmatter 변경 없음).
- `plan/in-progress/spec-sync-websocket-protocol-gaps.md` — 미체크 `[ ]` 는 `:23`
  (`auth.token_expired` emit) **1건뿐**. target 이 "마지막 열린 항목" 이라 부르는 근거가 실측과
  일치. `started: 2026-06-03` < Gate C cutoff `2026-06-04` → grandfather 대상이라
  `spec_impact` 미기재 상태로 `complete/` 이동해도 `spec-plan-completion.test.ts` 위반 아님(정확).
- `spec-draft-ws-wontdo-maintenance-appping.md` / `spec-draft-ws-socket-lifetime-binds-token.md` —
  둘 다 `started: 2026-09-02`(cutoff 이후)이고 frontmatter 에 이미 `spec_impact` 를 **리스트**로
  선언(`spec/5-system/6-websocket-protocol.md`, 실존 경로) — Gate C 의 "흔한 실패형"(bare
  string·빈 배열)을 밟지 않음.
- `ws-token-expired-socket-lifetime-impl.md` 체크리스트 — target 이 지목한 "이 planner 항목"
  (`:94` "머지 후 planner 턴")과 "PR" 항목(`:83`) 모두 실측상 `[ ]` 로 남아 있어 이번 draft 가
  체크 대상으로 삼는 것이 맞음.

## 발견사항

- **[WARNING] plan 자가 점검용 체크박스 지시가 대상 항목 하나를 놓칠 위험**
  - target 위치: "변경안 — spec 8곳 · plan 9곳 전수" 표, `#14` 행
    (`ws-token-expired-socket-lifetime-impl.md | PR 체크 + 이 planner 항목 [x]. in-progress 유지…`)
  - 위반/근접 규약: `.claude/docs/plan-lifecycle.md §5` "이동 commit 자가 점검" — "plan 체크박스 =
    실제 상태" 원칙(체크는 실제로 해소된 항목만, 해소된 항목은 남기지 않음). CLAUDE.md 가
    plan-lifecycle.md 를 라이프사이클의 SSOT 로 지목하므로 본 검토 범위(§3 문서 구조 규약)에
    포함시켰다.
  - 상세: `ws-token-expired-socket-lifetime-impl.md` 에는 **열린 "planner 트랙" 항목이 둘**이다 —
    (a) `:94` "머지 후 planner 턴 — 배지 flip(§1.2·§4.6·Rationale·`:28`)", (b) `:121`
    "`2-api-convention.md §10.4` 재연결 요약이 이제 오해를 부른다 (`--impl-done` W1, planner 트랙)".
    target 의 **결정①**은 (a) 를, **결정②**는 (b) 를 각각 실질적으로 해소하는데, `#14` 행은
    "이 planner 항목 [x]" 라고 **단수**로만 적어 어느 쪽(혹은 둘 다)을 가리키는지 모호하다.
    이대로 집행하면 (b) 가 실제로는 해소됐는데도 체크박스가 `[ ]` 로 남아 "plan 체크박스 = 실제
    상태" 를 깨는 결과를 낳을 수 있다(이 저장소가 반복해 겪은 실패형 — MEMORY
    `feedback_stale_plan_claims_and_checklist_sync.md` 부류).
  - 제안: `#14` 행을 "PR 체크 + **두 planner 항목** `:94`(배지 flip)·`:121`(§10.4) 모두 `[x]`"
    로 명시하거나, 최소한 "이 planner 항목들" 로 복수화해 실행자가 두 줄 다 확인하게 한다.

- **[INFO] "체크리스트 채움" 지시가 체크박스 없는 문서를 가리켜 모호함**
  - target 위치: plan 변경 표 `#12` 행
    (`spec-draft-ws-wontdo-maintenance-appping.md | 체크리스트 채움 + complete/ 이동…`)
  - 위반/근접 규약: `.claude/docs/plan-lifecycle.md §2`(작업 plan 분류 기준 — 미체크 체크박스 유무로
    in-progress/complete 판별) · §5(이동 자가 점검 "모든 체크박스가 [x] 인가").
  - 상세: 실측상 `spec-draft-ws-wontdo-maintenance-appping.md` 본문에는 `- [ ]`/`- [x]` 형태의
    체크박스가 **하나도 없다**(변경안이 번호 매김 표 형식). "체크리스트 채움" 이 (i) 존재하지
    않는 체크박스를 새로 만들어 채우라는 뜻인지, (ii) 단순히 "완료 확인" 노트를 추가하라는
    뜻인지 불명확하다. plan-lifecycle §2 기준으로는 이 문서에 미체크 항목이 원래 없으므로
    (vacuous) `complete/` 이동 자체는 규약 위반이 아니지만, 지시문의 "채움" 표현이 다음
    실행자에게 잘못된 작업(없는 체크박스를 찾는 것)을 유발할 수 있다.
  - 제안: "체크리스트 채움" → "완료 확인 노트 추가"(또는 `--impl-done` INFO#2 가 요구하는
    구체 문구를 그대로 인용)로 표현을 좁힌다.

- **[WARNING] "전수" 헤더 카운트가 실제 표 행 수와 어긋남**
  - target 위치: `## 변경안 — spec 8곳 · plan 9곳 전수` 헤더
  - 위반/근접 규약: 직접 대응하는 `spec/conventions/**` 항목은 없음(엄밀히는 본 checker 의
    5대 관점 밖일 수 있어 참고용으로 남긴다) — 다만 CLAUDE.md/plan-lifecycle 문서들이 요구하는
    "plan 서술 = 실제 상태" 정신, 그리고 바로 이 target 문서 계열의 자매 문서
    (`spec-draft-ws-wontdo-maintenance-appping.md` 상단 "초판은 '9개 자리 전수' 라 적고 spec/
    안에서만 셌다…")가 **동일한 결함 클래스**를 이미 한 번 자체 발견·정정한 전례가 있다는 점에서
    반복 위험 신호로 기록한다.
  - 상세: "spec" 표는 `#1`~`#10` 로 **10행**인데 헤더는 "8곳", "plan" 표는 `#11`~`#16` 로
    **6행**인데 헤더는 "9곳" 이다. 어느 쪽으로 세어도(행 수 기준, 또는 `#8`·`#15`·`#16` 처럼
    한 행에 여러 위치가 묶인 것을 낱개로 푸는 기준) 8/9 와 정확히 맞아떨어지지 않는다.
  - 제안: 자매 문서가 쓴 정정 패턴("두 축으로 셌다" 각주)처럼, 최종 커밋 전에 표 행을 실제로
    세어 헤더 숫자를 재계산하거나, 숫자 대신 "spec 전수 · plan 전수" 로 서술해 수치 드리프트
    표면을 없앤다.

## 요약

target spec draft 는 정식 규약(`spec-impl-evidence.md` 의 status 전이 가드, Gate C `spec_impact`
리스트 스키마, `plan-lifecycle.md` 의 이동·인입참조·outgoing 링크 규칙) 을 이례적으로 정밀하게
준수한다 — 인용한 모든 줄 번호·frontmatter 값·체크박스 상태를 원본과 대조한 결과 전부 정확했고,
`developer` 자기-반증형 소정정 예외를 배제한 근거(제품 정의 텍스트라 조건 2 미충족)도 CLAUDE.md
조건과 정합했다. 발견된 문제는 모두 **규약 위반이 아니라 규약이 요구하는 "체크박스=실제 상태"
정신을 다음 실행자가 오독할 수 있는 서술 모호성**(단수/복수 표현, "채움" 동사의 대상 부재,
헤더 카운트 드리프트)에 국한되며, 이 문서 계열이 이미 한 번 스스로 잡아낸 것과 같은 결함
클래스가 재발할 조짐이라 WARNING 으로 표시했다. Critical 은 없다.

## 위험도
LOW
