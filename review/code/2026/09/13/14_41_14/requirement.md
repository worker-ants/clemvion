# 요구사항(Requirement) 리뷰 — guide-identifier-existence

## 검증 방법

프롬프트 diff 를 읽은 뒤 실제 워크트리 파일을 직접 열람·실행해 교차검증했다(저장소는 뮤테이션하지 않음, `git status --short` 로 확인 — 이 세션이 만든 것은 `review/**` 산출물뿐).

- `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts` → **18/18 통과**
- `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/` (형제 가드 전체) → **23 files / 3315 tests 통과** (rename 으로 인한 회귀 없음)
- `grep -rn "guide-error-code" codebase/` → 삭제된 옛 파일에 대한 import 잔존 0건. `spec/` 전체에 `guide-error-code`/`guide-identifier` 참조 0건(§9 참고)
- `codebase/backend/.env.example`·`docker-compose.yml` 실제 포맷 확인 → `collectEnvDeclarations` 의 두 정규식(`.env.example` 라인형·compose map 형)이 이 저장소의 실제 포맷과 일치함을 확인
- `MCP_ALLOW_INSECURE_URL` / `MCP_INSECURE_URL_ALLOWED` 실재 여부를 grep 으로 직접 대조 → 회귀 픽스처가 주장하는 과거 결함(`#1328`)의 사실관계가 실제 소스와 일치함을 확인

## 발견사항

