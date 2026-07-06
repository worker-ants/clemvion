# Rationale 연속성 Check 리포트

- 검토 모드: --impl-done, scope=`spec/data-flow/`, diff-base=`origin/main`
- Target 문서: `spec/data-flow/0-overview.md`, `1-audit.md`, `10-triggers.md`, `11-workflow.md`, `12-workspace.md`, `13-agent-memory.md` (payload 발췌) + 다수 spec 의 `## Rationale` 발췌(비교 대상)
- 실제 `origin/main` 대비 uncommitted 변경분은 `spec/data-flow/8-notifications.md` 1개 파일뿐이며 (target payload 본문에는 미포함, `git diff origin/main -- spec/data-flow/` 로 확인), 이 변경은 자체 신규 Rationale("team_invite 채널 — 이메일 중복 회피")을 동반한 정석적인 결정 번복이다.

## 발견사항

- **[INFO]** `data-flow/11-workflow.md §3.3` 의 SoT 인용 섹션 번호 오류 (§8 → 실제로는 §6.0)
  - target 위치: `spec/data-flow/11-workflow.md` §3.3 `workflow_assistant_message` 의 role 시퀀스, 문장 "권위 정의·전이 규칙은 `spec/3-workflow-editor/4-ai-assistant.md` §8"
  - 과거 결정 출처: 해당 문구 없음 — 순수 cross-reference 사실 오류. `spec/3-workflow-editor/4-ai-assistant.md` 자체가 line 597 에서 "data-flow/11-workflow.md §3.3 과 동일 목록" 이라고 역참조하는 지점은 §8("LLM 시스템 프롬프트 구성")이 아니라 §6.0("Assistant message 응답 필드", `finishReason` 필드 정의가 있는 곳)이다. §8 은 시스템 프롬프트 구성 규칙만 다루며 role 시퀀스·finish_reason 전이 규칙이 없다.
  - 상세: Rationale-continuity 자체 위반은 아니지만, "권위 정의의 SoT" 를 잘못 가리키면 향후 이 필드의 전이 규칙이 바뀔 때 두 문서 중 어느 쪽이 갱신 대상인지 혼동을 유발해 결정 추적성이 끊길 위험이 있다. Rationale 연속성 점검이 의존하는 cross-reference 무결성이 이 지점에서 약화됨.
  - 제안: `spec/data-flow/11-workflow.md §3.3` 의 인용을 "§8" → "§6.0" 으로 정정.

## 검증한 항목 (문제 없음 — 정합 확인)

아래는 "기각된 대안 재도입" 또는 "무근거 번복" 의심 후보로 교차 검증했으나 모두 정합으로 확인된 항목이다.

1. **`team_invite` 알림 채널 하향 (`both`→`in_app`)** — `spec/data-flow/8-notifications.md` 의 유일한 실제 diff. 신규 `## Rationale` 항목("team_invite 채널 — 이메일 중복 회피")을 같은 커밋에 작성했고, 검토한 대안 (a)(b)(c) 를 모두 명시. 참조 spec (`spec/2-navigation/9-user-profile.md §5.1`) 도 동일 커밋 취지로 주석이 추가돼 cross-link 정합. **연속성 관점의 모범 사례** — 결정 번복 시 새 Rationale 동반 원칙(관점 3)을 정확히 충족.
2. **KB 원본 S3 키 `kb/{kbId}/{documentId}/...` (workspaceId prefix 제외)** — `spec/0-overview.md §2.7`/Rationale 과 `spec/data-flow/0-overview.md` 양쪽이 동일 채택안·동일 trade-off 를 기술. 과거 드리프트(다른 패턴 서술)는 이미 해소됐다고 명시적으로 각주 처리되어 재도입 위험 없음.
3. **`execution-continuation` durable 큐 (옛 Redis pub/sub·`pendingContinuations` fast-path 폐기)** — `spec/data-flow/0-overview.md §5` 의 "폐기" 서술을 코드로 재검증(`execution-engine.service.ts`, `form-interaction.service.ts`, `button-interaction.service.ts` 주석에 "옛 pendingContinuations 경로는 제거됐다" 명시). 재도입 흔적 없음.
4. **Schedule↔Trigger 양방향 동기화** — `spec/1-data-model.md §2.9.1` 의 "역방향도 동일" 계약과 `spec/data-flow/10-triggers.md §1.4`(2026-06-10 갭 해소로 명시)가 정합. 과거 gap 상태를 정확히 인지하고 해소 경위를 문서화했으며, 이전에 명시적으로 기각된 설계를 되살린 것이 아니라 명시된 목표 계약을 뒤늦게 충족한 사례.
5. **personal workspace 유일성 — 앱 레이어 강제, broad `@Unique(['ownerId','type'])` 제거** — `spec/data-flow/12-workspace.md` Rationale 의 "과거 데코레이터는 의미상 부정확해 제거" 주장을 `workspace.entity.ts` 주석으로 재검증, 일치. 부분 유니크 인덱스 도입은 "별도 hardening 마이그레이션으로 분리" 라고 명시해 향후 트랙을 열어두되 현재 상태를 정확히 반영.
6. **audit_log 커버리지 서술 폐기("모든 도메인 service 가 호출" → 실제로는 한정된 writer 목록)** — `spec/data-flow/1-audit.md` Rationale 이 스스로 "과거 서술 폐기" 를 명시하고 이유(부정확한 서술이었음)와 현재 SoT(§1.1 표)를 분명히 구분. 결정 번복이 아니라 정정이며 새 근거를 함께 기술 — 연속성 관점에서 문제 없음.

## 요약

이번 diff-base 대비 실질 변경분은 `spec/data-flow/8-notifications.md` 의 `team_invite` 채널 하향 1건뿐이며, 이는 자체 Rationale·대안 비교·연쇄 spec(§5.1) 갱신까지 포함한 모범적인 연속성 준수 사례로 확인됐다. payload 에 포함된 나머지 target 본문(0-overview/1-audit/10-triggers/11-workflow/12-workspace/13-agent-memory)은 신규 변경이 아니라 기존 spec 상태의 스냅샷으로 보이며, 각 문서의 Rationale 서술을 상호 참조 spec(`0-overview.md`, `1-data-model.md`, `9-user-profile.md` 등)과 대조한 결과 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 사례는 발견되지 않았다. 유일한 흠은 `11-workflow.md §3.3` 의 SoT 섹션 번호 인용 오류(§8 should be §6.0)로, Rationale 자체의 내용 문제가 아니라 추적성을 약화시키는 cross-reference 결함이라 INFO 등급으로 분류한다.

## 위험도

NONE
