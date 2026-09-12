# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-setup-error-classification.md`

## 발견사항

- **[WARNING] frontmatter `worktree:` 값이 확립된 표기(디렉토리 이름)가 아니라 전체 경로다**
  - target 위치: frontmatter `worktree: .claude/worktrees/spec-setup-error-classification-5e5a82`
  - 위반 규약: [`.claude/docs/plan-lifecycle.md §4`](../../../../../.claude/docs/plan-lifecycle.md) —
    `worktree: <task_name>-<slug>     # 이 plan 이 살아있는 worktree 디렉토리 이름`
  - 상세: 같은 스키마를 쓰는 다른 `spec-draft-*.md` 전부가 **디렉토리 이름만**(bare `<task>-<slug>`)
    적는다 — 실측: `spec-draft-eia-62-waiting-payload.md` → `worktree: eia-r8-cache-scope-4ae434`,
    `spec-draft-eia-notification-payload-contract.md` → `worktree: eia-r8-cache-scope-4ae434`,
    `spec-draft-nullable-notation-followups.md` → `worktree: plan-in-progress-items-b0c80b`.
    target 만 `.claude/worktrees/` 접두를 포함한 상대경로를 쓴다. `plan-frontmatter.test.ts` 는
    현재 "비어있지 않음 + placeholder 아님" 만 검사해 이 형태도 통과하지만(가드가 값 형태까지는
    강제하지 않음 — 실측: `plan-scan.ts` 의 `worktree-missing`/`worktree-placeholder` 두 분기뿐),
    `plan-lifecycle.md` 가 명시한 표기와 다르고 자매 문서 3건과도 어긋난다.
  - 제안: `worktree: spec-setup-error-classification-5e5a82` 로 정정 (디렉토리 이름만).

