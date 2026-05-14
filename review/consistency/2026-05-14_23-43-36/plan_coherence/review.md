---

## 발견사항

---

### [WARNING] `cafe24-pending-polish-followup.md` `worktree` 필드 불일치

- **target 위치**: 해당 없음 (plan 문서 메타데이터 문제)
- **관련 plan**: `plan/in-progress/cafe24-pending-polish-followup.md` frontmatter `worktree: (none — PR #18 머지 후 새 worktree 에서 진행)`
- **상세**: 현재 `cafe24-followup-legacy-mask-0ad56a` 워크트리에서 그룹 C/D/E 항목이 커밋으로 진행됨(`dd88ccff`, `a8783a9c`, `f774e6e4`). 그러나 plan frontmatter 는 `worktree: (none)` 그대로. consistency-checker `plan_coherence` checker 가 이 불일치를 감지한다.
- **제안**: plan `worktree` 필드를 `cafe24-followup-legacy-mask-0ad56a` 로 갱신.

---

### [WARNING] B그룹 TTL 기준 분리 구현 시 spec 갱신 범위 불명확

- **target 위치**: `spec/2-navigation/4-integration.md` §6 상태 전이 표 ("install_token 발급 후 24시간 내 callback 미성공"), Rationale §"install_token TTL 24h"
- **관련 plan**: `plan/in-progress/cafe24-pending-polish-followup.md` 그룹 B — "TTL 기준 분리. `installTokenIssuedAt` 컬럼 (V0XX 마이그레이션) 추가 후 TTL 기준을 옮긴다. … 그룹 B 의 advisory lock / installTokenIssuedAt 은 spec 갱신을 동반하므로 project-planner 위임 필요."
- **상세**: spec §6 는 TTL 기준을 "install_token **발급** 후 24시간"으로 명시한다. 재사용(begin 재호출 시 installToken 교체) 시 `createdAt` 을 TTL 기준으로 쓰면 신규 발급 직후에도 조기 만료될 수 있다 — 즉 현행 구현이 spec 의 "발급 후" 의도와 불일치할 가능성이 있다. plan 은 "project-planner 위임 필요" 라고만 하고 갱신이 필요한 spec 섹션 (`spec/2-navigation/4-integration.md §6`, `spec/1-data-model.md §2.10`)을 특정하지 않아, 위임 범위가 불명확하다.
- **제안**: B그룹 착수 전 plan 에 갱신 대상 spec 섹션(`§6` TTL 기준 행, `spec/1-data-model.md §2.10` 컬럼 목록, `spec/data-flow/integration.md §1.4` 스캐너 로직)을 명시하고 project-planner 에 위임.

---

### [WARNING] B그룹 TOCTOU advisory lock 구현 시 spec Rationale 충돌

- **target 위치**: `spec/2-navigation/4-integration.md` Rationale §"CAFE24_PRIVATE_APP_ALREADY_CONNECTED의 mall_id 비교 경로" — "동시 요청 race 는 매우 좁은 윈도우 … 라 앱 레벨 체크로 충분"
- **관련 plan**: `plan/in-progress/cafe24-pending-polish-followup.md` 그룹 B — "TOCTOU advisory lock 또는 mall_id plain 컬럼 분리"
- **상세**: 현재 spec Rationale 은 앱 레벨 체크를 결정된 정책으로 명문화한다. advisory lock 또는 partial UNIQUE index 중 하나를 선택하면 이 Rationale이 번복된다. plan 에는 Rationale 갱신 언급이 없다.
- **제안**: B그룹 착수 시 project-planner 에 Rationale 개정을 함께 요청. advisory lock 선택 시 `pg_advisory_xact_lock` 도입 배경과 trade-off, plain 컬럼 선택 시 mallId 평문화 결정을 Rationale 에 추가.

---

### [WARNING] `cafe24-pending-polish.md` 변경 1 미체크 항목의 추적 공백

