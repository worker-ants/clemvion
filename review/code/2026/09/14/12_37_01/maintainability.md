# 유지보수성(Maintainability) 리뷰 — trigger-canary-hardening (라운드 4)

## 검토 범위

`git diff origin/main...HEAD --stat -- codebase/` 로 실측한 결과, 코드 변경은 여전히 6개
파일뿐이다 — 신규 repo-guard(`trigger-secret-columns-guard.ts`) + 소비
spec(`trigger-secret-columns.spec.ts`), 기존 `trigger-workflow-ref.spec.ts` 의 원문자→아라비아
숫자 표기 통일, 그리고 `chat-channel-trigger-create.e2e-spec.ts`·`schedule-trigger.e2e-spec.ts`·
`trigger-workflow-ref.e2e-spec.ts` 세 e2e 파일의 주석 정정 + 기존 헬퍼 호출 추가다.

**이번 라운드의 codebase diff 는 직전 라운드(`review/code/2026/09/14/12_17_14`)와 완전히
동일하다** — `git diff origin/main...HEAD -- codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts codebase/backend/test/schedule-trigger.e2e-spec.ts codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`
및 두 핵심 신규 파일을 `Read` 로 직접 열어 라운드 3의 `maintainability.md` 서술과 바이트 단위로
대조했고, 그 사이 `fix(guards)` 커밋이 3라운드에 걸쳐 이미 반영된 상태 그대로다. 즉 이번 세션에서
`codebase/` 를 추가로 건드린 커밋이 없다 — 이번 fan-out 이 다시 도는 이유는
`review/code/2026/09/14/{11_27_40,11_52_13,12_17_14}/**` 와
`review/consistency/2026/09/14/10_44_37/**` 가 새 diff 파일로 잡혔기 때문이며, 이들은 리뷰·
컨시스턴시 산출물이라 코드 메트릭(함수 길이·중첩·순환 복잡도)이 적용되지 않는다.

## 발견사항

- **[INFO]** (라운드 3 재확인, 미해소이나 비차단) 신규 가드의 파일-부재 에러 메시지가 **자기 파일명을 문자열 리터럴로 하드코딩**한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` — `readStringArrayConst` 함수 내 `fs.existsSync` 분기, 55~58행 (`` `${relPath} 가 없다 — 파일이 옮겨졌거나 이름이 바뀌었다. ` + `trigger-secret-columns-guard.ts 의 경로 상수를 함께 고칠 것.` ``).
  - 상세: 두 번째 문자열 조각의 `trigger-secret-columns-guard.ts` 는 이 파일 자신의 이름을 리터럴로 박은 것이다. 이 가드 파일이 나중에 리네임되면(저장소의 `<주제>-guard.ts` 명명 관례를 따르는 한 있을 법하다) 이 안내 문구는 자동 갱신되지 않아, "가드가 깨졌다 vs 대상이 리네임됐다"를 가르려는 이 가드 고유의 설계 의도와 같은 종류의 문제를 메시지 자신이 안게 된다. 심각도는 낮다 — 같은 파일 안에 있어 리네임 시 함께 고칠 확률이 높고, 잘못돼도 안내 정확도만 떨어질 뿐 검출 능력엔 영향이 없다. 라운드 3 에서 이미 지적됐고 라운드 3 의 `RESOLUTION.md` 에서 "유예 — 리네임 시 함께 고칠 자리"로 명시적으로 처분(등재)된 항목이라 이번 라운드에서 재-고침을 요구하지 않는다.
  - 제안: (변경 없음, 이미 처분됨) `__filename` 사용 또는 리네임 시 동반 수정 — 다음 접촉 시.

- **[INFO]** (라운드 3 재확인, 동일 처분) AST 래퍼-언랩(`unwrap`) 로직이 저장소 안에 유사 목적의 소형 유틸로 3벌 독립 존재한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:68-79` (`AsExpression`/`SatisfiesExpression`/`ParenthesizedExpression` 루프) vs `engine-error-code-anchor-guard.ts` 의 `AsExpression` 전용 삼항식 두 곳.
  - 상세: 목적은 같지만 벗기는 래퍼 종류·구현 형태(루프 vs 삼항식)가 달라 완전 중복은 아니다. 저장소가 "가드별 독립 순수 로직" 관례를 명시 채택하고 있어(파일 헤더), 공유 유틸 추출을 강제할 근거가 약하다는 라운드 3 판단을 유지한다.
  - 제안: 조치 불요. 네 번째 언랩 유틸이 생기면 그때 추출 재고.

