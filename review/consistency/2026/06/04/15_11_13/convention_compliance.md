# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md` (구현 변경 diff 포함)
검토 범위: PR2a — `impl-exec-concurrency-cap` (§8 active-running 누적 타임아웃)
diff-base: origin/main

---

## 발견사항

### [INFO] spec §8 섹션 제목 — "부분 구현" 표현이 구현 상태를 정확히 반영하나 규약 선례 없음
- target 위치: `spec/5-system/4-execution-engine.md` line 936, `## 8. 동시 실행 제한 (부분 구현)`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — 구현 상태는 frontmatter `status` 필드가 SoT이며, 섹션 제목에 구현 상태 어노테이션을 박는 패턴은 다른 spec 문서에서 사용되지 않음
- 상세: 제목 안의 "(부분 구현)" 은 frontmatter `status: partial` + 섹션 내 blockquote 구현 상태 배너로 이미 표현됨. 섹션 제목에 중복 어노테이션을 박으면 구현이 완료됐을 때 제목까지 수정해야 하는 드리프트 위험이 생김. 기존 §7 `### 7.1 워커 크래시 복구 — BullMQ stalled-job (target)` 패턴은 "(target)" 어노테이션을 쓰며, 이와도 일관성이 어긋남 — "(target)" vs "(부분 구현)" 으로 두 가지 다른 어노테이션 스타일이 혼용됨.
- 제안: 섹션 제목을 `## 8. 동시 실행 제한` 으로 정리하고 구현 상태는 아래 blockquote 배너에만 두는 것이 규약 일관성상 더 적절. 단 INFO 수준이므로 즉시 교정 의무는 없음.

---

### [INFO] `spec/5-system/3-error-handling.md` §1.4 앵커 링크 표현 — "미구현/Planned" 표현 잔존
- target 위치: `spec/5-system/4-execution-engine.md` line 952, `[§3-error-handling §1.4](./3-error-handling.md#14-워크플로우-실행-에러)` 주변 인라인 괄호 설명
- 위반 규약: 해당 없음(규약 직접 위반 아님)
- 상세: `EXECUTION_TIME_LIMIT_EXCEEDED` 에러코드가 `spec/5-system/3-error-handling.md §1.4` 에 이미 반영되어 있음(grep 확인: line 60에 등재). spec 내 해당 링크 주변 설명은 정확하며 cross-reference는 양방향 일치. 문제 없음.
- 제안: N/A

---

