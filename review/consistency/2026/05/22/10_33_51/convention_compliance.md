# 정식 규약 준수 검토 결과

검토 대상: `plan/in-progress/chat-channel-secret-store-infra.md` (prompt_file 임베드 버전 — pgcrypto 채택 결정 반영본)
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### [WARNING] frontmatter `status` 값이 규약 스키마와 불일치

- **target 위치**: frontmatter 1행 `status: in_progress`
- **위반 규약**: `.claude/docs/plan-lifecycle.md` §4 Frontmatter 스키마
- **상세**: plan-lifecycle.md §4 는 `plan/in-progress/` 문서의 frontmatter 필수 키를 `worktree`, `started`, `owner` 3개로 정의한다. `status` 필드는 규약에 정의된 키가 아니다. 다만 현재 on-disk 파일(`plan/in-progress/chat-channel-secret-store-infra.md`)과 비교할 때, 임베드 버전은 `status: in_progress` 를 포함하나 on-disk 버전은 `status: backlog` 를 가진다 — `in_progress`라는 값 자체도 plan-lifecycle 규약에 열거된 공식 값이 아니다.
- **제안**: frontmatter 에서 `status` 키를 제거하거나, 규약에 추가할 필드임을 명시하고 plan-lifecycle.md §4 를 먼저 갱신한다. 필요하다면 별 plan 상태 추적은 `owner`·`worktree` 필드로 충분하다.

---

### [WARNING] frontmatter 필수 키 `worktree` 는 있으나 `started` 키가 누락

- **target 위치**: frontmatter 전체
- **위반 규약**: `.claude/docs/plan-lifecycle.md` §4 Frontmatter 스키마 — `started: <ISO 날짜>` 필수
- **상세**: 임베드 버전 frontmatter 에 `created: 2026-05-22` 는 있으나 규약이 요구하는 키 이름은 `started`이다. `created`는 규약에 없는 키이며 `started`와 다른 의미를 가질 수 있다. on-disk 버전에도 동일하게 `created`만 있고 `started`가 없다.
- **제안**: `created:` → `started:` 로 키 이름을 변경한다. 또는 plan-lifecycle.md §4 를 `created` 도 허용하도록 갱신하되, 이 경우 규약 갱신을 먼저 수행해야 한다.

---

### [WARNING] `priority` 필드가 frontmatter 규약에 없는 비표준 키

- **target 위치**: frontmatter `priority: v1.x (사전 배포 — pgcrypto 채택, 백필 불요)`
- **위반 규약**: `.claude/docs/plan-lifecycle.md` §4 Frontmatter 스키마 (3키만 정의: `worktree`, `started`, `owner`)
- **상세**: `priority` 는 규약에 정의되지 않은 임의 키다. on-disk 버전도 `priority: v2 (인프라 의존 — 사용자 결정 필요)` 를 갖는다 — 기존에도 동일 패턴이 존재했으므로 실질적 기존 위반의 연속이다. 규약을 넓히거나 필드를 제거해야 한다.
- **제안**: plan-lifecycle.md §4 를 갱신해 `priority` 를 선택 키로 추가하거나, 해당 필드를 plan 본문 배경 섹션으로 이동한다.

---

### [INFO] `Phase 5` 에서 예고된 신규 `spec/conventions/secret-store.md` 생성이 본 plan 에 포함되어 있으나 현재 conventions 목록에 부재

- **target 위치**: Phase 5 범위 섹션 마지막 항 — `신규 spec/conventions/secret-store.md — secret store 추상화 convention 정식 도입`
- **위반 규약**: CLAUDE.md "정보 저장 위치 — 정식 규약은 `spec/conventions/<name>.md`"
- **상세**: 규약 위반이 아니라 규약 준수 의도를 올바르게 선언한 것이다. 다만 현재 `spec/conventions/` 에 `secret-store.md` 가 존재하지 않으므로, Phase 5 실행 시점에 반드시 생성되어야 한다. Plan 이 이를 명시하고 있어 추적은 되고 있으나, 해당 신규 convention 문서의 구조(Overview / 본문 / Rationale 3섹션)도 CLAUDE.md 권장 구조를 따라야 한다는 점을 미리 명기하면 더 명확하다.
- **제안**: Phase 5 항목에 "`secret-store.md` 는 Overview / 본문 / Rationale 3섹션 포함" 요건을 추가한다.

