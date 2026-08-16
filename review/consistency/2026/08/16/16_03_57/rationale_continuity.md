# Rationale 연속성 검토 — spec/5-system/ (--impl-prep)

## 검토 범위와 방법

target=`spec/5-system/` 전체(주로 `2-api-convention.md`·`3-error-handling.md`·`4-execution-engine.md` 는 번들 전문, 나머지는 컨텍스트 예산으로 헤더만 절단). 절단된 파일 중 이번 impl-prep 이 실제로 건드릴 `spec/5-system/14-external-interaction-api.md` 와 `spec/conventions/secret-store.md` 는 직접 `Read` 로 전문을 확인했다. 아직 developer 착수 전 단계라 spec 자체에 새 diff 는 없으므로, "target 문서가 방금 무엇을 도입했는가" 대신 "이 상태로 구현이 시작되면 기존 Rationale 과 충돌할 지점이 있는가"를 기준으로 봤다. 참고로 `plan/in-progress/eia-internal-rest-error-masking.md`(이번 impl-prep 이 준비 중인 작업)도 대조군으로 확인했으나, 이 문서는 번들에 포함되지 않았고 본 리뷰의 판정 대상도 아니다 — 아래 발견은 어디까지나 **현재 spec 문서 자체**의 내적 정합성에 근거한다.

## 발견사항

- **[WARNING] `Execution.error` 원문 노출이 §2-api-convention §5.3/§3-error-handling 의 CWE-209 원칙과 이미 충돌 중이며, 그 상태가 spec 자기서술로 "미결"**
  - target 위치: `spec/5-system/14-external-interaction-api.md` R17 마지막 불릿 "`execution.failed` payload 의 `error.message`/`error.details`" 중 "**내부 REST 와의 비대칭은 미결이다**" (§Rationale, 2026-08-16 갱신분)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` §5.3 "`message`: ... 내부 구현 원문(라이브러리 예외 메시지·스택·파일 경로 등)을 echo 하지 않는다 — 정보 노출(CWE-209) 방지" + `spec/5-system/3-error-handling.md` `## Rationale` "4xx http-error `message` 고정 문구 — CWE-209 방지" 항목(이 항목은 스스로 "이는 WebSocket `EXECUTION_INTERNAL_ERROR` 의 고정 문구 결정... 과 동일한 원칙" 이라고 명시해, CWE-209 비echo 원칙이 이미 HTTP 전역 필터·WS 양쪽에 걸쳐 있음을 선언한다)
  - 상세: 두 문서가 "내부 원문을 client 로 echo 하지 않는다"를 반복적으로 원칙화(§5.3, §3-error-handling Rationale, R17 자체의 다른 불릿들 — `conversationThread`·`nodeOutput.conversationConfig` 마스킹)하는 동안, `GET /api/executions/:id` 등 4개 내부 REST 표면은 그 원칙을 아직 지키지 않고 `Execution.error` 를 원문 그대로 반환한다. R17 은 이를 정직하게 "미결"로 적어 뒀지만, 이 상태로 구현이 진행되어 코드만 고쳐지고 spec 텍스트(R17 의 "미결이다" 캐비엇, 필요하면 `2-navigation/14-execution-history.md` R-5 와의 교차 참조)가 함께 갱신되지 않으면, 원칙은 지켜졌는데 문서는 "미결"이라 말하는 반대 방향의 drift 가 생긴다.
  - 제안: 이번 impl-prep 이 여는 구현이 완료되는 시점에 R17 마지막 불릿의 "내부 REST 와의 비대칭은 미결이다" 문장을 반드시 갱신(결정 내용 + 근거)하는 것을 이 작업의 완료 조건에 명시적으로 포함시킬 것. 코드 변경과 R17 캐비엇 갱신이 분리된 PR/턴으로 나뉘면 그 사이 구간은 "코드=닫힘, spec=미결"인 자기모순 상태가 된다.

