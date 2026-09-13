# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 신규 `BACKTICK` 축이 "모든 백틱 UPPER_SNAKE 를 잡는다"는 설계 주장과 달리 **백틱 스팬 전체가 정확히 토큰 하나뿐일 때만** 매치되어, 실제 가이드 코퍼스에 반복 등장하는 `` `413 CODE` ``·`` `CODE=값` ``·`` `code='CODE'` `` 형태의 인용을 통째로 놓친다(requirement reviewer 실측, CRITICAL). 오늘 당장 거짓 PASS 는 아니지만(해당 토큰들이 현재는 실재함), 이 가드가 존재하는 이유(가이드 오탈자 검출)를 정확히 무력화하는 흔한 패턴이라 조치가 필요하다. 그 외 강제 화이트리스트(7명) 전원이 정상 실행·결과 확보되어 라우터 미이행은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `BACKTICK` 정규식이 백틱 스팬 **전체**가 토큰 단독일 때만 매치 — `` `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE` ``, `` `PARALLEL_ENGINE=v1` ``, `` `details.code='UNKNOWN_PLACEHOLDER'` `` 등 실제 코퍼스에 반복되는 정형 인용 패턴을 전부 미탐지(직접 실행으로 확인). `UNKNOWN_PLACEHOLDER`·`MAKESHOP_UNRESOLVED_PATH_PARAM`·`PARALLEL_ENGINE`·`ALLOW_HTTP_HOOKS`·`INVALID_FIELD` 5개 토큰은 코퍼스 전체에 순수-백틱 인용이 전혀 없어 이 가드의 검사 대상에서 완전히 빠져 있음. 가드 자신이 예시로 드는 과거 결함(`MAKESHOP_UNRESOLVED_PATH_PARAM`)에 대한 JSDoc 설명("existence≠emission")도 실측과 다름(실은 citation 자체가 미탐지) | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`BACKTICK` 정규식 정의부, 상단 "정규식 경계 — 전수 감사" 표) | 백틱 스팬 전체 일치가 아니라 스팬 **내부** 부분 매치로 변경(예: 백틱 쌍 분리 후 내부에서 `\b(${UPPER_SNAKE})\b` 재검색). 실측한 4개 실패 패턴(`413 X`, `X=1`, `code='X'`, `X: 설명문`)을 판별 fixture 로 추가하고 `MAKESHOP_UNRESOLVED_PATH_PARAM` JSDoc 설명을 "citation 미탐지"로 정정 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / testing | `FIELD_TABLE_NAME` 축이 `name` 이 객체 리터럴의 **첫 속성**일 때만 매치(순서 의존) — `{ type: "x", name: "CODE" }` 형태는 같은 줄이어도 놓침(fail-open). 오늘 코퍼스 242개 `<FieldTable>` 행 전부 첫 속성이라 관측되지 않음(실측). 문서화된 "줄 단위" 한계와 다른 축이라 전수 감사 표에도 없음 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:125` (`FIELD_TABLE_NAME` 정규식) | JSDoc 에 "name 이 그 줄의 `{` 바로 뒤 첫 키여야 한다" 가정 명시, 또는 `\{[^}]*?\bname:\s*"(${UPPER_SNAKE})"` 로 완화 |
| 2 | testing | `GUIDE_EXTERNAL_VOCABULARY` "4강제" 중 상한 검사를 제외한 나머지 3개가 배열이 **비면 전부 vacuous 하게 통과** — 직접 뮤테이션(배열을 `[]`로 비움)으로 확인. 오늘 이 뮤테이션이 그래도 잡히는 것은 이 describe 블록 덕분이 아니라 무관한 베이스라인-0 테스트(`discord.mdx` 의 `MESSAGE_CREATE` 인용)가 우연히 잡아준 것 — 코퍼스가 바뀌면 안전망도 사라짐 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:131-157` (대상 배열: `guide-identifier-scan.ts:175-185`) | `expect(GUIDE_EXTERNAL_VOCABULARY.length).toBeGreaterThan(0)` 류 명시적 하한 floor 추가 |
| 3 | documentation | plan 체크리스트의 자기참조 카운트(`grep -rn '#1331' plan/` "10곳", "이 파일의 3곳") 가 실측(11곳, 이 파일 자신 4곳)과 어긋남 — 노트가 자기참조적이라 문장을 추가할수록 카운트가 늘어나는 구조적 문제. 실제 치환 지시("`spec-draft-nullable-notation-followups.md` 의 7곳만") 자체는 여전히 정확 | `plan/in-progress/guide-identifier-existence.md:274` (268·276·314행도 관련) | 실측대로 "11곳(이 파일 자신의 4곳 포함)"으로 갱신하거나, 자기참조적 보조 진술을 빼고 핵심 지시 문장만 남김 |
| 4 | **SPEC-DRIFT** | [SPEC-DRIFT] `spec/conventions/user-guide-evidence.md §2` "Build-time 가드 (3건)" 표가 신설된 4번째 가드(`guide-identifier-existence.test.ts`)를 여전히 미등재 — 코드가 틀린 게 아니라 spec 갱신이 밀려 있는 상태. `developer` 권한 밖(`spec/` 직접 수정 불가)이며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`·`guide-identifier-existence.md §D`·다수 라운드 `--impl-prep`(`review/consistency/2026/09/13/12_33_41`, `16_28_53`)를 통해 반복 확인·등재된 선재 갭(플랜 문서 자체가 "통산 8회 확인"이라 기록) | `spec/conventions/user-guide-evidence.md:68-76` (§2 표) | 코드 변경 불필요. planner 턴에서 §2 표·§2.1 관계표·frontmatter `code:` 목록·Rationale 을 한 번에 갱신 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | 공유 트래커에 이번 작업과 무관한 새 백로그 항목 1건 추가(`cafe24-api-metadata.md §4` spec 오인용) — `developer` 가 spec 을 직접 못 고쳐 관례대로 즉시 등재, 투명하게 처리됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3406` | 조치 불요 |
| 2 | scope | 같은 트래커에 이번 PR 자신이 발견한 코드 결함(`lastIndex` 리셋 보일러플레이트 4곳 복제) 등재 — 스코프 절제로 미룸 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3416` | 조치 불요 |
| 3 | scope | 가드 파일 교체가 `git mv` 대신 delete+create 로 이뤄져 이력이 끊김(`--find-renames`로도 재인식 안 됨) — 6라운드에 걸쳐 이미 수용된 사항 | `guide-error-code-*` → `guide-identifier-*` | 조치 불요. 향후 유사 재설계 시 `git mv` 후 편집 분리 고려 |
| 4 | scope | `review/code/**`·`review/consistency/**` 산출물 126개가 함께 커밋 — 이 PR 의 6라운드 review-fix 사이클 정상 산출물 | `review/code/2026/09/13/**`, `review/consistency/2026/09/13/**` | 조치 불요 |
| 5 | side_effect | 모듈 스코프 `g`-정규식 5개가 `lastIndex` 라는 은닉 가변 상태를 공유(리셋 관례로 현재 안전, 향후 호출부 추가 시 리셋 누락 위험) | `guide-identifier-scan.ts` (`FIELD_TABLE_NAME`·`CODE_FIELD`·`BACKTICK`·`envLine`·`composeLine`) | 조치 불요. 재사용 호출부 추가 시 리셋 관례 유지 안내 |
| 6 | side_effect | 파일시스템 접근 전부 읽기 전용, 삭제 모듈 죽은 참조 없음, 신규 export 의 유일한 소비자가 같은 diff 안에 있어 하위 호환 영향 없음 | `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 전체 | 조치 불요 |
| 7 | maintainability | 설계 근거("과매치는 fail-closed") 프로즈가 전수감사 표·JSDoc·테스트 주석 3곳에 복제 — 형제 가드 파일들의 기존 관례 연장 | `guide-identifier-scan.ts:92,141-156`, `guide-identifier-existence.test.ts:370-379` | 조치 불요. 향후 정리 시 설계 근거를 한 곳(JSDoc)에 모으는 것 고려 |
| 8 | maintainability | 허용목록 테스트 임계값(`2`, `20`)에 다른 수치 단언들과 달리 실측 근거 주석 없음 | `guide-identifier-existence.test.ts:132-136` | 짧은 근거 주석 또는 이름 붙은 상수로 통일 |
| 9 | maintainability | 소스 파일이 구현 로직보다 많은 서술형 주석(과거 리뷰 라운드 경로 포함)을 담음 — 재발 방지 관례로 의도된 트레이드오프 | `guide-identifier-scan.ts:1-100` | 조치 불요(의도됨). 4번째 축 추가 또는 허용목록 상한 근접 시 파일 분리 고려 |
| 10 | documentation | 핵심 소스 변경의 문서화 수준이 매우 높음 — 설계 근거·반증 이력·한계 절이 JSDoc 에 모두 있고 CHANGELOG/PROJECT.md 와 정확히 일치, 자매 파일 상호참조도 최신 | `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`, `CHANGELOG.md`, `PROJECT.md` | 조치 불요 |
| 11 | security | 인젝션·시크릿·인증·입력검증·OWASP·암호화·의존성 전 항목 해당 없음 — 저장소 내 신뢰된 파일만 동기 읽기하는 순수 정적 스캐너 | `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | `BACKTICK` 축 스팬-전체-일치로 인한 미탐지(CRITICAL), `FIELD_TABLE_NAME` 순서 의존(WARNING), user-guide-evidence.md §2 SPEC-DRIFT |
| testing | LOW | `GUIDE_EXTERNAL_VOCABULARY` 4강제 중 3개 vacuous(WARNING), `FIELD_TABLE_NAME` 순서 의존 재확인(INFO), 그 외 6라운드 처분 유효 재검증 |
| documentation | LOW | plan 체크리스트 자기참조 카운트 불일치(WARNING), 나머지 문서화 수준 우수 |
| scope | LOW | 실 코드 변경 5개 파일로 스코프 수렴, 백로그 등재 2건 모두 관례 준수 |
| side_effect | NONE | 읽기 전용 I/O, `lastIndex` 공유 상태는 현재 안전 |
| maintainability | NONE | 설계 근거 3중 복제·매직넘버 근거 누락 등 경미한 INFO만 |
| security | NONE | 신규 보안 표면 없음 |

