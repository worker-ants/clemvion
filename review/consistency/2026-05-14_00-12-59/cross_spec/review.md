`spec/4-nodes/4-integration/` 전체 문서를 대상으로 cross-spec 일관성을 점검합니다.

---

## Cross-Spec Consistency Check — `spec/4-nodes/4-integration/` (--impl-prep)

### 발견사항

---

#### **[WARNING]** Send Email 출력 포트명 `out` — Integration 카테고리 내 명명 불일치

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §3.2, §5.1
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md` §3 공통 출력 구조 예시 (`"port": "success"`) / §6 표 (`'success' (또는 default 단일 출력)`)
- **상세**: HTTP Request · Database Query · Cafe24 세 노드는 모두 성공 포트명이 `success`인데, Send Email만 `out`을 사용한다. `0-common.md` §6가 "(또는 default 단일 출력)" 괄호 면제 문구로 수용하고 있으나, 이는 불일치를 숨기는 처리일 뿐 실제 통일은 이루어지지 않았다. Cafe24 구현 시 Send Email 포트도 `success`로 일괄 정정되어야 하는지 명확히 결정되지 않은 상태다.
- **제안**: Cafe24 구현 착수 전에 Send Email의 `out` → `success` 마이그레이션 여부를 명시적으로 결정하고, `0-common.md` §6의 면제 문구를 제거하거나 역으로 `send_email`의 포트명 유지를 Rationale에 기술한다. 현행 spec 변경 없이 구현을 진행하는 경우, `send_email` 핸들러가 `port: 'out'`을 유지함을 코드에서 명시적으로 보장해야 한다.

---

#### **[INFO]** 검증 불가 외부 참조 문서 3종

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` 헤더 관련 문서 목록 / §4 step 6 / §8~§9 전체
- **충돌 대상**: 제공되지 않은 외부 문서
- **상세**: 아래 세 문서가 광범위하게 참조되지만 이번 검토 컨텍스트에 포함되지 않아 내용 정합성을 확인할 수 없다.
  - `spec/2-navigation/4-integration.md#58-cafe24` — Cafe24 credentials JSONB 스키마 (§4 step 4가 요구하는 `mall_id`, `app_type`, `access_token`, `refresh_token`, `client_id`/`client_secret` 필드 정의의 원본)
  - `spec/5-system/11-mcp-client.md` — §2.3 Internal Bridge, §5.1 노출 규칙, §5.2 도구 이름 규칙, §5.6 도구 allowlist, §8.3 IntegrationUsageLog, §8.4 인증 실패 자동 status 전환
  - `spec/conventions/cafe24-api-metadata.md` — 18 카테고리 × operation 메타데이터 테이블 컨벤션
- **제안**: 구현 착수 전 세 문서가 `4-cafe24.md`에서 참조하는 섹션 앵커(`#23-internal-bridge`, `#52-도구-이름-규칙` 등)가 실제로 존재하는지 확인한다. 특히 `spec/2-navigation/4-integration.md#58-cafe24`의 `app_type` 필드 enum (`public`/`private`) 정의가 `4-cafe24.md` §4 step 4의 분기 논리와 일치하는지 중점 확인이 필요하다.

---

#### **[INFO]** `spec/0-overview.md` §6.3 — Cafe24 ❌ 미구현 표시 (의도적)

- **target 위치**: `spec/0-overview.md` §6.3 로드맵
- **충돌 대상**: 없음 (일관적)
- **상세**: `spec/0-overview.md` §6.3에서 Cafe24 통합이 "spec 완료(2026-05-13), 구현 예정"으로 명시적으로 ❌ 표시되어 있다. `spec/1-data-model.md` §2.6의 Node.type 목록에는 `cafe24`가 이미 등록되어 있는데, 이는 데이터 모델이 목표 상태를 기술하는 문서이기 때문에 일관적이다. 이번 `--impl-prep` 체크의 컨텍스트와 정확히 부합한다.
- **제안**: 구현 완료 후 `spec/0-overview.md` §6.1 노드 시스템 항목에 `cafe24` 를 추가하고 §6.3에서 해당 항목을 제거해야 한다. plan 문서에 이 후속 spec 갱신을 명시적 단계로 포함시킨다.

---

#### **[INFO]** `meta.callUsage` 단위 명시 — 구현 시 헤더 값 해석 주의

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §4.1, §5.1
- **충돌 대상**: 없음 (내부 일관성 확인)
- **상세**: `X-Cafe24-Call-Usage` 헤더 값이 `meta.callUsage` (%)로 기록된다고 명시되어 있고 예시에서 `12`로 표현된다. Cafe24 공식 문서에서 이 헤더가 백분율(%)인지 절대값인지를 구현 전 확인해야 한다. spec 예시(`"callUsage": 12`)는 퍼센트로 해석하면 12%를 의미하나, 실제 Cafe24 API가 다른 형식으로 반환할 경우 spec 예시와 코드 간 불일치가 발생할 수 있다.
- **제안**: 구현 시 Cafe24 API 응답 헤더 실측 후, spec 예시 값과 단위 설명이 정확한지 검증하고 필요하면 `4-cafe24.md` §4.1 표를 보정한다.

---

### 요약

`spec/4-nodes/4-integration/` 내 Cafe24 노드 spec은 데이터 모델(`spec/1-data-model.md`)·통합 PRD(`_product-overview.md`)·시스템 개요(`spec/0-overview.md`)와 **직접적인 모순이 없다**. 5필드 invariant 준수, `meta.durationMs` 명명 통일, `service_type='cafe24'` 등록, `status_reason='auth_failed'` 유효성 모두 기존 spec과 정합하다. 주요 리스크는 제공되지 않은 외부 참조 문서 3종(특히 `spec/2-navigation/4-integration.md#58-cafe24`의 credentials 스키마)의 정합성 미확인이며, 구현 전 해당 문서의 관련 섹션을 직접 교차 확인해야 한다. 카테고리 내 기존 불일치인 Send Email의 포트명 `out`은 Cafe24 구현 범위에 포함할지 여부를 명확히 결정할 것을 권장한다.

### 위험도

**LOW**