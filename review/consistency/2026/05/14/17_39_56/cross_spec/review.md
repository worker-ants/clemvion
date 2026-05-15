분석 결과를 정리합니다.

---

## 발견사항

---

### - **[WARNING]** Reauthorize 비활성 조건 범위 불일치 (DRAFT 2A vs DRAFT 2K)

- **target 위치**: DRAFT 2A §2.2 더보기(⋮) 메뉴 `재인증` 행 / DRAFT 2K §4.2 Reauthorize 행
- **충돌 대상**: 동일 target 문서 내 두 섹션 간 내부 불일치
- **상세**:
  - DRAFT 2A는 재인증 비활성 케이스를 **두 가지**만 열거: `pending_install`, `expired AND status_reason='install_timeout'`
  - DRAFT 2K는 위 두 케이스에 더해 **포괄 조건** `service_type='cafe24' AND credentials.app_type='private'` 모든 케이스를 제3 조건으로 추가
  - 이 포괄 조건에 따르면 `connected` 상태의 Cafe24 Private 통합도 재인증이 비활성화되어야 하지만, DRAFT 2A의 열거에는 `connected` 케이스가 포함되지 않아 구현 시 동작이 달라짐
  - Rationale의 "Private 앱은 재인증 진입점이 없어" 원칙이 `connected` 케이스에도 적용됨을 DRAFT 2K는 명시하지만 DRAFT 2A는 묵시적으로만 처리
- **제안**: DRAFT 2A §2.2를 DRAFT 2K §4.2의 포괄 조건(`service_type='cafe24' AND app_type='private'` 인 모든 케이스)과 통일, 또는 DRAFT 2K에서 `connected` Cafe24 Private 재인증 활성 여부를 명시

---

### - **[WARNING]** `install_token` 단일 row 조회를 위한 인덱스 부재

- **target 위치**: DRAFT 1D (§3 인덱스 전략 "변경 없음") / DRAFT 2J-2 §9.8 (식별 전략) / DRAFT 3C-bis §1.4 (스캐너 쿼리)
- **충돌 대상**: `spec/1-data-model.md §3 인덱스 전략` 표
- **상세**:
  - DRAFT 2J-2는 "옛 in-memory 100건 스캔 + trial HMAC → `install_token` 단일 row 조회"로의 성능 개선을 핵심 설계 변경 근거로 제시
  - 그러나 DRAFT 1D는 §3을 "변경 없음"으로 처리하고, DRAFT 3D도 `install_token` 컬럼에 인덱스를 추가하지 않아 실제로는 full table scan이 발생
  - 추가로 DRAFT 3C-bis의 TTL 스캐너 쿼리 `WHERE status='pending_install' AND created_at < now - '24h'`는 전역 스캔이지만, 제안되는 `(workspace_id, status)` 인덱스는 leading column이 `workspace_id`라 workspace 없는 전역 조회에 비효율적
- **제안**: `spec/1-data-model.md §3` 인덱스 표에 `install_token` UNIQUE 인덱스(또는 `WHERE install_token IS NOT NULL` 부분 인덱스)와 TTL 스캐너용 `(status, created_at)` 인덱스를 추가하거나, DRAFT 1D에 명시적 deferred 이유를 기록

---

### - **[WARNING]** `spec/1-data-model.md §3` 인덱스 목적 설명 미갱신

- **target 위치**: DRAFT 3D `spec/data-flow/integration.md §2.1` 인덱스 설명 갱신
- **충돌 대상**: `spec/1-data-model.md §3 인덱스 전략` 표 — `Integration (workspace_id, status)` 행, 목적: "만료/에러 상태 배지 카운트"
- **상세**:
  - DRAFT 3D는 data-flow spec의 `(workspace_id, status)` 인덱스 설명을 "배지 카운트 + pending_install TTL 스캐너 조회 겸용"으로 확장
  - 그러나 DRAFT 1D는 §3을 "변경 없음"으로 처리하여 데이터 모델의 권위적 인덱스 표(spec/1-data-model.md §3)가 구버전 설명으로 남음
  - 두 문서가 동일 인덱스를 서로 다른 목적으로 기술하게 됨
