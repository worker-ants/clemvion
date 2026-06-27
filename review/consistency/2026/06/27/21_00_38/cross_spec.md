# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` · scope: `spec/conventions/` · diff-base: `origin/main`

---

### 발견사항

- **[INFO]** `spec/5-system/2-api-convention.md §6` HTTP 상태 코드 표에 202 누락
  - target 위치: `spec/conventions/swagger.md §5-2` — `ApiAcceptedWrappedResponse(Dto)` 헬퍼 정의 (202 Accepted 공식 헬퍼로 등록)
  - 충돌 대상: `spec/5-system/2-api-convention.md §6` — HTTP 상태 코드 열거 표 (200 / 201 / 204 / 400~503, 202 미포함)
  - 상세: swagger.md가 202 Accepted 전용 래퍼 헬퍼 `ApiAcceptedWrappedResponse`를 공식 패턴으로 제공하지만, api-convention.md §6 상태 코드 표에는 202가 열거되어 있지 않다. 그러나 api-convention.md 본문(§5 내부) 에서는 이미 `202 Accepted 반환 (비동기 실행)` 을 참조하고 있어 표와 본문 사이 내부 모순이 있다. 충돌은 swagger.md가 유발한 것이 아니라, 기존 api-convention.md §6 표가 불완전한 데 swagger.md가 202를 명시적으로 드러낸 결과다.
  - 제안: `spec/5-system/2-api-convention.md §6` 상태 코드 표에 `202 | Accepted | 비동기 처리 접수 (예: 워크플로우 실행 큐 적재)` 행 추가. swagger.md 수정 불필요.

- **[INFO]** `spec/5-system/2-api-convention.md §1` 인증 표에 `interaction-token` Bearer scheme 미언급
  - target 위치: `spec/conventions/swagger.md §2-1` — `interaction-token` Bearer scheme을 Swagger에 등록함을 명시, EIA 전용 endpoint는 `@ApiBearerAuth('interaction-token')`을 사용한다고 기술
  - 충돌 대상: `spec/5-system/2-api-convention.md §1` 인증 항목 — "Bearer Token (Authorization: Bearer {access_token})" 단일 항목만 열거
  - 상세: `main.ts`가 두 개의 Bearer scheme을 등록한다는 사실(`access-token` + `interaction-token`)이 swagger.md §2-1에서 명시화됐다. api-convention.md §1의 인증 개요는 단일 Bearer Token만 기술하며 EIA 전용 interaction-token scheme을 언급하지 않는다. EIA spec(`spec/5-system/14-external-interaction-api.md`)은 `iext_*`/`itk_*` 토큰을 상세히 다루지만, cross-cutting 인증 인벤토리 역할을 하는 api-convention.md §1이 이 두 번째 인증 scheme을 누락하고 있어 전체 API 인증 체계가 한 곳에서 보이지 않는다.
  - 제안: `spec/5-system/2-api-convention.md §1` 인증 항목에 "EIA 전용 — Interaction Token (Authorization: Bearer {iext_jwt | itk_token}), 상세: [EIA §4](./14-external-interaction-api.md)" 행 추가. swagger.md 수정 불필요.

- **[INFO]** `spec/conventions/audit-actions.md §3` `model_config` 항목 — 1-auth.md와 표기 일치 확인
  - target 위치: `spec/conventions/audit-actions.md §3` 도메인별 분류 레지스트리 — `model_config` 행 신규 추가 (현재형 §2.2, `create/update/delete/set_default`, 미구현)
  - 충돌 대상: `spec/5-system/1-auth.md §4.1` — `model_config.*` 감사 액션을 "목표 설계, 현재 미구현" 으로 동일하게 참조
  - 상세: 두 spec의 `model_config` 기술이 패턴(현재형)·동사 목록(`create/update/delete/set_default`)·구현 상태(미구현)가 모두 일치하며 충돌 없음. reveal 미제공 근거도 양쪽에서 동일하게 서술된다. 별도 조치 불필요.
  - 제안: 없음 (일관성 확인됨).

- **[INFO]** `spec/conventions/cafe24-api-catalog/_overview.md §7.1` field-level 파일 frontmatter 제외 선언 — spec-impl-evidence.md 등록 일치 확인
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md §7.1` — `<name>-api-catalog/<resource>/**/*.md` 를 spec lifecycle frontmatter 의무에서 제외한다고 선언, 근거 "§Rationale R-7"로 위임
  - 충돌 대상: `spec/conventions/spec-impl-evidence.md §1/R-7` — 동일 패턴(`<name>-api-catalog/<resource>/**/*.md`)을 명시적으로 제외 목록에 등재하고 R-7에서 근거 설명
  - 상세: 두 문서의 제외 범위 표현이 정확히 일치하며 모순 없음.
  - 제안: 없음 (일관성 확인됨).

---

### 요약

`spec/conventions/` 영역의 이번 변경(swagger.md 신규 등록, audit-actions.md model_config 추가, cafe24-api-catalog field-level 파일 다수 추가)은 다른 spec 영역과 직접 모순을 일으키지 않는다. swagger.md가 202 Accepted 헬퍼(`ApiAcceptedWrappedResponse`)를 공식 패턴으로 명문화함으로써, 기존에 이미 존재하던 `spec/5-system/2-api-convention.md §6` 상태 코드 표의 불완전성(202 누락)이 수면 위로 드러났다. 마찬가지로 EIA 전용 `interaction-token` Bearer scheme이 api-convention.md 인증 개요에 언급되지 않은 점도 swagger.md §2-1 기술로 부각됐다. 두 가지 모두 swagger.md의 오류가 아니라 api-convention.md 측의 동기화 필요 항목이다. audit-actions.md의 model_config 추가 및 cafe24-api-catalog 제외 선언은 연관 spec과 완전히 일치한다. 전체적으로 CRITICAL 또는 WARNING 수준의 직접 모순은 발견되지 않았다.

### 위험도

LOW

STATUS: SUCCESS
