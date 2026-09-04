# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 3건은 전부 신규 repo-guard/테스트 인프라(`swagger-dto-contract-guard.ts`, `nullable-type-lie-cast-guard.ts`, `temp-fixture.ts`)의 유지보수성·테스트 커버리지에 국한되며, 핵심 변경(Swagger DTO nullable/presence 계약 정정 9곳)은 런타임 동작 변경 없이 문서-실제 불일치를 바로잡는 정합화로 전 reviewer 가 일관되게 확인. forced 화이트리스트 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 강제 리뷰 미이행 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `nullable-type-lie-cast.spec.ts` 가 공유 `withFixture` 를 import 하지 않고 거의 동일한 로컬 함수를 재정의 — 이 PR 이 "사본 제거"를 목표로 추출한 헬퍼 옆에서 새 사본이 생김. JSDoc 은 "얇은 래퍼"라 서술하나 실제로는 위임하지 않고 로직을 복제 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:51-55` | 공유 `withFixture` 를 import 해 `withFixture(content, fn, 'probe.entity.ts')` 로 위임(5줄+JSDoc 제거 가능) |
| 2 | maintainability | 크로스플랫폼 경로 정규화 한 줄(`split(path.sep).join('/')`)이 저장소 전체 7곳(신규 4곳 포함)에 복제됨 — 직전 라운드 WARNING(1곳 지적)을 고치며 추출 대신 복제로 3곳을 더 늘림 | `nullable-type-lie-cast-guard.ts:51,124,257`, `swagger-dto-contract-guard.ts:128` (기존 3곳: `masked-reject-callers-guard.ts:140`, `production-build-devdep-guard.ts:119`, `production-build-devdep.spec.ts:61`) | `source-scan.ts` 에 `toPosixRelative(root, file)` 로 한 번만 정의하고 7곳(신규 포함) 모두 호출하도록 통일 |
| 3 | testing | WARNING #2 의 경로 정규화 코드에 대한 테스트가 전무함 — 4곳 전부 뮤테이션(`.join('/')`→`.join('\\WRONG\\')`/`'WRONG'`)해도 관련 spec 50개 전체 GREEN. 원인은 픽스처 파일명이 전부 단일 세그먼트라 `path.relative` 결과에 구분자가 원리적으로 등장하지 않기 때문 — POSIX/Windows 무관하게 현재 테스트로는 검증 불가능한 상태 | `swagger-dto-contract-guard.ts:128`, `nullable-type-lie-cast-guard.ts:51,124,257` | 정규화 로직을 순수 함수로 뽑아 `path.sep` 를 인자로 받게 하거나, 픽스처에 `{'sub/probe.dto.ts': ...}` 처럼 중첩 디렉터리를 추가해 구분자가 실제로 나타나게 만들 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / side_effect / api_contract | `background-run-response.dto.ts` 8필드의 OpenAPI `required` 가 `false→true` 로 전환 — 서비스 조립 코드가 이미 항상 키를 채우고 있어 런타임 wire 동작 무변경, 계약 거짓 정정. 엄격한 코드제너레이터(orval 등) 소비자에게만 생성 타입이 좁아지는 관측 가능한 영향, CHANGELOG 에 이미 고지됨 | `background-run-response.dto.ts` (`finishedAt`/`durationMs`/`inputData`/`outputData`/`error`/`nextCursor`/`completedAt`/`durationMs`) | 조치 불요 |
| 2 | security / side_effect / api_contract | `create-assistant-session.dto.ts` `llmConfigId` 타입 확장(`string?`→`string\|null`)은 `@IsOptional()`(null/undefined 모두 하위 검증 스킵)·소비처(`?? null`)가 이미 그 동작을 전제하고 있어 컴파일타임 타입만 실제를 뒤늦게 따라감 | `create-assistant-session.dto.ts:19` | 없음 |
| 3 | architecture / maintainability | `SRC_ROOT = path.resolve(__dirname, '..', '..')` 계산식이 두 파일에 중복 | `nullable-type-lie-cast-guard.ts:21`, `swagger-dto-contract.spec.ts:43` | 3번째 가드 추가 시 `source-scan.ts` 로 통합 검토 (지금은 2곳뿐이라 급하지 않음) |
| 4 | architecture | presence/null 축 판정 로직이 AST 순회 클로저 내부에 인라인 — 3번째 축이 생기면 함수·타입(`ContractMismatch.axis`)·테스트 헬퍼를 모두 재작업해야 함(YAGNI, 현재 축 요구 없음) | `swagger-dto-contract-guard.ts:144-168` | 3번째 축이 실제 필요해지면 `judgePresence`/`judgeNull` 순수 함수로 분리 |
| 5 | architecture | 신규 W1 캐너리(`Reflect.getMetadata` 직접 호출)가 저장소에 이미 있는 `swagger-probe.ts`(`buildSwaggerDocument` 기반) 인프라를 재사용하지 않고 별도 경로를 새로 엶 — 각 방식 나름의 근거는 있음(가볍고 부트스트랩 불필요) | `swagger-dto-contract.spec.ts:256-276` vs `shared/testing/swagger-probe.ts` | 코드 변경 불요. 다음에 유사 캐너리가 필요해지면 두 경로 중 하나로 통일할지 판단 |
| 6 | requirement | `spec-draft-nullable-notation-followups.md` 안에서 "§5.4 와 어긋나는 곳수"가 두 자리에서 다른 수(마이그레이션 절 "111곳" vs 체크리스트 "104곳")로 병존 — 111곳 문장이 이 PR 에서 이미 고쳐진 8곳을 반영하지 않은 채 갱신 안 됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (마이그레이션 절 vs 후속 체크리스트) | "111곳" 문장에 "(8곳은 이 PR 에서 이미 정정 — 잔여 104곳)" 캐비엇 추가 또는 체크리스트 표현으로 통일 |
| 7 | scope | 무관 주제(execution-engine G2/G3 차단 전제 재실측)가 같은 diff 에 혼입 — 해당 plan 문서 자신이 frontmatter 에서 다른 worktree(`spec-frontmatter-status-migration-027c17`) 소유로 선언 중. 코드 변경과는 섞이지 않음 | `plan/in-progress/execution-engine-residual-gaps.md` 게이트 54-69 (커밋 `8691a2f25`) | 상위 세션이 "plan/in-progress 전역 훑기"라면 현행 유지 무방. 아니라면 별도 커밋/PR 분리 및 `worktree:` 필드 정정 검토 |
| 8 | scope | WARNING 수정(경로 정규화) 하나가 리뷰어가 지목한 1곳(`swagger-dto-contract-guard.ts:125`)보다 넓게 형제 파일 3곳까지 확장 — `RESOLUTION.md` 에 "같은 저장소 관례 이탈 방지" 근거가 이미 명시돼 은폐된 확장 아님 | `nullable-type-lie-cast-guard.ts` 3곳 (커밋 `59f83058e`) | 문제 아님. 향후 "지적 1곳→클래스 전체 확장" 패턴 시 근거 명시 관례 유지 |
| 9 | side_effect / concurrency | `withFiles` 의 W4(async 레이스) 수정이 반환값 thenable 여부만 검사해 즉시 throw — 이는 정확한 개선이나, discard 되는 원래 Promise 자체에 rejection 핸들러를 안 붙여 향후 실제 async 소비처가 생기면 **다른 테스트로 전이되는 unhandled rejection** 여지가 남음. 또한 반환하지 않는 detached 비동기 부작용(`setTimeout` 등)은 이 검사로 원천적으로 탐지 불가 — "동기 콜백 전용" 계약의 의도된 한계 | `temp-fixture.ts:56-65` | 현재 소비처 0건(전부 순수 동기)이라 급하지 않음. 닫으려면 discard 전 no-op `.catch()` 부착 검토 |
| 10 | side_effect | `withFiles` 가 파일명(`name`)을 검증 없이 `path.join(dir, name)` 에 사용 — `'../../evil.ts'` 같은 키를 넘기면 tmpdir 밖에 쓰고 `finally` 의 `rmSync` 로도 정리되지 않음. 현재 모든 호출부는 하드코딩 리터럴 키만 사용해 무해 | `temp-fixture.ts:51-54` | 급하지 않음. 필요 시 `name.includes('..')` 등 한 줄 가드로 하드닝 |
| 11 | side_effect | 공유 승격 과정에서 tmpdir 접두사가 `'nullable-guard-'` → 공용 기본값 `'repo-guard-'` 로 조용히 변경 — 이 이름에 의존하는 별도 정리 스크립트/문서 없음을 grep 으로 확인, 기능 영향 없음 | `nullable-type-lie-cast.spec.ts:28,41-49`, `temp-fixture.ts:47` | 조치 불요, 정보성 기록 |
| 12 | testing | `hasTopLevelNull` 이 최상위 `ParenthesizedTypeNode` 를 언랩하지 않아 `field: (T \| null)` 형태에서 위음성 — 뮤테이션으로 재현 확인(RED). 저장소 전수 grep 결과 현재 인스턴스 0건 | `swagger-dto-contract-guard.ts:83-90` | 급하지 않음. `ts.isParenthesizedTypeNode` 언랩 후 재귀 검토 (직전 라운드부터 이어지는 미해결 항목) |
| 13 | testing | `CreateAssistantSessionDto.llmConfigId` 에 실제 `null` 값이 검증을 통과해 서비스까지 도달하는 경로를 겨눈 unit/e2e 테스트가 0건 — 정적 계약 가드가 유일한 방어선 | `create-assistant-session.dto.ts:19` | e2e/컨트롤러 스펙에 `llmConfigId: null` 케이스 1개 추가 권장 |
| 14 | testing / api_contract | `readBooleanOption` 이 boolean 리터럴만 인식 — 상수 참조 등 non-literal 값은 조용히 "미선언" 취급되어 실제 불일치를 놓칠 수 있음. 저장소 실측(1,096개 필드) 상 전부 리터럴이라 현재 무해 | `swagger-dto-contract-guard.ts:59-74` | 급하지 않음. non-literal 값을 "판정 불가"로 별도 카운트하는 방어 + 픽스처 1개 추가 고려 |
| 15 | documentation | `create-assistant-session.dto.ts` `llmConfigId` 설명 문구가 명시적 `null` 케이스를 언급하지 않음 — 자매 DTO(`update-assistant-session.dto.ts`)는 이미 "null 전달 시 workspace default로 폴백"까지 명시 | `create-assistant-session.dto.ts:13` | 여유 있으면 자매 DTO 문구로 통일 |
| 16 | documentation | `nullable-type-lie-cast.spec.ts` 인라인 주석이 리팩터 후에도 "모듈 스코프의 `withFiles`" 라는 낡은 표현 유지 — 바로 위 JSDoc(이번 diff 로 갱신됨)은 "공유 헬퍼 import" 라고 정확히 서술해 어휘가 어긋남 | `nullable-type-lie-cast.spec.ts:123` | 사소함. "공유 헬퍼의 `withFiles`(import)" 로 한 단어만 교정 |
| 17 | documentation | 신규 가드(`swagger-dto-contract-guard.ts`)가 spec 을 단방향으로만 인용(`SoT: spec/5-system/2-api-convention.md §5.4`) — spec §5.4/Rationale 쪽에는 이 가드에 대한 역참조가 없음. `spec/` 쓰기가 필요해 developer 권한 밖(planner 턴 필요), 이미 별도 백로그(`rationale_continuity.md`)에 등재됨 | `swagger-dto-contract-guard.ts:98`, `spec/5-system/2-api-convention.md` §5.4 | 코드 수정 불요. planner 턴에서 spec 쪽 "강제: swagger-dto-contract.spec.ts" 역참조 추가 확인만 하면 됨 |
| 18 | api_contract | DTO 스키마 정합화(9곳)에 대응하는 API 버전 분기/헤더 마킹이 없음 — 계약을 넓히는 것이 아니라 정합화하는 성격이라 버전 분기 필수는 아니라고 판단되나, `required` 를 좁히는 8필드 변경은 유일하게 실제 영향이 있는데도 CHANGELOG 고지만으로 처리됨 | `background-run-response.dto.ts` 전체, `create-assistant-session.dto.ts:12-19` | 이번 PR 을 막을 사안 아님. `spec/5-system/2-api-convention.md` 버전 관리 절이 "스키마 정합화" 류도 버전 분기를 요구하는지 재확인 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | DTO nullable 정정은 계약 정확도 개선일 뿐 취약점 아님. 신규 repo-guard/tmpdir 헬퍼는 신뢰 입력만 처리하는 CI 전용 코드. 하드코딩 시크릿 없음 |
| architecture | LOW | 레이어/모듈 경계 정상. INFO 3건(형제 가드 간 `SRC_ROOT` 관례 불일치, 판정 로직이 클로저 내부, 캐너리가 기존 swagger-probe 미재사용) |
| requirement | LOW | §5.4 규칙 구현이 spec 과 line-level 일치, 직전 라운드 WARNING 5건 전부 실제 해소 재확인. plan 문서 내 곳수 서술(111 vs 104) 불일치 INFO 1건 |
| scope | LOW | 핵심 변경은 요청 범위와 정확히 일치. 무관 주제(execution-engine plan) 혼입 지속(다른 worktree 소유로 자기선언), WARNING 수정이 지목 범위보다 넓게 확장(근거 명시됨) |
| side_effect | LOW | 부작용 표면 좁음(tmpdir 격리+정리). W4 fix 재검증 완료하되 discard 되는 thenable 의 잠재적 unhandled rejection, 파일명 미검증 등 INFO 다수 |
| maintainability | LOW (WARNING 2건) | 핵심 로직은 가독성 양호, 직전 WARNING 5건 반영 확인. 이번 배치가 "중복 제거"를 목표로 하면서 오히려 새 중복(로컬 `withFixture` 재구현, 경로 정규화 7곳 복제)을 만듦 |
| testing | LOW (WARNING 1건) | W1/W4/W5 수정 유효성을 뮤테이션으로 직접 확인(GREEN↔RED 전환 재현). 단 W3(경로 정규화) 는 테스트 커버리지 0 — 4곳 뮤테이션 전부 GREEN 유지 |
| documentation | NONE | 직전 code-review·consistency WARNING 전건(CHANGELOG 누락, stale plan 참조, §5.4 스코프 오인용) 정확히 조치 확인. INFO 3건은 전부 사소하거나 developer 권한 밖 |
| concurrency | LOW | DTO/가드 변경은 순수 동기, 공유 가변상태 없음. `withFiles` 의 detached 비동기 미탐지·dangling promise 는 현재 소비처 0건인 이론적 여지 |
| api_contract | LOW | 실질 계약 표면은 DTO 2파일로 좁고 전부 계약 거짓 정정. `required` 전환만 유일한 관측 가능 영향, CHANGELOG 고지 완료. §5.4 요청/응답 스코프 오적용을 세션 스스로 반증·정정 |
| user_guide_sync | NONE | 21개 trigger 중 `backend-api-change` 1건만 매칭, target (a) swagger jsdoc 은 diff 자체로 충족, target (b) user-guide 페이지 갱신은 실제 참조점 없어 비해당 판정 |

