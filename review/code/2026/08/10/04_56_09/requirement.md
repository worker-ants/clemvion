STATUS=success requirement review complete — 2 WARNING, 1 INFO

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — Gate C plan-completion spec-consistency

## 발견사항

- **[WARNING]** `hasValidSpecImpact`/`danglingSpecImpact` 가 "실존 spec 파일" 이 아니라 "파일시스템 경로 존재" 만 확인해, 빈 문자열·디렉터리 경로가 유효한 `spec_impact` 항목으로 통과한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:74`-`81` (`hasValidSpecImpact` 의 array 분기), `:95`-`99` (`danglingSpecImpact`)
  - 상세: 두 함수 모두 `fs.existsSync(path.join(root, p))` 로만 검증한다. `path.join(root, "")` 는 Node 의미상 `root` 자체로 정규화되고 저장소 루트 디렉터리는 항상 존재하므로, `spec_impact: [""]` (리스트에 빈 문자열 원소)가 `hasValidSpecImpact` 를 `true` 로 통과하고 `danglingSpecImpact` 도 dangling 이 아니라고 판정한다. 실제로 저장소 루트에서 재현 확인함:
    ```
    hasValidSpecImpact([''], exists) = true
    danglingSpecImpact(root, ['']) = []
    ```
    같은 이유로 `"."`/`".."`/`"spec"`(디렉터리만) 같은 비-spec-파일 경로도 전부 "존재" 로 통과한다(디렉터리도 `fs.existsSync` 는 true). 이 파일의 헤더 주석(§Gate C, line 20)은 "리스트 원소는 실재 spec **파일**을 가리켜야 한다" 고 명시하는데 구현은 그보다 넓은 "무엇이든 존재하면 OK" 를 검증한다 — 의도(dangling-ref 방지)와 실제 커버리지 사이 괴리다.
    이 PR 은 정확히 이 종류의 fail-open(비-문자열 원소 조용히 통과 등, line 84-99 JSDoc 참조)을 반복해서 닫아왔는데, 문자열 타입 검사(`typeof p === "string"`)만으로는 빈 문자열이라는 "문자열이지만 무의미한 값" 을 걸러내지 못해 같은 계열의 구멍이 하나 남아있다.
    현재 실 데이터(`plan/complete/**`)에는 빈 문자열/디렉터리 항목이 없어 지금 당장의 오탐/누락은 없음(실측: grep 으로 확인, `spec_impact` 리스트에 빈 항목 0건) — 즉 latent 결함이지 현재 활성 위반은 아니다.
  - 제안: `p.trim().length > 0` 을 문자열 체크에 추가하고, 가능하면 `fs.statSync(...).isFile()` (또는 `.md` suffix) 로 "파일" 임을 검증해 디렉터리·빈 경로를 배제한다. 동일 패턴(`fs.existsSync` only, isFile 미검사)이 `spec-pending-plan-existence.test.ts:45-46` 에도 있어 함께 검토 권장(다만 그 파일은 이번 리뷰 대상 밖).

- **[WARNING]** `plan/complete/**` 에서 frontmatter YAML 자체가 파싱 불가(unparseable)이거나 손상된 plan 은 Gate C·`TERMINAL_PLAN_STATUSES` 검사·"malformed started" 표면화 테스트 **어느 것에도 걸리지 않고 조용히 전부 통과**한다 — 코드 주석이 위임한다고 말하는 "다른 가드" 가 실제로는 존재하지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:161`-`162` (`findNonTerminalCompletedPlans` 의 `if (parsed === null) continue;`), `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:125`-`127`(`enforced` 필터), `:144`-`146`(malformed-started 수집 필터) — 세 곳 모두 `p.parsed !== null` 을 전제로 스캔한다.
  - 상세: `parseFrontmatterSafe`(plan-scan.ts:121-128)는 `matter()` 가 throw 하면 `null` 을 반환한다(실측: 깨진 YAML `foo: [unterminated` 로 재현해 throw 확인). `null` 인 plan 은 세 검사 모두에서 조용히 제외된다. `plan-scan.ts:155` 의 JSDoc 은 "frontmatter 파싱 실패는 이 검사의 관심사가 아니라 건너뛴다(**다른 가드의 소관**)" 이라고 적지만, `plan/complete/**` 트리에 대해 `checkPlanFrontmatter`(missing-block/unparseable 을 실제로 검출하는 유일한 함수)를 호출하는 곳은 `findFrontmatterViolations`(plan-scan.ts:294-299) 뿐이고 이는 `collectLivePlanMarkdown`(top-level `plan/in-progress/*.md`)만 스캔한다 — 즉 "다른 가드" 는 `plan/complete/**` 에 대해 존재하지 않는다.
    실무 시나리오: 살아있는 plan 은 in-progress 단계에서 `checkPlanFrontmatter` 가 파싱 가능함을 이미 강제하지만, `complete/` 로 이동하며 `spec_impact`/`status` 를 같은 커밋에서 손으로 추가하다가 YAML 문법을 깨뜨리면 — 바로 이 PR 이 막으려는 "완료 시점에 Gate C 를 조용히 면제받는다" 패턴과 동일한 결과가 나지만, 이 특정 실패 모드는 어떤 테스트도 red 로 만들지 않는다.
  - 제안: `spec-plan-completion.test.ts` 나 `plan-frontmatter.test.ts` 중 하나에 `collectCompletePlanMarkdown` 을 돌며 `parseFrontmatterSafe(...) === null` 인 파일이 0건임을 단언하는 테스트를 추가하거나(이미 `spec-plan-completion.test.ts:139`의 "malformed started" 테스트와 병렬 패턴으로 자연스럽게 추가 가능), `plan-scan.ts:155` JSDoc 의 "다른 가드의 소관" 서술을 실제로 존재하는 가드로 정정한다.

- **[INFO]** 위 두 발견 모두 spec 문서(`spec/conventions/spec-impl-evidence.md`, `.claude/docs/plan-lifecycle.md §4/§5`)가 이 세부 엣지케이스(빈 문자열 경로, 파싱 불가 completed frontmatter)에 대해 침묵하는 회색지대다 — spec 본문 자체와 구현 사이의 명시적 모순은 없음(cutoff `2026-06-04`, `NONE_VALUES`(`none`/`없음`/`n/a`/`na`), `TERMINAL_PLAN_STATUSES`(`complete`/`implemented`/`applied`/`superseded`), `WORKTREE_SENTINEL`(`(unstarted)`) 모두 spec 과 line-level 로 일치 확인). SPEC-DRIFT 아님 — 코드가 spec 을 벗어난 것이 아니라 spec 이 다루지 않는 세부 구현 결함.

## 검증 사실

- `pnpm vitest run` 으로 `spec-plan-completion.test.ts` + `plan-frontmatter.test.ts` + `plan-scan.test.ts` 977개 테스트 전량 GREEN(실측, 이 세션에서 직접 실행).
- 실 저장소 `plan/complete/**` 358건의 `started:` 값 전수 확인 — 달력상 무효 날짜 0건(새 "malformed started" 테스트가 현재 실데이터로는 vacuous 하지 않지만 red 도 아님).
- `hasMalformedStarted`/`isGateCEnforced`/`isIsoDate` 의 롤오버·라운드트립 로직은 실측(node 재현)과 JSDoc 주장이 일치.
- `eslint` 클린.

## 요약

Gate C(완료 plan 의 `spec_impact` 선언 강제) 핵심 로직 — cutoff 비교, `NONE_VALUES` 어휘, `TERMINAL_PLAN_STATUSES`, `WORKTREE_SENTINEL`, ISO 날짜 라운드트립 검증 — 은 관련 spec 문서(`spec/conventions/spec-impl-evidence.md` §3/§4.2/R-8, `.claude/docs/plan-lifecycle.md` §4/§5)와 line-level 로 정확히 일치하고, 이미 여러 라운드의 ai-review·뮤테이션 테스트로 다수의 fail-open 경로(비-문자열 원소, 빈 배열, bare string, 날짜 롤오버)가 닫혀 있다. 실제 저장소 데이터(977 테스트, 358개 완료 plan)에 대해 현재 GREEN 이며 활성 위반은 없다. 다만 같은 계열의 "조용한 게이트 면제" 결함이 두 곳 latent 하게 남아있다 — (1) `spec_impact` 리스트의 빈 문자열/디렉터리 경로가 `fs.existsSync(path.join(root, p))` 의 root-fallback 성질 때문에 "존재" 로 오판정되고, (2) `plan/complete/**` 의 파싱 불가 frontmatter 가 Gate C·status 가드 어느 쪽에도 걸리지 않는다(코드 주석이 위임하는 "다른 가드" 부재). 둘 다 현재 데이터로는 무해하지만 이 PR 의 설계 철학(모든 조용한 면제 경로를 닫는다)과 정확히 같은 유형이라 후속 조치를 권장한다.

## 위험도

MEDIUM
