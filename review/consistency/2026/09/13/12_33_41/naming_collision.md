# 신규 식별자 충돌 검토 — `plan/in-progress/guide-identifier-existence.md` (scope: `spec/conventions/`)

## 검토 범위 확인

target 은 아직 구현이 시작되지 않은 **plan 문서**(`plan/in-progress/guide-identifier-existence.md`, git 상 untracked)다.
`git diff origin/main...HEAD` 결과 `codebase/**`·`spec/**` 변경분은 0 — 이번 턴이 만든 것은 plan 문서 1개뿐이다.
따라서 "새로 도입되는 식별자" 후보는 (a) plan 본문이 명시한 개념·용어, (b) plan 이 확장 대상으로 지목한 기존 가드
(`guide-error-code-existence.test.ts` / `guide-error-code-scan.ts`, SoT: `spec/conventions/user-guide-evidence.md` ·
`spec/conventions/error-codes.md`) 뿐이다. 구체적인 함수명·상수명·파일 경로는 plan 이 아직 확정하지 않았으므로
(§C "기존 가드의 축으로 넣는다" 까지만 결정됨), 이번 검토는 **확정된 식별자 충돌 0건** + **명명 확정 시 주의할 리스크** 위주로 보고한다.

## 발견사항

- **[INFO]** 가드 파일명이 확장될 스코프보다 좁아질 예정 — "에러 코드" 전용 이름이 "식별자(에러 코드+환경변수)" 검증을 가리키게 됨
  - target 신규 식별자: (미확정) plan §C 가 `guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` 에 환경변수 축을 추가하기로 결정 ("별 가드가 아니라 기존 가드의 축으로 넣는다")
  - 기존 사용처: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:1-4`("유저 가이드가 이름으로 적은 **에러 코드**가 backend 소스에 실재하는가"), `guide-error-code-existence.test.ts:14`("유저 가이드가 이름 붙인 **에러 코드**는 backend 소스에 실재해야 한다"), `spec/conventions/user-guide-evidence.md` frontmatter `code:` 목록(두 파일 모두 미등재 — 별개 갭)
  - 상세: 파일명·describe 블록 제목·JSDoc 전부 "에러 코드" 로 스코프를 명시하는데, 구현되면 이 가드는 환경변수까지 판정한다. 파일명이 실제 커버리지보다 좁아 보이면, 다음 사람이 "이 파일은 에러 코드만 본다" 고 오독해 새 환경변수 인용 결함을 이 가드가 이미 잡고 있다는 사실을 놓치거나, 반대로 진짜 스코프를 모른 채 "환경변수는 어디서 검증하나" 를 다시 찾아 헤맬 수 있다. 이 저장소가 반복적으로 겪은 "문서화된 보장이 구현보다 좁다/넓다" 패턴(`feedback_documented_guarantee_wider_than_built`)의 명명판이다.
  - 제안: 구현 PR 에서 파일·describe·JSDoc 제목을 `guide-error-code-*` → `guide-identifier-existence.*`(또는 동등하게 스코프를 명시하는 이름)로 리네임하거나, 리네임하지 않기로 정하면 그 결정과 근거(예: 파일 분할 비용 vs 이름 부정확 비용)를 plan 체크리스트에 명시적으로 남길 것. `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" 표는 이 가드를 아직 넣지 않았으므로(별도 갭), 리네임 시 그 표·frontmatter `code:` 도 함께 갱신해야 새 이름이 SoT 문서와 어긋나지 않는다.

- **[INFO]** `CitationAxis` 유니온 확장 시 명명 정합
  - target 신규 식별자: (미확정) plan 이 말하는 "넓은 축(백틱 전수)" — 구현되면 `CitationAxis`(`"field-table" | "code-field" | "prose"`, `guide-error-code-scan.ts:61`)에 새 값이 필요
  - 기존 사용처: 동 파일의 세 값과 `guide-error-code-existence.test.ts:73-80`("세 축이 모두 후보를 낸다")가 축 번호를 하드코딩(§1/§2/§3, 3″ 까지)해 서술
  - 상세: 새 값을 기존 3개 중 하나로 오버로드(`"prose"` 재사용)하면 "산문 백틱은 실패-문맥일 때만 후보" 라는 axis 3 의 좁힌 의미(`CODE_CONTEXT` 게이팅)와 "환경변수는 실패 문맥 무관하게 전수 대상" 이라는 새 축의 의미가 한 라벨 아래 섞여, 리포트의 `axis` 필드만 보고는 두 규칙 중 무엇이 적용됐는지 구분이 안 된다. 새 라벨(예: `"identifier"` 혹은 `"env-var"`)을 쓰면 기존 3개와 충돌은 없으나, 넘버링 서술("축 1/2/3/3′/3″")에 새 축을 "축 4" 로 추가할지 3 계열 하위로 넣을지 plan 이 정하지 않았다 — 실제 충돌은 아니지만 두 이름 체계(라벨 vs 산문 번호)가 갈라질 위험.
  - 제안: 구현 시 새 axis 라벨은 기존 세 값과 겹치지 않는 새 문자열로 만들고, JSDoc 의 번호 표(§ "축 | 후보 | 부재 | 채택" 표, `guide-error-code-scan.ts:21-27`)에도 새 행을 추가해 라벨-번호 대응을 1:1 로 유지할 것.