## 발견 없는 에이전트

- security (INFO 수준 확인 근거만 기록, 실질 발견 없음)
- side_effect (INFO 수준 관찰만, 실질 결함 없음)
- maintainability (INFO 수준 관찰만, 실질 결함 없음)

## 권장 조치사항

1. `BACKTICK` 정규식을 스팬 전체 일치가 아니라 스팬 내부 부분 매치로 수정하고, 실측한 4개 실패 패턴(`413 X`, `X=1`, `code='X'`, `X: 설명문`)을 판별 fixture 로 추가한다(CRITICAL, requirement).
2. `GUIDE_EXTERNAL_VOCABULARY` 배열에 명시적 하한(`length > 0`) 단언을 추가해 "4강제" 테스트가 실제로 4개 모두를 강제하도록 한다(WARNING, testing).
3. `FIELD_TABLE_NAME` 정규식의 `name`-첫속성 의존을 JSDoc 에 명시하거나 순서 무관하게 완화한다(WARNING, requirement/testing).
4. `plan/in-progress/guide-identifier-existence.md:274` 의 자기참조 카운트를 실측(11곳)으로 갱신하거나 자기참조 보조 진술을 제거한다(WARNING, documentation).
5. `spec/conventions/user-guide-evidence.md §2` 4번째 가드 미등재는 다음 planner 턴에서 갱신(SPEC-DRIFT, developer 권한 밖 — 이미 백로그 등재 완료, 재등재 불필요).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원) — forced 전원 결과 확보됨. 강제 화이트리스트 미이행 없음.
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff(테스트 전용 정적 스캐너, 런타임 요청 경로 없음) 스코프 밖 |
  | architecture | 라우터 판단 — 신규 아키텍처 레이어/서비스 경계 변경 없음 |
  | dependency | 라우터 판단 — package.json/lockfile 변경 없음 |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판단 — 단일 스레드 동기 실행, 동시성 표면 없음 |
  | api_contract | 라우터 판단 — API 엔드포인트/계약 변경 없음 |
  | user_guide_sync | 라우터 판단 — 가이드 문서(MDX) 본문 변경 없음(가드 코드만 변경) |