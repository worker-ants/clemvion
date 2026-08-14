# Plan 정합성 검토 — plan_coherence

## 검토 대상 요약

이번 diff(`origin/main...HEAD`)는 `spec/5-system/**` 를 직접 수정하지 않고, `llmCalls`(raw LLM
요청/응답) 외부 유출을 막는 보안 수정을 담는다 — (a) 외부 fanout(SSE/webhook/chat-channel)의
strip 을 depth-1 → 깊이 무관으로 강화(`stripExternalOnlyFields`, `81f2c60d6`), (b) 같은 필드가
REST 단발 조회(`InteractionService.getStatus`)로도 새는 것을 발견해 같은 유틸을 그 경로에도
적용(`34e32e62f`, `12_06_21` cross_spec CRITICAL 1 대응). 이 작업은
`plan/in-progress/spec-draft-eia-62-waiting-payload.md` 의 "🔴 조사 중 발견" 절에서 추적된다.

코드 수정 자체는 실증 테스트로 뒷받침되고 plan 체크리스트도 대체로 갱신됐다. 다만 **코드가
새로 만든 spec 후속 의무 하나**와 **커밋 메시지가 약속한 형제 plan 갱신 하나**가 실제로는
반영되지 않은 채 남아 있다.

---

## 발견사항

### [WARNING] REST `getStatus` strip 적용이 만든 spec 후속 의무가 어느 plan 에도 등재되지 않았다

- **target 위치**: `codebase/backend/src/modules/external-interaction/interaction.service.ts:342-355`
  (`stripExternalOnlyFields(deepRedactSecrets(nodeExec.outputData ?? {}), MAX_REDACT_DEPTH)` 신규
  적용) vs `spec/5-system/14-external-interaction-api.md:1346-1355`(§R17 "표면 제약(보안)")
- **관련 plan**: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 변경 제안 (7)
  ("`llmCalls` strip SoT 가 실제 누출 표면을 안 덮는다") · `plan/in-progress/
  spec-sync-external-interaction-api-gaps.md`(§14 gap 의 "정본" 트래커, 이미 "getStatus 일반
  nodeOutput 키-allowlist (§R17 잔여)" 항목은 있으나 이 항목과는 다른 sub-issue)
- **상세**: `12_06_21` cross_spec CRITICAL 1 은 "`getStatus` 가 `deepRedactSecrets` 값-마스킹만
  거쳐 `nodeOutput.meta.turnDebug[].llmCalls` 를 그대로 반환한다"를 지적하며, 처방 ①(코드
  strip)과 함께 처방 ②"`spec/5-system/14-external-interaction-api.md` §R17 에 `getStatus` 의
  `llmCalls` 처리를 명시적으로 추가"를 요구했다. 이번 diff(`34e32e62f`)는 처방 ①만 구현했다
  (`interaction.service.ts:349` `stripExternalOnlyFields` 신규 적용, 실증 테스트 45줄 추가
  확인). 그런데 §R17 본문(:1350-1351)은 여전히 "`getStatus` 는 `nodeOutput` 전체 + terminal
  `result`/`error` 의 `outputData` 를 `deepRedactSecrets` 로 마스킹한다"라고만 적어, 코드가
  실제로 하는 일(strip 선행 + redact)보다 좁다. 이는 이 브랜치가 §6.2/WS §4.4 에 대해 이미
  등재해 둔 것과 **같은 클래스의 드리프트**("문서의 보호 선언이 실제 표면보다 좁다", 변경 제안
  (7))가 §R17 에도 새로 생겼다는 뜻인데, 정작 그 사실은 `spec-draft-eia-62-waiting-payload.md`
  의 (7) 절이나 다른 어떤 plan/in-progress 문서에도 등재되지 않았다. developer 는 `spec/` 쓰기
  권한이 없어(CLAUDE.md §Skill 체계) 이 갱신은 planner 인계가 필요한데, 그 인계 자체가
  누락됐다.
- **제안**: `spec-draft-eia-62-waiting-payload.md` 변경 제안 (7) 또는
  `spec-sync-external-interaction-api-gaps.md` 에 "§R17 — `getStatus` 도 `stripExternalOnlyFields`
  를 거친다는 사실 명시(`34e32e62f`)" 항목을 신설해 planner 인계로 등재한다.

### [WARNING] 커밋이 약속한 "형제 plan 반증 각주"가 실제로는 기록되지 않았다

