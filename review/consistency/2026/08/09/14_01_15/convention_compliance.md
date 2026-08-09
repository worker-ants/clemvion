# 정식 규약 준수 검토 — spec/5-system/ (1-auth.md · 2-api-convention.md · 3-error-handling.md)

## 검토 범위

- target: `spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md` (impl-prep 번들 — `auth-guard-reflection-hardening` 착수 전, `1-auth.md` `code:` 의 `common/guards/*.ts` 매치로 선정된 것으로 추정)
- 대조 규약: `spec/conventions/error-codes.md`, `spec/conventions/swagger.md`, `spec/conventions/audit-actions.md`, `spec/conventions/spec-impl-evidence.md` (실제 repo 를 직접 열람 — prompt 에 번들된 `spec/conventions/cafe24-api-catalog/**` 는 대상 문서와 무관해 분석에서 제외)
- 결론 선반영: 세 문서 모두 대상 규약을 **매우 촘촘하게 교차 참조**하고 있고(특히 `error-codes.md §3` historical-artifact 레지스트리·`audit-actions.md` 시제 taxonomy·`swagger.md §5-4`), 명백한 CRITICAL 위반은 발견되지 않았다. 발견된 항목은 모두 문서 정합성 수준의 WARNING/INFO다.

---

### 발견사항

- **[WARNING] `2-api-convention.md §2.2` URL 중첩 규칙이 실제 auth/2FA/WebAuthn API 표면을 커버하지 못함**
  - target 위치: `spec/5-system/2-api-convention.md` §2.2 "명명 규칙" 표 (중첩 2단계 규칙 + "예외 — RPC-style sub-channel action")· `spec/5-system/1-auth.md` §5 API 엔드포인트 표
  - 위반 규약: `2-api-convention.md` §2.2 자신 — "중첩은 2단계까지" / "3단계 이상은 최상위로 분리" / 유일한 예외 조항 `/api/{resource}/{id}/{channel}/{action}` (`{id}` 필수)
  - 상세: `1-auth.md` §5 는 `POST /api/auth/2fa/webauthn/register/options`, `.../register/verify`, `.../authenticate/options`, `.../authenticate/verify`, `.../recovery`, `.../recovery-codes/regenerate` 등 `{id}` 세그먼트 없이 4~5단계로 중첩된 경로를 다수 정의한다. 이는 §2.2 의 "2단계까지" 원칙도, 유일한 예외 조항(`{id}` 를 포함하는 RPC-style sub-channel, 예 `/api/triggers/:id/notification/rotate-secret`)도 문언상 커버하지 못한다 — 예외 조항은 "자원 인스턴스 + 채널 + 동작"을 전제하는데, `auth/2fa/webauthn/*` 는 자원 인스턴스(`:id`) 없이 도메인 네임스페이스만으로 여러 단계를 쌓는 다른 패턴이다.
  - 제안: 이미 `implemented` 상태로 굳어진(rename 시 breaking) API 표면이므로 엔드포인트를 바꾸기보다 **규약 문서를 갱신**하는 편이 맞다. §2.2 예외 조항에 "자원 인스턴스가 없는 도메인 네임스페이스 하위의 다단계 action 경로"(`/api/{domain}/{feature}/{sub-feature}/{action}`, 예 `auth/2fa/webauthn/*`)를 별도 허용 패턴으로 명시해 향후 신규 엔드포인트 작성자가 §2.2 를 읽고 오판(3단계 이상은 무조건 위반)하지 않도록 한다.

- **[WARNING] `3-error-handling.md` — `status: implemented` 인데 본문에 미구현(Planned) 약속 3건이 `pending_plans:` 없이 존재**
  - target 위치: `spec/5-system/3-error-handling.md` frontmatter (`status: implemented`, `pending_plans:` 없음) · §2.1("`REQUIRED`/`INVALID_FORMAT` 세분화 코드 … 계획(Planned)이며 미구현") · §3.3("`maxInterval` 클램프 … 계획(Planned), 미구현") · §7.2("`vectorDb` 체크 항목과 `degraded` 3-state 어휘는 아직 미구현")
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 status 라이프사이클 — `implemented` = "모든 약속 구현 완료", 미구현 약속이 있으면 `partial` + `pending_plans:` 의무(§2.1 필드 정의, R-5 "spec 이 자기를 책임지는 plan 을 가리킴")
  - 상세: 본문에 명시적으로 "계획(Planned)"·"미구현"이라 쓴 3개 항목이 있는데도 frontmatter 는 `implemented` 로 선언돼 있고 `pending_plans:` 가 없다. `spec-status-lifecycle.test.ts` 가드는 `status` 값 자체와 `pending_plans` 존재 여부만 검증하고 본문 텍스트의 "Planned" 언급까지 대조하지 않으므로 이 drift 는 build 가드에 걸리지 않는다 — `spec-impl-evidence.md` R-5 가 막으려 한 "빈 약속"(어떤 plan 도 책임지지 않는 미구현 promise) 시나리오와 정확히 같은 패턴이다. `1-auth.md`(status: partial + pending_plans: spec-sync-auth-gaps.md, LDAP/SAML·`workflow.executed` 를 정확히 추적)와 대조된다.
  - 제안: 두 가지 중 하나 — (a) 이 3개 항목을 책임질 `plan/in-progress/*.md` 를 신설/지정하고 `3-error-handling.md` 를 `status: partial` + `pending_plans:` 로 낮추거나, (b) 세 항목이 실제로는 사소한 저우선순위 개선(로드맵성 언급일 뿐 "약속"이 아님)이라면 `spec-impl-evidence.md` §3 관점에서 그렇게 읽히도록 "계획(Planned)" 문구를 낮추거나(예: "향후 개선 검토 여지" 로 격하) 명시적으로 범위 밖임을 Rationale 에 남긴다. 어느 쪽이든 현재 상태(`implemented` 선언 + 본문 미구현 고지 + 추적 부재)의 3중 불일치는 해소가 필요하다.