- **[WARNING] `secret-store.md` "모든 도메인 모듈은 SecretResolver 를 경유" 원칙과, `interaction.triggerToken` 을 `AuthConfig.config` 와 같은 "비대상" 범주로 묶으려는 방향의 구조적 불일치**
  - target 위치: `spec/conventions/secret-store.md` 본문 도입부("본 컨벤션은... 모든 도메인 모듈 (chat-channel / external-interaction / 향후 cafe24·OAuth 등) 은 본 convention 의 `SecretResolver` 를 경유해 secret 을 읽고 쓴다") 및 §1 "비대상 — `AuthConfig.config`" 단락 / `spec/5-system/14-external-interaction-api.md` §7.1 line ~910 "`config.interaction.triggerToken` 는 현재 JSONB 평문 (향후 secret store 통합 검토)"
  - 과거 결정 출처: `secret-store.md` `## Rationale` R1 "Application-side AES-256-GCM 채택" — "마스터키가 app↔DB 경계를 절대 넘지 않음... DB 는 ciphertext 만 봄" 이 이 컨벤션 전체의 존재 이유로 명시돼 있고, 이 원칙의 유일한 기존 예외인 `AuthConfig.config` 는 "다른 곳에서 **동등한 암호화**(같은 `ENCRYPTION_KEY`·AES-256-GCM 컬럼 transformer)를 이미 받고 있다"는 근거로만 성립한다.
  - 상세: `Trigger.config.interaction.triggerToken` 은 현재 **어떤 암호화도 거치지 않는** 평문 JSONB이며, 바로 같은 JSONB 객체 안의 `notification.signing.secretRef` 는 이미 `SecretResolver` 로 이관돼 ref-only 로 보관된다(§7.1). 즉 `AuthConfig.config` 예외("암호화는 되지만 다른 경로")와 달리 `triggerToken` 예외는 "암호화 자체가 없음"이라는, 원칙이 지키려던 것(R1 의 "app↔DB 경계를 절대 넘지 않음")을 정면으로 비켜가는 성격이다. `data-flow/15-external-interaction.md`(§293 부근)의 "평문은 응답에 1회만" 설계로 발급 시점 노출은 완화돼 있지만, DB-at-rest 평문이라는 사실 자체는 변하지 않는다. 이 상태를 `AuthConfig.config` 옆에 "비대상"으로 나란히 등재하면, 두 예외의 근거가 실질적으로 다름에도 같은 범주로 묶여 "이미 선례가 있다"는 인상을 주고, `secret-store.md` 도입부의 "모든 도메인 모듈은 경유한다"는 원칙이 조용히 좁아진다.
  - 제안: `secret-store.md §1` 에 `interaction.triggerToken` 을 등재할 때 `AuthConfig.config` 예외와 **같은 문구를 재사용하지 말고**, "암호화가 이미 동등하게 되고 있다"가 아니라 "왜 평문 보관이 이 경우엔 수용 가능한가"(예: 발급-1회-노출 설계로 재노출 표면이 없다, rotation 이 즉시 무효화라 탈취 window 가 짧다 등 실제 근거)를 독립된 근거로 적을 것. 그렇지 않으면 다음에 이 절을 읽는 사람이 "두 예외가 동급"이라고 오독해 세 번째 평문 예외를 같은 패턴으로 또 늘릴 위험이 있다.

- **[INFO] EIA §7.1 line ~910 "향후 secret store 통합 검토" 문구가 함의하는 궤적(언젠가 이관)과, 영구 예외 등재 방향 사이의 결정 번복**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §7.1, `config.interaction.triggerToken` 각주
  - 과거 결정 출처: 같은 문장 자체("향후 secret store 통합 검토") — 이관을 전제로 한 임시 상태 서술
  - 상세: "통합 검토 중"이라는 현재 문구는 독자에게 "언젠가 `SecretResolver` 로 옮겨간다"는 궤적을 준다. 만약 최종 결정이 "이관하지 않고 영구 예외로 문서화"라면 이는 그 궤적의 명시적 번복이며, 번복 자체는 문제가 아니나(합리적 재검토는 정상) 문구를 그대로 방치하면 "검토 중"이라는 거짓 상태가 spec 에 남는다.
  - 제안: 결정이 확정되는 시점에 이 각주 문장을 "왜 이관하지 않기로 했는가"로 교체 — 위 두 번째 발견의 새 Rationale 근거와 동일한 자리에서 함께 정리하면 중복 작업이 없다.

## 요약

`spec/5-system/` 현재 상태는 자기모순으로 이미 깨져 있지는 않다 — 오히려 `14-external-interaction-api.md` R17 이 "내부 REST 와의 비대칭은 미결이다"라고 스스로 정직하게 적어 둔 상태라, 이번 impl-prep 검토 시점에는 명시적으로 기각된 대안의 재도입이나 강행 위반은 발견되지 않았다. 다만 두 지점에서 원칙과의 거리감이 있다: (1) CWE-209 비echo 원칙이 여러 문서에서 반복 선언되는데 정작 그 원칙이 아직 지켜지지 않는 표면(`GET /api/executions/:id` 등)이 있고 이 gap 이 "미결"로만 적혀 있어, 구현과 spec 갱신이 분리되면 반대 방향 drift(코드는 닫혔는데 문서는 열려 있음)가 생길 수 있다. (2) `secret-store.md` 의 "모든 도메인 모듈은 SecretResolver 경유" 원칙에 대한 유일한 기존 예외(`AuthConfig.config`)는 "동등한 암호화"라는 근거로 성립하는데, `interaction.triggerToken` 을 같은 범주로 등재하려는 방향은 근거의 질이 다르다(암호화 자체 부재) — 새 Rationale 이 이 차이를 명시적으로 인정하지 않으면 원칙이 조용히 약화된다. 둘 다 진행 중인 작업(트래커 I1/D)이 이미 인지하고 있는 영역으로 보이므로, 완료 조건에 "spec 텍스트 갱신"을 코드 변경과 짝지어 명시하면 충분히 해소 가능한 수준이다.

## 위험도

MEDIUM