## 발견 없는 에이전트

해당 없음 — 11개 에이전트 전원이 최소 INFO 이상을 보고했다(순수 "문제 없음" 단독 판정 없음).

## 절차 관측 (코드 결함 아님)

requirement·scope·testing·documentation 4개 reviewer 가 독립적으로 동일한 이상 상태를 관측했다:
검토 도중 `git status --short` 확인 결과 `review/consistency/2026/09/04/11_33_21/SUMMARY.md` 가
본 리뷰 세션이 만들지 않은 수정 상태(`M`)로 나타났다(내용은 같은 결론을 다른 포맷으로 재작성한
것으로 보임). 전원이 규약에 따라 `git checkout`/`restore` 로 원복하지 않고 사실만 보고했다 —
병렬로 같은 워크트리를 쓰는 다른 세션/에이전트의 흔적일 가능성이 있다. 코드 리뷰 결론에는
영향 없음. 오케스트레이터가 세션 종료 후 원인 확인 권장.

## 권장 조치사항

1. (WARNING #2, #3) 경로 정규화 로직(`split(path.sep).join('/')`)을 `source-scan.ts` 등 공유 모듈로 추출해 7곳 중복을 해소하고, 그 순수 함수에 대한 유닛 테스트(중첩 디렉터리 픽스처 등)를 추가해 현재 0인 커버리지를 메운다.
2. (WARNING #1) `nullable-type-lie-cast.spec.ts` 의 로컬 `withFixture` 재정의를 공유 `withFixture` import 로 교체한다.
3. (INFO #13, 선택) `llmConfigId: null` 이 실제로 서비스까지 도달하는 경로에 대한 e2e 케이스 1개를 추가한다.
4. (INFO #15, #16, 선택) `llmConfigId` 설명 문구와 낡은 "모듈 스코프" 주석을 정리한다.
5. (INFO #17) `spec/5-system/2-api-convention.md` §5.4 에 신규 가드(`swagger-dto-contract.spec.ts`)에 대한 역참조를 추가하는 작업은 planner 턴에서 처리 — 이미 백로그(`rationale_continuity.md`)에 등재돼 있으므로 중복 등재 불필요, 반영 여부만 확인.
6. (INFO #6) plan 문서(`spec-draft-nullable-notation-followups.md`)의 "111곳" 서술을 "104곳"(이미 8곳 정정 반영)과 일치하도록 정정한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync` (11명)
  - **제외**: 표 (reviewer · 이유, 3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 가 이번 diff 를 성능 영향 없음으로 판단(DTO 메타데이터·정적 분석 가드만 변경) |
  | dependency | 신규/변경 외부 의존성 없음(devDependency 추가 없음) |
  | database | DB 스키마/쿼리 변경 없음(DTO·TS 타입 선언만 변경) |