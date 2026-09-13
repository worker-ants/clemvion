# 요구사항(Requirement) 리뷰 — guide-identifier-existence (follow-up round, `#1331` 리뷰 라운드1 반영 후)

## 검증 방법

프롬프트 diff(2510줄, 다수는 이전 라운드 `14_41_14`/`12_33_41` 산출물 재수록)를 읽은 뒤 워크트리 원본 파일을 직접 열람·실행해 교차검증했다. 저장소는 뮤테이션하지 않음 — 세션 시작·종료 시점 `git status --short` 모두 리뷰 산출물 디렉터리(`review/code/2026/09/13/15_03_06/`, `review/consistency/2026/09/13/15_03_36/`)만 untracked 로 남아 있어 이 세션이 만든 파일 외 변경 없음을 확인.

- `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts` → **19/19 통과**
- `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/` (형제 가드 전체) → **23 files / 3316 tests 통과**
- `grep -rn "guide-error-code" codebase/` → 남은 참조 2곳 모두 `#1330`/`#1331` 각주가 붙은 **역사 서술**(`guide-identifier-scan.ts:9`, `guide-sanitized-message-parity.test.ts:16`)이며 살아있는(present-tense) 댕글링 참조 0건 — **이전 라운드(`14_41_14`) documentation/architecture/maintainability/side_effect/requirement 5개 reviewer 가 수렴 지적한 WARNING 이 실제로 고쳐졌음을 직접 확인**
- `ls codebase/frontend/src/lib/docs/__tests__/guide-error-code*` → 파일 없음(완전 삭제 확인)
- `guide-identifier-existence.test.ts:53-56` 의 `composeTexts` 필터를 `node -e` 로 재현 → `docker-compose.yml`·`docker-compose.e2e.yml` 2건만 걸리고 `pnpm-lock.yaml`(784KB)·`pnpm-workspace.yaml` 은 제외됨을 실측 확인 — WARNING(`composeTexts` 과다 수집) 실제로 좁혀짐
- `grep -n "MCP_ALLOW_INSECURE_URL\|MCP_INSECURE_URL_ALLOWED" codebase/backend/src` → 정정된 이름만 실재, 과거 오탈자는 부재 — 회귀 fixture 의 사실관계 일치
- `grep -n "EXECUTION_TIMEOUT" .../discord.en.mdx`, `grep -n "MCP_ALLOW_INSECURE_URL" .../mcp-servers.mdx` → 새로 복원된 "실제 코퍼스의 특정 파일·토큰을 이름으로 고정한다" 테스트(`guide-identifier-existence.test.ts:95-107`)가 주장하는 실제 파일·토큰이 그대로 존재함을 확인 — testing WARNING#6(합성 fixture만 남고 실제 코퍼스 명명 회귀가 사라짐) 실제로 해소됨
- `guide-identifier-scan.ts:53-76` — 삭제됐던 "존재 검사 ≠ 방출 검사" 한계 절 + "이 주석을 지우지 말 것" 문구가 env 축까지 일반화되어 복원돼 있고, 그 위에 **재발 경위 자체를 기록한 blockquote**(72-76행)까지 추가됨을 직접 확인 — documentation WARNING#2 해소
- `CHANGELOG.md:66-81` — 파일명(`guide-identifier-existence`)·허용목록 4강제·"두 PR 에 걸쳐 두 번 바뀌었다" 경위가 모두 반영됨을 확인 — documentation WARNING#3 해소
- `spec/conventions/user-guide-evidence.md` §2 — `grep -n "guide-error-code\|guide-identifier"` 0건, 헤더는 여전히 "Build-time 가드 (3건)". `plan/in-progress/spec-draft-nullable-notation-followups.md:3247` 에 `- [ ]` 미해결 planner 항목으로 등재돼 있음을 확인(내용은 §2.1 관계표 신규 2건 + `code:` frontmatter 3파일 누락 — 실제로는 가드 3건이 아니라 5건)

## 발견사항

