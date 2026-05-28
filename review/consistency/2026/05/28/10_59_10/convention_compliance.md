# 정식 규약 준수 검토 — convention_compliance

검토 모드: spec draft (`--spec`)
대상 문서: `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`
검토 일시: 2026-05-28

---

## 발견사항

### 발견사항 1
- **[WARNING]** plan frontmatter 에 `status` 필드 부재
  - target 위치: 문서 최상단 frontmatter (lines 1-7)
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4` — plan frontmatter 스키마 (`worktree`, `started`, `owner` 3필드)
  - 상세: 현재 frontmatter 에 `status: draft` 가 포함되어 있다. plan-lifecycle §4 의 공식 frontmatter 스키마는 `worktree` / `started` / `owner` 3필드만 정의하며, `status` 는 지정된 필드가 아니다. 이 필드는 `spec/conventions/spec-impl-evidence.md §2.1` 의 spec frontmatter `status` (5-enum 라이프사이클) 와 의미·도메인이 다른 임의 필드이며, plan-lifecycle 에서 지정한 적 없는 외래 키다. 오해·혼동을 유발할 수 있다.
  - 제안: plan frontmatter 에서 `status: draft` 제거. 초안 여부는 문서 제목 또는 본문 주석으로 표현. 또는 plan-lifecycle 을 갱신해 `status` 를 공식 선택 필드로 등록.

### 발견사항 2
- **[CRITICAL]** `spec/conventions/secret-store.md` 변경 제안이 convention 의 URI scheme 일관성을 깨뜨릴 우려
  - target 위치: §7.2 "§4 보안 요구사항 표 아래 신규 단락 '관련 컨벤션'"
  - 위반 규약: `spec/conventions/secret-store.md §1` — URI scheme 정의 (`secret://<scope>/<resourceId>/<name>`) 및 §7 변경 관리 절차
  - 상세: draft §7.2 는 `secret-store.md §4` 아래에 `## 4.A 관련 컨벤션 — 응답 마스킹` 신규 단락을 추가할 것을 제안한다. 그러나 `secret-store.md` 는 "외부 provider 자격증명 보관 추상화" 전용 convention 으로, `AuthConfig.config` 의 마스킹 정책은 `secret-store` URI scheme 의 통합 대상이 아니라고 draft 스스로 §7.1 에서 명시("본 secret-store URI scheme 의 통합 대상 아님"). 별 도메인이라고 밝히면서도 같은 convention 파일의 §4 본문 안에 단락을 삽입하면, 해당 convention 파일이 자기 영역을 벗어나 범위가 확장된다. `secret-store.md §7` 의 변경 관리 절차("interface 변경 PR 은 callers 의 동시 수정을 강제")와 연동해, 이 삽입이 convention 자체를 수정하는 행위인지 여부를 명확히 해야 한다. 별 도메인의 마스킹 정책을 타 convention 안에 끼워 넣는 것은 단일 진실 원칙(CLAUDE.md "정식 규약 → `spec/conventions/<name>.md`")에 반한다. AuthConfig 마스킹 정책의 정식 위치는 `spec/1-data-model.md §2.17.2` 또는 별도 `spec/conventions/auth-config-masking.md` 여야 한다.
  - 제안: draft §7.2 의 `secret-store.md` 삽입 계획을 철회하고, 마스킹 정책을 `spec/1-data-model.md §2.17.2` 본문에만 위치시킨다(이미 §1 에서 그렇게 정의됨). 필요하다면 `secret-store.md §7` Changelog 에 단 한 줄 "AuthConfig masking 은 별 도메인 — `spec/1-data-model.md §2.17.2` 참조" 외부 링크만 추가하는 것이 적절하다.

### 발견사항 3
- **[WARNING]** `spec/conventions/secret-store.md §1` 예시 표에 `auth-configs` scope 미등재
  - target 위치: §7 전체 (secret-store.md 변경안)
  - 위반 규약: `spec/conventions/secret-store.md §1 URI Scheme` + `§7 변경 관리` — "새 secret type 추가 시 §1 의 예시 표에 새 `name` 행 추가" 의무
  - 상세: draft §7.1 은 "변경 없음"이라고 명시하나, AuthConfig 의 `config` JSONB 는 별도 AES-256-GCM transformer 로 처리되므로 secret-store URI scheme 을 사용하지 않는다. 이 점 자체는 맞다. 그러나 `spec/1-data-model.md §2.17.2` 에서 정의할 마스킹 정책이 "`auth-configs` 모듈 자체 transformer" 를 사용한다고 기술하는데, 이 transformer 가 `SecretResolver` 와 완전히 분리된 별개의 메커니즘이라는 점이 spec 어디에도 명시되지 않는다. secret-store.md §1 URI scheme 내 `scope` 예시에 `auth-configs` 가 없는 채로 draft 가 `auth-configs` 를 독립 암호화 도메인으로 다루면, 미래 기여자가 secret-store 를 통해야 하는지 여부를 판단할 기준이 없다. 이는 naming collision / scope 혼동 위험이다.
  - 제안: `spec/1-data-model.md §2.17` 의 Rationale 또는 본문에 "AuthConfig.config 암호화는 secret-store URI scheme 을 사용하지 않음 — 이유: [...]" 를 명시. 혹은 secret-store.md §1 주석에 "auth-configs 는 module-internal transformer 사용 — URI scheme 적용 외" 한 줄 추가.

