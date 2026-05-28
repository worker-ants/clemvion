# 문서화(Documentation) 리뷰 — triggers-auth-column

리뷰 일시: 2026-05-29
대상 변경: `/triggers` 목록 인증 컬럼 추가 + 무인증 webhook 경고 (NAV-TR-11 / R-15)

---

## 발견사항

### [INFO] `AUTH_CONFIG_TYPE_LABEL_KEYS` 상수에 JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/triggers-auth-column-a80393/codebase/frontend/src/components/triggers/auth-config-select.tsx` 라인 13–18
- 상세: `useAuthConfigs` 훅과 `AuthConfigSelect` 컴포넌트에는 JSDoc 이 있으나, 이번 변경에서 `page.tsx` 가 새로 import 해 목록 셀 렌더링에 직접 사용하는 `AUTH_CONFIG_TYPE_LABEL_KEYS` 상수에는 용도 설명이 없다. 이 상수가 컴포넌트 외부(page.tsx)에서도 공유 사용됨을 명시하면 재사용 목적이 명확해진다.
- 제안: 상수 선언 위에 한 줄 JSDoc 추가. 예: `/** AuthConfig type → i18n 키 매핑. 셀렉터 옵션과 목록 뱃지 양쪽에서 공유. */`

### [INFO] 목록 셀 렌더 IIFE 로직에 인라인 주석 부족
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/triggers-auth-column-a80393/codebase/frontend/src/app/(main)/triggers/page.tsx` 라인 543 일대 `{(() => { ... })()}` 블록
- 상세: 인증 셀 렌더는 `type !== "webhook"` → `-`, `authConfigId` 존재 → 뱃지, `null` → 경고 아이콘 세 분기를 직렬 if 로 처리한다. 분기마다 인라인 주석이 없어 첫 번째 if 블록이 왜 `-` 를 반환하는지(schedule/manual 은 inbound HTTP 인증 N/A) 코드만으로는 즉시 파악하기 어렵다. diff 에서 `// 외부 노출 webhook + 무인증 → 보안 경고 (R-15)` 주석이 세 번째 분기(return 앞)에만 붙어 있고 첫 번째·두 번째 분기에는 없다.
- 제안: 첫 번째 if 앞에 `// webhook 외 타입은 inbound HTTP 인증이 N/A — §2.1` 한 줄 추가. 두 번째 분기 앞에 `// authConfigId 연결됨 → type 뱃지` 추가. 세 번째 return 은 이미 주석 있음.

### [INFO] `Trigger` 인터페이스의 `authConfigId` 필드 JSDoc 과 `RawTrigger` 내부 타입의 동일 필드 사이 문서 비대칭
- 위치: `page.tsx` 라인 497–498 (공개 `Trigger` 인터페이스) vs 라인 506 (`RawTrigger` 내부 타입)
- 상세: 공개 인터페이스 `Trigger` 의 `authConfigId` 에는 `/** Spec 2-trigger-list §2.1 인증 열 — 연결된 AuthConfig (null = 무인증). */` JSDoc 이 달려 있다. 그러나 매핑 소스가 되는 동일 파일 내 로컬 `RawTrigger` 타입의 동일 필드에는 주석이 없다. 독자가 두 타입의 필드 간 관계를 스스로 연결해야 한다.
- 제안: INFO 수준이므로 차단 불필요. `RawTrigger.authConfigId` 에 `// API 응답 원본 — Trigger.authConfigId 로 매핑` 한 줄 추가하면 충분.

