### 발견사항

- **[INFO]** target 변경이 완료된 plan(unified-model-management PR4b)의 후속 작업과 정합
  - target 위치: `spec/2-navigation/6-config.md` 라인 240 (B.6.2 표 Base URL 행), 라인 324 (R-4 Rationale)
  - 관련 plan: `plan/complete/unified-model-management.md` §PR4b, §7 "#21 구 에러 코드 호환성"
  - 상세: 이 worktree 는 `RERANK_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 로 2곳을 수정한다. `plan/complete/unified-model-management.md` §PR4b (완료 표기)에서 "LLM_CONFIG_*→MODEL_CONFIG_* 통일"이 처리됐고, §7 "#21"에서 `RERANK_CONFIG_*`→`MODEL_CONFIG_*` 변경이 언급된다. 그러나 PR4b 완료 기록 본문에는 "에러코드 통일"이 포함됐다고 표기되어 있으나, main 브랜치의 `spec/2-navigation/6-config.md`에는 여전히 `RERANK_CONFIG_INVALID` 두 곳이 잔존한다. 본 worktree 변경은 이 잔여 드리프트를 해소하는 것으로, 이미 완료 처리된 plan 의 누락된 spec 수정을 보완한다.
  - 제안: 충돌 없음. target 수정은 plan 결정(MODEL_CONFIG_* 통일)과 정합한다.

- **[INFO]** R-4 Rationale 수정에서 `local` 리랭커 provider 에 대한 추가 서술 변경
  - target 위치: `spec/2-navigation/6-config.md` R-4 (라인 324)
  - 관련 plan: `plan/in-progress/spec-draft-unified-model-management.md` §변경 3 (7-llm-client.md §5.5), `plan/complete/unified-model-management.md` §PR4a
  - 상세: target 은 R-4 Rationale 에서 `"tei/local 만 예외"` → `"rerank 에선 tei 만 예외 — local 리랭커 provider 는 Dropped([LLM Client §2.1])"` 로 정밀화했다. 이는 `spec/5-system/7-llm-client.md §2.1` 이 이미 `local` 리랭커를 Dropped 상태로 명시한다면 정합하나, 해당 spec 을 별도 확인할 필요가 있다. `spec-draft-unified-model-management.md`(in-progress) 에서 llm-client §5.5 tei/local 예외 규칙 재사용을 언급하나, local 리랭커 Dropped 결정이 in-progress plan 의 미결 항목과 충돌하지는 않는다.
  - 제안: 이슈 없음. 추적 확인만 권장.

- **[INFO]** `spec-sync-config-gaps.md`(in-progress)가 `pending_plans` 에 아직 등재됨
  - target 위치: `spec/2-navigation/6-config.md` frontmatter `pending_plans`
  - 관련 plan: `plan/in-progress/spec-sync-config-gaps.md`
  - 상세: target 의 frontmatter 는 `plan/in-progress/spec-sync-config-gaps.md` 만 `pending_plans`로 등재한다. 해당 plan 의 모든 항목(§A.2, §A.3, C-2, God Component 분리, RBAC 가드)은 완료 표기([x])되어 있다. 단 plan 파일 자체는 `plan/in-progress/`에 잔존한다. 이는 plan-lifecycle 규약에 따라 별도 이동 작업이 필요하나 본 worktree 의 에러코드 수정 범위와 직접 충돌하지는 않는다.
  - 제안: plan 자체는 별 작업에서 `plan/complete/`로 이동 요망. 본 target 변경과 무관.

### 요약

이 worktree(`spec-fix-models-errorcode`)는 `spec/2-navigation/6-config.md`의 두 곳에 잔존하던 구 에러 코드 `RERANK_CONFIG_INVALID`를 `MODEL_CONFIG_INVALID`로 교체한다. 이 변경은 `plan/complete/unified-model-management.md` PR4b에서 결정·완료된 에러코드 통일 방향과 완전히 일치하며, 미해결 결정을 우회하거나 선행 plan 의 미해소 사전 조건을 위반하는 항목은 없다. in-progress plan(`spec-draft-unified-model-management.md`, `spec-sync-config-gaps.md`) 어느 것도 이 변경과 충돌하지 않으며, 후속 plan 갱신이 필요한 새로운 의존성도 발생하지 않는다. 유일한 잔여 사항은 `spec-sync-config-gaps.md`가 전 항목 완료임에도 `plan/in-progress/`에 남아 있다는 점이나, 이는 plan-lifecycle 이동 문제로 본 변경과 무관하다.

### 위험도

NONE