- **[INFO] `[SPEC-DRIFT]` `user-guide-evidence.md §2` 가 "가드 3건"으로 세는데 실제로는 5건이다 — 이미 추적 중인 선재 갭, 이번 PR 이 새로 만든 결함 아님**
  - 위치: `spec/conventions/user-guide-evidence.md:68`(`## 2. Build-time 가드 (3건)` 표), `:1-14`(frontmatter `code:` 목록)
  - 상세: `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`/`guide-sanitized-message-parity.test.ts` 세 파일 모두 JSDoc/헤더 주석에서 이 문서를 SoT 로 자칭하지만(`guide-identifier-scan.ts:4`, `guide-identifier-existence.test.ts:25`), 문서 §2 표에도 frontmatter `code:` 목록에도 세 파일이 없다. 코드 구현 자체는 실측(뮤테이션 7건, 과거 결함 재현 3갈래, 축별 대조군)에 근거해 견고하고, **이것은 코드가 틀린 게 아니라 spec 갱신이 코드를 못 따라간 SPEC-DRIFT** 다. 다만 이는 (1) `#1330` 시점부터 있던 갭이고, (2) `--impl-prep`(`review/consistency/2026/09/13/12_33_41`)에서 cross_spec·rationale_continuity·plan_coherence 3개 checker 가 독립 수렴 지적했으며, (3) 이전 `/ai-review`(`14_41_14`) requirement reviewer 도 4번째로 같은 결론에 도달했고, (4) `plan/in-progress/spec-draft-nullable-notation-followups.md:3247` 에 `- [ ]` planner 미해결 항목으로 명시 등재돼 있다(§2.1 관계표 신규 2건 + `code:` 3파일 누락, "3건→5건"). `plan/in-progress/guide-identifier-existence.md` 상단 blockquote 도 "developer 권한 밖 → planner 항목" 이라고 명시한다. `developer` 는 `spec/` 쓰기 권한이 없고 자기-반증형 소정정 예외에도 해당하지 않는다(§2 표는 developer 가 쓴 예고 문장이 아니라 제품 카탈로그).
  - 제안: 코드 유지 + `project-planner` 턴에서 `spec/conventions/user-guide-evidence.md` §2 표제("3건"→"5건") 및 표 2행(`guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`) 추가 + frontmatter `code:` 목록 갱신(3파일: `guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`). 이미 등재돼 있으므로 이 리뷰는 새 조치를 요구하지 않으며 5번째 독립 확인으로만 기록한다.

- **[INFO] 이전 라운드(`14_41_14`) WARNING 6건이 이번 커밋(`69847f45f`)에서 실제로 해소됐음을 코드 레벨로 직접 검증 — 새 결함 아님, 회귀 방지 기록**
  - 위치: `guide-sanitized-message-parity.test.ts:16`(sibling 참조), `guide-identifier-existence.test.ts:48-56`(compose 필터), `guide-identifier-scan.ts:53-76`(한계 주석 복원), `CHANGELOG.md:66-81`, `guide-identifier-existence.test.ts:95-107`(실코퍼스 명명 회귀)
  - 상세: 위 "검증 방법" 절에서 항목별로 실측했다. 6건 중 5건(문서 상호참조·compose 스코프·한계 주석·CHANGELOG·테스트 명명 회귀)이 소스 레벨에서 그대로 확인됐다. 나머지 1건(§2 SoT 미등재)은 위 SPEC-DRIFT 항목으로 별도 유지.
  - 제안: 조치 불요.

- **[INFO] 존재 검사 ≠ 방출 검사 한계는 이번 축(백틱 전수 + env)에서도 그대로 유지되며 코드·문서 양쪽에 투명하게 disclose 됨**
  - 위치: `guide-identifier-scan.ts:53-76`, `PROJECT.md:300`
  - 상세: `collectSourceTokens`/`collectEnvDeclarations` 는 "토큰이 텍스트로 존재하는가"만 보고 실제 `output.error.code` 방출 여부나 `process.env` 실제 read 여부는 보지 않는다. 실측 사례(`MAKESHOP_UNRESOLVED_PATH_PARAM`)까지 포함해 코드·`PROJECT.md` 카탈로그 양쪽이 명시적으로 disclose 하고 있고, 사용자 가이드 본문(`integrations.mdx:306`)도 "코드가 아니라 메시지를 봐야 해요" 라고 이 한계를 직접 반영해 사용자에게도 정확히 전달된다(grep 으로 실측 확인). 회색지대이며 이미 투명하므로 조치 불요.

