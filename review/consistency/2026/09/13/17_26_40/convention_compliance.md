# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 및 실측 경로 정정

`_prompts/convention_compliance.md` 번들은 예산에 잘려 `## 구현 변경 사항` diff 본문이
빠져 있었다(안내문이 예고한 대로). 따라서 워킹트리를 절대경로로 직접 조회해 실제 델타를
확인했다:

- `git diff --stat origin/main...HEAD -- codebase/ spec/` → **5개 파일** (`codebase/frontend/src/lib/docs/__tests__/` 하위, `spec/` 델타는 0 — 프롬프트의 "scope 델타 0" 진술과 일치).
- 요지: `guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` 를
  `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` 로 리네임·확장(에러 코드
  전용 → UPPER_SNAKE 식별자 전반, env 변수 축 포함) + `guide-sanitized-message-parity.test.ts`
  주석 각주 1건.
- 이 배치의 plan(`plan/in-progress/guide-identifier-existence.md`)이 이미 7라운드에 걸쳐
  `/ai-review` + `/consistency-check --impl-done` 을 반복 수행했고, 매 라운드 **동일한 단일
  WARNING** — `user-guide-evidence.md §2` 미등재 — 이 재발했다. 아래 발견사항은 그 히스토리와
  독립적으로 실측을 재확인한 결과이며, 판정은 그 6회 선례와 일치한다(새 CRITICAL 없음).

## 발견사항

### [WARNING] SoT 로 지목된 절이 새 가드를 아직 나열하지 않는다

- target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 파일
  상단 주석(`// SoT: spec/conventions/user-guide-evidence.md (가드 가족) · ...`),
  `PROJECT.md:300`(가드 카탈로그, `SoT: spec/conventions/user-guide-evidence.md §2`)
