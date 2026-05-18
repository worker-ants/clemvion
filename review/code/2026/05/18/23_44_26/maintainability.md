# 유지보수성(Maintainability) 리뷰

리뷰 대상: 2FA WebAuthn 구현 관련 spec 변경 및 consistency review 산출물 (파일 1~19)
리뷰 일시: 2026-05-18

---

## 발견사항

### spec 문서 (파일 14~19)

- **[WARNING]** `spec/5-system/1-auth.md` — Rationale 섹션 순서가 본문과 불일치
  - 위치: `spec/5-system/1-auth.md` diff, Rationale 1.4.A~1.4.E 블록 (diff 기준 +344~+375 라인 이후)
  - 상세: Rationale 절이 `1.4.A`, `1.4.B`, `1.4.C`, `1.4.E`, `1.4.D` 순으로 선언되어 있다. 본문 §1.4에서 상호 참조하는 순서(1.4.A → 1.4.B → 1.4.C → 1.4.D → 1.4.E)와 실제 파일 내 Rationale 등장 순서가 일치하지 않는다(1.4.E가 1.4.D보다 먼저 등장). 독자가 순서를 따라가며 읽을 때 혼란을 야기하고, 검색으로 찾지 않으면 특정 Rationale을 놓치기 쉽다.
  - 제안: Rationale 절을 `1.4.A → 1.4.B → 1.4.C → 1.4.D → 1.4.E` 순서로 재배치한다.

- **[WARNING]** `spec/5-system/1-auth.md §1.4` — 용어 혼재: "강제 비활성" vs "row 삭제"
  - 위치: `spec/5-system/1-auth.md §1.4.4` 본문("강제 비활성 (별도 컬럼 추가 없이 row 삭제)")과 Rationale 1.4.E("해당 row를 즉시 삭제")
  - 상세: `cross_spec.md` 파일 9에서도 이미 지적됐으나 spec 문서 자체에서 "강제 비활성"과 "row 삭제"를 병용한다. 괄호 부연이 없으면 `is_active` 컬럼이 존재하는 것으로 오해할 수 있다. 데이터 모델(`spec/1-data-model.md §2.21`) 역시 `counter` 필드 설명에서 이미 "row 즉시 삭제"로 통일됐으므로, auth.md 내 표현도 단일 용어로 통일해야 유지보수 시 혼란이 줄어든다.
  - 제안: `§1.4.4` 본문의 "강제 비활성 (별도 컬럼 추가 없이 row 삭제)" 문구를 "row 즉시 삭제 (suspend 컬럼 도입 금지 — Rationale 1.4.E)"로 통일.

- **[WARNING]** `spec/5-system/1-auth.md §1.4.2` — 복잡한 표 셀 가독성 저하
  - 위치: §1.4.2 인증 방식 선택 표, `{ requires2fa: true, methods: ['webauthn'], challengeToken, requiresTotp: <true if TOTP active else false> }` 셀
  - 상세: 마크다운 표 셀 안에 JSON 유사 구조체와 조건식(`<true if TOTP active else false>`)이 함께 들어있어 좁은 뷰포트에서 렌더링이 깨지고 diff에서 한눈에 파악하기 어렵다. 특히 표 셀 내부에 `|` 문자를 포함하는 배열 표기(`['webauthn']`)는 일부 마크다운 렌더러에서 열 구분자로 오인될 수 있다.
  - 제안: 응답 형태는 표 셀 대신 표 아래 별도 코드 블록(`\`\`\`json`)으로 기술하거나, 표를 간략히 유지하고 상세 응답 스키마는 §5 API 표를 정식 참조처로 지정한다.

- **[INFO]** `spec/1-data-model.md §2.21` — `WebAuthnCredential` 설명 주석이 본문과 중복
  - 위치: `spec/1-data-model.md` diff, WebAuthnCredential 섹션 하단 "WebAuthn challenge ... 별도 테이블에 보관하지 않는다" 문단
  - 상세: 이 설명은 Rationale 1.4.C와 완전히 동일한 내용을 데이터 모델 파일에 반복한다. 링크 참조(`spec/5-system/1-auth.md §1.4 Rationale 1.4.C`)만 두어도 충분한데, 내용을 직접 기술함으로써 향후 Rationale 1.4.C 내용이 바뀔 때 두 곳을 동시에 수정해야 하는 유지보수 부담이 생긴다.
  - 제안: 해당 문단을 "challenge 발급 방식은 [Rationale 1.4.C](./5-system/1-auth.md#14c--webauthn-challenge-stateless-jwt) 참고" 한 줄로 교체.