## 기능/엣지케이스/반환값 점검 요약

- 세 축(`field-table`/`code-field`/`backtick`) + env 병합 floor 모두 vacuity floor 로 "조용히 0건" 회귀를 잡는다. 실제 실행 결과 19/19 통과로 확인.
- `readIfPresent`(존재하지 않는 `.env.example` 방어), `basis = sourceTokens ∪ envTokens`, `allowed`(허용목록 우회 로직) 등 null/빈 컬렉션 방어가 적절하다.
- `GUIDE_EXTERNAL_VOCABULARY` 허용목록의 4강제(외부 시스템명 필수·상한 5·인용 유지·기준집합 비포함)가 각각 독립 테스트로 고정돼 있어 허용목록이 은폐 수단으로 변질되는 것을 구조적으로 막는다 — 비즈니스 로직과 구현이 정확히 일치한다.
- `#1328` 과거 결함(환경변수 오기) 재현 테스트 3갈래(오기 포착/정정 통과/`#1330` 축이었다면 놓쳤을 것)가 실제 소스 상태(`MCP_ALLOW_INSECURE_URL` 실재, `MCP_INSECURE_URL_ALLOWED` 부재)와 정확히 부합함을 grep 으로 직접 재확인했다.
- "실제 코퍼스의 특정 파일·토큰을 이름으로 고정한다" 테스트가 복원되어, 총량 floor 만으로는 가려질 수 있던 좁은 회귀 형태(문맥으로 좁혀서 특정 형태만 사라지는 것)를 다시 이름으로 고정했다.
- TODO/FIXME/HACK/XXX 주석 없음(`guide-identifier-scan.ts`, `guide-identifier-existence.test.ts` grep 확인).
- 함수 시그니처·반환 타입(`Set<string>`, `IdentifierCitation[]`) 모든 경로에서 값을 반환하며 누락된 경로 없음.

## 요약

이 라운드는 이전 `/ai-review`(`14_41_14`)의 WARNING 6건에 대한 fix-and-re-review 이며, 실측 결과 코드 스코프의 5건(sibling 참조, compose 필터 과다 수집, "지우지 말 것" 한계 주석 소실, CHANGELOG 낡음, 실코퍼스 명명 회귀 소실)이 정확히 고쳐졌고 23 files/3316 tests 로 회귀 없음을 직접 확인했다. 남은 1건(`user-guide-evidence.md §2` 가 가드 3건이 아니라 5건임에도 미갱신)은 `[SPEC-DRIFT]` — spec 이 낡았을 뿐 코드가 틀린 게 아니며, `developer` 권한 밖이라 이미 planner 백로그(`spec-draft-nullable-notation-followups.md:3247`)에 정확히 등재돼 있고 3개 이상의 독립 checker/reviewer 가 이미 같은 결론에 도달한 선재 갭이다. 기능적으로 이 가드는 완결돼 있다 — 자신이 대체한 옛 가드(`guide-error-code-*`)가 놓쳤던 등재 근거 결함(`#1328` env 오기)을 실제로 포착하고, 정정된 이름은 통과시키며, vacuity floor·허용목록 4강제·과거 결함 재현·실코퍼스 명명 회귀가 전부 실측된 임계값과 일치한다. 이번 라운드에서 새로 등재할 CRITICAL/WARNING 급 요구사항 결함은 없다.

## 위험도

LOW — 기능·에러 시나리오·반환값 전부 정상 동작하며 회귀 없음(19/19, 3316/3316 확인). 유일한 미해소 항목은 코드가 아니라 spec 문서 갱신 누락(SPEC-DRIFT)이고, 이미 planner 턴에 정확히 위임돼 있어 이번 코드 변경 자체를 막을 사유가 아니다.
