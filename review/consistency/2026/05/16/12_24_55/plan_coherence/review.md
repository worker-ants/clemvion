# Plan 정합성 Review

검토 대상: `plan/in-progress/spec-draft-data-model-install-token-followup.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-16
검토 worktree: `cafe24-app-url-detail-a7c3f4`

---

### 발견사항

- **[WARNING]** `spec/data-flow/integration.md §1.2.1` line 90 미정정 — target 이 "이미 반영됨" 으로 참조하나 실제로는 구 정책 잔존
  - target 위치: 본문 "정합성" 절 — "`spec/data-flow/integration.md §1.2.1` line 90" 을 새 정책 근거로 인용
  - 관련 plan: 없음 (미추적 drift)
  - 상세: target plan 은 "본 변경은 이미 머지된 두 spec 의 정책과 완전 일치" 하며 `spec/data-flow/integration.md §1.2.1` line 90 을 그 근거로 든다. 그러나 실제 해당 줄은 아직 `UPDATE integration SET status=connected, install_token=NULL, ...` 로 기록되어 있어 callback 성공 시 install_token 을 **소거** 하는 구 정책을 그대로 나타낸다. 새 persistent 정책(callback 성공 시 보존)이 해당 파일에 반영되지 않은 상태다.
  - 제안: `spec/data-flow/integration.md §1.2.1` line 90 의 mermaid sequence diagram 을 함께 정정하거나, 이를 별도 follow-up plan 항목으로 명시해야 한다. 현재 target plan 의 "정합성" 절은 근거가 부정확하므로 해당 줄 인용을 제거하거나 "아직 잔존 drift, 추가 정정 필요" 로 수정해야 한다.

- **[WARNING]** `spec/2-navigation/4-integration.md` Rationale "TTL 기준" 단락 내 callback 성공 NULL 문장 미정정
  - target 위치: 본문 "정합성" 절 — "`spec/2-navigation/4-integration.md` Rationale 'install_token TTL 24h'" 를 새 정책 근거로 인용
  - 관련 plan: 없음 (미추적 drift)
  - 상세: `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 단락의 "TTL 기준 (2026-05-15 갱신)" 문단 말미에 "callback 성공 시 `install_token` 과 함께 `install_token_issued_at` 도 NULL 로 비워진다." 가 잔존한다. 동 문서의 §6 상태 전이 표(line 598)와 §3.2(line 188)는 install_token 보존 정책을 명시하고 있어 같은 파일 내부에서 모순이 발생한다. target plan 은 이 단락을 정합 근거로 인용하나, 해당 단락은 구 정책 문장을 포함한다.
  - 제안: `spec/2-navigation/4-integration.md` Rationale TTL 기준 단락의 "callback 성공 시 ... NULL 로 비워진다" 문장을 target plan 변경 범위에 포함하거나, 별도 follow-up 항목으로 추가해야 한다. 인용 근거도 "§6 상태 전이 표 / §3.2 / §9.2" 등 올바른 줄로 교정이 필요하다.

- **[WARNING]** `cafe24-data-model-strengthen.md` plan 의 구현 체크박스가 구 정책(callback 성공 시 NULL)을 기반으로 완료 처리됨
  - target 위치: 없음 (plan 간 관계)
  - 관련 plan: `plan/in-progress/cafe24-data-model-strengthen.md` (worktree: `cafe24-data-model-strengthen-464de9`, 현재 worktree 미존재) — 단계 "결정 3" 체크박스 `handleCallback` 성공 분기: `installTokenIssuedAt = null` 로 install_token 과 함께 클리어
  - 상세: `cafe24-data-model-strengthen.md` 는 "handleCallback 성공 시 `installTokenIssuedAt=null` 클리어" 를 구현·테스트 모두 완료(✅) 처리했다. 해당 worktree 는 이미 소멸(merge 추정)했으므로 코드에 구 정책이 반영된 상태일 수 있다. target plan 이 `spec/1-data-model.md §2.10` 설명을 "callback 성공 시 보존"으로 정정하더라도 실제 백엔드 코드(`integration-oauth.service.ts` 의 `handleCallback`)가 아직 `installTokenIssuedAt = null` 로 동작한다면 spec ↔ 구현 간 새로운 drift 가 발생한다. 테스트(`integration-oauth.service.spec.ts`) 도 구 정책을 기준으로 작성되어 있어 spec 정정 이후 회귀 기준이 어긋난다.
  - 제안: target plan 에 "spec 정정 후 backend `handleCallback` 에서 `installTokenIssuedAt` 보존 처리로 변경 + 관련 테스트 갱신" 을 후속 항목으로 명시해야 한다. 아니면 별도 developer plan 을 생성해 구현을 spec 과 재동기화해야 한다.

