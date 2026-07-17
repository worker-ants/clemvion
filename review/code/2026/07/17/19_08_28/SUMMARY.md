# Code Review 통합 보고서

## 전체 위험도

**LOW** — Critical 0건 / Warning 0건. 7개 reviewer 전원(security, requirement, scope, side_effect, maintainability, testing, documentation)이 NONE(5) 또는 LOW(2) 로 보고했고, 모든 발견사항은 INFO 등급이다. 대상 diff(`origin/main..HEAD`, 커밋 4개)는 `src/lib → @/components` 레이어 역전 차단 ESLint 가드를 강화하는 빌드타임 lint 설정 + 그 설정을 검증하는 테스트 변경으로, 애플리케이션 런타임·보안 공격 표면과 접점이 없다. requirement·scope·side_effect·testing 리뷰어가 각각 `npx vitest run`(34/34 pass)·`npx eslint`(0 errors, baseline 과 동일 warning) 실측 재현으로 회귀 없음을 교차 확인했다. 이번 리뷰 대상 diff 는 이미 2회의 선행 `/ai-review` 라운드(`18_06_36`, `18_43_17`)를 거친 최종 상태이며, 남은 INFO 는 전부 지금 당장 조치가 필요 없는 저우선순위 defer 항목이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability / Testing (중복 지적) | `tsParser` 선택 휴리스틱(`g.includes("ts")` 부분열 매칭 + `.at(-1)`)이 이론상 취약함 — glob 문자열에 `"ts"` 부분열만 있으면 TS 와 무관한 블록도 매칭될 수 있고, "매치가 아예 없을 때"만 fail-loud 하며 "엉뚱한 블록이 매치되는" 경우는 감지 못함. **defer 대상 — 현재는 정상 동작.** 파서 블록이 3개뿐이고 override 순서(flat config "나중 블록 우선")상 실제 TS 파서와 정확히 일치함을 testing 리뷰어가 `node --input-type=module` 로 실측 확인했다. 또한 `!tsParser` fail-loud throw + `layeringErrors()` 의 fatal 파싱 가드가 "파서가 아예 안 잡힘"과 "파싱 실패"를 이중으로 방어해, 잘못된 파서 선택이 조용히 통과할 여지를 상당 부분 좁힌다. | `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` (`tsParser` 추출부) | 조치 불요(이번 diff 범위 아님). 향후 config 구조 변경 시 재점검 필요하므로, 확장자 기준 매칭(`g.endsWith(".ts")`)으로 좁히거나 "파서 블록 3개 이하 전제" 주석을 남기는 것을 권장. |
| 2 | Testing | 규칙 메시지 상수(`DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`) swap 이 어떤 테스트로도 잡히지 않음 — 테스트는 `errors.length`·`severity` 만 검증하고 `message` 내용은 미검증이라, 두 메시지를 실수로 맞바꿔도 34개 테스트 전부 통과. 차단 기능 자체(회귀)에는 영향 없고 개발자 안내 메시지 정확성에만 영향. **defer 대상 — 저비용 개선 여지, 병합 차단 사유 아님.** | `codebase/frontend/eslint.config.mjs` (메시지 상수·selector 블록); `eslint-layering-guard.test.ts` (위반 케이스 assertion) | 대표 케이스 1~2개에 `expect(errors[0].message).toContain(...)` 로 메시지 방향성만 최소 검증(이번 diff 범위 밖이라도 무방). |
| 3 | Testing | `require()` 의 2단계 상대경로 우회(`../../components/foo`)가 백틱·리터럴 양쪽 모두 미테스트 — 정적/동적 import 는 2단계 fixture 가 있으나 `require()` 는 1단계만 있어 비대칭. `COMPONENTS_PATH_RE` 를 3종이 공유하므로 실사용 위험은 낮음. **defer 대상.** | `eslint-layering-guard.test.ts` (위반 fixture 목록) | `it.each` 에 `require() 상대경로 우회(2단계)` 1건 추가해 대칭성 확보(선택 사항). |
| 4 | Maintainability | [선행 세션 defer 재확인] `no-restricted-imports` 의 glob `group` 패턴과 `no-restricted-syntax` 의 `COMPONENTS_PATH_RE` 정규식이 "components 경로 매칭"을 여전히 2가지 문법으로 이중 표현. ESLint API 상 문법이 달라 완전한 단일 소스화가 구조적으로 불가능하며, `18_43_17/RESOLUTION.md` INFO#4 에서 이미 defer 확정된 항목의 재기재. **재작업 요구 아님.** | `codebase/frontend/eslint.config.mjs` (`group` vs `COMPONENTS_PATH_RE`) | 기존 권고 유지(우선순위 낮음): 파일 상단에 "매칭 지점 2곳, 함께 갱신 필요" 크로스레퍼런스 주석. |
| 5 | Maintainability | [선행 세션 defer 재확인] `errors.every((m) => m.severity === 2)` 의 `2` 가 이름 없는 매직넘버. ESLint `Linter#verify()` 가 severity 를 숫자로만 반환해 완전한 회피는 어려우며, 바로 위 줄 주석이 의미를 즉시 설명해 가독성 저해는 낮음. | `eslint-layering-guard.test.ts` (severity assertion) | 기존 권고 유지(선택 사항): `const ESLINT_ERROR_SEVERITY = 2;` 추출 가능하나 우선순위 낮음. |
| 6 | Scope | 첫 커밋(`a1e2ec8af`)이 커밋 메시지에 언급하지 않은 두 논리적 항목(선행 WARNING#1~#3 후속 + severity 미탐지 fix)을 함께 번들링. diff 내용 자체는 두 항목 모두 승인된 범위 내라 **스코프 위반은 아니며**, bisect 정밀도가 약간 떨어지는 경미한 감사 편의성 이슈. | 커밋 `a1e2ec8af` | 조치 불요. 향후 유사 상황에서 커밋 분리 시 감사 추적이 더 명확해짐 — 참고 수준. |
| 7 | Side Effect | 테스트 헬퍼의 `mergedRules`(`Object.assign({}, ...layeringBlocks.map(...))`) 는 top-level 만 얕은 복사하고 각 규칙 값(배열)은 원본 config 모듈 참조를 공유. 현재는 전부 read-only 사용이라 무해하나, 향후 in-place mutation 테스트가 추가되면 같은 vitest worker 내 다른 테스트로 상태가 전이될 이론적 리스크. ESLint CLI 는 별도 프로세스라 실제 lint 실행에는 영향 없음. | `eslint-layering-guard.test.ts` (`mergedRules` 정의부) | 현재 조치 불요. 향후 mutation 테스트 작성 시 `structuredClone(mergedRules)` 등 깊은 복사 권장. |
| 8 | Requirement | `src/lib → @/components` 레이어 경계 규약을 다루는 전용 spec 문서가 `spec/conventions/` 에 여전히 부재. spec 본문과의 불일치(SPEC-DRIFT)가 아니라 spec 자체의 미작성 상태이며, 선행 리뷰(`17_29_21/SUMMARY.md` WARNING#4, `18_43_17/RESOLUTION.md` INFO#6)에서 이미 `project-planner` 위임으로 트래킹 중 — 이번 diff 범위 밖. | N/A (`spec/conventions/` grep 0건) | 조치 불요(이번 diff 범위 아님). 별도 `project-planner` 작업으로 `spec/conventions/frontend-layering.md`(가칭) 신설 검토는 기존 트래킹 유지. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견사항 없음. 런타임 코드·사용자 입력·인증·암호화·네트워크와 무접점. 정규식/selector 문자열 전부 고정 상수라 인젝션·ReDoS 우려 없음. 신규 의존성 없음(오히려 phantom-dependency 회피). |
| requirement | NONE | 선행 WARNING#1~#3(flat config 병합·bare 형태·정규식 중복) 완전 해소를 `vitest`(34/34)·`eslint`(0 errors) 실측 재현. severity 미탐지·백틱 우회·파서 미배선도 코드 레벨로 해소 확인. INFO 1건(spec 문서 부재, 기존 트래킹). |
| scope | NONE | 전체 변경 파일이 소스 2개 + 리뷰 산출물로 완전히 설명됨. 의도 밖 변경·불필요 리팩터·무관 영역 수정 없음. INFO 1건(커밋 번들링, 감사추적성). |
| side_effect | NONE | selector 확장 스코프가 `files: ["src/lib/**"]` 블록 내부로 유지, 오탐/회귀 없음(grep+실측). INFO 1건(`mergedRules` 얕은 복사, 향후 리스크). |
| maintainability | LOW | 함수 길이·중첩·네이밍·주석 모두 양호. 신규 INFO 1건(`tsParser` 휴리스틱), 선행 defer 재확인 2건(glob/regex 이중 표현, severity 매직넘버). |
| testing | LOW | mock 없는 통합 테스트 + mutation testing 으로 강하게 방어(vitest 34/34 재현). INFO 3건(메시지 swap 미탐지, require 2단계 비대칭, tsParser 휴리스틱 — 전부 가드의 차단 여부 자체에는 영향 없음). |
| documentation | NONE | 지정된 3개 주석(커버리지 한계, literalSpecifier/backtickSpecifier, phantom-dependency 근거) 전건 실측 검증 결함 없음. RESOLUTION.md "23/23" vs 현재 "34/34" 는 커밋 시점 스냅샷이라 결함 아님(실측 대조 완료). |

## 발견 없는 에이전트

- **security** — Critical/Warning/Info 어떤 등급의 발견사항도 없음.

## 권장 조치사항

1. (필수 아님) 병합 차단 사유 없음 — 현재 diff 는 그대로 병합 가능.
2. (저우선순위, defer) `tsParser` 선택 로직에 "파서 블록 3개 이하·`src/lib/**` 이후 마지막에 전역 override 되는 현재 구조 전제" 주석을 남겨 향후 config 구조 변경 시 리뷰어가 재점검하기 쉽게 할 것.
3. (저우선순위, defer) 대표 케이스 1~2개에 `DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG` 방향성 검증 assertion 추가, `require()` 2단계 상대경로 fixture 1건 추가로 대칭성 확보.
4. (기존 트래킹 유지, 이번 diff 범위 아님) `project-planner` 에게 `src/lib → @/components` 레이어 경계 규약 전용 spec 문서 신설 위임.
5. (선행 defer 유지, 재작업 불요) glob/regex 이중 표현 크로스레퍼런스 주석, severity 매직넘버 상수화는 우선순위 낮음으로 계속 defer.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명) — 전원 `router_safety` 강제 포함
  - **제외**: 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 상수 추출·테스트 로직 수정은 성능 중립적 |
  | architecture | 레이어 가드 구조 변경 없음, 테스트 정확성 개선만 |
  | dependency | package.json/의존성 변경 없음 |
  | database | DB 변경 없음 |
  | concurrency | async/lock/queue 코드 변경 없음 |
  | api_contract | API route/controller 변경 없음 |
  | user_guide_sync | trigger 디렉토리 매칭 안 됨 |