### [INFO] 구현 파일 `execution-limits.ts` 가 spec frontmatter `code:` 경로에 미포함
- target 위치: `spec/5-system/4-execution-engine.md` frontmatter lines 4–7, `code:` 글로브 목록
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1·§3` — `status: partial` 인 spec 의 `code:` 는 ≥1 파일 매치 의무이며, 본 spec 의 `code: codebase/backend/src/modules/execution-engine/**` 글로브가 신규 파일(`execution-limits.ts`, `execution-limits.spec.ts`)을 포함하므로 기계적으로는 가드 통과. 규약 위반 아님.
- 상세: 새로 추가된 `codebase/backend/src/modules/execution-engine/execution-limits.ts`, `execution-limits.spec.ts` 는 `execution-engine/**` 글로브에 포함됨. `spec-code-paths.test.ts` 가드는 통과 예정. 문제 없음.
- 제안: N/A

---

### [INFO] 마이그레이션 파일명 규약 — `.conf` 페어 부재
- target 위치: `codebase/backend/migrations/V073__execution_active_running_ms.sql`
- 위반 규약: `spec/conventions/migrations.md §1` — "`.conf` 페어는 항상 `.sql` 과 동일한 base name 을 사용한다"는 의무이나, `.conf` 파일 자체는 "필요한 경우만" 두는 선택 항목
- 상세: `V073__execution_active_running_ms.sql` 에는 `.conf` 파일이 없음. ADD COLUMN 마이그레이션은 DDL 이고 트랜잭션 내 실행이 안전하므로 `executeInTransaction=false` 설정이 불필요, `.conf` 페어 미작성은 규약에 부합. 규약 위반 없음.
- 제안: N/A (현 상태가 정상)

---

### [INFO] `user_guide:` frontmatter 필드 — 신규 MDX 가이드 섹션 추가 후 미참조
- target 위치: `spec/5-system/4-execution-engine.md` frontmatter (lines 1–12)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `user_guide:` 는 "선택" 필드
- 상세: 이번 PR 에서 `codebase/frontend/src/content/docs/05-run-and-debug/error-handling.mdx` 및 `.en.mdx` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 섹션이 추가됨. 해당 MDX 파일은 이미 `error-handling.mdx` frontmatter `spec:` 에 `spec/5-system/3-error-handling.md` 가 참조되어 있고, `spec/5-system/4-execution-engine.md` 의 `user_guide:` 필드는 선택 사항이므로 미등록 자체는 규약 위반이 아님. 단, 가이드 문서와 spec 의 cross-reference 가독성 측면에서 등록해두면 일관성에 유리.
- 제안: 선택 사항이므로 강제 필요 없음. 원한다면 `user_guide: [codebase/frontend/src/content/docs/05-run-and-debug/error-handling.mdx]` 추가 가능.

---

### [INFO] 에러코드 `EXECUTION_TIME_LIMIT_EXCEEDED` — 명명 규약 확인
- target 위치: `codebase/backend/src/nodes/core/error-codes.ts` (신규 항목)
- 위반 규약: `spec/conventions/error-codes.md §1` — 의미 기반 명명 원칙
- 상세: `EXECUTION_TIME_LIMIT_EXCEEDED` 는 "단일 Execution 의 active-running 누적 시간이 한도를 초과했음" 이라는 조건의 의미를 직접 기술하며, 구현 경로·역사적 아티팩트를 이름에 박지 않음. `EXECUTION_TIMEOUT`(Code 노드 스크립트 타임아웃)과 의미가 달라 새 코드로 신설한 결정은 `error-codes.md §2("의미가 분기되면 새 코드 신설")` 에 정확히 부합. 도메인 prefix 없이 `EXECUTION_` 으로 시작하는 것도 기존 `EXECUTION_TIMEOUT` 패턴과 일관. 규약 완전 준수.
- 제안: N/A

---

### [INFO] i18n Principle 3-C 준수 — `ERROR_KO` 등재
- target 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` 신규 항목
- 위반 규약: `spec/conventions/i18n-userguide.md Principle 3-C` — 점진 등록 방식, hard fail 강제는 등록 집합에만 적용
- 상세: `EXECUTION_TIME_LIMIT_EXCEEDED` 가 `ERROR_KO` 에 등재됨. i18n 규약은 `ErrorCode` 전체 일괄 강제가 아닌 점진 방식이며, 신규 user-facing 코드를 동일 PR 에서 `ERROR_KO` 에 등록한 것은 규약 권장 행위에 부합. 규약 완전 준수.
- 제안: N/A

---

### [INFO] `spec/5-system/4-execution-engine.md` — `## Overview` 섹션 부재
- target 위치: `spec/5-system/4-execution-engine.md` 전체 구조
- 위반 규약: CLAUDE.md 문서 구조 권장 (Overview / 본문 / Rationale 3섹션). 단 "권장"이며 강제 규약 아님.
- 상세: 본 spec 문서는 `## Rationale` 섹션은 있으나 `## Overview` 섹션이 없음. 이 패턴은 `4-execution-engine.md` 의 기존 상태이며, 이번 PR 변경으로 신규 도입된 문제가 아님. 이번 diff 에서도 Overview 섹션을 추가하지 않았으나 기존 문서의 구조를 수정하는 것은 이번 PR 범위 밖임. INFO 수준으로만 기록.
- 제안: 후속 spec 정비 시 `## Overview` 섹션 추가 고려.

---

## 요약

이번 PR2a 구현(`impl-exec-concurrency-cap`)의 변경 사항 — `EXECUTION_TIME_LIMIT_EXCEEDED` 에러코드 신설, `V073` 마이그레이션, `execution-limits.ts` 모듈, `ERROR_KO` 등재, MDX 가이드 섹션 추가, spec §8 갱신 — 은 정식 규약(`spec/conventions/`) 을 전반적으로 준수하고 있다. 에러코드 명명은 `error-codes.md §1·§2` 의 의미 기반·신설 우선 원칙을 정확히 따르고, 마이그레이션 파일명은 `migrations.md §1` snake_case 규약에 부합하며, i18n 등재는 `i18n-userguide.md Principle 3-C` 의 점진 등록 방식을 따른다. spec frontmatter(`status: partial`, `pending_plans:` 실존, `code:` 글로브 매치)도 `spec-impl-evidence.md` 가드 요건을 충족한다. 발견된 항목은 모두 INFO 수준의 형식 일관성 제안으로, 채택 차단이 필요한 규약 위반은 없다.

## 위험도

NONE
