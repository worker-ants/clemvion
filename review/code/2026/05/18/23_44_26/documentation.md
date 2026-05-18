# 문서화(Documentation) 리뷰 — 2FA WebAuthn 구현

리뷰 대상: review/consistency 산출물 2세션 + spec 문서 6개 (spec/1-data-model.md, spec/5-system/1-auth.md, spec/2-navigation/10-auth-flow.md, spec/2-navigation/9-user-profile.md, spec/3-workflow-editor/4-ai-assistant.md, spec/data-flow/2-auth.md, spec/5-system/_product-overview.md)

---

### 발견사항

- **[WARNING]** `spec/5-system/1-auth.md §1.4.4` — counter 역행 처리 문구 불일치 (오래된 주석 유형)
  - 위치: `spec/5-system/1-auth.md` §1.4.4 마지막 단락: "해당 credential 을 강제 비활성 (별도 컬럼 추가 없이 row 삭제)"
  - 상세: 동일 파일 내 `§2.21 WebAuthnCredential` 데이터 모델에서는 "row 즉시 삭제 (suspend 컬럼 도입 금지)" 로 표현이 통일되어 있으나, §1.4.4 본문은 "강제 비활성" 이라는 모호한 표현을 먼저 쓰고 괄호 내에서만 "row 삭제" 를 부연한다. 두 표현이 같은 파일 안에서 혼재하여 구현자가 `disabled_at` 컬럼 도입 여지를 읽어낼 수 있다. cross_spec 검토에서도 동일 이슈가 WARNING 으로 지적되었다.
  - 제안: §1.4.4 의 해당 문장을 "해당 credential row 를 즉시 삭제하고 (`disabled_at` 등 suspend 컬럼 불도입 — Rationale §1.4.E) LoginHistory 에 `webauthn_failed`(`WEBAUTHN_COUNTER_REGRESSION`) 기록" 으로 통일.

- **[WARNING]** `spec/1-data-model.md §2.18.2` — 미래 마이그레이션 번호(V058) 문서에 고정 기재
  - 위치: `spec/1-data-model.md §2.18.2` LoginHistory 섹션 하단: "WebAuthn 추가는 V058 에서 DROP CONSTRAINT + ADD CONSTRAINT 패턴으로 갱신한다"
  - 상세: spec 에 구체적 마이그레이션 번호를 박는 것은 구현 전 예약 번호에 불과하며, 착수 시점에 다른 worktree 가 해당 번호를 선점하면 spec 과 코드 사이에 불일치가 발생한다. cross_spec 검토에서도 동일 이슈를 INFO 로 지적했다. 이 패턴이 spec 의 신뢰성을 흐린다.
  - 제안: "V058" 표기를 "구현 완료 후 실제 적용 마이그레이션 번호로 사후 갱신" 주석으로 대체하거나, 구현 시점 번호 확정 후 spec 을 반영하는 절차를 plan 에 명시한다.

- **[WARNING]** `spec/5-system/1-auth.md §4.1` — WebAuthn credential 등록·삭제 이벤트의 AuditLog 포함 여부 미결로 문서 공백
  - 위치: `spec/5-system/1-auth.md §4.1` AuditLog 대상 액션 목록
  - 상세: TOTP 의 `2fa_enable/disable` 은 AuditLog 대상으로 명시되어 있으나, WebAuthn credential 등록·삭제(`webauthn_credential_register`, `webauthn_credential_delete`)의 AuditLog 포함 여부가 TODO 상태다. 보안 관점에서 credential 추가/삭제는 TOTP 활성화/비활성화와 동급의 보안-critical 변경인데, spec 에 결정이 없으면 구현자가 임의로 처리하거나 누락할 위험이 있다. cross_spec 검토에서도 동일 항목이 WARNING 으로 지적됐다.
  - 제안: §4.1 에 "WebAuthn credential 등록·삭제: LoginHistory 기록만으로 대체 OR AuditLog 포함" 결정을 명시한다. 어느 쪽이든 결정 내용을 Rationale 절에 한 줄 이유와 함께 기재한다.

- **[WARNING]** `spec/2-navigation/9-user-profile.md §6.1` — 구 endpoint 행이 deprecated 표기 없이 canonical 과 혼재
  - 위치: `spec/2-navigation/9-user-profile.md §6.1` API 표: `/api/users/me/enable-2fa`, `/api/users/me/confirm-2fa` 행
  - 상세: 변경된 코드에서 두 행에 "canonical: POST /api/auth/2fa/setup" 식의 참조를 추가했으나, 해당 행이 여전히 표에 살아있어 이 경로들이 실제로 동작하는 별도 alias 인지 역사적 legacy 인지 구분이 안 된다. 이미 제거된 구 endpoint 라면 표에서 삭제해야 하고, alias 로 유지한다면 그 사실과 유지 기한을 명시해야 한다.
  - 제안: 실제로 라우트가 존재하지 않으면 행을 삭제한다. alias 로 유지한다면 "deprecated alias — 다음 major 에서 제거 예정" 과 같이 표기하고 canonical 참조 링크만 남긴다.

