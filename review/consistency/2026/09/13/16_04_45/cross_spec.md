# Cross-Spec 일관성 검토 — guide-identifier-existence (`--impl-done`, scope=`spec/conventions/`)

## 검토 범위 확인

- `spec/conventions/**` 델타: **0개 파일** (`git diff origin/main...HEAD -- spec/` 실측 0). 이 브랜치는 spec 을 고치지 않는다 — 정상.
- 실제 diff: `codebase/frontend/src/lib/docs/__tests__/` 5개 파일 (`git diff origin/main...HEAD -- codebase/` 실측). 내용은 `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` → `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 리네임 + 판정 축 확장(에러 코드 전용 → UPPER_SNAKE 식별자 전반: 에러 코드 + 환경변수). 순수 build-time 테스트 harness 변경이며 데이터 모델·API 계약·RBAC·상태 머신·서비스 계층 코드는 건드리지 않는다.
- 위 절대경로 워킹트리에서 `spec/conventions/user-guide-evidence.md`, `spec/conventions/error-codes.md`, `spec/5-system/3-error-handling.md §1.4`, `spec/conventions/spec-impl-evidence.md`, `spec/conventions/frontend-layering.md` 를 직접 열어 대조했다.

## 발견사항

- **[INFO]** 가드가 자칭하는 SoT(`user-guide-evidence.md §2`)에 아직 미등재 — 단, 이미 추적 중
  - target 위치: 신규 `guide-identifier-scan.ts` 상단 주석 "SoT: spec/conventions/user-guide-evidence.md (가드 가족)" 및 `guide-identifier-existence.test.ts` JSDoc
  - 충돌 대상: `spec/conventions/user-guide-evidence.md §2` (Build-time 가드 "3건" 표) · §2.1 관계표 — 두 곳 다 `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 미등재, frontmatter `code:` 목록(5줄)에도 없음
  - 상세: 코드 주석이 `user-guide-evidence.md` 를 이 가드 계열의 SoT 로 지목하지만 그 문서의 §2 표는 여전히 "3건"만 세고, 리네임 후 이름(`guide-identifier-*`)도 반영돼 있지 않다. 이는 이번 diff 가 새로 만든 문제가 아니라 `#1330`(guide-error-code-* 최초 도입) 시점부터 있던 갭이며, `plan/in-progress/guide-identifier-existence.md §D` 가 `--impl-prep`(`review/consistency/2026/09/13/12_33_41`, 3-checker 수렴) 결과로 이미 이 갭을 인지하고 있다. 해당 plan 은 "developer 권한 밖(spec 쓰기는 project-planner 소관)"이라고 명시하며 `spec_impact: none` 처리하고, `plan/in-progress/spec-draft-nullable-notation-followups.md:3247` 에 이름을 `guide-identifier-*` 로 갱신한 planner 항목(`[ ]`, 3건→5건 승격 + frontmatter `code:` 3파일 추가 + "허용목록 없음" 원칙 번복의 Rationale 반영까지 명시)으로 정식 등재돼 있다.
  - 제안: 추가 조치 불요 — 이미 올바른 채널(project-planner 트래커)로 이관돼 있다. 후속 planner 세션에서 `spec-draft-nullable-notation-followups.md` 의 해당 항목을 처리할 때 `user-guide-evidence.md §2`/§2.1/frontmatter `code:` 를 한 턴에 갱신하면 된다.

- **[INFO]** 코드 주석의 spec 인용(§1.4 앵커 3분류) 정합성 확인 — 충돌 없음
  - target 위치: `guide-identifier-scan.ts` `collectSourceTokens` JSDoc — "`3-error-handling.md §1.4` 가 명시하듯 코드 앵커는 셋으로 갈리고... 상당수는 앵커 없는 맨 문자열"
  - 충돌 대상: `spec/5-system/3-error-handling.md §1.4`
  - 상세: 실제 §1.4 본문(`ErrorCode` const · `EngineErrorCode` const · 에러 클래스 `readonly code` 3분류 + "나머지 7종은 앵커 없는 맨 문자열")과 정확히 일치. 인용이 정확하며 이 설계 결정(enum 만이 아니라 소스 전체 UPPER_SNAKE 를 기준집합으로 삼는 이유)의 근거가 실제 spec 서술과 부합한다.

- **[INFO]** `GUIDE_EXTERNAL_VOCABULARY` 허용목록과 `error-codes.md §3` Historical-artifact 예외 레지스트리 — 별개 메커니즘, 충돌 없음
  - target 위치: `guide-identifier-scan.ts` `GUIDE_EXTERNAL_VOCABULARY`
  - 충돌 대상: `spec/conventions/error-codes.md §3`
  - 상세: 둘 다 "예외 허용" 개념이지만 대상이 다르다 — `error-codes.md §3` 은 *코드 자체의* 명명 규약 위반 예외(예: `AbortError` PascalCase), `GUIDE_EXTERNAL_VOCABULARY` 는 *가이드가 인용하는 외부 시스템 어휘*(Discord `MESSAGE_CREATE`)에 대한 테스트 harness 허용목록이다. plan(`spec-draft-nullable-notation-followups.md:3330` 부근)도 "`error-codes.md` 에는 적지 않는다 — 그 문서가 소유 범위를 명명원칙/rename/historical-artifact 로 못박았다"고 이미 명확히 구분해 두었다. 두 메커니즘이 서로 다른 범위를 다루므로 모순 없음.

- **[INFO]** frontend-layering 경계 — 신규 위반 없음
  - target 위치: `guide-identifier-existence.test.ts` — `codebase/backend/src`·`codebase/packages` 소스를 `fs.readFileSync` 로 읽음
  - 충돌 대상: `spec/conventions/frontend-layering.md §1`
  - 상세: 이 문서는 `src/lib/**` → `src/components/**` 방향의 **import** 만 규율하며 `src/__tests__/**` 류 테스트 디렉터리는 "의존 축 밖"으로 명시 제외한다. 대상 파일은 `import` 가 아니라 `fs` 로 파일 텍스트를 읽는 빌드타임 검증 코드이고, 같은 패턴(backend/packages 소스를 frontend 테스트에서 읽음)이 리네임 전부터 이미 존재했다(`impl-anchor-existence.test.ts` 등 선례). 이번 diff 로 새로 생긴 레이어 위반 아님.

## 요약

이번 PR 은 `spec/conventions/**` 를 전혀 변경하지 않는 순수 코드(테스트 harness) diff 로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 중 어느 것도 건드리지 않아 Cross-Spec 충돌의 표면 자체가 거의 없다. 유일하게 실질적인 spec 정합 이슈(가드가 자칭하는 SoT 문서 `user-guide-evidence.md §2`에 아직 미등재)는 이번 diff 가 새로 만든 문제가 아니라 `#1330` 부터 이어진 기존 갭이며, `plan/in-progress/guide-identifier-existence.md` 가 developer 권한 밖임을 정확히 인지해 `project-planner` 트래커(`spec-draft-nullable-notation-followups.md`)에 상세 처리 지침(등재 표 3건→5건, frontmatter `code:` 3파일, Rationale 반영)과 함께 정식 이관해 두었다. 코드 주석이 인용하는 spec 서술(§1.4 앵커 3분류)도 실제 문서와 정확히 일치하며, 허용목록·레이어링 경계 모두 기존 규약과 충돌하지 않는다.

## 위험도
NONE
