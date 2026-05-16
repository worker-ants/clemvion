# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target: `spec/2-navigation/4-integration.md`
검토 일시: 2026-05-16

---

## 발견사항

### 발견사항 1

- **[WARNING]** `tryRecoverByMallId` 회복 분기와 기각된 "100건 mall_id 스캔 + trial HMAC" 패턴의 표현상 재도입
  - target 위치: `spec/2-navigation/4-integration.md` 의 Rationale 섹션 "Cafe24 install_token mismatch 회복 흐름 — 보안 전제 (2026-05-16)" 항
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "install_token 을 App URL path 식별 키로 승격 (2026-05-14)" — "원래 설계는 O(N) 매칭 비용 + 비결정적 선택 위험으로 폐기, install_token 단일 row 조회로 고정"
  - 상세: Rationale "install_token mismatch 회복 흐름 — 보안 전제" 항이 스스로 "옛 폐기된 '100건 mall_id 스캔 + trial HMAC'" 와 표현상 충돌함을 인지하고 있으며, "본질적으로 다른 경로" 라 주장한다. 구분 근거는 (a) 정상 흐름 zero impact — install_token 단일 row 조회가 여전히 우선, (b) fallback only, (c) `RECOVERY_CANDIDATE_LIMIT = 5` 로 DoS 보호, (d) workspace-scoped UNIQUE 제약으로 실무 N=1~2 다. 단, 이 구분 근거가 Rationale 내에 충분히 서술되어 있어 "이유 명시 없는 재도입" 은 아니다. 그러나 구현자가 해당 보안 전제 항을 별도로 인지하지 않으면 "폐기된 패턴의 부분 부활"로 혼동할 여지가 있다.
  - 제안: 구현 시 `tryRecoverByMallId` 에 `RECOVERY_CANDIDATE_LIMIT = 5` 상수가 코드에 명시되어 있는지, 정상 흐름(install_token 직접 조회)이 항상 선행되는지를 코드 레벨에서 반드시 확인. Rationale 의 "구분" 설명이 코드 주석에도 반영되도록 요청.

---

### 발견사항 2

- **[WARNING]** `refresh 실패 → error(auth_failed)` 채택 — 기존 spec §6 `expired (refresh_failed)` 표기 번복
  - target 위치: `spec/2-navigation/4-integration.md` Rationale "refresh 실패 시 status_reason 통일 (2026-05-16)" 항
  - 과거 결정 출처: 같은 spec 본문 §6 (상태 전이 표) 의 옛 표기 `connected → expired | refresh fail`
  - 상세: Rationale 에 번복 이유가 명문화되어 있고 (`error(auth_failed)` 채택 근거 (a)~(c) 열거, `expired (refresh_failed)` 폐기 선언), 데이터 모델 변경 없음 및 알림 정책까지 기술되어 있다. Rationale 갱신 자체는 완료된 것으로 보인다. 그러나 spec §6 본문 상태 전이 표가 실제로 갱신되었는지 — 즉 Rationale 기술 내용과 spec 본문이 동기화되었는지 — 구현 착수 전에 확인이 필요하다. 상태 전이 표와 Rationale 이 불일치하면 구현자가 어느 쪽을 따라야 할지 혼동한다.
  - 제안: 구현 착수 전, `spec/2-navigation/4-integration.md` §6 상태 전이 표에서 `expired (refresh_failed)` 항목이 `error(auth_failed)` 로 실제 갱신되어 있는지 확인. 불일치 발견 시 project-planner 에게 spec 본문 동기화 요청.

---

### 발견사항 3

- **[INFO]** `install_timeout` 알림 미발사 결정 — 이전 PR #75/#76 기재 내용과의 명시적 충돌 해소
  - target 위치: `spec/2-navigation/4-integration.md` Rationale "install_timeout 알림 미발사 (2026-05-16)" 항
  - 과거 결정 출처: PR #75/#76 spec 표현 ("expired 전이 두 경로 — token_expired, install_timeout — 모두 발사")
  - 상세: Rationale 에 이전 기재가 "코드 미확인 상태에서의 오기"임을 명시하고, 현행 동작(`expirePendingInstalls()` 가 `notificationsService.createMany` 호출 없음) 을 의도로 명문화했다. 기각된 옵션(발사)의 근거도 서술되어 있다. Rationale 연속성 관점에서 적절하게 처리된 번복이다. 추가 조치 불필요.
  - 제안: 없음 (Rationale 기술 적절). 구현 시 `expirePendingInstalls()` 에 알림 호출이 실수로 추가되지 않도록 테스트 커버리지 확인 권장.

---

### 발견사항 4

- **[INFO]** `OAuthState.mode='reauthorize'` 재사용 — 별도 mode 신설 기각 근거 명시
  - target 위치: `spec/2-navigation/4-integration.md` Rationale "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유 (2026-05-14)" 항
  - 과거 결정 출처: 동일 항 내 — `mode='cafe24_private_install'` 별도 신설 검토 후 기각
  - 상세: Rationale 에 기각 이유 (callback 처리 분기 동일, enum 확장 이득 없음) 와 향후 재검토 조건 ("분리해야 할 동작이 늘어나면") 이 함께 기술되어 있다. 연속성 위반 아님. 구현 시 `mode='reauthorize'` 분기가 `pending_install` 과 `connected` 상태를 올바르게 구분하는지 확인 필요.
  - 제안: 없음 (Rationale 기술 적절).

---

### 발견사항 5

- **[INFO]** `install_token` persistent 격상 — 옛 `callback 성공 시 NULL 처리` 가정의 명시적 번복
  - target 위치: `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)" 항
  - 과거 결정 출처: 동일 spec 의 옛 single-use 가정 ("callback 성공 시 `installToken=NULL` 소거")
  - 상세: 번복 이유(post-install navigation 신규 요구사항 발견, 운영 사용자 보고) 와 옛 행 호환 처리 방침이 기술되어 있다. NULL 처리가 유지되는 경로(`pending_install → expired`, 삭제)도 명시. Rationale 연속성 관점에서 적절하게 처리된 번복이다.
  - 제안: 없음 (Rationale 기술 적절). 구현 시 `handleInstall` 의 status 분기가 spec 의 `install_token` persistent 전제와 일치하는지 확인.

---

## 요약

`spec/2-navigation/4-integration.md` Rationale 전반은 기각된 대안·번복 결정에 대해 상당히 상세한 근거 기술을 유지하고 있어, Rationale 연속성 관점에서 큰 위반은 발견되지 않는다. 다만 두 가지 WARNING 이 존재한다: (1) `tryRecoverByMallId` 회복 분기가 기각된 "O(N) mall_id 스캔 + trial HMAC" 패턴과 표현상 유사해, Rationale 의 보안 전제 항을 함께 숙지하지 않은 구현자가 혼동할 위험이 있다 — 구현 시 `RECOVERY_CANDIDATE_LIMIT`, 정상 흐름 선행 보장을 코드 레벨에서 검증해야 한다. (2) `expired (refresh_failed)` → `error(auth_failed)` 번복이 Rationale 에는 서술되어 있으나, spec 본문 §6 상태 전이 표가 실제로 동기화되었는지 착수 전 확인이 필요하다. INFO 3건은 모두 Rationale 기술이 적절히 이루어진 사례로, 구현 레벨 주의 사항만 메모한다. Target 문서 내용이 `(없음)`으로 제공되어 구현 코드 자체의 직접 점검은 불가했으며, 본 검토는 Rationale 발췌 기반 분석에 한정된다.

## 위험도

LOW
