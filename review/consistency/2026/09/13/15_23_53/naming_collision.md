# 신규 식별자 충돌 검토 — naming_collision

## 전제 재확인

- 검토 scope `spec/conventions/` 의 `origin/main` 대비 델타는 **0개 파일**이다. 즉 이 PR 은
  spec 을 바꾸지 않는다 — 요구사항 ID·엔티티/DTO·API endpoint·이벤트명 등 spec 이 선언하는
  종류의 신규 식별자는 **애초에 없다**.
- 실제 구현 diff(5파일/930줄)는 `codebase/frontend/src/lib/docs/__tests__/` 아래 build-time
  가드 테스트/스캐너의 **리네임 + 축 확장**이다: `guide-error-code-existence.test.ts` +
  `guide-error-code-scan.ts` (삭제) → `guide-identifier-existence.test.ts` +
  `guide-identifier-scan.ts` (신규), `guide-sanitized-message-parity.test.ts` (주석 1곳
  갱신), `PROJECT.md`/`CHANGELOG.md` 가드 카탈로그 문구 동기화.
- 이 PR 은 harness 코드(가이드 실재성 가드)를 다루므로, 본 검토는 그 신규 식별자
  (함수명·타입명·상수명·파일 경로)가 기존 사용처와 충돌하는지를 본다.

## 확인한 신규 식별자와 충돌 조사 결과

다음 식별자를 `codebase/` 전역에서 grep 하여 두 신규 파일 밖의 사용처가 있는지 확인했다
(전부 0건 — 충돌 없음):

- 타입 `CitationAxis`(값 `"field-table" | "code-field" | "backtick"`), `IdentifierCitation`
- 함수 `scanIdentifierCitations`, `collectSourceTokens`, `collectEnvDeclarations`
- 상수 `GUIDE_EXTERNAL_VOCABULARY`, `EXTERNAL_VOCABULARY_CAP`(테스트 파일 로컬 const)

또한 `"backtick"` 문자열 리터럴이 다른 axis enum 등에서 다른 의미로 쓰이는지도 grep 했으며
0건이었다.

## 발견사항

### [INFO] 파일 리네임은 기존 컨벤션과 정합, 충돌 없음

- target 신규 식별자: 파일 경로 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` · `.../guide-identifier-scan.ts`
- 기존 사용처: 없음 (동일 디렉터리의 `plan-scan.ts`/`plan-scan.test.ts`, `spec-links.ts`/`spec-links.test.ts`, `spec-frontmatter-parse.ts`/`.test.ts`, `tree-walk.ts`/`.test.ts` 와 같은 "순수 스캐너 `.ts` + 테스트 `.test.ts`" 명명 패턴)
- 상세: 신규 파일명은 기존 디렉터리의 명명 관례를 그대로 따른다. 옛 이름(`guide-error-code-*`)을 참조하던 `PROJECT.md`·`CHANGELOG.md`·`plan/in-progress/`·`plan/complete/guide-error-code-truth.md`(역사 기록, 각주로 리네임 명시)까지 확인했고, `spec/**` 안에는애초에 이 두 옛 파일명을 문자 그대로 인용한 곳이 없어 깨지는 참조도 없다.
- 제안: 없음 (조치 불요).

### [INFO] 허용목록 상수명 `GUIDE_EXTERNAL_VOCABULARY` — 무관 도메인 `KNOWN_*` 접두와 의도적으로 분리, 충돌 없음

- target 신규 식별자: `GUIDE_EXTERNAL_VOCABULARY` (배열 상수, `guide-identifier-scan.ts`)
- 기존 사용처: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-docs-drift.spec.ts:72` 의 `KNOWN_DOCS_ABSENT` (전혀 다른 도메인 — cafe24 카탈로그 vs docs drift allowlist)
- 상세: 두 상수는 이름도 다르고(`GUIDE_EXTERNAL_VOCABULARY` vs `KNOWN_DOCS_ABSENT`) 의미도 다르다(외부 어휘 허용목록 vs 카탈로그-문서 drift 예외 목록). 실제로 이 PR 의 plan(`plan/in-progress/guide-identifier-existence.md` §명명 표)이 impl-prep naming_collision INFO 를 받아 **`KNOWN_*` 접두를 공유하지 않도록 의도적으로 `GUIDE_EXTERNAL_VOCABULARY` 를 채택**했다고 명시하고 있다 — 즉 이 조사 관점은 이미 impl-prep 단계에서 한 번 걸러졌고, 이번 impl-done 재확인에서도 실제 충돌 0건으로 재확인됐다.
- 제안: 없음 (조치 불요, 기 처리 확인).

### [INFO] (신규 아님, 사전 존재 갭 — 참고용) 가드 2건이 자칭 SoT `user-guide-evidence.md §2` 표에 미등재

- target 신규 식별자: 해당 없음 — `guide-identifier-existence.test.ts` 자체는 신규지만, "SoT: `spec/conventions/user-guide-evidence.md §2`" 라는 귀속 문구는 `#1330`(전신 `guide-error-code-existence.test.ts`) 때부터 있었고 이번 PR 은 그 문구를 새 파일명으로 그대로 옮겼을 뿐이다.
- 기존 사용처: `spec/conventions/user-guide-evidence.md §2` 의 "Build-time 가드 (3건)" 표는 `impl-anchor-existence.test.ts` · `integrations-coverage.test.ts` · `triggers-coverage.test.ts` 3건만 나열하고, `guide-identifier-existence.test.ts`/`guide-sanitized-message-parity.test.ts` 는 나오지 않는다.
- 상세: 엄밀히는 "충돌"이 아니라 "SoT 표가 자신을 참조하는 코드의 존재를 반영하지 못하는" 정합성 갭이다. 이번 PR 이 새로 만든 것이 아니라 확대(리네임)만 했고, `plan/in-progress/guide-identifier-existence.md` §D #1이 이미 이 갭을 인지해 "`#1330` 이 이미 planner 등재했다"고 명시적으로 후속 planner 턴에 위임해 두었다(developer 권한 밖 — `spec/conventions/user-guide-evidence.md` 쓰기는 project-planner 소관).
- 제안: 신규 조치 불요 — 이미 planner 트래커에 등재된 항목이므로 본 검토에서 별도 CRITICAL/WARNING 승격 없이 참고 기록만 남긴다.

## 요약

이 PR 은 `spec/conventions/` 를 전혀 수정하지 않으며(델타 0), 실제 변경은 유저 가이드
식별자 실재성 build-time 가드의 리네임(`guide-error-code-*` → `guide-identifier-*`)과 축
확장(에러 코드 전용 → 에러 코드+환경변수)이다. 새로 도입된 함수명·타입명·상수명·파일 경로를
codebase 전역에서 조사했으나 기존 사용처와의 충돌은 0건이었고, 파일명은 디렉터리의 기존
"스캐너+테스트" 명명 관례를 그대로 따른다. 유일하게 발견한 잠재 혼동 지점(`GUIDE_EXTERNAL_VOCABULARY`
vs 무관 도메인의 `KNOWN_DOCS_ABSENT`)은 이 PR 의 plan 자체가 impl-prep 단계에서 이미 명명
충돌을 검토해 회피한 결과였고, 재확인 결과도 충돌 없음이다. 발견한 유일한 정합성 갭(가드
2건이 자칭 SoT 표에 미등재)은 이번 PR 이 새로 만든 문제가 아니라 전신 PR(`#1330`)부터 있던
것이며 이미 planner 트래커에 위임돼 있어 본 검토의 신규 CRITICAL/WARNING 대상이 아니다.

## 위험도

NONE