- **[INFO] `2-api-convention.md` 에 `## Overview` 섹션 부재 (CLAUDE.md 3섹션 구성 권장과의 거리)**
  - target 위치: `spec/5-system/2-api-convention.md` 상단 — `> 관련 문서: ...` 직후 바로 `## 1. 기본 원칙` 로 진입
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장" — 같은 번들의 `1-auth.md`·`3-error-handling.md` 는 둘 다 `## Overview` 를 갖고 있어 대비된다.
  - 상세: 다만 `spec/5-system/` 안에서 `## Overview` 가 없는 파일이 `2-api-convention.md` 외에도 `16-system-status-api.md`·`11-mcp-client.md`·`5-expression-language.md`·`7-llm-client.md`·`6-websocket-protocol.md`·`_product-overview.md` 6개 더 있어, 이번 변경이 새로 만든 결함이 아니라 영역 전반의 기존 패턴이다. 심각도는 낮게 잡았다.
  - 제안: 즉시 조치보다는, 이 영역의 "레퍼런스형" 문서(API/프로토콜 규칙 나열형)에는 Overview 절이 관례상 생략된다는 점을 CLAUDE.md 또는 project-planner SKILL.md 에 명시적 예외로 적어두거나, 다음 spec 정리 라운드에서 일괄로 짧은 Overview 를 채워 넣는 것을 권장.

- **[INFO] `1-auth.md` §3.2 "리소스별 권한 매트릭스" 표가 각주 블록quote 로 두 조각나 있어 후반부가 표로 렌더링되지 않을 위험**
  - target 위치: `spec/5-system/1-auth.md` L372~L379 — `| Schedule | ... |` 다음 바로 `> **† Admin 멤버 삭제의 대상 제약**...` 블록quote 4줄이 끼어들고, 이어서 헤더/구분선 재선언 없이 `| Integration (Org) | ... |` 행이 이어짐
  - 위반 규약: 특정 `spec/conventions/**` 항목은 아니며 GFM 테이블 문법 자체의 문제 — "문서 구조 규약" 관점에서 부수적으로 짚음
  - 상세: GFM 은 표 헤더+구분선 바로 다음에 연속된 `|` 행만 같은 표로 인식한다. 블록quote 로 끊긴 뒤에는 새 헤더/구분선이 없어 `Integration (Org)` 이하 행들(Integration~Audit Log)이 별도 표로 렌더링되지 않고 원시 텍스트로 노출될 가능성이 크다 — `spec-link-integrity.test.ts` 가 쓰는 렌더 파이프라인(`rehype-slug`) 기준으로 실제 사이트에서 깨질 수 있다.
  - 제안: 각주(`†`) 블록quote 를 표 **아래**(전체 표 종료 후)로 옮기거나, 표를 완전히 마친 뒤 각주를 배치. 정식 규약 위반이라기보다 렌더링 방지 차원의 권고이므로 INFO 로 유지.

---

### 요약

세 target 문서(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)는 `spec/conventions/error-codes.md`(명명·rename 안정성·historical-artifact 예외 레지스트리)·`spec/conventions/audit-actions.md`(액션 taxonomy·도메인 레지스트리)·`spec/conventions/swagger.md`(응답 wrapping·DTO 패턴·§5-4 최신 가드 확장)를 문장 단위로 정합성 있게 교차 참조하고 있으며, historical-artifact lowercase 코드·workspace 직접-추가 코드·재인증 코드 3종(`REAUTH_REQUIRED`/`PASSWORD_INVALID`/`TOTP_INVALID`) 등 세부까지 카탈로그가 어긋나지 않는다. CRITICAL 급 직접 위반은 발견되지 않았다. 다만 (1) API URL 중첩 규칙(§2.2)이 실제 auth/2FA/WebAuthn 다단계 action 경로를 문언상 커버하지 못하는 점과 (2) `3-error-handling.md` 가 `status: implemented` 를 선언한 채 본문에 미구현(Planned) 항목 3건을 `pending_plans:` 없이 방치한 점은 `spec-impl-evidence.md` 가 명시적으로 막으려 한 "추적되지 않는 빈 약속" 패턴과 일치해 WARNING 으로 등재했다. 나머지는 문서 렌더링/구조 관례 수준의 INFO다.

### 위험도

LOW
