# 정식 규약 준수 검토 결과

검토 대상: `plan/in-progress/spec-draft-integration-autorefresh.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-17

---

### 발견사항

- **[INFO]** Plan frontmatter 구조는 규약을 완전히 준수
  - target 위치: 문서 최상단 frontmatter (lines 1-6)
  - 위반 규약: 해당 없음 (준수)
  - 상세: `worktree`, `started`, `owner` 세 필드 모두 CLAUDE.md 명세대로 기재되어 있으며 값도 유효하다. `worktree: spec-integration-autorefresh-b2c4f1`, `started: 2026-05-17`, `owner: planner` 형식 완전 일치.
  - 제안: 없음.

- **[INFO]** 문서 내 구현 경로 참조가 spec 문서가 아닌 plan draft 안에 인라인 포함
  - target 위치: §2 autoRefresh 정의 — `backend/src/modules/integrations/services/service-registry.ts` 직접 경로 언급, §4.10 Rationale 항 `프론트엔드·백엔드 영향` 단락
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "기술 명세(스펙)" 는 `spec/<영역>/*.md` 본문이 담당; plan 은 작업 추적 문서
  - 상세: plan draft 는 spec 본문에 들어갈 패치 내용을 미리 기술하는 중간 문서이므로 구현 파일 경로가 일부 등장하는 것은 허용 범위이나, §4.10 Rationale 에 `backend/src/modules/...`, `frontend/_shared/status-badge.tsx` 등 구현 경로가 상세하게 언급된다. 이 내용은 spec 본문 Rationale 에 그대로 옮겨질 예정인데, spec/conventions 규약(`spec/conventions/node-output.md` 등)은 구현 경로를 spec 본문에 직접 박지 않도록 간접 참조를 권장한다.
  - 제안: spec 본문(`spec/2-navigation/4-integration.md`)의 Rationale 에 옮길 때 구현 경로는 "서비스 레지스트리(`service-registry.ts`)" 수준 약식 참조로 유지하거나, 코드 경로 대신 기능 명칭으로 기술하는 것을 권고. 현 plan draft 수준에서는 수정 불필요.

- **[INFO]** `spec/conventions/cafe24-api-catalog/_overview.md` 의 언더스코어 prefix 파일 명명 패턴 준수 여부
  - target 위치: 문서 전반 (직접 해당 사항 없음)
  - 위반 규약: CLAUDE.md 명명 컨벤션 표 — `spec/<영역>/_product-overview.md` 는 언더스코어 prefix, `spec/conventions/*.md` 는 평문
  - 상세: target 문서가 직접 이 파일들을 생성하거나 경로를 잘못 사용하는 일은 없다. 다만 §6 consistency-check 대상 설명에서 `spec/conventions/cafe24-api-catalog/_overview.md` 를 언급하는데, 해당 파일은 이미 `spec/conventions/cafe24-api-catalog/_overview.md` 경로로 존재하며 언더스코어 prefix 도 규약(다중 spec 파일을 가진 영역의 진입 문서)에 정합한다. 이 경로 참조 자체는 올바르다.
  - 제안: 없음.

- **[WARNING]** `spec/2-navigation/4-integration.md` 의 대상 spec 문서가 권장 3섹션 구성 (Overview / 본문 / Rationale) 을 갖추고 있는지 본 draft 로는 확인 불가
  - target 위치: §3 "본 PR 범위 밖" 항목 중 "I-6 (Rationale 섹션 누락 보강)" 언급
  - 위반 규약: CLAUDE.md "프로젝트 스펙 문서" 절 — `spec/<영역>/N-name.md` 은 "본문 끝에 `## Rationale` 섹션을 권장"
  - 상세: draft 스스로 "I-6 Rationale 섹션 누락 보강" 을 "범위 밖" 으로 분류하고 별도 plan `spec-update-2-navigation-hygiene.md` 신설 권고로 처리한다. Rationale 섹션은 권장(required X) 이므로 CRITICAL 은 아니나, 현재 `4-integration.md` 에 Rationale 섹션이 없는 상태에서 이번 draft 가 Rationale 항목을 추가하는 §4.10 패치를 제안하고 있어 실질적으로 Rationale 섹션을 신설하는 효과가 있다. 다만 Rationale 섹션 헤더(`## Rationale`) 자체가 이미 존재하는지, §4.10 이 그 안에 추가되는 것인지, 아니면 Rationale 헤더 없이 내용만 넣는 것인지 명시가 없다.
  - 제안: §4.10 패치 설명에 "Rationale 헤더(`## Rationale`)가 존재하는 경우 그 안에, 없는 경우 섹션을 신설하여 추가한다" 는 주석을 보강하면 spec 구조 규약 명확성이 높아진다.

- **[INFO]** API 응답 DTO 필드명 `autoRefresh` 의 camelCase 사용
  - target 위치: §4.6 — `IntegrationDto` 에 `autoRefresh: boolean` 필드 추가, §9.1 내용
  - 위반 규약: `spec/conventions/swagger.md` §1 DTO 패턴 — 필드명 casing 에 대해 직접 명시 없음. 단, NestJS/TypeScript 관례상 DTO 필드는 camelCase
  - 상세: `autoRefresh` 는 camelCase 로 TypeScript DTO 관례에 부합하며, `supportsTokenAutoRefresh` 라는 backend 필드명과도 일관된 camelCase 패턴을 공유한다. swagger.md 는 casing 을 명시적으로 금지/강제하는 항목이 없으므로 위반은 없다.
  - 제안: 없음 (준수).

- **[INFO]** 가상 필터값 `expiring` / `attention` 의 소문자 snake_case 사용
  - target 위치: §4.7 `?status=expiring`, `?status=attention` 쿼리 파라미터 값
  - 위반 규약: `spec/conventions/node-output.md` Principle 3.2 — error code 는 `UPPER_SNAKE_CASE`. API 쿼리 파라미터 값 casing 은 swagger.md 에 별도 규정 없음
  - 상세: `expiring`, `attention` 은 에러 코드가 아니라 REST 쿼리 파라미터 값이므로 UPPER_SNAKE_CASE 규칙 적용 대상이 아니다. 기존 spec 내 `connected`, `expired`, `error`, `pending_install` 등과 동일한 소문자 패턴을 유지하며 일관성이 있다.
  - 제안: 없음 (준수).

- **[INFO]** 자매 plan 참조 경로가 `plan/in-progress/` 규약을 따르는지
  - target 위치: 문서 헤더 — `자매 plan: plan/in-progress/integration-token-ui-autorefresh.md`, `위임 문서: plan/in-progress/spec-update-integration-autorefresh.md`
  - 위반 규약: CLAUDE.md 명명 컨벤션 표 — `plan/in-progress/<name>.md` 는 평문
  - 상세: 두 참조 경로 모두 `plan/in-progress/` 하위 평문 md 형식으로 규약 준수. 파일명에 숫자 prefix 없고 평문 kebab-case 사용 — 정상.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/spec-update-2-navigation-hygiene.md` 신설 권고 표기
  - target 위치: §3 "범위 밖" 항목 마지막 줄
  - 위반 규약: CLAUDE.md PLAN 문서 라이프사이클 — "새 plan 문서는 항상 `plan/in-progress/` 에서 생성"
  - 상세: draft 가 "별도 plan `spec-update-2-navigation-hygiene.md` 신설 권장" 이라고 기술하지만, 경로를 `plan/in-progress/spec-update-2-navigation-hygiene.md` 로 명시하지 않고 파일명만 언급했다. 독자가 경로를 잘못 추론할 여지가 있다.
  - 제안: "별도 plan `plan/in-progress/spec-update-2-navigation-hygiene.md` 신설 권장" 으로 전체 경로 명시 권고.

- **[INFO]** `commit + PR` 제목이 CLAUDE.md 규약이 아닌 커밋 스타일 규약에 해당
  - target 위치: §7 진행 체크리스트 마지막에서 두 번째 항목 — `commit + PR (제목: docs(spec/integration): autoRefresh 친화 attention 술어 + 표현 정책)`
  - 위반 규약: 직접 위반 없음. PR 제목 규약은 별도 convention 파일이 없음
  - 상세: PR 제목 형식 자체는 정식 규약(`spec/conventions/`)에 정의된 항목이 없어 위반 판정 불가. Conventional Commits 형식(`docs(spec/integration): ...`)을 사용하는 것은 기존 커밋 히스토리 스타일과 일치한다.
  - 제안: 없음.

---

### 요약

`plan/in-progress/spec-draft-integration-autorefresh.md` 는 정식 규약(`spec/conventions/**` 및 CLAUDE.md 명명 컨벤션) 관점에서 중요한 위반 사항이 없다. Frontmatter 는 완전 준수, 자매 plan 경로 참조도 `plan/in-progress/` 규약을 따른다. API DTO 필드 `autoRefresh` 는 camelCase 로 Swagger 규약에 정합하며, 가상 필터 값 casing 도 기존 spec 내 동일 소문자 패턴과 일관된다. 유일한 주의 사항은 §4.10 에서 신설하는 Rationale 내용이 실제 spec 파일에 패치될 때 `## Rationale` 헤더 존재 여부를 명시하지 않은 점(WARNING), 그리고 신설 권고 plan 의 전체 경로를 생략한 소소한 명확성 부족(INFO 2건)이다. CRITICAL 항목은 없다.

### 위험도

LOW