- **[INFO]** `expectTriggerWorkflowRef(x, { present: true, expectedWorkflowId: workflowId })` 동일 인자 형태 호출이 3곳 반복 — 라운드 1~3 에서 반복 확인된 항목의 재확인.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — 게이트 277~280(C-2 목록), 392~395(G, cron PATCH), 429~432(H, 재활성 PATCH).
  - 상세: 같은 파일에서 `assertMatchesContract(...)` 도 각 `it()` 마다 반복되는 기존 관례이고, 세 곳은 서로 다른 독립 시나리오의 회귀 방어라 공용 헬퍼로 묶으면 오히려 각 케이스의 "무엇을 확인하는가"가 흐려질 수 있다. 코드가 3라운드째 변경되지 않았으므로 이전 판단(조치 불요)을 유지한다.
  - 제안: 없음.

## 확인한 사항 (문제 없음)

- `codebase/` diff 가 라운드 3 대비 0줄 변경임을 `git diff origin/main...HEAD --stat -- codebase/` 및 세 e2e 파일 개별 diff 로 직접 실측 확인 — 새로 도입된 구조적 결함 없음.
- `readStringArrayConst`(약 60줄, `unwrap`/`visit` 두 지역 함수 포함)는 AST 순회라는 단일 책임 안에 응집돼 있고 중첩 깊이(if → if → for → if, 4단)도 형제 AST 가드와 동등하다.
- 네이밍(`CANONICAL_SOURCE`/`CANONICAL_CONST`/`MIRROR_SOURCES`/`MIRROR_CONST`), 매직 넘버 부재, `trigger-workflow-ref.spec.ts` 원문자→아라비아 숫자 표기 통일 — 모두 라운드 3 확인과 일치하며 재열람으로 재확인.
- `trigger-secret-columns.spec.ts` 10개 케이스는 `[대조군]` 그룹핑과 `describe` 중첩 1단으로 각 `it()` 이 단일 관심사(주석 무시/satisfies 언랩/래퍼 없음/괄호 언랩/선언 없음/빈 배열/부재 파일/비-문자열 원소)를 갖는다. 이번에 신설(라운드 3)된 "괄호로 감싼 선언" 대조군도 형태 일관성이 나머지 케이스와 동일함을 확인.
- `review/**`, `plan/**` 신규 산출물은 표·인용·각주 구조가 저장소 기존 관례를 그대로 따르고 있어 유지보수성 관점 지적 없음(라운드 1~3 과 동일 판단).

## 요약

이번 라운드는 `codebase/` 에 신규 변경이 전혀 없는 상태(라운드 3 이후 코드 diff 0줄)에서 재검토한 것이다. 라운드 1의 vacuous 삼항식 WARNING, 라운드 2의 중첩 템플릿 리터럴 INFO는 이미 해소되어 재발이 없고, 라운드 3에서 새로 낸 두 INFO(자기 파일명 하드코딩, AST 언랩 로직 3중 독립 존재)는 둘 다 라운드 3 RESOLUTION 에서 "유예/조치 불요"로 명시 처분되어 이번 라운드에서 재고침을 요구하지 않는다. `expectTriggerWorkflowRef` 3곳 반복 호출도 라운드 1부터 동일하게 "결함 아님"으로 처분된 사항이다. 새로 발견한 maintainability 문제는 없다 — 핵심 신규 코드(`trigger-secret-columns-guard.ts`)는 함수 길이·중첩 깊이·네이밍·JSDoc 스타일 모두 형제 repo-guard 와 동등한 수준으로 정렬돼 있고, e2e·self-spec 변경은 기존 헬퍼·관례를 그대로 재사용하는 저위험 추가다. Critical/Warning 없음.

## 위험도

LOW
