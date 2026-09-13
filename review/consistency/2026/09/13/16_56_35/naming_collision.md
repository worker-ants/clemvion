# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위

- target: `spec/conventions/` — scope 델타 **0개 파일**(이 브랜치는 `spec/` 을 전혀 바꾸지 않는다. 정상 — 코드 전용 harness PR).
- 실제 변경(코드 diff, 5파일/1112줄): `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` +
  `guide-error-code-scan.ts` (삭제) → `guide-identifier-existence.test.ts` + `guide-identifier-scan.ts` (신규)로
  완전 교체. 유저 가이드가 인용하는 UPPER_SNAKE 식별자(에러 코드 + 환경변수) 실재성 가드를 에러 코드 전용에서
  식별자 전반으로 일반화. `guide-sanitized-message-parity.test.ts` 는 자매 파일명 인용 각주만 갱신(4줄).
  `CHANGELOG.md`·`PROJECT.md`·`plan/in-progress/guide-identifier-existence.md`(신규)·
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 항목 해소 기록) 동반 갱신.
- 판정은 워킹트리 HEAD(`git show`/`grep`, cwd 내 상대경로)를 1차 근거로 삼았다. 이 세션은 이미 해당 워킹트리
  안에서 실행되고 있어 CWD-분리 문제는 해당하지 않는다(실측: `git log --oneline origin/main..HEAD` 로 라운드
  1~6 커밋을 직접 확인).
- 직전 라운드 `review/consistency/2026/09/13/16_28_53/naming_collision.md` 가 같은 5파일 diff 를 이미 NONE 으로
  판정했다. 그 이후 커밋(`171627852`)은 이미 `origin/main` 에 병합돼 있고 `.claude/tools/run-test-all.sh` 관련이라
  본 target 과 무관함을 `git show --stat` 으로 확인했다 — 이번 라운드의 diff 는 직전 라운드와 동일 범위다.

## 점검한 신규 식별자와 결과

| 신규 식별자 | 종류 | 충돌 검색 결과 |
|---|---|---|
| `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` | 파일 경로 | `codebase/frontend/src/lib/docs/__tests__/` 내 기존 `<subject>-existence.test.ts` + `<subject>-scan.ts` 명명 컨벤션(`impl-anchor-existence.test.ts`/`impl-anchor-parse.ts` 등)과 일치. 동명 파일 없음(`find`/`grep` 전수 확인). 삭제된 `guide-error-code-*` 두 파일과 경로 중복 없음(완전 교체이지 공존 아님) |
| `CitationAxis` (`"field-table"\|"code-field"\|"backtick"`) | export 타입명 | 저장소 전체에서 신규 파일 밖 사용처 없음(`grep -rn "CitationAxis" codebase --include="*.ts"` → 신규 파일 2개 외 0건). 옛 리터럴 유니온의 `"prose"` 는 `"backtick"` 로 교체됐고 옛 파일은 삭제돼 공존하지 않는다 |
| `IdentifierCitation`, `scanIdentifierCitations`, `collectSourceTokens`, `collectEnvDeclarations` | export 함수/인터페이스명 | 전수 grep 결과 신규 파일과 그 import/사용 지점(테스트) 외 사용처 없음. `impl-anchor-parse.ts`·`spec-links.ts` 등 이웃 스캐너 모듈의 export 명과도 겹치지 않음 |
| `GUIDE_EXTERNAL_VOCABULARY` (const, `{token, system, why}[]`) | export 상수명 | 저장소 전체에서 신규 파일·해당 테스트·`CHANGELOG.md` 서술 외 사용처 없음. 다른 allowlist 상수(`ALLOWED_*`, 등)와 이름 겹침 없음 |
| `MESSAGE_CREATE` (`GUIDE_EXTERNAL_VOCABULARY` 유일 항목, Discord Gateway 이벤트) | 외부 어휘 토큰 | `codebase/backend/src`·`codebase/packages` 전수 grep 0건 — "우리 것이 아님" 을 보장하는 테스트(`각 항목이 기준집합에 없다`)와 실측이 일치. 내부 식별자와 의미 충돌 없음 |
| `MCP_ALLOW_INSECURE_URL` (테스트 주석·fixture 내 인용) | 환경변수 | `codebase/backend/.env.example:331`·`mcp.config.ts`·`production-guards.ts` 의 **실재하는** 기존 변수와 일치(신규 도입 아님, 정정 사례를 fixture 로 재현) |
| `MCP_INSECURE_URL_ALLOWED` (테스트 fixture 내 인용) | 환경변수 | 저장소 전체에 실재하지 않음 — "부재해야 정상"인 과거 오탈자 반례로 인용. 신규 식별자 도입이 아니다 |
| `#1331` (plan/PR 번호 각주, 7~10곳) | 트래커 라벨 | `plan/in-progress/guide-identifier-existence.md` 자체가 "push 전 실제 PR 번호로 치환 필요"를 명시적으로 등재해 자기-추적 중인 **알려진 placeholder** 다. 기존에 다른 의미로 쓰인 PR #1331 은 없음(아직 미할당 번호에 대한 전방 참조이지, 이미 존재하는 다른 항목과의 의미 충돌이 아니다). naming_collision 관점의 신규 CRITICAL/WARNING 사유는 아니라고 판단 — 이미 항목화된 사후 처리 사안 |