- **[WARNING] 리네임 후 자매 파일의 present-tense 상호참조가 존재하지 않는 파일명을 가리킨다**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16`
  - 상세: 이 파일의 JSDoc 은 `"자매 \`guide-error-code-existence.test.ts\` 는 코드 토큰의 실재를 본다"` 라고 **현재형**으로 서술한다. 그런데 이번 PR 이 `guide-error-code-existence.test.ts` 를 `guide-identifier-existence.test.ts` 로 리네임했으므로, 이 문구가 가리키는 파일은 더 이상 그 이름으로 존재하지 않는다. plan(`plan/in-progress/guide-identifier-existence.md` §C "명명")은 리네임 참조처를 "PROJECT.md 가드 카탈로그 2행 + 트래커 전방 참조 5곳"으로 명시하고 "`guide-sanitized-message-parity` 는 스코프가 안 바뀌므로 리네임 대상이 아니다"라고 적었는데, 이는 파일 자체를 리네임할 필요가 없다는 뜻이지 그 파일 **내부의 상호참조 문구**까지 정확하다는 뜻은 아니다 — 정확히 이 자리를 놓쳤다. `guide-identifier-scan.ts` 자신의 최상단 주석(`"#1330 은 이 가드를 에러 코드 전용으로 만들었다(\`guide-error-code-*\`)"`)은 **역사 서술**이라 문제 없지만, 이 자리는 "자매 파일이 지금 무엇을 본다"는 **현재 아키텍처 서술**이라 성격이 다르다.
  - 제안: `guide-error-code-existence.test.ts` → `guide-identifier-existence.test.ts` 로 정정(이 PR 이 이미 다른 4곳에서 쓰는 패턴 그대로 적용하면 됨). 이 파일은 `codebase/**` 이므로 developer 권한 안이다.

- **[WARNING] SoT(`user-guide-evidence.md §2`) 가 "가드 3건"이라 세는데 실제로는 5건이다 — 단, 이미 추적 중인 선재 갭이며 이번 PR 이 새로 만든 결함은 아니다**
  - 위치: `spec/conventions/user-guide-evidence.md:68` (`## 2. Build-time 가드 (3건)` 표 — `impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·`triggers-coverage.test.ts` 만 등재)
  - 상세: `guide-identifier-existence.test.ts`(및 `guide-identifier-scan.ts`)의 JSDoc 은 `"SoT: spec/conventions/user-guide-evidence.md (가드 가족)"`·`"SoT: spec/conventions/user-guide-evidence.md §2"`(PROJECT.md 카탈로그 문구)라고 자칭하지만, 실측(`grep -rn "guide-error-code\|guide-identifier" spec/` → 0건)으로 확인한 대로 그 문서 §2 표·frontmatter `code:` 목록 어디에도 이 가드가 없다. 자매 `guide-sanitized-message-parity.test.ts` 도 마찬가지로 미등재라 실질 가드 수는 5건인데 표제가 "3건"이다. **다만** 이 갭은 `#1330`(guide-error-code-* 최초 도입) 시점부터 있던 것이고, 이번 PR 은 그 위에 리네임만 더했다. `--impl-prep`(`review/consistency/2026/09/13/12_33_41`)에서 cross_spec·rationale_continuity·plan_coherence 3개 checker 가 독립적으로 이미 지적했고(WARNING #1/#2), `plan/in-progress/guide-identifier-existence.md` 상단 blockquote 가 "developer 권한 밖 → planner 항목으로 등재돼 있다(§D)"고 명시하며, 실제로 `plan/in-progress/spec-draft-nullable-notation-followups.md:3247`(`"user-guide-evidence.md §2.1 관계표에 새 가드 2건이 빠져 있다" (planner, ...)`)에 미해결(`- [ ]`) 항목으로 남아 있음을 확인했다. 즉 **인지·추적은 정확히 됐고**, 남은 것은 `project-planner` 턴에서 spec 을 갱신하는 것뿐이다.
  - 제안: 코드 수정 불요(developer 스코프 아님). `project-planner` 가 `spec/conventions/user-guide-evidence.md` §2 표제("3건"→"5건")·표 2행 추가(`guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`)·frontmatter `code:` 목록 갱신을 한 턴에 처리할 것 — 이미 plan 에 등재돼 있으므로 별도 조치는 불필요, 다만 이 리뷰가 독립적으로 같은 결론에 도달했음을 4번째 확인으로 기록한다.

- **[INFO] "존재 검사 vs 방출 검사" 한계가 이번 축(백틱 전수)에서 그대로 유지된다 — 이미 코드 주석에 명시**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`scanIdentifierCitations`/`collectSourceTokens` 상단 JSDoc)
  - 상세: `collectSourceTokens` 는 파일 텍스트 전체(주석·문자열 리터럴 포함)에서 `\bUPPER_SNAKE\b` 를 무조건 수집하므로, 가이드가 인용한 토큰이 실제로 `error.code`/`process.env.X` 로 **방출**되는지는 보장하지 않는다 — 임의의 상수명·테스트 픽스처 값과 우연히 같아도 "실재"로 판정한다. 이 한계는 새로 발견한 것이 아니라 파일 자신의 주석(`"이 가드가 못 보는 것 — 존재 검사이지 방출 검사가 아니다"`, `MAKESHOP_UNRESOLVED_PATH_PARAM` 실측 사례 포함)과 PROJECT.md 카탈로그 문구가 이미 명시적으로 disclose 하고 있다. 회색지대이자 이미 투명하게 문서화됐으므로 조치 불요.

- **[INFO] `collectEnvDeclarations` 병합이 오늘 판정을 지탱하지 않는다는 사실이 코드·plan·테스트 세 곳 모두에서 일관되게 disclose 됨**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:150-166`(JSDoc), `guide-identifier-existence.test.ts` 의 `"env 선언처 수집기가 살아 있다 (오늘 판정은 지탱하지 않는다)"` 테스트, `plan/in-progress/guide-identifier-existence.md §B`
  - 상세: 가이드가 인용하는 env 변수 8종이 전부 소스에도 있어(`process.env.X`), `collectEnvDeclarations` 를 통째로 제거해도 오늘은 GREEN 이라는 사실을 뮤테이션으로 직접 검증했다고 세 곳이 일관되게 서술한다. "설계 근거는 반드시 뮤테이션으로 반증해 보라"는 일반 원칙에 부합하는 드문 사례 — 근거가 실측 기반이고 자기모순이 없다. 조치 불요.

## 기능/엣지케이스/반환값 점검 요약

- 세 축(`field-table`/`code-field`/`backtick`) 모두 vacuity floor 로 "조용히 0건" 회귀를 잡는다. 실제 실행 결과 세 축 모두 임계값을 넘는다(18/18 통과로 확인).
- `readIfPresent`(존재하지 않는 `.env.example` 방어), `basis = sourceTokens ∪ envTokens ∪ allowed`(허용목록 우회 로직) 등 null/빈 컬렉션 방어가 적절하다.
- `GUIDE_EXTERNAL_VOCABULARY` 허용목록의 4강제(외부 시스템명 필수·상한 5·인용 유지·기준집합 비포함)가 각각 독립 테스트로 고정돼 있어 허용목록이 은폐 수단으로 변질되는 것을 구조적으로 막는다 — 요구사항(비즈니스 로직)과 구현이 정확히 일치한다.
- `#1328` 과거 결함(환경변수 오기) 재현 테스트 3갈래(오기 포착/정정 통과/구축-당시 축이었다면 놓쳤을 것)가 실제 소스 상태(`MCP_ALLOW_INSECURE_URL` 실재, `MCP_INSECURE_URL_ALLOWED` 부재)와 정확히 부합함을 grep 으로 직접 확인했다 — plan 의 실측 주장이 사실과 일치한다.
- TODO/FIXME/HACK/XXX 주석 없음.
- 함수 시그니처·반환 타입(`Set<string>`, `IdentifierCitation[]`) 모든 경로에서 값을 반환하며 누락된 경로 없음.

## 요약

기능적으로는 완결돼 있다 — 새 가드(`guide-identifier-existence`/`guide-identifier-scan`)는 자신이 대체하는 옛 가드(`guide-error-code-*`, 완전 삭제 확인)가 놓쳤던 등재 근거 결함(`#1328` env 오기)을 실제로 포착하고, 정정된 이름은 통과시키며, vacuity floor·허용목록 4강제·과거 결함 재현 테스트가 전부 실측된 임계값과 일치해 18/18·(형제 포함) 3315/3315 GREEN 으로 확인됐다. 실제 결함은 리네임 스윕에서 누락된 `guide-sanitized-message-parity.test.ts:16` 의 present-tense 상호참조 1건(WARNING, developer 스코프 안, 즉시 고치기 쉬움)이며, spec fidelity 관점의 §2 "3건→5건" 갭은 실재하지만 이미 3개 checker·plan tracker·plan blockquote 세 겹으로 정확히 추적되고 있는 선재 갭이라 이번 리뷰가 새로 등재할 필요는 없다(4번째 독립 확인으로만 기록). 두 발견 모두 기능 자체를 깨뜨리지 않는 문서/등재 정합성 문제다.

## 위험도

LOW