- **target 위치**: 커밋 `34e32e62f` 메시지("형제 plan 반증 각주를 이 작업의 일부로 포함한다")
  vs `git diff origin/main HEAD -- plan/in-progress/spec-draft-eia-notification-payload-contract.md`
  (0 변경 — 이 브랜치 전체에서 해당 파일은 한 번도 수정되지 않았다)
- **관련 plan**: `plan/in-progress/spec-draft-eia-notification-payload-contract.md:228-229`
  (체크리스트 `[x]` "§6.2 blockquote — 일반 봉투 규칙은 도입부로, 남은 것은 `waiting_for_input`
  **고유 필드명 매핑**뿐임을 명시") vs `plan/in-progress/spec-draft-eia-62-waiting-payload.md`
  변경 제안 (3)의 각주("**형제 plan 과 충돌한다**(`12_06_21` plan_coherence W5) ... 그 전제가
  실측으로 반증됐다. 그 plan 에 반증 각주를 다는 것을 이 작업의 일부로 포함한다")
- **상세**: `spec-draft-eia-62-waiting-payload.md` 는 실측으로 "§6.2 에 남은 결함은 필드명
  매핑뿐이 아니라 **봉투(payload 래퍼) 누락**도 있다"를 확인했고, 이는
  `spec-draft-eia-notification-payload-contract.md` 가 이미 `[x]` 로 완료 처리한 전제("남은
  것은 필드명 매핑뿐")를 정면으로 반증한다. `34e32e62f` 커밋 메시지는 이 반증 각주를 "이 작업의
  일부로 포함한다"고 명시적으로 약속했으나, 실제 diff 는 그 plan 파일을 전혀 건드리지 않았다
  (git diff 확인, 0줄). 결과적으로 `spec-draft-eia-notification-payload-contract.md`(아직
  `status: in-progress`, `plan/complete/` 로 이관되지 않음)는 지금도 반증된 전제를 `[x]` 완료로
  표시한 채 남아 있다 — 다음 planner 턴이 이 문서만 보고 §6.2 재작성을 "필드명 매핑만 손보면
  된다"고 판단하면 봉투 누락을 놓친다.
- **제안**: `spec-draft-eia-notification-payload-contract.md:228-229` 옆에 "실측으로 전제 일부
  반증됨 — §6.2 봉투 누락은 별도 잔존(`spec-draft-eia-62-waiting-payload.md` 변경 제안 (1))"
  각주를 추가하거나 최소한 두 문서를 교차 링크한다.

### [INFO] CHANGELOG 가 두 유출 경로 중 하나만 기록한다

- **target 위치**: `CHANGELOG.md:3-24`("(보안) 외부 fanout 의 `llmCalls` strip 이 depth-1 이라
  raw 프롬프트가 새고 있었다" 항목, fanout 경로만 서술)
- **관련 plan**: `spec-draft-eia-62-waiting-payload.md` "처분 (실제 상태)" 절의 "이미 유출된
  데이터에 대한 사후 대응 — 운영 판단 필요" 항목
- **상세**: `34e32e62f`(REST `getStatus` 경로 fix)는 CHANGELOG 에 별도 항목을 추가하지 않았다.
  두 경로 모두 "이미 전송된 데이터" 성격이 같으므로, 사후 통지 판단 시 REST 경로로 새어나간
  것까지 포함해 판단해야 한다는 점이 CHANGELOG 만 봐서는 드러나지 않는다.
- **제안**: 급하지 않음 — plan 문서(`spec-draft-eia-62-waiting-payload.md`)에는 이미 통합
  서술이 있으므로, CHANGELOG 항목 제목에 "(REST 스냅샷 포함)" 정도만 덧붙이면 충분하다.

---

## 요약

이번 diff 는 `12_06_21` cross_spec CRITICAL 1(REST `getStatus` 의 `llmCalls` 우회 노출)을
코드 레벨에서 정확히 해소했고 관련 plan 체크리스트도 대부분 갱신됐다. 그러나 그 CRITICAL 이
요구한 두 후속 중 spec 문서(§R17) 갱신은 어느 plan 에도 등재되지 않았고, 같은 커밋이 명시적으로
약속한 형제 plan(`spec-draft-eia-notification-payload-contract.md`)의 반증 각주도 실제로는
작성되지 않아 그 문서는 지금도 반증된 전제를 완료로 표시한 채 남아 있다. 코드 수정 자체를
막을 문제는 아니나, 두 건 모두 다음 planner 턴이 놓치기 쉬운 "약속됐지만 실행 안 된 후속"이라
WARNING 으로 등재해 갱신을 권한다.

## 위험도

MEDIUM