- **[WARNING]** `spec/2-navigation/10-auth-flow.md §3.2` — `requiresTotp` deprecated 타임라인 참조가 외부 spec 에만 위임되어 있어 단독 문서 독해 불가
  - 위치: `spec/2-navigation/10-auth-flow.md §3.2` 하단 "응답의 `requiresTotp` 는 deprecated 호환 필드이며 두 필드 충돌 시 `requires2fa` 가 우선한다. 자세한 deprecate 타임라인은 [auth spec §1.4.2]… 를 따른다."
  - 상세: auth-flow spec 을 단독으로 읽는 프론트엔드 구현자가 `requiresTotp` 를 언제까지 지원해야 하는지 바로 알 수 없어, 링크를 타야만 답을 얻을 수 있다. cross_spec 검토에서도 동일 항목을 WARNING 으로 지적했다.
  - 제안: §3.2 에 "(제거 조건: 두 마이너 버전 후 + `methods`만 보는 신규 프론트엔드 동일 PR 배포 확인 — 상세는 [auth spec §1.4.2])" 형태로 핵심 조건을 한 줄 인라인 요약한다. 외부 링크는 유지하되 단독 독해 가능성을 확보한다.

- **[INFO]** `spec/5-system/1-auth.md §1.4.3` — `WEBAUTHN_ORIGIN` 과 기존 `CORS_ORIGINS` 의 역할 차이 설명 누락
  - 위치: `spec/5-system/1-auth.md §1.4.3` WebAuthn 환경변수 표
  - 상세: `WEBAUTHN_ORIGIN` 이 추가되었으나 기존 `CORS_ORIGINS` 와의 차이(HTTP CORS 정책용 vs. WebAuthn `expectedOrigin` 파라미터용)가 spec 에 기술되지 않는다. naming_collision 검토도 운영자가 두 변수를 독립 관리해야 하는 이유가 불명확하다고 지적했다. `.env.example` 에도 `WEBAUTHN_*` 블록이 없는 상태이다.
  - 제안: `§1.4.3` 표 하단에 "WEBAUTHN_ORIGIN 은 WebAuthn `verifyAuthenticationResponse` 의 `expectedOrigin` 파라미터용이며 CORS_ORIGINS(HTTP 레이어)와 독립적으로 설정해야 한다" 한 줄 설명을 추가한다. `codebase/backend/.env.example` 에 `WEBAUTHN_*` 블록과 동일 주석을 추가한다.

- **[INFO]** `spec/5-system/1-auth.md §1.4` Rationale — §1.4.D 가 추가되었으나 §1.4.C 와 §1.4.E 사이에 비연속으로 배치되어 목차 순서가 혼재
  - 위치: `spec/5-system/1-auth.md` Rationale 섹션 말미: 1.4.A → 1.4.B → 1.4.C → 1.4.E → 1.4.D 순서로 나열됨 (diff 기준)
  - 상세: Rationale 항목이 1.4.A, 1.4.B, 1.4.C, 1.4.E, 1.4.D 순으로 배치되어 있어 D 가 E 뒤에 위치한다. 소단원 번호 순서가 맞지 않으면 참조 시("Rationale §1.4.D 참고") 독자가 순서를 역행해야 한다.
  - 제안: Rationale 항목을 A → B → C → D → E 순으로 재정렬한다.

- **[INFO]** `spec/3-workflow-editor/4-ai-assistant.md` — 관련 문서 링크의 섹션 번호 갱신이 단순 수치 변경에만 그쳐 링크 정합성 확인 필요
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md` 첫 줄 관련 문서 링크: `§2.20·§2.22` (변경 전 `§2.20~2.21`)
  - 상세: §2.21 → WebAuthnCredential 신설로 AssistantMessage 가 §2.22 로 시프트됨에 따라 링크 앵커 텍스트를 갱신했다. 그러나 `#220-assistantsession` 앵커 자체는 유효한지, `§2.22` 에 대응하는 앵커(`#222-assistantmessage`)가 `spec/1-data-model.md` 에 올바르게 생성되었는지 확인이 필요하다. markdown 앵커는 헤딩 텍스트 기반이라 번호가 바뀌면 앵커 ID 도 바뀐다.
  - 제안: `spec/1-data-model.md` 에서 `§2.22 AssistantMessage` 헤딩이 생성한 앵커 ID 를 확인하고, `4-ai-assistant.md` 의 링크 href 를 정확한 앵커로 수정한다.

- **[INFO]** consistency review 산출물 — `plan_coherence.md` (23_02_30 세션) 헤더 섹션(`### 발견사항`) 이 있으나 문서 제목(`#`)이 없어 리뷰 문서 독해 맥락 부족
  - 위치: `review/consistency/2026/05/18/23_02_30/plan_coherence.md` 파일 전체
  - 상세: 같은 세션의 `convention_compliance.md`, `cross_spec.md`, `naming_collision.md` 는 모두 `# <제목>` H1 헤딩으로 시작하지만, `plan_coherence.md` 와 `rationale_continuity.md` 는 `### 발견사항` 으로 바로 시작해 독립 파일로 열었을 때 어떤 검토 결과인지 제목이 없다. 비교적 경미하지만 리뷰 아카이브 탐색 시 혼란을 줄 수 있다.
  - 제안: `plan_coherence.md` 와 `rationale_continuity.md` 상단에 `# Plan 연속성 검토 — …` / `# Rationale 연속성 검토 — …` 형태의 H1 헤딩을 추가한다. (두 번째 세션 `23_11_17` 의 동명 파일도 같은 패턴)