- **target 위치**: 해당 없음 (plan 체크박스 상태 문제)
- **관련 plan**: `plan/in-progress/cafe24-pending-polish.md` 변경 1 — "Public 흐름의 `oauth_callback` 메시지 미수신 timeout 보완", "통합 목록 `useQuery` 에 `refetchOnWindowFocus: true, staleTime: 0` 명시", "`statusReason`/`lastError` 채워졌으면 UI 에 노출" 등 다수 미체크
- **상세**: `cafe24-pending-polish.md` 는 "변경 0~5 + ai-review 모두 처리 완료" 라 서술하지만 변경 1 의 체크박스들은 해제 상태다. 이 중 Public 팝업 timeout 보완, useQuery 설정, lastError 진단 메시지 UI 항목은 `cafe24-pending-polish-followup.md` 어느 그룹에도 없다 — 의도적 drop 이면 원본 plan 에 명시가 없고, 미구현이라면 추적이 끊긴다.
- **제안**: `cafe24-pending-polish.md` 에서 실제로 완료된 항목은 체크 처리하고, 의도적으로 drop 한 항목(Public timeout, useQuery 설정 등)은 ~~취소선~~ 또는 "(scope 외, drop)" 주석으로 처리. 남은 항목은 follow-up plan 해당 그룹에 편입.

---

### [INFO] §13 데이터 모델 요약에 `install_token` + 인덱스 누락

- **target 위치**: `spec/2-navigation/4-integration.md §13` — `status_reason`, `last_used_at`, `last_rotated_at`, `last_error` 4개 필드만 언급, `install_token` 컬럼과 `(install_token) WHERE install_token IS NOT NULL` 부분 인덱스 누락
- **관련 plan**: `plan/in-progress/cafe24-pending-polish-followup.md` 그룹 F "§13 데이터 모델 요약에 `install_token` 누락 보완"
- **상세**: `spec/1-data-model.md §2.10` 에는 `install_token` 컬럼과 해당 인덱스가 이미 기술되어 있으나, §13 요약이 동기화되지 않은 상태.
- **제안**: F그룹 착수 시 §13 의 인덱스 목록에 `(install_token) WHERE install_token IS NOT NULL` 추가.

---

### [INFO] §6 mermaid `install_token` 보존 정책 미명시

- **target 위치**: `spec/2-navigation/4-integration.md §6` — `pending_install` callback 실패 루프 항목에 `install_token` 유지 여부 미기재
- **관련 plan**: `plan/in-progress/cafe24-pending-polish-followup.md` 그룹 F "§6 mermaid `install_token` 보존 정책 명시"
- **제안**: F그룹 착수 시 §6 callback 실패 루프 항목에 "install_token 유지 → 재시도 가능" 문구 추가.

---

### [INFO] `spec/conventions/swagger.md §2-4` 실재 확인 — cross-link 유효

- `spec/conventions/swagger.md §2-4` 파일 존재 확인. "409 중복/충돌 → `@ApiConflictResponse`" 규칙 정상 기재. `spec/2-navigation/4-integration.md §9.4` 의 cross-link 는 유효하다. 그룹 F 항목 "§2-4 실재 확인" 은 완료 처리 가능.

---

## 요약

`spec/2-navigation/4-integration.md` 자체는 PR #18 이후 상태가 정상 반영(§6 상태 전이, §9 install_token API, §10 callback 실패 처리)되어 있고, 구현 착수에 대한 **CRITICAL 블로커는 없다**. 다만 세 가지 WARNING 을 처리한 뒤 착수하는 것이 안전하다 — plan frontmatter `worktree` 갱신은 즉시 가능, B그룹 TTL/TOCTOU 항목은 project-planner 위임 범위 명확화가 선행 조건이며 Rationale 충돌 예방 목적이다. 변경 1 미체크 항목 추적 공백은 스코프 이탈 위험을 낮추기 위해 plan 정리가 권장된다. INFO 항목들은 F그룹 진입 시 함께 처리하면 된다.

## 위험도

**MEDIUM** — 현재 작업 중인 C·D·E 그룹은 차단 없이 진행 가능하나, B그룹 착수 전 spec Rationale 충돌 해소가 필요하다.