# 아키텍처(Architecture) 리뷰 결과

리뷰 대상: 2026-06-28 변경셋 (consistency review 산출물 35개 파일 + spec 변경 9개 파일)
diff-base: origin/main

---

## 발견사항

### [INFO] review/consistency 디렉토리 내 `_retry_state.json` 공개 상태 유지
- 위치: `review/consistency/2026/06/28/15_02_09/_retry_state.json`, `15_41_51/_retry_state.json`, `16_05_14/_retry_state.json`, `16_48_46/_retry_state.json`
- 상세: `_retry_state.json` 은 오케스트레이터 내부 상태(session_dir 절대경로, pending/success/fatal 에이전트 목록, rate_limit 에피소드 수 등)를 담는 런타임 파일이다. 모든 인스턴스가 `agents_pending` 에 5개 에이전트를 나열한 채 `agents_success: []`로 커밋됐다 — 즉 완료된 세션에서도 초기 상태가 그대로 저장된다. 이 파일은 오케스트레이터 재시작용 재개 상태이지 영구 산출물이 아니므로, 완료 후에도 repo에 공개되는 것이 의도인지 확인이 필요하다.
  - 아키텍처적 문제: 세션 상태(재시작 포인터)와 완료된 리뷰 산출물이 동일 디렉토리에 혼재한다. 두 정보의 생명주기가 다르므로 레이어 책임 분리 관점에서 분리를 고려할 수 있다.
- 제안: 의도적 설계라면 변경 불필요. 그렇지 않다면 `_retry_state.json` 을 완료 시 제거하거나 `.gitignore` 처리한다.

---

### [INFO] spec 변경: `hooks-body-parser.ts` 가 `src/bootstrap/` 신규 경로에 배치됨
- 위치: `spec/5-system/12-webhook.md` WH-NF-02, `spec/5-system/naming_collision.md` 발견사항
- 상세: `hooks-body-parser.ts`(`createHooksBodyParsers`, `createGlobalBodyParsers`) 가 `src/bootstrap/` 에 신설됐다. 레이어 책임 관점에서 body-parser 설정은 인프라 부트스트랩 레이어에 위치하는 것이 적절하며, 모듈 경계가 명확하다. `bodyParser: false` + 명시 등록 순서 의존성은 Rationale 에 기재됐다. 별도 파일로 분리한 것은 단일 책임 원칙(SRP) 준수다.
- 제안: 이상 없음.

---

### [INFO] `PAYLOAD_TOO_LARGE`(전역) vs `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(도메인) 이중 413 구조
- 위치: `spec/5-system/3-error-handling.md §1.3`, `spec/5-system/2-api-convention.md §6`
- 상세: 두 코드가 동일 HTTP 413을 반환하되 발행 레이어·임계·담당 가드가 다르다(body-parser 전역 레이어 vs 공개 webhook 도메인 Guard 레이어). 이 이중 구조는 레이어 책임 분리(인프라 레이어 vs 도메인 가드 레이어)를 반영하는 의도적 설계이며 `3-error-handling.md Rationale` 및 `2-api-convention.md Rationale` 에 공존 근거가 명문화됐다. 클라이언트가 HTTP status만 보고 분기할 경우 세부 code를 추가로 확인해야 하는 소비자 인터페이스 부담은 있으나, 두 코드의 의미 경계가 spec에서 명확히 정의됐다.
- 제안: 이상 없음. 단, 향후 동일 HTTP 상태에 대한 세 번째 도메인 코드 신설 시 클라이언트 분기 복잡도가 증가할 수 있어 신설 기준을 Rationale에 추가 명문화해두면 좋다.

---

### [INFO] `4-security.md` ↔ `12-webhook.md` 상호 역참조 구조
- 위치: `spec/7-channel-web-chat/4-security.md L143`, `spec/5-system/12-webhook.md` rate-limit §4
- 상세: channel-web-chat 보안 spec 이 webhook의 rate-limit 수치를 SoT 로 포인팅하고, webhook spec 이 channel-web-chat 보안 §4 를 역참조하는 상호 참조 구조다. 각 문서가 담당 SoT가 다르므로(rate-limit 수치 vs body size 정책) 순환 의존의 외양이지만 실질적으로 SoT 분리가 명확하다. `spec/data-flow/10-triggers.md` 도 두 문서를 동시 참조한다.
- 제안: 이상 없음. 단, data-flow 문서가 중간 집약점 역할을 하고 있으므로 이 참조 구조가 이후 spec 변경에서 중복 갱신 대상이 되지 않도록 주의가 필요하다.

---