- **[INFO]** `cafe24-pending-polish-followup.md` 내 미해결 항목과 부분 중복
  - target 위치: 없음 (plan 간 관계)
  - 관련 plan: `plan/in-progress/cafe24-pending-polish-followup.md` — "§6 mermaid `install_token` 보존 정책 명시 (callback 실패 시 install_token 유지)" 항목 미완료(`[ ]`)
  - 상세: `cafe24-pending-polish-followup.md` 는 §6 mermaid 의 install_token 보존 정책 명시를 별도 미완 항목으로 추적 중이다. target plan 이 `spec/1-data-model.md §2.10` 을 정정하면 이 followup 항목과 관련된 인접 정책 구역이 함께 갱신되어야 일관성이 유지된다. 직접 충돌은 아니나, target plan 완료 후 해당 followup 항목이 여전히 미완으로 남으면 두 문서 간 gap 이 지속된다.
  - 제안: target plan 완료 후 `cafe24-pending-polish-followup.md` 의 §6 항목을 re-assess 하여 여전히 유효한지, 또는 target plan 의 정정으로 커버됐는지 확인하고 체크박스를 갱신한다.

- **[INFO]** worktree 단독 점유 — 다른 활성 worktree 와 `spec/1-data-model.md §2.10` 동시 접근 없음
  - target 위치: frontmatter `worktree: cafe24-app-url-detail-a7c3f4`
  - 관련 plan: 해당 섹션을 현재 활성 수정 중인 다른 in-progress plan 없음
  - 상세: `cafe24-data-model-strengthen-464de9` worktree 는 이미 소멸. `cafe24-3rdparty-url-503aa0`, `cafe24-pending-polish-7fdb7e` 등 관련 worktree 도 소멸. `spec-update-impl-prep-findings.md`(worktree: `ai-thread-source-mark-7c4f2a`) 는 `spec/1-data-model.md §2.13` 만 다뤄 §2.10 과 겹치지 않는다. 현재 `cafe24-app-url-detail-a7c3f4` 가 `spec/1-data-model.md §2.10` 에 단독 접근하므로 worktree 경합 위험은 없다.
  - 제안: 추적 메모 — 이후 backend 구현 worktree 가 `handleCallback` 을 수정할 때 동일 영역 경합이 생길 수 있으므로, 해당 시점에 plan frontmatter 를 갱신하고 직렬화를 확인한다.

---

### 요약

target plan 은 `spec/1-data-model.md §2.10` 의 install_token / install_token_issued_at 컬럼 설명을 "callback 성공 시 NULL" 에서 "callback 성공 시 보존"으로 정정하는 순수 drift-fix 작업으로, 새 정책 도입 없이 이미 머지된 정책을 반영한다는 점에서 범위는 적절하다. 그러나 두 가지 미정정 drift 가 존재한다: (1) `spec/data-flow/integration.md §1.2.1` line 90 의 sequence diagram 이 여전히 `install_token=NULL` 을 표기하며, (2) `spec/2-navigation/4-integration.md` Rationale TTL 기준 단락에 "callback 성공 시 ... NULL 로 비워진다" 가 잔존한다. target plan 은 이 두 위치를 이미 정합한 근거로 인용하지만 사실과 다르다. 추가로 `cafe24-data-model-strengthen` 이 구 정책(callback 성공 시 NULL)으로 구현·테스트를 완료했으므로, spec 정정 이후 backend 구현도 함께 갱신되어야 완전한 정합이 달성된다. 이 후속 구현 갱신이 현 plan 에 명시되지 않은 점이 누락 위험이다.

---

### 위험도

MEDIUM
