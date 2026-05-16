# Convention Compliance Review

**Target**: `plan/in-progress/spec-draft-cafe24-app-url-detail.md`
**Mode**: spec draft 검토 (--spec)
**검토일**: 2026-05-16

---

### 발견사항

- **[INFO]** plan 문서 제목이 "Spec Draft" 형식 — 일관성 주석
  - target 위치: 문서 제목 `# Spec Draft — Cafe24 App URL 상세 페이지 노출 + data-flow drift 정정`
  - 위반 규약: `CLAUDE.md` 명명 컨벤션 — `plan/in-progress/<name>.md` 는 평문 파일명 규칙
  - 상세: 파일명 `spec-draft-cafe24-app-url-detail.md` 자체는 평문 소문자 kebab-case 로 규약에 부합한다. 제목 문자열도 규약 위반은 아니나, 이 문서는 "spec draft" 이지 spec 본문 자체가 아니므로 plan 문서로 적절히 위치해 있다. 위반 없음, 기록 목적.
  - 제안: 해당 없음 (준수).

- **[INFO]** frontmatter `spec_files` 키 — CLAUDE.md 비정의 필드
  - target 위치: frontmatter (lines 2-7), `spec_files:` 키
  - 위반 규약: `CLAUDE.md` §PLAN 문서 라이프사이클 — frontmatter 에는 `worktree`, `started`, `owner` 세 필드가 정의되어 있음
  - 상세: `spec_files` 는 CLAUDE.md 가 정의한 필수 3 키 외 추가 메타데이터다. 명시적 금지 조항은 없으나 규약에는 정의되지 않은 확장 필드다. 다른 도구(plan_coherence checker 등)가 이 키를 파싱하지 않을 수 있다.
  - 제안: 규약 위반은 아니므로 유지해도 무방. 단, 이 패턴이 확산될 경우 CLAUDE.md frontmatter 필드 목록에 명시적으로 추가해 공식화할 것을 권장.

- **[INFO]** 변경 3 — API 응답 DTO 필드명 규약 참조 부재
  - target 위치: `## 변경 3` — `appUrl: string | null` 필드 추가 내용
  - 위반 규약: `spec/conventions/swagger.md` (내용 일부 미로드됨) — DTO 명명 패턴
  - 상세: `IntegrationDto.appUrl` 필드 추가가 camelCase 로 기술되어 있는데, 이는 통상적인 TypeScript DTO 컨벤션에 부합한다. 단, 이 spec draft 가 참조하는 Swagger/DTO 명명 규약 문서(`spec/conventions/swagger.md`)의 구체적 패턴을 명시적으로 언급하지 않는다. 실질적 위반보다는 참조 누락.
  - 제안: `## 변경 3` 본문에 `spec/conventions/swagger.md` 의 DTO 명명 규칙 준수 여부를 한 줄 명시하면 일관성 검토자가 추가 검증 없이 통과 여부를 판단할 수 있다.

- **[INFO]** 변경 4 Rationale 항 — 로그 보안 정책 참조가 spec 경로로 특정되지 않음
  - target 위치: `## 변경 4` Rationale 추가 본문 — "`SECRET_LEAK_PATTERNS` 와 일관" 언급
  - 위반 규약: `CLAUDE.md` §정보 저장 위치 (단일 진실 원칙) — 정식 규약은 `spec/conventions/<name>.md` 에 두어야 함
  - 상세: `SECRET_LEAK_PATTERNS` 가 어느 spec/conventions 파일에 정의되어 있는지 경로 참조 없이 인용되었다. 단순 Rationale 텍스트이므로 CRITICAL 급은 아니나, 독자가 해당 규약을 추적하기 어렵다.
  - 제안: `SECRET_LEAK_PATTERNS` 가 정의된 spec/conventions 파일 경로 (예: `spec/conventions/logging.md §N`) 를 인용에 추가. 정의 위치가 없다면 별도 conventions 문서에 정식화 필요.

