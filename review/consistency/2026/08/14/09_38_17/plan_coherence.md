### 발견사항

- **[WARNING]** SSE 필드명 매핑 blockquote 재작성이 하루 전 같은 worktree 가 "완료" 로 체크한
  바로 그 내용을 뒤집는데, target 이 그 plan 을 인지·인용하지 않는다
  - target 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 변경 제안 (3)
    "SSE 필드명 매핑 blockquote 정정"
  - 관련 plan: `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
    — 같은 worktree(`eia-r8-cache-scope-4ae434`), 2026-08-13 실행, 체크리스트
    "[x] §6.2 blockquote — 일반 봉투 규칙은 도입부로, 남은 것은 `waiting_for_input` 고유
    필드명 매핑뿐임을 명시"
  - 상세: `spec/5-system/14-external-interaction-api.md` §6.2 의 현재 blockquote(L680-690,
    `waiting_for_input` 의 SSE 필드명 매핑)는 바로 이 plan 이 어제 확정한 내용이다 —
    "본 이벤트는 [채널별 봉투 규칙] 위에 **필드명까지 달라지는 유일한 경우**" 라 명시하고
    `node.id → waitingNodeId` 류 화살표 매핑 6개를 나열한다. 그 plan은 §6.2 본문(JSON 예시)
    자체는 의도적으로 손대지 않고 "waiting 고유 필드 예시만 남긴다" 며 이 blockquote 를
    그대로 두는 것으로 "완료" 처리했다. target 의 실측(fanout 이 필드명을 바꾸지 않는다는
    `notification-fanout.service.ts:134` 확인)은 이 blockquote 의 전제 자체("필드명까지
    달라지는 유일한 경우")가 틀렸다고 결론짓는다 — 즉 target 은 이웃 plan 이 어제 "정답"
    으로 확정해 체크한 문구를 오늘 다시 "오답" 으로 뒤집는다. 기술적으로 target 의 결론이
    맞아 보이지만(§6 도입부의 "채널별 봉투" 절도 필드 재명명을 주장하지 않아 정합),
    target 은 이 관계를 전혀 언급하지 않는다 — `spec-draft-eia-notification-payload-contract.md`
    는 target 의 "다른 plan" 참조 어디에도 등장하지 않는다.
  - 제안: target 의 변경 제안 (3)에 `spec-draft-eia-notification-payload-contract.md` 를
    명시 인용하고, 그 plan 의 §6.2 blockquote 체크 항목 아래에 "실제로는 필드명 매핑이
    아니라 봉투 차이만 있었다 — `spec-draft-eia-62-waiting-payload.md` 가 정정" 같은
    후속 각주를 남길 것. 그렇지 않으면 그 plan 을 나중에 읽는 사람이 "필드명까지 다르다"
    라는 이미 반증된 전제를 다시 검토 없이 신뢰하게 된다.

- **[WARNING]** target frontmatter `spec_impact` 의 `spec/5-system/1-data-model.md` 경로가
  실재하지 않는다
  - target 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` frontmatter
    `spec_impact:` 2번째 항목
  - 관련 plan: 없음(target 자체 결함) — 단, `eia-terminal-payload.md` 의 "함께 넘기는
    spec 항목" 표가 같은 절(`1-data-model.md §2.14`)을 올바른 상대 표기(경로 접두어 없이)로
    이미 가리키고 있어 target 이 이를 frontmatter 로 옮기며 오기했을 가능성이 높다
  - 상세: 실제 파일은 루트 레벨 `spec/1-data-model.md` 이고 `spec/5-system/` 하위가
    아니다(`find spec -iname "*data-model*"` 로 확인, `spec/5-system/1-data-model.md` 는
    부재). target 이 고치려는 §2.14 "Execution.error ↔ NodeExecution.error 관계" 표
    (`nodeId: "uuid"` → nullable 로 갱신 대상)는 그 루트 파일에 실재한다 — 내용상의 대상
    식별은 맞고 frontmatter 의 경로 표기만 틀렸다.
  - 제안: frontmatter 를 `spec/1-data-model.md` 로 정정. spec_impact 는 Gate C
    (`spec-plan-completion.test.ts`)와 이후 consistency 라운드가 번들링 대상을 찾는 데
    쓰이므로, 틀린 경로는 그 항목이 조용히 스킵될 위험이 있다.

- **[INFO]** target 은 `eia-terminal-payload.md` 가 차단 사유로 등재한 4개 spec 항목
  (§6.2 봉투 CRITICAL·data-model §2.14·§6.2 URL·error.code 옵셔널)을 전부 포함하고
  범위를 오히려 넓힌다(interaction 블록 Planned 표기·SSE 필드명 매핑 정정 2건 추가) —
  구조적으로는 정합. 다만 확장된 두 항목이 `eia-terminal-payload.md` 원 표에 없던
  새 결정이므로, 그 plan 의 "함께 넘기는 spec 항목" 표도 이 draft 반영 후 4→6항목으로
  갱신해 두는 편이 추적 일관성에 낫다(현재도 기능적으로는 막히지 않음 — target 체크리스트의
  "`eia-terminal-payload.md` 차단 해제 후 `--impl-prep` 재실행" 항목이 사실상 같은 결과를
  낸다).

### 요약

target 은 `eia-terminal-payload.md` 가 요구하는 planner 턴(§6.2 봉투 정정·data-model
nullable·URL 정정·error.code 옵셔널)을 실측 기반으로 충실히 커버하고, 그 4항목을 넘어서는
결함(§6.2 안쪽 구조 전체가 실제 wire 와 다름·interaction 블록 처리·SSE 필드명 매핑 오류)까지
직접 코드를 읽어 확장한다. 다만 target 이 손대려는 §6.2 blockquote 는 **하루 전, 같은
worktree 의 다른 plan**(`spec-draft-eia-notification-payload-contract.md`)이 6차 반려
끝에 확정하고 체크한 내용과 정면으로 부딪히는데, target 은 이 관계를 인지·인용하지 않는다 —
기술적 결론은 옳아 보이나 이웃 plan 의 "완료" 기록이 stale 해지는 후속 갱신이 빠졌다.
frontmatter 의 spec_impact 경로 오기(`spec/5-system/1-data-model.md` → 실제
`spec/1-data-model.md`) 도 별도로 정정이 필요하다.

### 위험도
MEDIUM
