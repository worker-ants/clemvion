## 발견사항

---

### [WARNING] `install_token` 필드가 Generic Integration 엔티티에 직접 추가됨 — 단일 책임 원칙 위반
- **위치**: `spec/1-data-model.md:252` — `install_token | String?`
- **상세**: `install_token`은 Cafe24 Private 앱 전용 필드임에도 범용 `Integration` 엔티티에 nullable 컬럼으로 추가됐다. 비-Cafe24-Private 서비스 타입의 모든 Integration 행에서 이 컬럼은 항상 NULL이다. 엔티티가 특정 provider의 install 라이프사이클 상태를 직접 소유하는 구조로, 향후 다른 provider에 유사한 설치 흐름이 생기면 provider별 nullable 컬럼이 계속 누적된다.
- **제안**: 단기적으로는 현 구조가 단순하고 인정 가능하다. 단, `spec/1-data-model.md §2.10`의 `install_token` 설명에 "Cafe24 Private 전용 — 다른 provider에 유사 흐름 추가 시 별도 `IntegrationInstallProcess` 엔티티 분리를 검토" 한 줄 Rationale를 추가해 향후 설계 방향을 명시해야 한다.

---

### [WARNING] `OAuthState.mode='reauthorize'` 의미 이중화 — 추상화 수준 불일치
- **위치**: `spec/data-flow/integration.md §1.2.1` 시퀀스 다이어그램, `spec/2-navigation/4-integration.md §10.2 step 4`
- **상세**: `mode='reauthorize'`는 "기존 connected 통합 재인증"이라는 의미를 가진 enum 값이다. 그러나 현 설계는 `status='pending_install'`인 초기 install에도 동일 mode를 재사용하며, callback 핸들러가 `integration.status`를 추가 확인해 두 케이스를 분기한다. 이는 mode 값의 의미가 상태(status)에 의존적으로 해석되는 **컨텍스트 의존적 추상화**다. `mode`가 흐름의 타입을 나타내야 하는데, 실제로는 "현재 integration.status를 봐야만 의미가 확정되는" 간접 참조가 된다.
- **제안**: Rationale에 이미 `mode='cafe24_private_install'` 신설 대안을 검토하고 기각한 근거가 기록되어 있다. 다만 콜백 핸들러 구현 시 이 이중 의미 처리 로직이 반드시 방어적으로 작성되어야 함을 `spec/2-navigation/4-integration.md §10.4` 에러 매핑 표에 구현 주의사항으로 명시할 것.

---

### [WARNING] Frontend가 Encrypted JSONB(`credentials.app_type`) 내부 값으로 UI 분기 — 레이어 책임 위반
- **위치**: `spec/2-navigation/4-integration.md §4.2` Reauthorize 비활성 조건 — `credentials.app_type='private'`
- **상세**: `credentials`는 AES-256-GCM 암호화 JSONB다. Frontend가 Reauthorize 버튼 활성화 여부를 결정하기 위해 이 값을 사용하려면, Backend API 응답(`GET /integrations/:id`)이 복호화된 `appType` 필드를 별도로 노출해야 한다. 현재 spec §9.1이 이 노출 경로를 명시하지 않아, 구현자가 암호화 필드를 직접 읽거나(불가), credentials 전체를 평문 노출하는(보안 위험) 잘못된 선택을 할 수 있다. 데이터 레이어의 저장 포맷이 프레젠테이션 레이어 로직에 직접 노출되는 결합도 문제다.
- **제안**: `spec/2-navigation/4-integration.md §9.1` Integration 응답 스키마에 `meta.appType: 'public' | 'private' | null` 필드를 명시하고, 이 값이 `credentials.app_type`의 read-only projection임을 기술한다.

---

