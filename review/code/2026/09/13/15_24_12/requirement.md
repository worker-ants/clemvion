# 요구사항(Requirement) 리뷰 — guide-identifier-existence (3차 라운드, 라운드 2 fix `938060138` 반영 후)

## 검증 방법

프롬프트 diff(조립 문서, 다수는 이전 라운드 `14_41_14`/`15_03_06`/`12_33_41`/`14_41_43`/`15_03_36` 산출물 재수록)를 훑은 뒤, 실제 워크트리의 원본 소스(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`, `guide-sanitized-message-parity.test.ts:16`)를 직접 `Read` 로 열람하고, 관련 spec(`spec/conventions/user-guide-evidence.md`)·plan(`plan/in-progress/guide-identifier-existence.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`) 을 직접 grep/Read 로 대조했다.

- `npx vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` → **2 files / 31 tests 통과**.
- `grep -rnE '`?[0-9]{2}_[0-9]{2}_[0-9]{2}`?'` 로 `guide-identifier-*.ts`/`guide-sanitized-message-parity.test.ts`/`PROJECT.md`/`CHANGELOG.md` 를 재검사 — round-2 fix(`938060138`)가 고쳤다고 주장한 bare `hh_mm_ss` 인용(`review-citations.md §2` 위반) **잔여 0건**을 직접 재확인(리뷰어가 이미 잡은 CRITICAL이 실제로 해소됨).
- `collectEnvDeclarations` 뮤테이션 2건을 저장소 밖 scratch(`/private/tmp/.../scratchpad/mutcheck/*.js`)에서 **독립 재현**했다(원본 로직을 옮겨 적어 실행, 저장소 파일은 건드리지 않음):
  - `^#?` 제거 → `.env.example` 형 주석 선언(`#ENABLE_SWAGGER_IN_PROD=false`) 입력 시 원본은 `["CORS_ORIGINS","ENABLE_SWAGGER_IN_PROD"]`, 뮤턴트는 `[]` → RED 재현 확인.
  - `^\s+` → `^\s*` (compose 케이스) → 최상위 `NOT_AN_ENV_KEY:` + 들여쓴 `POSTGRES_PASSWORD:` 혼합 fixture 로 원본은 `["POSTGRES_PASSWORD"]`, 뮤턴트는 `["NOT_AN_ENV_KEY","POSTGRES_PASSWORD"]` → RED 재현 확인. RESOLUTION.md 의 "판별 fixture 교정" 서사가 실측과 일치한다.
- `spec/conventions/user-guide-evidence.md` 를 `grep -n "guide-identifier\|guide-error-code\|guide-sanitized"` → **0건** — SoT §2 가 여전히 세 가드 파일을 등재하지 않은 상태(선재 갭)를 재확인.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 grep → 리네임 반영된 파일명(`guide-identifier-existence`/`guide-identifier-scan`/`guide-sanitized-message-parity`)으로 planner 항목이 이미 갱신·등재돼 있음을 확인.

## 뮤테이션/원복 메모 (반드시 보고하도록 규약이 요구)

리뷰 도중 `git status --short` 를 두 차례 실행했는데, 첫 실행에서 `M codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(1줄 변경) 와 `?? .../guide-identifier-scan.ts.bak2` 가 관측됐다. **이 세션은 그 파일에 어떤 Edit/Write 도 하지 않았다** — 동시에 워킹트리를 읽고 있는 다른 reviewer 의 뮤테이션 테스트 사이클(수정 → 확인 → `.bak` 경유 원복)로 추정된다. 수십 초 뒤 재확인(`git status --short`, `git diff HEAD --stat`)한 결과 두 항목 모두 사라졌고 트리는 clean 상태로 복귀했으며, 파일 MD5(`05d14400d7dceb96095bbb572bb57822`)도 내가 라운드 초반에 `Read` 로 확인한 내용과 일치한다. 즉 **일시적이었고 자체 원복됐다** — 내가 조치할 것은 없었지만, 병렬 fan-out 프롬프트가 명시한 "관측한 이상 상태는 그대로 보고하라" 지시에 따라 기록한다. 이 세션이 만든 것은 `review/code/2026/09/13/15_24_12/`·`review/consistency/2026/09/13/15_23_53/` 뿐이다.

## 발견사항

- **[INFO] `[SPEC-DRIFT]` `user-guide-evidence.md §2` 가 이 가드 가족(3파일)을 여전히 등재하지 않음 — 선재 갭, 이번 라운드가 새로 만든 결함 아님 (통산 7번째 독립 확인)**
  - 위치: `spec/conventions/user-guide-evidence.md` (§2 표·frontmatter `code:` 목록에 `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`/`guide-sanitized-message-parity.test.ts` 미등재), 자칭 SoT 는 `guide-identifier-scan.ts:4`·`guide-identifier-existence.test.ts:25`
  - 상세: `--impl-prep`(`12_33_41`)·`--impl-done`(`14_41_43`)·`/ai-review` 라운드1(`14_41_14` requirement)·라운드2(`15_03_06` requirement)에서 이미 4회 독립 확인됐고, 이번(라운드3)이 5번째다(자매 checker `cross_spec`/`rationale_continuity`/`plan_coherence` 를 더하면 통산 7번째). `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 리네임 반영된 파일명으로 `- [ ]` planner 미해결 항목으로 정확히 등재돼 있다. **코드가 틀린 게 아니라 spec 갱신이 못 따라간 것**이다 — `developer` 는 `spec/` 쓰기 권한이 없고, §2 표는 developer 가 쓴 예고 문장이 아니라 제품 카탈로그라 자기-반증형 소정정 예외에도 해당하지 않는다.
  - 제안: 코드 유지 + `project-planner` 턴에서 `user-guide-evidence.md` §2 표제(가드 건수)·표 2행 추가·frontmatter `code:` 목록을 리네임된 파일명으로 갱신. 이미 등재돼 있으므로 이 리뷰가 새로 요구하는 조치는 없다 — 회귀 방지 재확인으로만 기록.

- **[INFO] 라운드 2 fix(`938060138`)가 라운드 2 리뷰(`15_03_06`)의 CRITICAL 1(bare `hh_mm_ss` 인용) + WARNING 1(`collectEnvDeclarations` 뮤테이션 미검증)을 실제로 해소했음을 독립 재현으로 확인**
  - 위치: `guide-identifier-existence.test.ts:98`(citation 경로), `:191-246`(`collectEnvDeclarations` 대조군 5건)
  - 상세: 위 "검증 방법" 절에서 grep + 독립 뮤테이션 재현으로 둘 다 확인했다. 특히 WARNING 은 RESOLUTION.md 가 서술한 "판별 fixture 를 한 번 잘못 골랐다"(들여쓴 키만 넣은 첫 판본은 `^\s+`→`^\s*` 뮤턴트를 못 잡았고, 최상위 `NOT_AN_ENV_KEY:` 를 섞은 뒤에야 RED 로 갈렸다) 서사가 내가 저장소 밖에서 독립적으로 재구성한 로직과 정확히 일치한다.
  - 제안: 조치 불요.

## 기능/엣지케이스/반환값 점검 요약

- 3축(`field-table`/`code-field`/`backtick`) + env 병합 basis 로 "가이드가 이름 붙인 UPPER_SNAKE 식별자(에러 코드 + 환경변수)가 실재해야 한다"는 의도된 기능이 완전히 구현돼 있다 — `#1328` 과거 결함(환경변수 오기)을 3갈래 재현 테스트(오기 포착/정정 통과/구 축이었다면 놓쳤다)로 고정했고 실제 소스 상태(`MCP_ALLOW_INSECURE_URL` 실재, `MCP_INSECURE_URL_ALLOWED` 부재)와 일치.
- `readIfPresent`(`.env.example` 부재 방어), `GUIDE_EXTERNAL_VOCABULARY` 4강제(외부 시스템명 필수·상한 5·인용 유지·기준집합 비포함) 모두 독립 테스트로 고정돼 허용목록이 은폐 수단으로 변질되는 것을 구조적으로 막는다.
- vacuity floor(코퍼스 적재량·축별 후보 수·`envOnly` 카운트)와 실제 코퍼스 명명 회귀(`discord.en.mdx`/`EXECUTION_TIMEOUT`, `mcp-servers.mdx`/`MCP_ALLOW_INSECURE_URL`)가 함께 있어 총량 floor 만으로 가려질 수 있는 좁은 회귀를 별도로 잡는다.
- 모든 함수(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`)가 모든 입력 경로에서 정의된 타입(`IdentifierCitation[]`/`Set<string>`)을 반환하며 예외를 던지는 경로 없음 — 반환값 누락 없음.
- TODO/FIXME/HACK/XXX 주석 없음(grep 확인).
- 알려진 한계("존재 검사 ≠ 방출 검사")가 코드·plan·`PROJECT.md` 세 곳에 일관되게 disclose 돼 있고, "이 주석을 지우지 말 것" 문구에 라운드1에서 실제로 지워졌던 재발 경위까지 자기참조적으로 기록돼 있다 — 의도와 구현 간 괴리 없음.

## 요약

라운드 3(`938060138` 이후 상태)을 직접 소스 대조 + 독립 뮤테이션 재현으로 검증한 결과, 라운드 2 가 지적한 CRITICAL(bare 인용 규약 위반) 과 WARNING(`collectEnvDeclarations` 뮤테이션 미검증) 이 실제로 해소됐음을 확인했다. 가드의 핵심 기능(가이드가 적은 UPPER_SNAKE 식별자가 소스·env 선언처에 실재하는지 검증, 등재 근거였던 과거 결함을 실제로 재현·포착)은 완결돼 있고, 엣지케이스·에러 시나리오·반환값·비즈니스 로직(허용목록 4강제) 모두 실측된 테스트로 고정돼 있다. 유일하게 열려 있는 항목은 `user-guide-evidence.md §2` 미등재(SPEC-DRIFT)인데, 이는 코드 결함이 아니라 developer 권한 밖의 spec 갱신 누락이며 이미 planner 백로그에 정확히 등재돼 있고(5번째 독립 확인) 새로운 조치를 요구하지 않는다. 리뷰 도중 다른 병렬 reviewer 로 추정되는 일시적 파일 뮤테이션(`guide-identifier-scan.ts` 1줄 변경 + `.bak2`)을 관측했으나 이 세션이 재확인한 시점엔 자체 원복돼 있었고 내용도 일치해 실질적 영향은 없다.

## 위험도

LOW — 기능·엣지케이스·에러 시나리오·반환값 전부 정상이고 테스트(31/31)로 확인됨. 유일한 미해소 항목은 코드가 아니라 spec 문서 갱신 누락(SPEC-DRIFT)이며 이미 planner 턴에 정확히 위임돼 있어 이번 코드 변경을 막을 사유가 아니다.