- **[WARNING] 재확정하는 `502 CHAT_CHANNEL_SETUP_FAILED` 가 두 축에서 근거가 흔들린다**
  - target 위치: "### (1) `15-chat-channel.md §5.4` 에러 표 두 행" 및 "편집 대상 원문 ⓐ/ⓒ"
  - 위반 규약: [`spec/5-system/2-api-convention.md §6`](../../../../../spec/5-system/2-api-convention.md#6-http-상태-코드)
    (HTTP 상태 코드 선택의 SoT — [`error-codes.md`](../../../../../spec/conventions/error-codes.md)
    가 그렇게 위임한다)
  - 상세: §6 의 HTTP 상태 코드 표에는 `200/201/202/204/400/401/403/404/409/410/413/422/429/500/503`
    만 있고 **`502` 항목이 없다**. 저장소 전체에서 이 문서(§5.4)만 자기 API 응답 status 로 `502` 를
    실제로 쓴다(`3-error-handling.md` 의 `502` 두 곳은 Code 노드가 소비하는 **외부** HTTP 응답
    예시일 뿐 이 시스템의 API status 가 아니다). 게다가 `4-execution-engine.md` 는 "Redis 장애는
    502(잘못된 게이트웨이 응답)가 아니라 503(일시 불가·재시도)" 이라는 명시적 구분 원칙을 남겨 뒀는데,
    §5.4 의 `502` 가 이 구분에 부합하는지 §6 에 한 번도 등재되지 않아 판단할 SoT 가 없다.
    **더 크게는**, target 이 그대로 인용한 ⓒ 현재 구현이 `CHAT_CHANNEL_SETUP_FAILED` 분기에서도
    `new BadRequestException(...)` 을 던진다 — Nest 의 `BadRequestException` 은 **항상 400** 을
    내므로, 이 분기는 스펙이 주장하는 502 를 **한 번도 실제로 만들어 낸 적이 없다**
    (`chat-channel-input-rules.spec.ts` 의 두 테스트도 `.getResponse().code` 만 보고 실제
    HTTP status(`getStatus()`)는 단언하지 않는다 — 테스트 제목의 "502" 는 검증되지 않은 라벨이다).
    target 의 "④ 구현 위임" 목록(1~5)은 접두 판별 로직만 다루고 이 exception-class/실제-status
    불일치는 항목화하지 않아, 이 draft 가 착지해도 §5.4 표는 여전히 코드가 만들 수 없는 상태를
    문서화하게 된다.
  - 제안: (a) `2-api-convention.md §6` 에 `502` 행을 신설하거나 §5.4 자체가 예외임을 명시 —
    project-planner 소관. (b) "구현 위임" 목록에 "`translateSetupChannelError` 의 fallback 분기가
    실제로 `BadGatewayException`(502) 을 던지는지 확인·정정" 항목 추가(developer 소관). 현재
    누락 상태로 착지하면 §5.4 재작성 직후에도 "502" 서술이 여전히 미실증 상태로 남는다.

- **[INFO] `[CCA §R-CCA-N]` cross-file 인용 포맷을 아직 반영하지 않았다**
  - target 위치: "## Rationale (spec 에 실을 근거) — `R-CC-23`" 문단
  - 위반 규약: [`spec/5-system/15-chat-channel.md` "Rationale ID 컨벤션"](../../../../../spec/5-system/15-chat-channel.md#rationale-id-컨벤션)
    · [`spec/conventions/chat-channel-adapter.md` 동 컨벤션 문단](../../../../../spec/conventions/chat-channel-adapter.md#rationale)
  - 상세: 두 컨벤션 문단 모두 "cross-file 인용 시에는 `[CCA §R-CCA-N]` 형태로 파일 prefix 명시"
    를 요구한다. `R-CC-23`(15-chat-channel.md)과 `R-CCA-9`(chat-channel-adapter.md)는 같은 결정을
    양쪽에 나눠 신설하는 짝이라 상호 인용이 예상되는데, target 은 아직 논지만 bullet 로 스케치했고
    실제 prose 인용 포맷을 정하지 않았다. draft 단계라 위반은 아니나, 실제 spec 반영 시 두 Rationale
    항목이 서로를 인용할 때 이 포맷을 놓치기 쉬운 지점이라 표시해 둔다.
  - 제안: spec 반영 커밋에서 `R-CC-23` 본문이 adapter 쪽을 가리킬 때 `[CCA §R-CCA-9]` 형태를,
    `R-CCA-9` 본문이 spec 쪽을 가리킬 때는 자매 파일 prefix 없이 `R-CC-23`(같은 파일이 아니므로
    파일명 명시, 예: `[Chat Channel §R-CC-23]`) 형태를 쓸 것.

## 검토 확인된 준수 사항 (참고)

- ⓐⓑⓒⓓ 네 개의 "편집 대상 원문" 인용은 전부 현재 저장소 상태와 **byte-단위로 일치**
  (`spec/5-system/15-chat-channel.md:366`, `spec/conventions/chat-channel-adapter.md:127`,
  `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:310-324`,
  `discord.adapter.ts:94`/`slack.adapter.ts`/`telegram-client.ts`) — 실측으로 확인.
- Rationale ID 채번은 두 파일 모두 실제 최댓값(`R-CC-22`, `R-CCA-8`) 대비 `+1` 로 정확 —
  `R-CC-14` 결번 주장도 grep 으로 확인됨(재사용 표시가 옳음).
- `providers/{slack,discord,telegram}.md §3.1` 참조는 세 파일 모두 실재.
- HTTP 상태코드 변경(400 관련 서술)을 **자기-반증형 소정정 조건 2**(API 계약은 예외 대상 아님)로
  정확히 배제하고 planner 턴으로 넘긴 판단은 `CLAUDE.md` 서술과 정합.
- `## 체크리스트` 를 `## Rationale` 뒤에 두는 구조는 이 저장소의 다른 `spec-draft-*.md`
  (예: `spec-draft-eia-62-waiting-payload.md`)와 동일한 선례 패턴 — 위반 아님.
- `#1316` 인용(details.code 승격 선례)은 `git log` 로 실재 확인.

## 요약

target 문서 자체의 spec/conventions 직접 위반(CRITICAL)은 발견되지 않았다. 다만 (1) frontmatter
`worktree:` 표기가 `plan-lifecycle.md §4` 및 동일 계열 draft 3건의 확립된 관행(디렉토리 이름만)에서
벗어나 있고, (2) 이 draft 가 그대로 유지하는 `502 CHAT_CHANNEL_SETUP_FAILED` 서술이 `2-api-convention.md
§6` HTTP 상태 코드 SoT 에 등재되지 않은 값이며, 심지어 draft 자신이 인용한 현재 구현 코드는 그 분기에서도
`BadRequestException`(400)만 던져 "502" 가 실제로 발생한 적이 없다는 사실이 "구현 위임" 목록에 반영돼
있지 않다. 두 항목 모두 이 draft 를 spec 에 반영하기 전에 처리하면 좋을 실질적 gap 이며, WARNING 등급이
적절하다.

## 위험도
LOW