### 발견사항 4
- **[WARNING]** migration 버전 번호 표기 규약 미준수 — `V0NN+1` 형식
  - target 위치: §1 (spec/1-data-model.md 변경안) 첫 단락, §5.2 (`/auth/rotate-secret` deprecate 행)
  - 위반 규약: `spec/conventions/migrations.md §1` — "번호는 단조 증가하는 정수. `V<번호>__<snake_case_descriptor>.sql`"; `§2` — "신규 V번호는 항상 현재 main 의 max(V) +1"
  - 상세: draft 에서 cleanup migration 을 `V0NN+1` 이라는 placeholder 형식으로 표기했다. 이는 migrations.md §1 의 "V<번호>__<snake_case_descriptor>.sql" 공식 패턴과 다르며, `0NN` 은 alphanumeric suffix 유사 표기로 혼동을 유발할 수 있다. migrations.md §1 은 "alphanumeric suffix 금지" 를 명시한다 (V035a, V035_1 등). spec draft 단계에서 실제 번호를 특정하지 않는 것은 허용되나, placeholder 표기도 공식 패턴(`V<N+1>` 또는 `V<max+1>`)을 따르거나 명시적으로 "작성 시점에 max(V)+1 으로 결정" 이라고 기술해야 한다.
  - 제안: `V0NN+1` → `V<max+1>` 또는 `V<N+1>` (migrations.md §5 절차 인용) 으로 표기 변경. spec draft 이므로 실제 번호는 구현 시 결정하되, placeholder 가 공식 naming pattern 과 겹치지 않도록 꺾쇠괄호 형식 사용.

### 발견사항 5
- **[WARNING]** spec 문서 제안 변경안에 frontmatter `status` 전이 처리 누락
  - target 위치: §2.9 (spec/5-system/12-webhook.md frontmatter)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — status 라이프사이클, `§3.1` 전이 규칙
  - 상세: §2.9 는 `12-webhook.md` 의 frontmatter `status` 를 `spec-only` → `partial` 또는 `implemented` 로 격상할 것을 제안하되 "검토 후 결정" 이라고 유보했다. 그러나 `spec-impl-evidence.md §3.1` 은 `partial → implemented` 전이 시 "마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 (가드)" 을 명시한다. 또한 `partial` 선택 시 `pending_plans:` 필드가 의무다. 현재 draft 는 이 두 가드 요건에 대한 계획이 없다. `spec-code-paths.test.ts` 가드가 `partial`/`implemented` spec 에 `code:` ≥1 파일 매치를 요구하는데, `12-webhook.md` 의 현재 `code:` 가 비어있다는 점도 §2.9 가 인지하고 있으나 정확한 glob 을 명시하지 않았다.
  - 제안: draft §2.9 에 다음을 추가 — (a) `partial` 선택 시 `pending_plans:` 에 본 plan 파일 경로 등재 의무 명시, (b) 실제 spec 갱신 시 `code:` glob 을 최소 1개 이상 채워야 `spec-code-paths.test.ts` 통과 가능 명시.

### 발견사항 6
- **[WARNING]** `spec/conventions/secret-store.md §1` 예시 표에 있는 `scope` 토큰 kebab-case 규약과 draft 의 `auth-configs` scope 명칭 불일치 가능성
  - target 위치: §1 "§2.17.2 마스킹·노출 정책" 본문
  - 위반 규약: `spec/conventions/secret-store.md §1` — `scope` 는 lower-case kebab-case (예: `auth-configs`)
  - 상세: 이 항목은 정보성(INFO) 레벨이나, draft 본문이 "별 도메인" 이라고 밝히면서도 spec 이 "auth-configs 모듈 자체의 AES-256-GCM transformer (Integration 과 공유)"라고 기술하는 부분에서 Integration 의 `credentials` transformer 와 공유한다고 명시했다. `secret-store.md` 의 URI scheme 에는 `credentials` 나 `integrations` scope 도 없어 이 공유 관계가 convention 에 문서화되어 있지 않다. 범위는 낮으나 향후 기여자 혼동의 씨앗이 된다.
  - 제안: spec/1-data-model.md §2.17 의 Rationale 에 "Integration credentials transformer 와 동일 키·알고리즘 공유 — secret-store URI scheme 미사용 이유" 한 줄 추가.