### [WARNING] BullMQ `integration-expiry` 큐 스키마 확장 — 배포 순서 의존성이 Architecture에 미명시
- **위치**: `spec/data-flow/integration.md §1.4` — `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }`
- **상세**: 큐 메시지에 `reason` 필드를 추가하면 소비자(consumer)와 생산자(producer)의 배포 순서가 아키텍처 제약이 된다. Consumer가 먼저 배포되어야 기존 잔존 메시지(`reason` 없음)를 처리할 수 있다. spec이 `reason ?? 'token_expiring'` fallback을 명시했으나, 이 제약이 `plan/in-progress/cafe24-pending-polish.md` 변경 4의 배포 순서 체크박스에 반영되지 않았다. 분산 시스템에서 큐 스키마 진화 시 배포 순서 의존성은 운영 사고의 주요 원인이다.
- **제안**: 변경 4에 "Consumer(worker) 배포 → Producer(scanner) 배포 순서 보장" 체크박스 추가. rolling restart 환경에서는 graceful degradation이 확보되는지 확인.

---

### [INFO] 5회 Consistency Check 반복 — Spec 내부 결합도가 높음을 시사
- **위치**: `review/consistency/2026-05-14_17-49-11/` → `..._17-58-37/` (BLOCK:YES, CRITICAL 2건) → `..._18-15-41/` → `..._18-23-55/` → `..._18-38-32/`
- **상세**: CRITICAL 2건(동일 draft 내 `resource_not_found` 포함 여부 4곳 모순, `connected` 재인증 실패 status 처리 2섹션 충돌)이 단일 draft 내부에서 발생했다. 이는 spec 변경이 여러 파일(1-data-model, 4-integration, data-flow, 4-cafe24, conventions)에 걸쳐 원자적으로 적용되어야 함에도 draft가 파일별로 독립적으로 작성되다 보니 내부 정합성 유지가 어려웠음을 보여준다. 아키텍처적으로 spec 변경의 단일 진실 지점이 분산되어 있다.
- **제안**: 향후 multi-file spec 변경 시 "상태 전이 + 에러 매핑 + 데이터 모델" 세 파일이 함께 변경되는 패턴의 경우, draft 작성 체크리스트에 "동일 enum/값을 참조하는 모든 파일에서 일관성 확인" 항목을 선행 배치.

---

### [INFO] `status_reason`의 DB 저장값(snake_case) / API 에러 코드(UPPER_SNAKE_CASE) 이중 표기
- **위치**: `spec/1-data-model.md §2.10 status_reason`, `spec/2-navigation/4-integration.md §10.4`
- **상세**: 의도적 분리 설계이고 Rationale에 근거가 명시되어 있다. 다만 동일 개념이 레이어별로 다른 표기를 가지면 구현자가 매핑 로직을 별도로 작성해야 하고, 향후 새 에러 케이스 추가 시 두 곳을 동기화해야 한다. 이 패턴이 확장될 경우 매핑 테이블이 유지보수 부담이 될 수 있다.
- **제안**: 현 설계는 수용 가능하다. 단, backend 서비스 레이어에 "API 에러 코드 → DB status_reason 자동 변환 유틸"이 있는지, 있다면 spec에 해당 유틸의 위치를 참조로 추가할 것.

---

## 요약

이번 변경사항의 아키텍처적 핵심 결정은 Cafe24 Private 앱의 install 흐름을 기존 OAuth 인프라 위에 최소 침습적으로 얹는 것이다. `install_token`을 Integration 엔티티에 직접 추가하고 `mode='reauthorize'`를 재사용하는 선택은 단기 구현 비용을 낮추나, Integration 엔티티의 범용성과 `mode` enum의 단일 의미론을 희생한다. 더 큰 구조적 위험은 `credentials.app_type`이 암호화 JSONB 안에 있음에도 프런트엔드 UI 로직이 이 값에 의존한다는 점으로, API 레이어에서의 명시적 노출 없이는 구현 시 보안 사고 또는 잘못된 구현으로 이어진다. BullMQ 큐 확장의 배포 순서 의존성도 plan에 명시되어야 한다. 전반적으로 도메인 경계(Cafe24 전용 상태 vs 공통 Integration 상태)가 단일 엔티티 안에 혼재하는 패턴이 축적되고 있어, 향후 provider 다변화 시 리팩토링 비용이 증가할 수 있음을 인식하고 Rationale에 기록해 두어야 한다.

## 위험도

**MEDIUM** — Critical 수준의 구조적 결함은 없으나, `credentials.app_type` 노출 경로 미명시(W3)가 구현 시 보안 사고 또는 API contract 위반으로 이어질 수 있다. 나머지 WARNING은 구현 전 plan/spec 단순 갱신으로 해소 가능하다.