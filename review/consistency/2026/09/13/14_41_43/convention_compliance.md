# 정식 규약 준수 검토 — convention_compliance

검토 모드: `--impl-done` (scope=`spec/conventions/`, diff-base=`origin/main`)
target: `spec/conventions/` (이번 브랜치의 `spec/conventions/**` 델타는 0개 파일 — 정상. 구현 diff 는
frontend `guide-error-code-*` → `guide-identifier-*` 리네임/확장 4파일 + `PROJECT.md` 1줄이다.)

## 발견사항

### 1. [WARNING] `user-guide-evidence.md §2` 가 새 가드 가족을 여전히 등재하지 않는다

- target 위치: `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" 표
  (가드 3건만 나열: `impl-anchor-existence.test.ts` · `integrations-coverage.test.ts` ·
  `triggers-coverage.test.ts`) + frontmatter `code:` 목록(7개 경로).
- 위반 규약: CLAUDE.md "정보 저장 위치(단일 진실 원칙)" — 기술 명세는 `spec/<영역>/*.md` 본문이
  SoT 여야 하는데, 코드 쪽(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`)은
  자신의 SoT 로 이 문서를 **명시적으로 지목**하면서(`SoT: spec/conventions/user-guide-evidence.md
  (가드 가족)`) 정작 그 문서에는 자신이 없다.
- 상세: `guide-identifier-existence.test.ts`(구 `guide-error-code-existence.test.ts`) ·
  `guide-identifier-scan.ts`(구 `guide-error-code-scan.ts`) · `guide-sanitized-message-parity.test.ts`
  셋 다 §2 표에도, frontmatter `code:` 배열에도 없다. 이번 PR 이 새로 만든 gap 이 아니라 이미
  `--impl-prep`(`review/consistency/2026/09/13/12_33_41`) 에서 3-checker 수렴 WARNING 으로
  잡혔던 기존 gap이며, 리네임으로 참조 이름만 낡았다.
- 처분 확인: developer 권한(`spec/` write 불가) 밖이라 `plan/in-progress/
  spec-draft-nullable-notation-followups.md` 에 planner 항목으로 (재)등재돼 있다 — CLAUDE.md
  "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 원칙을 올바르게 따른
  처리다. **다만 target 문서 자체는 아직 규약 미준수 상태로 남아 있으므로** 이번 라운드에서도
  재보고한다(사용자 메모 "consistency WARNING 은 BLOCK:NO 여도 반영" 관례에 따름).
- 제안: 별도 planner 턴에서 §2 표에 행 2개 추가(`guide-identifier-existence.test.ts`,
  `guide-sanitized-message-parity.test.ts`) + frontmatter `code:` 에 3개 경로(`guide-identifier-
  scan.ts` 포함) 추가 + Rationale 에 "허용목록 없음" 원칙 번복 근거 기록. developer 는 이번
  PR 에서 직접 고칠 수 없다(자기-반증형 소정정 예외 대상 아님 — 이 표는 developer 자신이 쓴
  예고 문장이 아니다).

### 2. [WARNING] `cafe24-api-metadata.md §4` 가 node-output envelope 정의처를 오인용 (선재 결함)

- target 위치: `spec/conventions/cafe24-api-metadata.md` §4 "용어 주의" 박스
  (`> **용어 주의**: … CONVENTIONS Principle 7 의 **노드 출력 envelope** (`{config, output, meta,
  port}`) 와 무관한 별개 개념이다.`)
- 위반 규약: `spec/conventions/node-output.md` 자체의 Principle 번호 체계 — 노드 출력 5필드
  envelope(`{config, output, meta, port, status}`)의 정의처는 **Principle 0**
  (`## Principle 0 — NodeHandlerOutput의 5필드는 불변`)이지 Principle 7 이 아니다. Principle 7 은
  "config echo 원칙"(별개 주제)을 다룬다.
- 상세: 인용된 필드 목록도 4개(`config, output, meta, port`)뿐이라 Principle 0 이 실제로 선언한
  5번째 필드 `status` 가 누락돼 있다. `git log -S` 로 확인한 결과 2026-05-16 최초 작성 시점부터의
  오인용이며 이번 브랜치의 재넘버링 때문이 아니다(이번 브랜치는 `spec/conventions/` 를 전혀
  건드리지 않았다 — 위 파일 diff 0줄).
- 처분 확인: 이번 PR 의 `--impl-prep` 라운드(WARNING#4)에서 이미 지적됐고, `spec/**` 이므로
  developer 권한 밖 → `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner
  항목으로 신규 등재돼 있다. 올바른 처리이나 target 문서 자체의 미준수 상태는 그대로다.
- 제안: 별도 planner 턴에서 "Principle 7" → "Principle 0" 정정 + `status` 필드 언급 추가.

### 3. [WARNING] 리네임이 자매 파일의 상호 참조 주석에 전파되지 않았다

- target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts`
  상단 JSDoc "자매 `guide-error-code-existence.test.ts` 는 **코드 토큰**의 실재를 본다."
  (이 파일 자체는 이번 diff 에서 0줄 변경 — 리네임 대상에서 누락됐다.)
- 위반 규약: 이번 PR 이 스스로 세운 명명 결정(`plan/in-progress/guide-identifier-existence.md`
  §C "명명" — `guide-error-code-*` → `guide-identifier-*` 리네임 확정, "참조처는 `PROJECT.md`
  가드 카탈로그 2행과 트래커의 planner 등재 문구다(둘 다 이 PR 이 고칠 수 있다)")의 **완전성
  주장**이 실제로는 이 세 번째 참조처(자매 테스트 파일의 JSDoc)를 놓쳤다. `spec/conventions/`
  자체를 직접 위반하는 것은 아니지만, 명명 규약 준수 관점(점검 관점 1)에서 리네임 후 존재하지
  않는 파일명(`guide-error-code-existence.test.ts`)을 가리키는 죽은 참조가 코드베이스에 남는다.
- 상세: `guide-identifier-scan.ts` 안의 `guide-error-code-*` 언급(주석 상단 "왜 '에러 코드' 가
  아니라 '식별자' 인가" 절)은 `#1330` 시절 사실을 서술하는 **의도된 역사 서술**이라 문제
  없다(이 PR 이 이미 다른 곳에서 쓴 "역사 서술은 이름을 보존" 원칙과 일치). 그러나
  `guide-sanitized-message-parity.test.ts` 의 문장은 역사 서술이 아니라 **현재형 자매 관계
  서술**이라 실제로 어긋난 상태다.
- 제안: 그 줄을 `guide-identifier-existence.test.ts`(리네임 전 `guide-error-code-existence.test.ts`)
  로 갱신 — 이 PR 이 다른 자리(예: `guide-identifier-scan.ts` 자신의 주석)에서 이미 쓴
  "리네임 전 …" 각주 패턴을 그대로 적용하면 된다. `codebase/**` 파일이라 developer 권한
  안이며 planner 턴 불필요.

### 4. [INFO] `cafe24-api-metadata.md` 에 `## Overview` 헤딩이 없다 (구조 관례, 선재)

- target 위치: `spec/conventions/cafe24-api-metadata.md` 도입부(제목 직후 서술, `## 1. 디렉토리
  구조` 전까지) — 다른 conventions 문서(`audit-actions.md`, `error-codes.md`, `user-guide-
  evidence.md`)는 전부 `## Overview` 헤딩을 명시하는데 이 문서는 산문 도입만 있고 헤딩이 없다.
  `## Rationale` 은 있음(§441).
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장".
- 상세: 이번 PR 델타와 무관한 기존 구조이며 강제 규칙이라기보다 "권장" 이라 CRITICAL/WARNING
  급은 아니다.
- 제안: 급하지 않음 — 다음에 이 문서를 편집할 planner 턴에서 도입 문단에 `## Overview` 헤딩만
  추가해도 충분하다.

## 요약

이번 브랜치는 `spec/conventions/**` 를 전혀 수정하지 않았고(델타 0, 정상), 구현 diff 는
`guide-error-code-*` 가드를 `guide-identifier-*` 로 리네임·확장(에러 코드 + 환경변수 이중 축,
`GUIDE_EXTERNAL_VOCABULARY` 허용목록 4강제)한 4파일이다. 이 확장 자체는 명명·허용목록 설계
(`KNOWN_*` 접두 회피, 외부 어휘 등재 강제 조건 4가지)에서 정식 규약을 새로 위반하지 않는다.
다만 target 인 `spec/conventions/` 는 자신이 소유해야 할 가드 가족 등재(`user-guide-evidence.md
§2`)와 인접 문서 상호 참조(`cafe24-api-metadata.md §4` 의 Principle 오인용) 두 곳에서 이미 알려진
미준수 상태를 유지하고 있고, 둘 다 developer 권한 밖이라 이번 PR 은 이를 planner 항목으로 정확히
등재만 하고 직접 고치지 않았다 — 이는 CLAUDE.md 워크플로 규약을 올바르게 따른 것이다. 추가로
이번 리네임이 자매 테스트 파일(`guide-sanitized-message-parity.test.ts`)의 상호 참조 주석 1곳을
갱신하지 못해 죽은 파일명 참조가 새로 생겼다 — 이는 developer 권한 안의 경미한 정정 대상이다.
CRITICAL 급 위반은 없다.

## 위험도

LOW