- **[INFO]** `spec/5-system/1-auth.md §1.4.4` WebAuthn 흐름 — 복구 코드 재발급 endpoint 문서가 §1.4.4 본문에 없고 §5 API 표에만 존재
  - 위치: `spec/5-system/1-auth.md §1.4.4` WebAuthn 흐름 설명 vs. §5 API 표 `POST /api/auth/2fa/webauthn/recovery-codes/regenerate` 행
  - 상세: §1.4.4 는 등록·인증·복구 코드 fallback 3개의 흐름을 설명하지만 "복구 코드 재발급" 흐름은 §5 API 표에만 나온다. 독자가 §1.4.4 를 읽는 것만으로는 재발급 흐름의 사전 조건(비밀번호 재확인, 기존 코드 폐기 등)을 파악할 수 없다.
  - 제안: §1.4.4 에 복구 코드 재발급 흐름을 4번째 항목으로 추가하고 (`POST /api/auth/2fa/webauthn/recovery-codes/regenerate` + 비밀번호 재확인 조건), §5 표와 교차 참조한다.

- **[INFO]** plan 문서 — `plan/in-progress/2fa-webauthn.md §4` 91번 줄 counter 역행 응답 코드 `400` 이 spec (401) 과 불일치 (오래된 주석)
  - 위치: `plan/in-progress/2fa-webauthn.md §4` 91번 줄 (rationale_continuity 검토가 WARNING 으로 지적)
  - 상세: rationale_continuity 검토가 spec `§5` API 표와 동일 plan e2e 시나리오 모두 `401` 을 명시하는데 plan §4 구현 설명에만 `400 응답` 으로 기재되어 있다고 지적했다. 이는 구현자가 plan 을 그대로 따를 경우 직접 HTTP 상태 코드 오류로 이어지는 오래된 주석 유형이다.
  - 제안: plan §4 91번 줄의 `400 응답` 을 `401 응답` 으로 수정한다. spec §5 가 SoT.

- **[INFO]** plan 문서 — `requiresTotp` deprecated 제거 조건에서 두 번째 조건(프론트엔드 동시 배포 확인) 누락
  - 위치: `plan/in-progress/2fa-webauthn.md §4` 105번 줄 (rationale_continuity 검토 INFO)
  - 상세: plan 이 "(1) 두 마이너 버전 후 제거" 만 언급하고 "(2) `methods` 만 보는 새 프론트엔드 동일 PR 배포 확인" 조건을 빠뜨렸다. spec §1.4.2 는 둘 다 충족되어야 한다("둘 중 늦은 시점")고 명시하므로, W-1 follow-up 시 (1)만 기준으로 제거할 위험이 있다.
  - 제안: plan 105번 줄에 "(2) `methods`만 보는 신규 프론트엔드 동일 PR 배포 확인 후 제거 — `spec/5-system/1-auth.md §1.4.2` 두 조건 모두 충족 시점" 을 병기한다.

---

### 요약

이번 변경에서 spec 문서화 수준은 전반적으로 높다. `spec/5-system/1-auth.md` 에 WebAuthn 관련 §1.4 전체를 신설하고 Rationale A~E 를 추가했으며, `spec/1-data-model.md` 의 User 필드·LoginHistory enum·WebAuthnCredential 신규 섹션·인덱스 표, `spec/data-flow/2-auth.md` 의 시퀀스 다이어그램 갱신, `spec/2-navigation/10-auth-flow.md` 의 3.4.2 WebAuthn 화면 신설까지 다수 문서를 체계적으로 갱신했다. 다만 문서화 관점의 주요 결함은 세 가지다. 첫째, counter 역행 처리를 "강제 비활성" 과 "row 삭제" 두 표현이 같은 spec 내에서 혼재해 구현자가 `disabled_at` 컬럼 도입을 고려할 수 있다. 둘째, `spec/1-data-model.md §2.18.2` 에 구현 전 마이그레이션 번호(V058)가 spec 에 고정 기재되어 있어 실제 번호와 달라질 경우 spec 의 신뢰성을 저해한다. 셋째, WebAuthn credential 등록·삭제의 AuditLog 포함 여부 결정이 문서에 공백으로 남아 있어 구현자가 임의로 판단해야 한다. Rationale 순서 비연속(D 가 E 뒤에 배치), `requiresTotp` deprecated 타임라인의 단독 문서 독해 불가, plan 내 오래된 응답 코드(`400` vs `401`) 등 인라인 설명 정확성 문제도 수정이 필요하다. 전반적으로 신규 기능 spec 문서화 품질은 양호하나 위의 WARNING 3건과 INFO 8건의 보완이 구현 착수 전 권장된다.

---

### 위험도

MEDIUM