## 발견사항

없음. 이 PR 이 새로 도입한 파일명·타입명·함수명·상수명·외부 어휘 항목 중 기존 사용처와 의미가 다르게 겹치는
것을 찾지 못했다. 삭제되는 `guide-error-code-*` 파일에 대한 살아있는(present-tense) 참조는 코드·
`PROJECT.md`·`CHANGELOG.md`·`spec/conventions/user-guide-evidence.md` 어디에도 남아있지 않다 — 남은 3건
(`guide-identifier-scan.ts` 상단 주석, `guide-sanitized-message-parity.test.ts:16`, `CHANGELOG.md` 각주)은
전부 `#1330`/`#1331` 라벨이 붙은 의도적 역사 서술이다. `plan/complete/guide-error-code-truth.md` 에 옛
파일명이 남은 것도 완료 이력 문서의 정상 스냅샷이라 충돌이 아니다.

## 참고 (충돌은 아니나 인접 관찰)

- `spec/conventions/user-guide-evidence.md §2` 가드 가족 표에 신규 가드(`guide-identifier-existence` 계열
  파일명·`GUIDE_EXTERNAL_VOCABULARY` 허용목록)가 아직 등재되지 않은 SoT 지연이 있다 — 이는 이미
  `plan/in-progress/guide-identifier-existence.md` §D 에 developer 권한 밖 planner 항목으로 명시돼 있고,
  직전 라운드(`convention_compliance` `16_28_53`)의 별도 관점에서 다뤄지는 사안이다. naming_collision 관점의
  "충돌"(동일 식별자, 다른 의미)이 아니라 "미등재"이므로 본 checker 범위 밖으로 판단했다.

## 요약

target scope(`spec/conventions/`)에 대한 실변경은 이번에도 0건이며, 이 PR 의 실질 변경은 harness 테스트 파일
두 쌍의 교체(에러 코드 전용 가드 → 식별자 전반 가드 일반화, 리뷰 라운드 1~6 의 fix 누적)다. 신규 도입된 파일
경로·타입명·함수명·상수명·외부 어휘 항목·환경변수 인용을 저장소 전수 grep 으로 대조한 결과 기존 사용처와
의미가 다르게 겹치는 사례는 없고, 옛 `guide-error-code-*` 식별자에 대한 댕글링(비-각주) 참조도 없다. 파일
명명은 같은 디렉터리의 기존 `<subject>-existence.test.ts` + `<subject>-scan.ts` 컨벤션을 그대로 따른다.
직전 라운드의 NONE 판정과 결론이 일치한다.

## 위험도

NONE