- **[INFO]** `spec/2-navigation/10-auth-flow.md` API 표 — 다중 경로를 단일 셀에 나열
  - 위치: diff `+| POST | /api/auth/2fa/webauthn/authenticate/options · /verify · /recovery | WebAuthn 2FA 흐름...`
  - 상세: `·`(가운데점) 구분으로 세 endpoint를 한 행에 묶었다. 이 표는 "경로별 한 행" 원칙에서 벗어나 검색·텍스트 처리가 어려워진다. 기존 API 표의 다른 행들은 모두 단일 경로를 표기한다.
  - 제안: 세 경로를 각각 별도 행으로 분리하거나, "WebAuthn 2FA 흐름 전체는 [auth spec §5] 참고"와 같이 참조로만 남긴다.

- **[INFO]** `spec/2-navigation/9-user-profile.md §6.1` — deprecated 경로의 표 표기 방식 비일관성
  - 위치: diff `| POST | /api/users/me/enable-2fa | 2FA TOTP 활성화 시작 (canonical: ...)` 행
  - 상세: deprecated 경로임을 "(canonical: ...)" 형태로 표기했으나, 프로젝트의 다른 spec 문서에서 deprecated 표기 방식이 통일되지 않았다. "구 경로" 또는 `~~취소선~~` 형태, 또는 별도 deprecated 섹션으로 이동하는 방식 등이 혼재할 경우 미래 리뷰어가 deprecated 상태를 놓칠 수 있다.
  - 제안: 표 행 앞에 `~~` 취소선을 적용하거나, 표 하단에 `> **Deprecated**: ...` 주석을 두는 방식으로 일관성을 확보한다.

---

### consistency review 산출물 (파일 1~13)

- **[WARNING]** `plan_coherence.md` (파일 5, 파일 12) — 헤더 누락으로 문서 구조 불완전
  - 위치: `review/consistency/2026/05/18/23_02_30/plan_coherence.md` 및 `review/consistency/2026/05/18/23_11_17/plan_coherence.md` 첫 번째 줄
  - 상세: 두 `plan_coherence.md` 파일 모두 문서 상단에 `# 제목` 헤더 없이 바로 `### 발견사항`으로 시작한다. 같은 세션의 다른 checker 파일들(`cross_spec.md`, `naming_collision.md`, `convention_compliance.md`, `rationale_continuity.md`)은 모두 `#` 수준 헤더와 메타 정보 블록(검토 모드, 대상 파일, 날짜 등)을 갖추고 있다. 이 비일관성은 세션 산출물을 하나의 SUMMARY로 통합할 때 파일 경계를 파악하기 어렵게 만든다.
  - 제안: `plan_coherence.md` 파일도 다른 checker 파일과 동일하게 `# Plan 일관성 검토 — <대상>` 헤더와 메타 정보 블록을 문서 첫 부분에 추가한다.

- **[WARNING]** `rationale_continuity.md` (파일 6) — 출력 형식 비일관성 (§ 번호 없는 목록 vs 번호 있는 목록)
  - 위치: `review/consistency/2026/05/18/23_02_30/rationale_continuity.md` 전체
  - 상세: 파일 6의 `rationale_continuity.md`는 발견사항을 순서 없는 목록(`-`)으로 기술하는 반면, 파일 4 `naming_collision.md`와 파일 9 `cross_spec.md`는 `### 발견사항 N` / `### 발견 N` 형태로 번호를 부여한다. 같은 세션 내 checker 산출물들이 서로 다른 발견사항 표기 방식을 사용하면, SUMMARY가 각 파일을 파싱해 취합할 때 구조적 일관성이 없어진다.
  - 제안: 모든 checker 산출물의 발견사항 표기 방식을 통일한다. 번호 없는 목록 방식이든 번호 있는 방식이든 세션 내에서 동일해야 한다.

- **[WARNING]** `_retry_state.json` (파일 7) — 절대 경로가 파일에 하드코딩됨
  - 위치: `review/consistency/2026/05/18/23_11_17/_retry_state.json` 내 `session_dir`, `prompt_file`, `output_file` 값 전체
  - 상세: 모든 경로가 `/Volumes/project/private/clemvion/...`으로 시작하는 절대 경로다. 다른 개발자가 다른 마운트 경로에서 프로젝트를 체크아웃하거나, CI 환경에서 재시도를 실행하면 경로가 깨진다. 이는 `_retry_state.json` 이 생성 머신에 종속된다는 의미로, 재시도 메커니즘의 이식성을 저해한다.
  - 제안: `_retry_state.json`의 경로를 프로젝트 루트 또는 worktree 루트 기준의 상대 경로로 저장하고, 실행 시점에 절대 경로로 변환하는 방식을 검토한다. 또는 `session_dir`을 기준점으로 삼아 나머지 경로를 `session_dir` 상대 경로로 표기한다.