---

### [INFO] Flyway 마이그레이션 파일명 `V063__secret_store.sql` — 번호 유효성 검증 필요

- **target 위치**: Phase 1 범위 — `Flyway V063__secret_store.sql`
- **위반 규약**: `spec/conventions/migrations.md` §1 명명 규약, §2 V번호 정책 (단조 증가, gap 금지)
- **상세**: 규약은 신규 V번호가 항상 현재 main 의 max(V)+1 이어야 함을 요구한다. V063 이 실제 max(V)+1 인지는 실제 `codebase/backend/migrations/` 파일 목록 없이는 plan 문서만으로 확인 불가하다. Plan 문서는 이 번호를 고정값으로 적시하고 있으므로 구현 착수 전 §5 절차(git rebase 후 `ls codebase/backend/migrations | tail -2` 로 max 확인)를 반드시 수행해야 한다. Plan 문서 자체가 번호를 확정하는 것은 구현 착수 시 번호가 달라질 수 있어 오해를 유발한다.
- **제안**: `V063__secret_store.sql` → `V<max+1>__secret_store.sql` (또는 "구현 착수 시 §5 절차로 번호 확정" 주석 추가)로 표기해 번호 고정 위험을 명시한다.

---

### [INFO] `secret://` URI scheme 형식이 Phase 1 과 배경 섹션 간 미세 불일치

- **target 위치**: 배경 섹션 `secret://<scope>/<resourceId>/<name>`, Phase 1 예시 `secret://triggers/{triggerId}/bot-token`
- **위반 규약**: 직접적 conventions 위반은 아니나 단일 진실 원칙(CLAUDE.md) 위배 가능성
- **상세**: 배경 섹션은 URI scheme 을 `secret://<scope>/<resourceId>/<name>` 으로 표기하고, Phase 1 예시는 `secret://triggers/{triggerId}/bot-token` 를 사용해 scope=triggers, resourceId={triggerId}, name=bot-token 으로 매핑된다. 두 표기는 일관하나 `{triggerId}` (중괄호) 와 `<scope>` (꺾쇠) 표기 혼용이 문서 내 형식 일관성을 약간 떨어뜨린다. `spec/conventions/secret-store.md` 가 생성되면 이 scheme 정의가 SoT 가 되므로, plan 에서는 예고용으로만 두고 확정 형식은 해당 convention 문서에서 다루는 것이 바람직하다.
- **제안**: plan 의 scheme 표기를 어느 한 형식으로 통일하거나, "확정 형식은 `spec/conventions/secret-store.md` §1 에서 정의" 문구를 추가해 SoT 를 명확히 한다.

---

## 요약

대상 plan 문서(`plan/in-progress/chat-channel-secret-store-infra.md` pgcrypto 채택 버전)는 정식 규약의 핵심 위반 없이 작성되어 있다. 단, `.claude/docs/plan-lifecycle.md` §4 가 규정한 frontmatter 스키마(`worktree`, `started`, `owner` 3키)와 실제 문서 frontmatter 사이에 키 이름(`created` vs `started`) 및 비표준 키(`status`, `priority`) 불일치가 존재하며, 이는 on-disk 버전부터 이어져 온 기존 drift 의 연속이다. CRITICAL 수준의 규약 직접 위반은 없으나, frontmatter 스키마 준수 여부가 `consistency-checker` 의 `plan_coherence` checker 자동 검증 대상이므로 조기 정정이 권장된다. Flyway 번호 고정 표기와 `secret-store.md` convention 신규 도입 예고는 구현 단계에서 각각 §5 절차 준수 및 3섹션 구조 충족으로 해소된다.

## 위험도

LOW