- **[INFO]** 신설 예정 "허용목록"(방어적 4강제) 이름이 기존 `KNOWN_DOCS_ABSENT` 패턴과 나란히 놓일 때 혼동 여지
  - target 신규 식별자: (미확정) plan §C 의 "허용목록" — 항목별 외부 시스템명·상한·인용 여부 단언·기준집합 부재 단언 4강제
  - 기존 사용처: `spec/conventions/cafe24-api-catalog/_overview.md` §3·Rationale, `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-docs-drift.spec.ts` 의 `KNOWN_DOCS_ABSENT` — 이름은 다르지만 "구조상 정상인 부재를 허용목록으로 면제" 하는 동일 설계 패턴
  - 상세: 두 허용목록은 도메인이 완전히 달라(Cafe24 API 문서 부재 vs 가이드 외부 어휘) 실제 식별자 충돌은 없다. 다만 새 허용목록이 구현되며 이름을 지을 때 `KNOWN_*` 접두를 그대로 재사용하면(예: `KNOWN_EXTERNAL_VOCAB`) grep 검색 시 두 무관한 allowlist 가 뒤섞여 나와 리뷰어가 혼동할 수 있다.
  - 제안: 이름에 도메인을 명시(예: `GUIDE_EXTERNAL_VOCAB_ALLOWLIST` 류)해 `KNOWN_DOCS_ABSENT` 와 접두를 공유하지 않도록 할 것. 강제 사항이나 CRITICAL 은 아님 — 두 패턴이 별 파일·별 목적이라 실질 충돌 가능성은 낮다.

- **[INFO]** plan 파일 경로·워크트리명 자체는 충돌 없음 (확인됨)
  - target 신규 식별자: `plan/in-progress/guide-identifier-existence.md`
  - 기존 사용처: 없음 — `plan/complete/`, `plan/in-progress/` 전수 grep 결과 동일/유사 파일명 0건(`plan/complete/guide-error-code-truth.md`, `plan/complete/trigger-uuid-and-guide-error-codes.md` 는 선행 작업이며 이름이 다름)
  - 상세: 명명 컨벤션(`<task>-<slug>.md`, worktree 명과 1:1)을 준수하며 기존 파일과 겹치지 않는다.
  - 제안: 없음 — 문제 없음, 참고용으로 기록.

## 요약

이번 target 은 코드/spec 을 아직 건드리지 않은 **설계 단계 plan** 이며, 구체적인 신규 요구사항 ID·엔티티·엔드포인트·이벤트·환경변수·spec 파일 경로를 확정하지 않았다. plan 문서 경로 자체는 기존 명명과 충돌하지 않고, plan 이 명시적으로 "별 가드가 아니라 기존 가드의 축" 을 택해 새 파일 경로를 만들지 않기로 한 점은 오히려 경로 충돌 위험을 스스로 없앤 설계다. 다만 구현 단계에서 이름을 확정할 때 주의할 지점 셋을 INFO 로 남긴다 — ① `guide-error-code-*` 파일/제목이 환경변수까지 포괄하면 이름이 스코프보다 좁아진다, ② `CitationAxis` 신규 값이 기존 `"prose"` 의 좁혀진 의미와 섞이지 않게 별도 라벨을 써야 한다, ③ 신설 허용목록 이름이 `KNOWN_DOCS_ABSENT` 와 접두를 공유하면 무관한 두 패턴이 grep 상 뒤섞인다. 셋 다 CRITICAL/WARNING 급 충돌이 아니라 구현 시 이름을 결정하는 사람에게 남기는 선제 메모다.

## 위험도

LOW