- **[INFO]** `meta.json` (파일 3, 파일 10) — 파일 끝 개행 누락 (`No newline at end of file`)
  - 위치: `review/consistency/2026/05/18/23_02_30/meta.json` 마지막 줄, `review/consistency/2026/05/18/23_11_17/meta.json` 마지막 줄, `review/consistency/2026/05/18/23_11_17/_retry_state.json` 마지막 줄
  - 상세: 세 파일 모두 diff에서 `\ No newline at end of file` 경고가 표시된다. POSIX 표준에서 텍스트 파일은 개행으로 끝나야 하며, 이를 지키지 않으면 일부 도구(cat, diff, grep 등)에서 예상치 못한 동작이 발생하고 git diff 가독성이 떨어진다.
  - 제안: JSON 파일 생성 시 마지막 줄 뒤에 개행 문자(`\n`)를 추가한다.

- **[INFO]** `naming_collision.md` (파일 4) — 발견사항 번호와 본문 표현 불일치
  - 위치: `review/consistency/2026/05/18/23_02_30/naming_collision.md` 발견사항 5번 표제
  - 상세: 발견사항 1~4는 `### 1. INFO`, `### 2. INFO` 형식인데, 발견사항 5는 `### 5. WARNING`으로 건너뛰지 않고 연속되어 있으나 동일 파일 내에서 중간 발견사항이 `---` 구분선으로만 구분되고 번호가 빠진 경우가 있는지 점검이 필요하다. 더 큰 문제는 `등급 — 설명` 패턴이 발견사항 표제에 직접 노출되어 있어, 다른 checker 파일의 `**[WARNING]** 설명` 인라인 마크업 패턴과 다르다.
  - 제안: 표제는 `### N. 간략 설명`으로 유지하되, 등급은 본문의 `**[WARNING]**` 형태로 통일하거나, 반대로 표제에 등급을 포함하는 방식으로 프로젝트 내 모든 checker 산출물이 동일한 패턴을 사용하도록 한다.

- **[INFO]** `convention_compliance.md` (파일 8) — WARNING 항목 중 일부가 실제 위반이 아님을 기술하면서도 WARNING으로 분류
  - 위치: `review/consistency/2026/05/18/23_11_17/convention_compliance.md`, `**[WARNING]** AuthController 클래스 레벨 @ApiBearerAuth` 항목
  - 상세: 해당 항목 상세 설명에서 "엄밀히 규약 위반은 아니지만"이라고 명시하면서도 WARNING으로 분류했다. 이는 리뷰 판독자가 등급과 실제 심각도 사이에서 혼동을 야기한다. 등급이 내용을 정확히 반영해야 리뷰 산출물의 신뢰도가 유지된다.
  - 제안: 규약 위반이 아닌 것으로 판단됐다면 INFO로 하향 조정하고, 상세 설명에서 "규약 위반 아님, 개선 권장" 취지를 명확히 기술한다.

---

## 요약

이번 변경의 핵심인 spec 문서(`spec/5-system/1-auth.md`, `spec/1-data-model.md`, `spec/2-navigation/10-auth-flow.md` 등)는 WebAuthn 2FA 도입을 위한 대규모 갱신으로, 전반적으로 구조화된 서술과 Rationale 섹션 추가를 통해 의사결정의 맥락을 잘 보존하고 있다. 그러나 유지보수 관점에서 몇 가지 문제가 눈에 띈다. 가장 주목할 점은 `spec/5-system/1-auth.md`에서 Rationale 절의 순서(1.4.C → 1.4.E → 1.4.D)가 본문 참조 순서와 어긋나 있어 독자 혼란을 야기한다는 점이다. "강제 비활성" vs "row 삭제" 용어 혼재도 동일 파일 내에서 발생해 단일 진실 원칙을 해친다. consistency review 산출물 측면에서는 `plan_coherence.md` 두 파일이 표준 헤더를 갖추지 않고, checker 간 발견사항 서식이 통일되지 않아 SUMMARY 통합 시 파싱 일관성이 떨어진다. JSON 파일 세 곳의 파일 끝 개행 누락과 `_retry_state.json`의 절대 경로 하드코딩은 운영 환경 이식성을 저해하는 소규모 유지보수 부채다. 전반적인 코드베이스 스타일 및 SDD 패턴 준수 수준은 양호하며, 발견된 문제는 대부분 문서 포맷의 일관성 수준에 해당한다.

---

## 위험도

LOW