### 발견사항 7
- **[INFO]** 문서 구조 — Overview / 본문 / Rationale 3섹션 권장 미준수
  - target 위치: 문서 전체 구조
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고"
  - 상세: 본 문서는 plan draft 이므로 spec 문서 3섹션 구조가 필수 적용 대상은 아니다. 그러나 draft 가 제안하는 각 spec 파일 변경안(§1~§7)은 각각 "어떤 변경인가"(본문)와 "왜 변경하는가"(Rationale) 를 포함하고 있어 3섹션 의도와 부합한다. 다만 §7 (secret-store.md 변경) 은 §7.1 에서 "변경 없음" 으로 선언 후 §7.2 에서 신규 단락을 추가하는 모순된 구조를 갖는다.
  - 제안: §7.1 "변경 없음" 문구를 삭제하고 §7.2 의 내용 전체를 제거(발견사항 2 참조). 또는 §7.1 을 "partial 변경" 으로 정정.

### 발견사항 8
- **[INFO]** API endpoint 명명 — `/auth/rotate-secret` deprecation 표기의 endpoint path 규약
  - target 위치: §5.2 (spec/2-navigation/2-trigger-list.md 변경안)
  - 위반 규약: 특정 convention 파일의 직접 위반은 아님. 그러나 `spec/conventions/swagger.md §2-2` (엔드포인트 데코레이터 패턴) 에서 deprecate 시 410 응답을 spec 에 명시하는 권장.
  - 상세: "410 `GONE`" 응답을 언급하나 swagger.md 의 상태코드 규칙 표(§2-4)에는 410 이 포함되어 있지 않다. 410 은 `@ApiGoneResponse` 가 NestJS Swagger 에 없는 커스텀 상황이므로 구현 시 어떤 decorator 를 사용할지 spec 이 명시하지 않으면 구현자가 임의 선택하게 된다.
  - 제안: §5.2 에 "구현 시 `@HttpCode(410)` + `@ApiResponse({ status: 410, description: '...' })` 사용" 한 줄 추가하거나, `spec/conventions/swagger.md §2-4` 표에 410 행을 추가하는 것을 별 follow-up 으로 등록.

### 발견사항 9
- **[INFO]** `spec/2-navigation/6-config.md §3 API 표` 제안에서 경로 대소문자 패턴
  - target 위치: §4.4 (spec/2-navigation/6-config.md API 표 행 추가)
  - 위반 규약: `spec/conventions/swagger.md §2-3` — path param 의 `@ApiParam({ format: 'uuid' })` 일관 적용 권장
  - 상세: API 표에 `POST /api/auth-configs/:id/reveal` 를 추가하는데, `:id` 가 UUID 임을 spec 표에서 명시하지 않았다. swagger.md §5-4 체크리스트는 "경로 UUID 파라미터는 `@ApiParam({ format: 'uuid' })` 일관 적용" 을 명시한다. spec 표 자체에서 타입 힌트를 제공하면 구현자 참조 편의가 높아진다.
  - 제안: API 표 행에 `:id` 컬럼 설명에 "(UUID)" 추가하거나, 설명 컬럼에 "`:id` — auth-config UUID" 명시.

---

## 요약

이 spec draft 는 전반적으로 도메인 구조와 표 형식을 체계적으로 작성했다. 그러나 정식 규약 관점에서 두 가지 주요 문제가 있다. 첫째, `spec/conventions/secret-store.md` 에 별 도메인(AuthConfig 마스킹 정책)의 내용을 삽입하려는 §7.2 계획은 "정식 규약 → `spec/conventions/<name>.md` 단일 진실 원칙"을 위반하며, draft 스스로 §7.1 에서 "별 도메인"이라 선언한 것과 논리적으로 모순된다(CRITICAL). 둘째, cleanup migration 을 `V0NN+1` 이라는 비표준 placeholder 로 표기하여 `spec/conventions/migrations.md §1` 의 alphanumeric suffix 금지 원칙과 충돌할 소지가 있다(WARNING). 그 외에 plan frontmatter 의 비표준 `status` 필드, `spec-impl-evidence.md` 의 partial/implemented 전이 가드 요건 미반영, secret-store 와 auth-configs transformer 관계의 convention 미문서화 등 경미한 규약 거리감이 있다.

---

## 위험도

**MEDIUM**

(CRITICAL 1건은 채택 시 convention 파일의 범위를 잘못 확장하는 문제이나, spec draft 단계에서 발견되어 실제 파일 수정 전 수정 가능. 구현 전 대응 가능한 범위.)