- **제안**: `spec/1-data-model.md §3` 인덱스 표의 해당 행 설명을 "만료/에러 상태 배지 카운트 + pending_install TTL 스캐너 조회"로 동기화하는 DRAFT 1D 보완 추가

---

### - **[INFO]** DRAFT 2D §6 mermaid 다이어그램 — `pending_install` 자기 루프 누락

- **target 위치**: DRAFT 2D §6 상태 전이 mermaid 다이어그램
- **충돌 대상**: DRAFT 3A §3.1 stateDiagram-v2 — `pending_install --> pending_install: callback 실패 (status 보존, last_error/status_reason 갱신)`
- **상세**: DRAFT 3A의 상태 다이어그램은 자기 루프 전이를 명시하지만 DRAFT 2D의 flowchart 다이어그램에는 해당 전이가 없음. 전이 표(텍스트)에는 포함되어 있어 부분적 불일치. 다이어그램만 보는 독자가 callback 실패 재시도 흐름을 놓칠 수 있음

---

### - **[INFO]** `integration_oauth_state.mode='reauthorize'` — 초기 install에 혼용

- **target 위치**: DRAFT 3C §1.2.1 시퀀스 다이어그램 / DRAFT 2G §10.4 에러 표
- **충돌 대상**: `spec/2-navigation/4-integration.md §3.2` 응답 mode 필드 (`cafe24_private_pending`)
- **상세**: `/oauth/begin` 응답의 `mode` 값은 `cafe24_private_pending`이지만, DB의 `integration_oauth_state.mode`는 초기 install에도 `reauthorize`를 사용. §10.4 에러 표는 `mode=reauthorize + status=pending_install`(초기 install)과 `mode=reauthorize + status=connected`(재인증)를 status로 구분. 동일 mode 값이 두 의미를 가져 향후 확장 시 오독 가능성

---

### - **[INFO]** `expired → [*]: manual delete` 한정자의 범위 모호성

- **target 위치**: DRAFT 3A §3.1 상태 다이어그램 `expired --> [*]: manual delete (install_timeout 케이스)`
- **충돌 대상**: `spec/data-flow/integration.md §3.1` 현재 상태 다이어그램 — 일반 `expired` 삭제 가능 여부 미명시
- **상세**: 괄호 한정자 `(install_timeout 케이스)`가 있어 `token_expired`, `refresh_failed` 등 일반 `expired` 행의 삭제는 불가한 것처럼 읽힘. 실제로 일반 expired 행도 UI에서 삭제할 수 있다면 다이어그램이 오해를 유발

---

## 요약

target draft는 `install_token` 기반 식별 전략 전환, `pending_install` 라이프사이클 정비, callback 실패 status 보존 정책 등 핵심 설계 변경을 여러 spec 파일에 걸쳐 일관되게 기술하고 있으며, 에러 코드 도입·상태 전이 번복·용어 통일도 내부 논리는 유지됩니다. 다만 **reauthorize 비활성 조건**이 §2.2와 §4.2 사이에서 범위가 다르게 열거되어 `connected` Cafe24 Private의 버튼 상태가 구현에서 갈릴 수 있고, **install_token 인덱스 부재**는 성능 개선의 근거가 된 "단일 row 조회" 주장을 약화시킵니다. **spec/1-data-model.md §3 인덱스 표**는 data-flow spec과 동기화가 필요합니다.

## 위험도

**MEDIUM** — CRITICAL 차단 사항은 없으나 WARNING 3건이 구현 단계에서 동작 불일치 또는 성능 오해를 유발할 수 있음. spec 적용 전 위 3개 WARNING 보완 권장.