# Rationale 연속성 검토 결과

검토 모드: --impl-prep (구현 착수 전)
대상 영역: spec/2-navigation

---

## 발견사항

### 1. **[WARNING]** R-2 가 R-14 에 의해 부분 무효화됐으나 갱신 미완료

- **target 위치**: `spec/2-navigation/2-trigger-list.md` — `## Rationale` 의 `### R-2. Webhook HMAC secret 입력 vs. rotate 분리` (§ 마지막 문단)
- **과거 결정 출처**: 동일 문서 `### R-14. authConfigId v1 — inline 인증 필드 제거` + §3 API 주석 (`PATCH /api/triggers/:id` 설명 블록)
- **상세**: R-2 는 v1 경로로 `PATCH /api/triggers/:id { config.hmacSecret }` 를 명시하고("API 도 동일 분리: `PATCH /api/triggers/:id { config.hmacSecret }` (v1) vs `POST /api/triggers/:id/auth/rotate-secret` (v1.1)"), v1.1 후속 rotate 경로로 `POST /api/triggers/:id/auth/rotate-secret` 를 예약했다. 그러나 이후 R-14 가 채택되면서 **인증 관련 inline PATCH 키(`config.authType`/`hmacHeader`/`hmacSecret`/`bearerToken`)가 모두 제거됐다** — §3 API 주석에서 "인증 관련 inline 키 (`config.authType` / `hmacHeader` / `hmacSecret` / `bearerToken`) 는 제거됨" 으로 확인된다. 또한 같은 §3 주석은 v1.1 예약 경로 `POST /api/triggers/:id/auth/rotate-secret` 도 "신설되지 않은 채 본 PR 에서 폐기됐다"고 명시한다. 결과적으로 R-2 본문이 전제하는 두 경로(v1 inline PATCH + v1.1 rotate endpoint)가 모두 무효화됐지만, R-2 자체는 해당 사실을 반영하지 않고 구 내용을 그대로 유지하고 있다. R-2 는 §2.3.1 매트릭스의 `hmacSecret` 행을 언급하나, 그 행 자체도 현 spec 에서 Auth Config 카드의 `authConfigId` 단일 행으로 대체되어 존재하지 않는다.
- **제안**: R-2 를 다음 방향 중 하나로 갱신한다. (a) R-2 전체를 폐기·삭제하고 R-14 가 인증 정책의 단일 SoT 임을 R-14 에 명시한다. (b) R-2 를 역사 기록으로 보존하되 도입부에 "본 결정은 R-14 로 대체됨 — `config.hmacSecret` inline 경로 및 `POST /api/triggers/:id/auth/rotate-secret` v1.1 예약 경로 모두 폐기 (§3 참고)" 를 명시한다. 어느 방향이든 구 경로가 현 구현자를 오도할 가능성이 있어 착수 전 정리가 권장된다.

---

### 2. **[INFO]** §4.2 삭제 confirmation 이름 타이핑 패턴의 convention 이동이 미완료 상태

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §4.2 삭제 정책 — "오삭제 방지: ... (본 spec 이 이 패턴을 최초 도입; 후속 spec 정비 PR 에서 `spec/2-navigation/_layout.md` 또는 별 convention 으로 끌어올린다)"
- **과거 결정 출처**: 해당 §4.2 인라인 주석
- **상세**: 이름 타이핑 확인 패턴이 `_layout.md` 나 별도 convention 문서로 아직 이전되지 않은 채 2-trigger-list.md 로컬에 남아 있다. Rationale 위반은 아니나, 해당 convention 이 trigger 구현과 연관된 다른 화면(schedule, integration 등의 삭제 UX)에서도 참조될 경우 단일 진실이 누락된 상태에서 구현이 진행될 수 있다.
- **제안**: 구현 범위에 삭제 UX 가 포함된다면 `_layout.md` 또는 `spec/conventions/` 에 이 패턴을 우선 정의한 뒤 2-trigger-list.md 에서 교차 참조하도록 정비한다. 구현 범위와 무관하면 지속 보류 가능.

---

## 요약

`spec/2-navigation` 전체에서 Rationale 연속성 위반으로 식별된 주요 사항은 1건이다. `spec/2-navigation/2-trigger-list.md` 의 R-2 는 v1 inline `config.hmacSecret` PATCH 경로와 v1.1 `POST /api/triggers/:id/auth/rotate-secret` 경로를 전제로 작성됐으나, 동일 문서의 R-14(이후 결정)와 §3 API 주석이 두 경로를 모두 폐기·제거했음을 확인해준다. R-2 가 갱신되지 않은 채 남아 있어 구현자가 이미 기각된 API 경로를 유효한 v1/v1.1 설계로 오인할 가능성이 있다. 나머지 스펙 문서들(0-dashboard, 10-auth-flow, 11-error-empty-states, 13-user-guide, 14-execution-history, 15-system-status, 16-agent-memory)의 Rationale 항목들은 과거 결정과 충돌 없이 일관성을 유지하고 있다.

## 위험도

LOW
