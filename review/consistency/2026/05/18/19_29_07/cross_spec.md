# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`
Target: `spec/2-navigation/4-integration.md`
검토 시각: 2026-05-18

---

## 발견사항

### 1. [WARNING] `data-flow/5-integration.md §2.2` 의 `Cafe24RefreshJobData.source` 타입 미동기

- **target 위치**: `spec-update-cafe24-jwt-exp.md` 제안 §10.5 Rationale 신규 항목 — `'reactive_401'` 을 `Cafe24RefreshJobData.source` 의 새 값으로 추가.
- **충돌 대상**: `spec/data-flow/5-integration.md §2.2 Redis` 표의 `cafe24-token-refresh` 큐 행, payload 컬럼 — 현재 `{ integrationId: UUID, source: 'background' | 'proactive' }` 로 기술.
- **상세**: `spec/data-flow/5-integration.md` 는 큐 payload 의 authoritative 계약 문서이다. 이 파일의 `source` 타입 유니온이 `'background' | 'proactive'` 로 고정되어 있는 상태에서, 구현 코드(`cafe24-token-refresh.constants.ts` 의 `Cafe24RefreshJobData` 인터페이스) 와 `spec/2-navigation/4-integration.md §10.5 Rationale` 신규 항목 모두 `'reactive_401'` 을 추가하면, `data-flow` spec 이 실제 큐 계약과 달라진다. 동작 자체는 문제 없으나 spec 간 참조 시 혼선 발생 가능. `spec-update-cafe24-jwt-exp.md` 의 spec 갱신 제안 목록에 `data-flow/5-integration.md` 동시 갱신이 누락되어 있다.
- **제안**: `spec/2-navigation/4-integration.md §10.5 Rationale` 항 신설과 동시에 `spec/data-flow/5-integration.md §2.2 Redis` 표의 `cafe24-token-refresh` payload 컬럼을 `source: 'background' | 'proactive' | 'reactive_401'` 로 갱신. `spec-update-cafe24-jwt-exp.md` 제안 목록 §3 이후에 4번째 항으로 추가.

---

### 2. [WARNING] `data-flow/5-integration.md §2.2` 의 `removeOnComplete` 정책이 per-source 분기를 반영하지 않음

- **target 위치**: `spec-update-cafe24-jwt-exp.md` 제안 §10.5 Rationale — `reactive_401` 잡에 `removeOnComplete: { age: 0 }` 옵션 적용 (BullMQ jobId dedup edge case 대응). 기존 `proactive`/`background` 잡은 `{ age: 60 }` 유지.
- **충돌 대상**: `spec/data-flow/5-integration.md §2.2 Redis` 표의 `cafe24-token-refresh` 행, dedup 컬럼 — `removeOnComplete: { age: 60 }` 가 단일값으로 기재되어 있음.
- **상세**: source 에 따라 `removeOnComplete.age` 가 달라지는 분기 정책이 도입되면, 단일값 `{ age: 60 }` 으로 기술된 `data-flow` spec 이 실제 동작을 설명하지 못하게 된다. 운영 진단 시 `reactive_401` 잡의 완료 job 이 Redis 에서 즉시 사라지는 것이 사양인지 버그인지 구분이 어렵다.
- **제안**: `data-flow/5-integration.md §2.2 Redis` 표의 `cafe24-token-refresh` dedup 컬럼을 `removeOnComplete: { age: 60 } (proactive/background) | { age: 0 } (reactive_401 — completed job 즉시 삭제로 stale dedup 차단)` 형식으로 명시.

---

### 3. [WARNING] `spec/4-nodes/4-integration/4-cafe24.md §9.6` refresh 진입점 목록에 reactive_401 경로 누락

- **target 위치**: `spec-update-cafe24-jwt-exp.md` 제안 §10.5 Rationale — `performAuthRefresh` 가 `refreshViaQueue` 호출 시 `source='reactive_401'` 전달.
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md §9.6` (2026-05-18 갱신 주석) — "Refresh 진입점은 셋" 으로 열거 (proactive `ensureFreshToken` / `connected-expiry` 0d 분기 / `McpToolProvider.buildTools()` expired 자가 회복).
- **상세**: 본 fix 구현으로 4번째 진입점 — `Cafe24ApiClient.performAuthRefresh` 내 401 reactive refresh — 이 추가된다. `4-cafe24.md §9.6` 의 "셋" 기술은 구현과 달라져 감사·디버깅 기록으로서의 정확성이 낮아진다. 기능적 충돌은 없으나 미래 기여자가 진입점 수를 잘못 파악할 수 있다.
- **제안**: `4-cafe24.md §9.6` 의 2026-05-18 갱신 주석에 4번째 진입점 추가 — `Cafe24ApiClient.performAuthRefresh (401 reactive) → refreshViaQueue('reactive_401')` 및 `source='reactive_401'` short-circuit skip 정책 한 줄 보강.

---

### 4. [INFO] `spec/2-navigation/4-integration.md §5.8` Rationale 항의 흡수 처리 명시 필요

- **target 위치**: `spec-update-cafe24-jwt-exp.md` 제안 §2 — §5.8 의 "응답 shape (Cafe24 quirk)" 설명을 "JWT exp 우선 → expires_in → expires_at ISO → 2h default" precedence 로 갱신. 텍스트 끝에 "옛 'Cafe24 token 응답의 `expires_at` 처리 (2026-05-17)' Rationale 항은 본 격상으로 흡수" 표기 포함.
- **충돌 대상**: `spec/2-navigation/4-integration.md ## Rationale "Cafe24 token 응답의 expires_at 처리 (2026-05-17)"` 항.
- **상세**: 흡수 표기는 target 문서 본문(§5.8)에 inline 참조로 적혀 있으나, Rationale 기존 항 자체에는 "흡수됨" 또는 "(superseded by …)" 표시가 없다. 독자가 두 항을 모두 읽으면 어느 것이 현행 정책인지 불명확해진다. 기능 충돌은 없으나 spec 독자 혼선 방지 차원에서 정리 권장.
- **제안**: `spec/2-navigation/4-integration.md ## Rationale "Cafe24 token 응답의 expires_at 처리 (2026-05-17)"` 항 헤더 또는 본문 첫 줄에 `> **(2026-05-18 superseded)** 본 항은 "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)" 에 흡수됨.` 한 줄 추가.

---

## 요약

`spec/2-navigation/4-integration.md` 의 Cafe24 JWT exp 기반 만료 추출 + reactive_401 short-circuit 제거 변경안은 기존 spec 과 **기능적 직접 모순은 없다**. 그러나 `spec/data-flow/5-integration.md §2.2` 가 `cafe24-token-refresh` 큐의 payload 계약 (`source` 유니온) 과 `removeOnComplete` 정책을 단일값으로 기술하고 있어, 구현 후에도 두 spec 이 달라지는 상태가 된다. 이 spec 은 큐 payload 를 authoritative 하게 기술하는 위치이므로 동시 갱신이 필요하다. `spec/4-nodes/4-integration/4-cafe24.md §9.6` 의 refresh 진입점 수 기술도 4번째 경로 추가로 인해 과소 기재가 된다. `spec-update-cafe24-jwt-exp.md` 의 갱신 대상 목록에 위 두 파일이 포함되지 않아 구현이 spec 을 앞서 나가는 상황이 된다. 세 항목 모두 naming/sync 수준으로 CRITICAL 은 없으나 운영 진단·문서 일관성 측면에서 갱신이 권장된다.

## 위험도

LOW
