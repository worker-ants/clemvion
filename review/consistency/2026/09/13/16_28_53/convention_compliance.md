# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 확인

- `spec/conventions/**` 자체의 diff 는 0개 파일 (정상 — 이번 브랜치는 spec 영역을 바꾸지 않았다).
- 실제 구현 diff 는 `codebase/frontend/src/lib/docs/__tests__/` 아래 5개 파일 (`guide-error-code-existence.test.ts` / `guide-error-code-scan.ts` 삭제, `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` 신설, `guide-sanitized-message-parity.test.ts` 참조 갱신) + `PROJECT.md`/`CHANGELOG.md`의 가드 카탈로그 문구 갱신 — HEAD 워킹트리에서 직접 `git diff origin/main...HEAD -- codebase/ PROJECT.md CHANGELOG.md` 로 실측했다.
- 이 diff 는 API 응답/이벤트 페이로드/DTO/Swagger 데코레이터를 건드리지 않는다 — 점검 관점 2(출력 포맷 규약)·4(API 문서 규약)는 해당 표면이 이번 변경에 없어 **N/A**로 처리한다.

## 발견사항

- **[WARNING] SoT 로 자칭한 `user-guide-evidence.md §2` 가 이 가드 계열을 아직 열거하지 않는다 — 단, 이미 추적된 known-deferred 항목**
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 상단 JSDoc ("SoT: `spec/conventions/user-guide-evidence.md` (가드 가족)"), `PROJECT.md` 자동 가드 표의 `guide-identifier-existence.test.ts` 행 ("SoT: `spec/conventions/user-guide-evidence.md §2`"), `CHANGELOG.md` 신규 항목 헤더
  - 위반 규약: `spec/conventions/user-guide-evidence.md §2 "Build-time 가드 (3건)"` — 표는 정확히 `impl-anchor-existence.test.ts` · `integrations-coverage.test.ts` · `triggers-coverage.test.ts` 3건만 열거하고 "(3건)"으로 닫힌 개수를 명시한다. §2.1 "다른 가드와의 관계"도 `registry.test.ts`/`nodes-coverage.test.ts`/`spec-code-paths.test.ts` 와의 관계만 서술하고 이 가드는 언급하지 않는다.
  - 상세: 코드·`PROJECT.md`·`CHANGELOG.md` 는 한목소리로 이 가드(그리고 리네임 전 `guide-error-code-existence.test.ts`)가 `user-guide-evidence.md` "가드 가족"의 형제(자매 `impl-anchor-existence.test.ts` 와 "방향이 같고 표면이 다르다")라고 선언하지만, 그 SoT 문서 자신은 이 4번째 가드의 존재·축(`field-table`/`code-field`/`backtick`)·허용목록(`GUIDE_EXTERNAL_VOCABULARY`)을 전혀 모른다. 이 gap 은 이번 PR 이 새로 만든 것이 아니다 — `#1330` 이 `guide-error-code-existence.test.ts` 를 만들 때부터 있었고(`git log` 로 확인, `user-guide-evidence.md`/`error-codes.md` 어느 쪽 frontmatter `code:` 에도 그 파일이 없었다), 이번 PR(#1331)은 리네임·축 확장(환경변수 포함)·허용목록 도입으로 그 gap 을 **유지한 채 넓혔다**.
  - **이미 추적됨** — `plan/in-progress/guide-identifier-existence.md §D` (`--impl-prep`, `review/consistency/2026/09/13/12_33_41`, 3-checker 수렴)의 지적 #1·#2 가 정확히 이 gap 을 등재하고 있다: "`user-guide-evidence.md` 는 이 가드 가족의 SoT 인데 `#1330` 의 가드 2건도, 이번 축 변경의 근거도 아직 거기 없다. 한 planner 턴에서 표·frontmatter·Rationale 을 함께 처리해야 한다." developer 는 `spec/` 쓰기 권한이 없어(CLAUDE.md §Skill 체계) planner 위임으로 정확히 처리했고, 자기-반증형 소정정 예외("예고 문장"에만 열림) 대상이 아님도 스스로 명시했다.
  - 제안: 새 CRITICAL/WARNING 백로그 항목으로 재등록하지 말 것 — 정당한 프로세스(developer→planner 위임)를 이미 따르고 있다. 다음 planner 턴에서 `user-guide-evidence.md §2` 표에 4번째 행 추가("(3건)"→"(4건)") + §2.1 관계 서술 갱신 + (plan §D#2) "허용목록 없음" 원칙 번복의 근거를 spec Rationale 로 승격하는 것을 한 턴에 묶어 처리할 것을 권고.

- **[INFO] review-citations.md §2 (날짜 포함 인용) — 준수 확인**
  - target 위치: `guide-identifier-existence.test.ts`/`guide-identifier-scan.ts` 전역의 리뷰 인용 (`review/code/2026/09/13/14_41_14`, `15_03_06`, `15_24_12`, `16_04_15`, `review/consistency/2026/09/13/11_33_51` 등)
  - 상세: 신규 diff 안의 모든 리뷰 인용을 `[0-9]{2}_[0-9]{2}_[0-9]{2}` 로 grep 해 전수 확인한 결과, bare `hh_mm_ss` 형태는 0건이고 전부 "전체 경로"(권장 형태, §2 표)를 취한다.
  - 제안: 조치 불요. 규약 준수 확인용 기록.

- **[INFO] 명명 규약 — 파일명·축 라벨 일관성 확인**
  - target 위치: `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` 파일명, `CitationAxis` 값(`field-table`/`code-field`/`backtick`)
  - 상세: 기존 `guide-error-code-*` / `guide-sanitized-message-parity.test.ts` 네이밍 패턴과 일관되고(`guide-<subject>-<verb>` 구조), 축 라벨도 kebab-lowercase 로 일관된다. 라벨 `"prose"` 를 재사용하지 않고 `"backtick"` 으로 새로 명명한 것도(의미 충돌 회피, plan §C "명명" 절에서 실측 근거와 함께 결정) 이 저장소의 "정의를 재사용하면 의미가 흐려진다" 관행과 부합한다.
  - 제안: 조치 불요.

- **[N/A] 출력 포맷 규약 / API 문서 규약**
  - 상세: 이번 diff 는 frontend 빌드타임 가드(테스트+스캐너) 전용이며 API 응답 envelope·이벤트 페이로드·에러 코드 카탈로그·Swagger/DTO 데코레이터 표면을 변경하지 않는다. `spec/conventions/error-codes.md`(명명 규약)·`spec/conventions/node-output.md`(envelope) 어느 쪽도 이 diff 로 인한 영향이 없다.

## 요약

이번 PR 은 spec/conventions 문서 자체를 변경하지 않고, 기존 `guide-error-code-existence` 가드를 `guide-identifier-existence` 로 리네임·확장(환경변수 축 + 방어적 허용목록)하는 frontend 테스트/스캐너 코드 변경이다. 코드 레벨 정식 규약(명명·리뷰 인용 형식)은 준수하고 있으며, 유일한 실질적 편차는 코드·`PROJECT.md`·`CHANGELOG.md` 가 SoT 로 인용하는 `spec/conventions/user-guide-evidence.md §2` 가 실제로는 이 가드 계열을 열거하지 않는다는 것인데, 이는 `#1330` 부터 존재해 온 pre-existing gap 이고 이번 PR 의 plan(`plan/in-progress/guide-identifier-existence.md §D`)이 이미 --impl-prep 3-checker 수렴으로 정확히 짚어 developer 권한 밖(§0 governance)임을 인지하고 planner 턴으로 명시적으로 위임해 두었다. 새로운 미추적 위반은 발견되지 않았다.

## 위험도

LOW