### [INFO] autoRefresh attention 구현: `supportsTokenAutoRefresh` — service registry 기반 derived 필드 설계
- 위치: `review/consistency/2026/06/28/16_48_46/rationale_continuity.md`, `naming_collision.md`
- 상세: spec Rationale 가 SQL `service_type IN (...)` 리터럴 하드코딩을 명시적으로 기각하고 `ServiceDefinition.supportsTokenAutoRefresh` service registry 에서 동적 목록을 조회하는 derived 필드 설계를 채택했다. Consistency 검토(W-2)에서 이 Rationale 준수 여부가 주요 경고로 표시됐으나, SUMMARY 에서 service registry 기반 동적 조회 방식 구현으로 준수 확인됐다. 개방-폐쇄 원칙(OCP) 관점에서 신규 provider 추가 시 registry만 갱신하면 되는 확장 용이한 설계다.
- 제안: 이상 없음.

---

### [INFO] google `autoRefresh=true`(§9.1) vs `isRefreshCapable=false`(§11.1) 비대칭 — 스캐너/UI 레이어 간 불일치
- 위치: `review/consistency/2026/06/28/16_48_46/cross_spec.md [WARNING]`, `SUMMARY.md W-1`
- 상세: UI 레이어(`autoRefresh=true` — needsAttention 가드 제외) 와 backend 스캐너 레이어(`isRefreshCapable=false` — 만료 알림·격하 수행) 가 google 통합에 대해 모순된 행동을 낳는다. 이는 cross-spec 정책 공백으로, 레이어 책임(UI attention 표시 vs 스캐너 만료 처리) 간 행동 정합이 spec 에 명시되지 않은 상태다. SUMMARY 에서 "본 PR 범위 밖 / project-planner 위임"으로 처리됐다.
  - 아키텍처적 영향: 두 레이어(frontend attention 판정, backend scanner expiry 판정)가 동일 도메인 개념(`supportsTokenAutoRefresh`)에 대해 서로 다른 집합 정의를 참조한다. 단일 진실 원칙(SoT) 부재.
- 제안: project-planner 에 위임된 후속 spec PR 에서 `isRefreshCapable` 의 SoT 를 `ServiceDefinition.supportsTokenAutoRefresh` 코드 한 곳으로 통일하거나, 두 레이어 간 집합 차이의 의도를 명문화한다.

---

### [INFO] consistency review 세션 디렉토리 다중 생성 패턴 (15_02_09 → 15_41_51 → 16_05_14 → 16_48_46)
- 위치: `review/consistency/2026/06/28/` 하위 4개 세션 디렉토리
- 상세: 동일 날짜에 검토 scope를 달리하는 여러 consistency check 세션이 각각 독립 디렉토리로 생성됐다 (webchat-polish → spec/5-system → spec/5-system 재검 → impl-prep). 각 세션이 완전히 독립적인 출력 공간을 가지며, 세션 간 상호 참조 없이 SUMMARY가 각자 완결된다. 이 구조는 각 세션의 immutability를 보장하는 장점이 있으나, 동일 대상에 대한 중복 검토(15_41_51 vs 16_05_14 — 둘 다 spec/5-system/ 대상)가 repo에 잔류한다.
- 제안: 재실행 세션의 경우 이전 세션을 대체(덮어쓰기)하거나 관계를 메타데이터에 명시하는 방향을 고려할 수 있다. 현재 설계(불변 이력)가 의도적이라면 이상 없음.

---

## 요약

이번 변경셋은 크게 세 가지 아키텍처 맥락으로 구성된다: (1) webchat polish batch — spec §1·§2·§5 정합화로 레이어 책임과 모듈 경계가 명확하게 유지됐고, (2) webhook WH-NF-02 body-parser 분리 — `src/bootstrap/hooks-body-parser.ts` 의 SRP 분리와 두 413 코드(body-parser 전역 vs 공개 webhook 도메인)의 레이어 책임 명문화가 적절하다, (3) autoRefresh attention 구현 준비 — `supportsTokenAutoRefresh` derived 필드 설계(OCP 준수, registry 기반 동적 조회)가 Rationale과 일치한다. 발견된 아키텍처 관점의 주요 관심사는 google `autoRefresh` 비대칭으로, UI attention 레이어와 backend scanner 레이어가 동일 도메인 개념에 대해 다른 집합 정의를 참조하는 구조적 불일치가 존재한다. 이는 SUMMARY에서 project-planner 후속으로 이관됐으며 현재 PR 범위에서는 차단 요인이 아니다. review 인프라 산출물(`_retry_state.json` 런타임 상태 파일의 repo 잔류)은 운영 편의 vs 산출물 순도 관점에서 검토 여지가 있으나 기능적 문제는 없다.

## 위험도

LOW