- **[WARNING]** 변경 2 표 행 — spec 본문 수정 지시이나 Overview/Rationale 구조 준수 확인 필요
  - target 위치: `## 변경 2` — `spec/2-navigation/4-integration.md` §4.2 표 행 추가
  - 위반 규약: `CLAUDE.md` §프로젝트 스펙 문서 — spec 문서 권장 3섹션 (Overview / 본문 / Rationale). `spec/conventions/` 내 해당 파일은 평문 명명 규칙 적용
  - 상세: 이 변경은 spec 본문(§4.2 표)에 행을 추가하는 것으로, 변경 근거가 변경 4 의 Rationale 항으로 분리되어 있다. 이는 CLAUDE.md 가 권장하는 "본문 끝 Rationale 섹션" 패턴과 정합한다. 다만 spec draft 문서 자체가 변경 2, 3, 4 를 별개 섹션으로 분리해두고 있어, 실제 spec 파일 반영 시 §4.2 표 행과 Rationale 항이 같은 파일 안에 각자 올바른 위치에 삽입되는지 점검이 필요하다. Draft 내에서 이 연결이 명시되어 있으므로 준수로 보이나, 실제 적용 시 구조 위반 가능성이 있어 WARNING 수준으로 기록.
  - 제안: 변경 2 본문에 "변경 4 의 Rationale 항이 `spec/2-navigation/4-integration.md` 의 `## Rationale` 섹션 말미에 삽입되어 CLAUDE.md 권장 3섹션 구조를 유지함" 을 명시적으로 교차 참조하면 충분.

- **[INFO]** `plan/in-progress/spec-update-cafe24-app-url-detail.md` 인계 plan 참조 — 존재 여부 미확인
  - target 위치: "인계 plan: `plan/in-progress/spec-update-cafe24-app-url-detail.md`" 참조
  - 위반 규약: `CLAUDE.md` §PLAN 문서 라이프사이클 — plan 은 반드시 `in-progress/` 또는 `complete/` 에 위치
  - 상세: 참조된 `spec-update-cafe24-app-url-detail.md` 가 실제로 `plan/in-progress/` 에 존재하는지 이 draft 검토 범위에서 직접 확인되지 않는다. 만약 해당 plan 이 이미 `complete/` 로 이동했거나 삭제된 상태라면 dead link 가 된다.
  - 제안: spec draft 반영 전 인계 plan 파일의 현재 위치(`in-progress/` vs `complete/`)를 확인해 링크를 갱신하거나 제거.

- **[INFO]** 변경 5 — "변경 불필요" 항의 spec draft 내 포함 적절성
  - target 위치: `## 변경 5` — 변경 없음 확인만 기록
  - 위반 규약: 해당 없음 (금지 조항 없음)
  - 상세: 변경 5 는 실제 변경이 없음을 확인하는 목적으로 draft 에 포함되었다. 이는 검토 완료 증적으로 plan 문서에 적절히 위치한다. 규약 위반 없음. INFO 수준으로 기록.
  - 제안: 해당 없음.

---

### 요약

`plan/in-progress/spec-draft-cafe24-app-url-detail.md` 는 CLAUDE.md 및 `spec/conventions/` 의 정식 규약을 전반적으로 잘 준수하고 있다. frontmatter 에 필수 3필드(`worktree`, `started`, `owner`)가 모두 존재하고, 파일명은 평문 kebab-case 규약을 따르며, spec 변경 내용이 target 파일·섹션을 명시적으로 지시하고 있다. 권장 3섹션(Overview/본문/Rationale) 패턴도 변경 2~4 의 구조를 통해 spec 파일 내에서 유지되도록 설계되어 있다. 발견된 이슈는 모두 INFO 1건과 WARNING 1건으로, 직접적인 규약 위반(CRITICAL)은 없다. WARNING 은 변경 2/4 간의 Rationale 연결이 draft 문서 내에서 교차 참조로 명시되지 않아 spec 반영 시 구조 누락 위험이 있다는 점이며, 실제 spec 파일 편집 단계에서 확인하면 해소된다.

---

### 위험도

LOW
