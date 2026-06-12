### 발견사항

전체 문서를 대상으로 4개 점검 관점을 적용한 결과 CRITICAL 및 WARNING 수준의 위반은 발견되지 않았다. 아래는 관찰된 항목들이다.

- **[INFO]** `execution.re_run` 동사 시제 예외에 대한 Rationale 미작성
  - target 위치: `spec/5-system/1-auth.md` §4.1 Action naming 규약 (line 349)
  - 과거 결정 출처: 동일 문서 `## Rationale §4.1.A`
  - 상세: §4.1 naming 규약에서 "integration 은 과거분사, execution 은 `re_run` 을 쓴다, auth_config 은 현재형으로 통일"로 서술하나, `execution.re_run` 이 과거분사(`re_ran`)도 현재형도 아닌 이유에 대한 Rationale 항목이 본 문서에 없다. Rationale 4.1.A 는 `auth_config.*` 현재형 예외를 명시적으로 정당화하고, `model_config.*` 도 동일 근거로 현재형을 선택함을 기술하지만, `execution.re_run` 은 "구현된 현실값이라서 유지한다"는 암묵적 historical-artifact 처리만 있고 이를 명문화하는 Rationale 항목이 없다. `data-flow/1-audit.md` cross-audit G-02 주석에 "정정됐다"는 사실만 기록될 뿐, 왜 `re_ran`이나 `re_run` 현재형 통일로 가지 않았는지 결정 근거가 어디에도 없다.
  - 제안: §Rationale 에 `execution.re_run` 이 기존 구현값으로 고착된 historical-artifact 임을 명시하는 1–2줄 항목(`4.1.B` 등)을 추가해 4.1.A 의 "신규 Planned 액션은 과거분사 기본" 규칙과의 긴장을 해소한다. 혹은 4.1.A 항 내에 `re_run` 을 historical exception 으로 명시할 수 있다.

- **[INFO]** `WEBAUTHN_ALLOW_FALLBACK` env 가 "운영 사용 금지"로 기술되어 있으나 Production fail-closed 가드 목록에 포함되지 않는 이유 불명
  - target 위치: `spec/5-system/1-auth.md` §1.4.3 (line 123), §Rationale `Production fail-closed 가드` (line 577-601)
  - 과거 결정 출처: 동일 문서 `## Rationale 1.4.F`; `## Rationale Production fail-closed 가드` (단일 블록 응집 이유)
  - 상세: `WEBAUTHN_ALLOW_FALLBACK=1` 은 §1.4.3 에서 "개발·로컬·시연 한정, 운영 사용 금지"로 명시한다. Production fail-closed 가드 Rationale 은 "env 만으로 부팅 직전 판정 가능한 절대-금지 항목만 포함"한다고 기술하면서 `OAUTH_STUB_MODE`, `LLM_STUB_MODE` 등 유사한 "운영 금지" 플래그를 throw 대상으로 포함시킨다. `WEBAUTHN_ALLOW_FALLBACK=1` 이 그 목록에서 빠진 이유가 명시되지 않는다. `1.4.F` Rationale 은 "폴백이 필요한 dev/local/시연 한정 escape hatch"로 묘사하지만, `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 도 동일하게 "dev/test 전용"으로 설계된 플래그들이다.
  - 제안: Production fail-closed 가드 Rationale 에 `WEBAUTHN_ALLOW_FALLBACK` 이 throw 목록에서 제외된 이유를 한 줄 명시한다 (예: "WebAuthn 은 부가 인증 수단이라 비활성 시 인증 전면 우회가 아닌 기능 단순 미제공 — 운영 보안 위협 등급이 낮아 warn 에 그침"). 또는 의도적으로 throw 대상으로 추가하는 방향도 검토 가능하다.

---

### 요약

`spec/5-system/1-auth.md` 는 대상 문서의 모든 Rationale 항목(1.4.A~I, 1.5.A~D, 2.3.A, 4.1.A, Production fail-closed 가드)이 본문 설계 결정과 일관되게 유지되고 있으며, 기각된 대안(suspend vs 삭제, 공통 복구 코드 풀, stateful challenge DB 테이블, `requiresTotp` 필드, TOTP 자동 fallback, 워크스페이스 SMTP 초대 사용, inline auth 필드, 환경별 flyway conf, undo 스크립트)이 본문에 재도입된 사례는 없다. 합의된 invariant(WebAuthn 우선 로그인, counter 역행 즉시 삭제, 초대 이메일 일치 강제, 자유 문자열 audit action 컬럼, refresh 쿠키 domain 자동 유도)도 그대로 유지된다. 발견된 INFO 항목 2건은 기존 결정의 번복이 아니라 Rationale 보완 기회 — `execution.re_run` 의 시제 예외 근거 미기술, `WEBAUTHN_ALLOW_FALLBACK` 의 production throw 제외 이유 미기술 — 에 해당한다.

### 위험도

LOW