- 위반 규약: `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" 표 +
  frontmatter `code:` 목록(CLAUDE.md "정보 저장 위치" 표의 "정식 규약" 행 — 구현이 규약을
  가리키면 규약도 그 구현을 알아야 한다는 단일 진실 원칙의 역방향)
- 상세: `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 두 파일은 코드
  주석과 `PROJECT.md` 양쪽에서 `spec/conventions/user-guide-evidence.md §2` 를 SoT 로
  선언한다. 그런데 실제로 그 문서를 읽어보면(§2, 라인 68-77) "Build-time 가드 (3건)" 표는
  여전히 `impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` /
  `triggers-coverage.test.ts` 세 건만 나열하고, frontmatter `code:` 목록(라인 4-14)에도 이번
  두 파일이 없다. "SoT 가 나를 가리킨다" 는 문장이 그 SoT 문서 자체에는 반영돼 있지 않은
  상태 — `feedback_documented_guarantee_wider_than_built` 패턴과 동형이다. `spec/` 은
  developer 쓰기 금지(read-only)이므로 이 diff 로는 원리적으로 고칠 수 없고, 해당 plan 도
  이를 정확히 인지해 planner 항목으로 등재해 두었다(§D #1·#2, 6라운드 연속 동일 WARNING).
  CRITICAL 로 올리지 않는 이유: 가드 코드 자체는 정상 동작하며(회귀 테스트로 검증됨), 깨지는
  것은 문서 간 교차 참조뿐이고 이 상태는 이미 최소 6차례 독립 검토에서 동일하게 WARNING·
  BLOCK:NO 로 판정된 선례가 있다.
- 제안: developer 몫이 아니라 project-planner 턴에서 `user-guide-evidence.md` §2 표에 4번째
  행(또는 별도 절)을 추가하고 frontmatter `code:` 에 두 파일을 등재. 아래 항목도 함께
  처리할 것.

### [WARNING] 등재 위치가 `user-guide-evidence.md` 자신이 선언한 스코프와 어긋날 수 있다

- target 위치: `spec/conventions/user-guide-evidence.md` "SoT 역할" 문구(파일 상단,
  `> SoT 역할: ... <ImplAnchor> 컴포넌트의 단일 진실`) 및 §2 표 제목
- 위반 규약: 같은 문서의 Overview 가 스스로 정의한 범위(`<ImplAnchor>` 전용)
- 상세: `user-guide-evidence.md` 는 스스로를 "`<ImplAnchor>` 컴포넌트의 단일 진실" 로
  선언한다. §2 "Build-time 가드 (3건)" 표의 기존 3건은 모두 `<ImplAnchor>` 를 소비하는
  가드다. 반면 `guide-identifier-existence.test.ts` 는 `<ImplAnchor>` 와 무관하게 가이드
  본문의 백틱/필드/코드 리터럴 토큰 실재성을 검사한다 — 검증 대상 컴포넌트가 다르다. 위
  WARNING 이 해소될 때 단순히 §2 표에 4번째 행을 추가하면, 그 표의 제목("Build-time 가드
  (3건)")과 문서 서두의 스코프 선언("`<ImplAnchor>` 단일 진실") 둘 다 사실과 어긋나게 된다.
- 제안: planner 턴에서 단순 행 추가보다 (a) Overview 스코프 문구를 "가이드 진실성 가드
  가족" 수준으로 넓히거나, (b) §2 와 구분된 새 절(예: §6 "식별자 인용 가드")로 등재하는
  두 방법 중 하나를 명시적으로 택할 것. plan(`guide-identifier-existence.md` §D #1·#2)은
  "한 planner 턴에 등재" 만 요구할 뿐 이 카테고리 불일치까지는 다루지 않았다.

## 준수 확인 (참고 — 위반 아님)

- `error-codes.md` frontmatter `code:` 는 `error-codes.ts` (명명 SoT) 만 열거하며 소비자
  가드 파일은 등재하지 않는다 — 이 문서 스스로 "유일하게 소유하는 것" 에 가드 레지스트리를
  포함하지 않으므로, `guide-identifier-scan.ts` 주석이 이 문서를 `code:` 미등재 상태로 SoT
  인용해도 규약 위반이 아니다(§Overview 책임 경계 그대로).
- 리네임된 파일에 대한 옛 이름(`guide-error-code-existence.test.ts` 등)의 잔존 참조를
  `spec/`·`PROJECT.md`·`codebase/` 전수 grep 했다 — 남은 두 곳(`guide-identifier-scan.ts`
  자신의 역사 각주, `guide-sanitized-message-parity.test.ts` 각주)은 plan 이 명시한 "역사
  서술은 이름 보존 + 각주" 방침에 부합하며 dangling reference 가 아니다.
- `GUIDE_EXTERNAL_VOCABULARY` 명명은 무관 도메인의 `KNOWN_*` 접두(`KNOWN_DOCS_ABSENT` 등)와
  의도적으로 분리했다는 근거가 plan 에 남아 있고 실제 코드도 그 결정을 반영한다 — 명명
  충돌 없음.
- `<FieldTable>`/`code:` 축의 UPPER_SNAKE 판정 정규식은 `error-codes.md §1`/`node-output.md
  §3.2` 가 정의한 `UPPER_SNAKE_CASE` 표기 규약과 일치하는 방향으로만 동작하며(허용 목록
  화이트리스트에도 §3 Historical-artifact 예외 레지스트리와 유사하게 시스템명·사유 필드를
  의무화) 명명 규약 자체를 위반하지 않는다.

## 요약

이번 라운드의 실제 구현 변경분(`spec/` 델타 0, `codebase/frontend/.../__tests__/` 5개 파일)은
정식 규약을 새로 위반하지 않는다. 유일한 실질 이슈는 코드가 스스로 "SoT" 로 지목한
`spec/conventions/user-guide-evidence.md §2` 가 아직 그 가드를 나열하지 않는 문서 간
비동기 상태이며, 이는 developer 권한(spec read-only) 밖의 planner 몫으로 이미 plan 에
정확히 등재돼 있고 6차례 이상 동일하게 WARNING·BLOCK:NO 로 확인된 사안이다. 추가로,
등재 시 단순 표 추가만으로는 `user-guide-evidence.md` 가 스스로 선언한 "`<ImplAnchor>`
전용" 스코프와 충돌할 수 있다는 점을 planner 턴을 위해 남겨 둔다. 두 발견 모두 CRITICAL
로 볼 근거(다른 시스템이 가정한 invariant 붕괴)는 없다.

## 위험도

LOW
