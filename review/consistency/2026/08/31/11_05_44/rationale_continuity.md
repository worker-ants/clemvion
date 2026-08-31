# Rationale 연속성 검토 — `plan/in-progress/spec-draft-auth-errorcode-drift.md`

## 발견사항

- **[WARNING]** `ACCOUNT_LOCKED` 423→401 정정이 §1.2 를 "401/403/423 구조" 로 서술한 과거 Rationale 을 소급 stale 화
  - target 위치: target 문서 `① ACCOUNT_LOCKED` 처방 섹션 (`3-error-handling.md:48` 의 `423`→`401`)
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` 의 `## Rationale`
    - "§1.9 워크스페이스 멤버 직접 추가 코드 등재 (#893 후속 완결성 pass)" 항목 — *"§1.2(401/403/423)에 409 를 섞지 않고 status 열 서브섹션으로 둔 것은 §1.5~§1.8 선례"*
    - "§1 카탈로그 완결성 종결 — #882/#887 deferred 잔여 등재" 항목 — *"§1.2 의 401/403/423 구조 부합"*
  - 상세: 실측 결과 spec 전체(`spec/**`)에서 상태코드 `423` 이 등장하는 지점은 `3-error-handling.md:48` (`ACCOUNT_LOCKED`) 딱 한 곳이다(`spec/5-system/2-api-convention.md`·`spec/conventions/error-codes.md`·`spec/data-flow/*.md` 어디에도 없음). 즉 `ACCOUNT_LOCKED` 는 §1.2 안에서 **423 을 대표하는 유일한 행**이다. 위 두 과거 Rationale 항목은 "§1.2 = 401/403/423 구조" 라는 서술을 **근거**로 삼아 `NOT_A_MEMBER`·`INVALID_PASSWORD`(401/403) 는 §1.2 에, `CANNOT_ASSIGN_OWNER` 등(409 포함)은 별도 §1.9 서브섹션에 배치하는 결정을 정당화했다. target 의 처방대로 `423`→`401` 로 고치면 §1.2 (나아가 spec 전체) 에서 423 코드가 완전히 사라져, 이 두 Rationale 문구가 더 이상 현재 상태를 정확히 기술하지 않는다. 배치 결론 자체(두 코드가 401/403 이라 §1.2 에 맞다)는 뒤집히지 않지만, 이 문구를 근거로 다음 사람이 "§1.2 는 423 도 다룬다" 고 판단하면 오도된다. target 은 이 파급을 인지·서술하지 않았다.
  - 제안: target 의 ① 처방 절에 "본 정정 이후 §1.2 는 423 코드를 하나도 포함하지 않게 된다" 는 한 줄 각주를 추가하거나, 실제 spec 편집 커밋에서 위 두 Rationale 문구의 "401/403/423" 을 "401/403(과거 423 오기 포함, 2026-08-31 정정)" 등으로 갱신하는 후속 작업을 spec_impact 에 명시한다.

- **[INFO]** `ALERT_RULE_NOT_FOUND` 를 "카탈로그가 SoT" 로 못박은 표현이 도메인-참조 패턴과의 관계를 명시하지 않음
  - target 위치: target 문서 `② ALERT_RULE_NOT_FOUND` 처방 섹션 — *"기능 spec 쪽은 그대로 두고 카탈로그를 SoT 로 추가한다"*
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` Overview 도입부 — *"정의·트리거 조건의 상세 SoT 가 도메인 spec 에 있는 코드(2FA/WebAuthn §1.2.1·WS commands §1.5·EIA REST §1.6·webhook §1.7·KB/Graph RAG §1.8·워크스페이스 멤버 직접추가 §1.9)는 해당 도메인 spec 을 SoT 로 참조하고 본 §1 에는 공용 카탈로그 가시성을 위해 등재만 한다"* 및 동일 문서 §1.3 의 `MODEL_CONFIG_NOT_FOUND`(도메인-참조 컬럼 없이 §1.3 에 완전 서술로 직접 등재된) 선례
  - 상세: 이 문서에는 실제로 두 개의 공존 패턴이 있다 — (a) §1.2.1/§1.5~§1.9: "정의 SoT = 도메인 spec, 본 문서는 등재만" 원칙을 명시한 도메인-참조 패턴, (b) §1.3 의 `RESOURCE_NOT_FOUND`·`MODEL_CONFIG_NOT_FOUND`: 도메인 spec 을 가리키지 않고 §1.3 자체가 완전한 정의를 담는 직접-등재 패턴. target 이 택한 것은 (b) 이며 실측으로 확인한 `alerts.service.ts` 동작(존재 누설 방지, `MODEL_CONFIG_NOT_FOUND` 패턴 재사용)과 부합해 원칙 위반은 아니다. 다만 "카탈로그를 SoT 로 추가한다" 는 문구가 Overview 의 "도메인 spec 이 SoT, 카탈로그는 등재만" 원칙과 표면적으로 충돌해 보일 수 있다.
  - 제안: target 처방문에 "이는 §1.5~§1.9 의 도메인-참조 패턴이 아니라 `MODEL_CONFIG_NOT_FOUND` 직접-등재 선례를 따른 것" 이라는 한 문장을 명시하면 다음 검토자가 두 패턴 중 어느 쪽을 의도적으로 골랐는지 헷갈리지 않는다.

## 요약

target 은 두 건 모두 "구현이 처음부터 spec 과 달랐다" 는 사실을 `git log -S`·코드 실측으로 확인한 뒤 spec 을 구현에 맞추는 순수 정정이며, 저장소가 이미 기록한 교훈("문서화됐는데 미구현 → 폐기 이력 확인 후 되살릴지 판단")을 스스로 인용해 올바르게 적용했다. `ACCOUNT_LOCKED` 423→401 은 어떤 과거 Rationale 도 명시적으로 채택한 적 없는 오기였고(관련 코드·Rationale 어디에도 423 채택 근거 없음), 423→구현변경 대안은 API 계약 변경 위험을 근거로 target 자신이 새 Rationale 로 명시 기각했다 — 이는 절차상 올바르다. `ALERT_RULE_NOT_FOUND` 등재는 `MODEL_CONFIG_NOT_FOUND` 의 기존 "존재 누설 방지" Rationale 패턴을 실측(코드의 `where: { id, workspaceId }`)으로 검증 후 재사용한 것으로 선례를 정확히 계승한다. 유일한 아쉬움은, `ACCOUNT_LOCKED` 정정이 §1.2 를 "401/403/423 구조" 로 서술한 두 과거 Rationale 항목을 소급 부정확하게 만드는 부수효과를 target 이 언급하지 않은 점(WARNING)과, "카탈로그가 SoT" 문구가 문서 내 공존하는 두 등재 패턴 중 어느 것을 택했는지 명시하지 않은 점(INFO)이다. 둘 다 새 결정을 뒤집거나 기각된 대안을 되살리는 문제가 아니라, 문서 정합성 유지를 위한 보완 제안 수준이다.

## 위험도

LOW