### [INFO] `plan/in-progress/triggers-auth-column.md` Phase 체크박스 미완료 상태로 커밋
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/triggers-auth-column-a80393/plan/in-progress/triggers-auth-column.md` Phase 섹션
- 상세: P1~P6 가 모두 `- [ ]` (미완료) 로 표시되어 있다. 코드 변경(P3 테스트 선작성, P4 구현, en/ko i18n)이 이미 완료된 상태임에도 plan 문서가 갱신되지 않았다. plan 문서의 체크박스가 실제 진행 상태를 반영하지 못하면 `plan_coherence` checker 가 진행 상태를 오독할 수 있다.
- 제안: 완료된 Phase(P3·P4·i18n 적용)는 `- [x]` 로 갱신한다.

### [INFO] `spec-draft-triggers-auth-column.md` 의 체크리스트 항목 상태 미갱신
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/triggers-auth-column-a80393/plan/in-progress/spec-draft-triggers-auth-column.md` `## 체크리스트` 섹션
- 상세: spec 변경(§2.1 표 행 추가, NAV-TR-11 추가, NAV-TR-10 갱신, R-15 추가) 이 이미 `spec/2-navigation/2-trigger-list.md` 와 `spec/2-navigation/_product-overview.md` 에 반영되었으나 체크박스는 모두 `[ ]` 로 남아 있다.
- 제안: 반영된 항목은 `[x]` 로 갱신하고, 아직 처리 안 된 항목(pending_plans frontmatter 등록 등)만 `[ ]` 로 유지한다.

### [WARNING] `spec/2-trigger-list.md` §1 화면 구조 ASCII 다이어그램이 신규 "인증" 컬럼을 미반영
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/triggers-auth-column-a80393/spec/2-navigation/2-trigger-list.md` §1 화면 구조 ASCII 블록 (라인 약 26–43)
- 상세: §2.1 표에 "인증" 행이 추가되었고 `_product-overview.md` 에 NAV-TR-11 이 등록되었으나, §1 의 ASCII 다이어그램 행 (`│ ● order-webhook Webhook Active │` 등) 은 인증 컬럼이 전혀 반영되지 않은 채 그대로다. spec 내에서 §1 다이어그램과 §2.1 표가 서로 다른 컬럼 집합을 묘사하게 된다.
- 제안: spec 다이어그램을 엄격한 픽셀 단위 UI 가 아니라 개념도로 간주하는 팀 컨벤션이 있으면 INFO 로 하향 가능. 그렇지 않으면 다이어그램 행에 인증 상태(예: `[HMAC]` 또는 `⚠`)를 포함하거나 "컬럼 전체 표시 아님 — §2.1 참조" 안내를 추가한다.

### [WARNING] `spec/2-trigger-list.md` frontmatter `pending_plans:` 미등록
- 위치: `spec/2-navigation/2-trigger-list.md` frontmatter (`id`, `status`, `code` 필드만 존재)
- 상세: `spec/conventions/spec-impl-evidence.md §3` 에 따르면 구현 plan 이 진행 중일 때 대상 spec 파일의 frontmatter `pending_plans:` 에 plan 이름을 등록해야 한다. 현재 `triggers-auth-column` 이 등록되어 있지 않아 spec-impl-evidence 역방향 추적이 단절된다. 이 누락은 consistency-check 의 `plan_coherence` 검사 가 이 plan 을 spec 과 연결하지 못하게 한다.
- 제안: `spec/2-navigation/2-trigger-list.md` frontmatter 에 `pending_plans: [triggers-auth-column]` 을 추가한다.

---

## 요약

이번 변경은 spec(§2.1 표·R-15·NAV-TR-11), i18n(en/ko 두 언어), 구현(page.tsx), 테스트 파일을 일관되게 갱신한 잘 정렬된 증분이다. `auth-config-select.tsx` 의 기존 JSDoc 은 양호하고, 신규 `authConfigId` 필드에도 spec 링크 주석이 붙어 있다. 문서화 관점의 주요 개선 여지는 두 가지다: (1) spec `2-trigger-list.md` frontmatter 에 `pending_plans` 등록 누락(WARNING)과 §1 ASCII 다이어그램이 신규 컬럼을 반영하지 않음(WARNING), (2) plan 체크박스가 실제 완료 상태를 반영하지 않아 진행 추적이 부정확함(INFO). 코드 수준에서는 IIFE 렌더 블록 첫 번째 분기 주석 부재와 `AUTH_CONFIG_TYPE_LABEL_KEYS` 상수 JSDoc 미비가 소소하게 남아 있으나 기능에는 영향이 없다.

---

## 위험도

LOW
