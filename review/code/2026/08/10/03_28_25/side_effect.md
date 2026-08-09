# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[WARNING]** `findNonTerminalCompletedPlans` 만 gray-matter 의 프로세스-전역 캐시 회피 수정을 놓쳤다 — 같은 파일의 자매 함수가 명시적으로 방어한 바로 그 side channel
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:124` (문제 지점) vs `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:220-226` (같은 파일의 대응 수정)
  - 상세:
    - `checkPlanFrontmatter` (gate 220-226) 는 `matter(raw, {})` 로 **명시적으로 빈 옵션 객체**를 넘긴다. 그 이유가 바로 위 주석에 실측으로 적혀 있다 — `gray-matter@4.0.3` (`node_modules/.pnpm/gray-matter@4.0.3/.../index.js`) 의 `matter()` 는 `options` 가 falsy 일 때만 `matter.cache`(모듈 최상단 `matter.cache = {}` — **프로세스 전체가 공유하는 단일 싱글턴 객체**)를 읽고 쓴다. 캐시 등록(`matter.cache[file.content] = file`)이 실제 파싱(`parseMatter`) **이전에** 일어나고, 파싱이 깨진 YAML 에서 throw 하면 그 부분 초기화된 `file` 객체(즉 `data` 미설정)가 그대로 캐시에 남는다. 그러면 **동일 content 문자열**의 두 번째 호출은 throw 없이 조용히 `data=undefined`(→ `?? {}`) 를 돌려준다 — "호출 순서에 따라 결과가 달라지는" 전형적인 전역 가변 상태 부작용이다. 이를 회피하려고 `checkPlanFrontmatter` 는 `{}` 를 넘겨 캐시 read/write 분기(`if (!options) {...}`) 자체를 건너뛴다. `defaults(options)` 는 `Object.assign({}, options)` 라 `{}` 유무가 실제 파싱 규칙에는 영향을 주지 않음도 확인했다(`gray-matter/lib/defaults.js`) — 즉 이 옵션은 **순수하게 캐시 참여 여부만** 바꾼다.
    - 그런데 gate 124 의 `findNonTerminalCompletedPlans` 는 `matter(fs.readFileSync(f.absPath, "utf8")).data ?? {};` 로 **옵션 없이** 호출한다. 같은 파일, 같은 PR 안에서 바로 아래 함수가 방어한 그 정확한 전역 캐시 hazard 에 그대로 노출된다.
    - 실제로 이 함수가 스캔하는 `plan/complete/**.md` 파일들은 **동일 프로세스 안에서 다른 독립 구현으로도 옵션 없이 재파싱된다** — `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:93,114` (Gate C, 이번 리뷰 대상 밖이지만 같은 `repoRoot()` 트리를 스캔) 가 정확히 같은 파일들에 대해 `matter(fs.readFileSync(abs, "utf8")).data ?? {}` 를 옵션 없이 호출한다. 두 소비자가 vitest 같은 워커 프로세스에서 실행되면 `matter.cache` 를 공유하므로, 한쪽이 깨진 YAML 파일을 먼저 파싱해 캐시를 오염시키면 다른 쪽의 재파싱 결과가 실행 순서에 따라 달라질 수 있다.
    - 현재는 두 소비자 모두 "throw→skip" 과 "cache-hit(빈 data)→skip" 이 최종적으로 같은 결과(위반 미보고)로 수렴해 관측 가능한 오류는 없다. 그러나 이는 우연한 수렴이지 보장이 아니다 — 두 로직 중 하나가 향후 바뀌어 `data` 의 다른 필드(예: `content`)를 참조하거나, "파싱 실패"와 "빈 status" 를 다르게 취급하게 되면 실행 순서에 의존하는 조용한 오분류가 생긴다. 이 파일의 헤더 주석이 스스로 경고하는 "158 tests 전량 GREEN 인데 위반 분기가 한 번도 실행되지 않았다" 류의 실패와 같은 계열(관측되지 않는 전역-상태 의존 분기)이다.
  - 제안: `findNonTerminalCompletedPlans` 의 `matter(...)` 호출에도 `checkPlanFrontmatter` 와 동일하게 `{}` 를 넘겨 캐시를 우회한다(`matter(fs.readFileSync(f.absPath, "utf8"), {})`). 가능하면 `spec-plan-completion.test.ts:93,114` 도 같은 패턴으로 정정해 두 gate 가 같은 실제 파일 집합을 스캔할 때 캐시 오염 여지를 완전히 없애는 편이 안전하다(단, 그 파일은 이번 리뷰 대상 밖이므로 별도 확인 필요).

- **[INFO]** 모듈 최상위 가변 정규식 `LINK_RE`(전역 상태) — 현재는 안전하지만 재진입에 취약한 패턴
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:78` (선언), `:95` (`LINK_RE.lastIndex = 0;` 리셋), `:97` (`while ((m = LINK_RE.exec(noCode)) !== null)`)
  - 상세: `g` 플래그가 있는 정규식 객체를 모듈 스코프 상수로 두고 `lastIndex` 상태를 여러 호출에 걸쳐 공유한다. 현재 코드는 매 라인 순회 직전 `LINK_RE.lastIndex = 0;` 로 명시적으로 리셋하므로 동기 호출 흐름에서는 부작용이 없다. 다만 이 상태는 **함수 스코프가 아니라 모듈 스코프**라, 향후 `extractLinks` 를 재진입(같은 tick 안에서 중첩 호출)하거나 async 화하면 `lastIndex` 경합이 발생할 수 있는 잠재적 footgun이다.
  - 제안: 현 시점 동작 변경은 불필요. 리팩터링 시 `LINK_RE` 를 함수 내부 지역 변수로 옮기거나 매 호출마다 새 `RegExp` 인스턴스를 생성하면 이 계열의 재발을 원천 차단할 수 있다(우선순위 낮음).

- **[INFO]** 파일시스템 부작용은 테스트 픽스처로 적절히 격리됨 — 이슈 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:34-36`(`beforeAll`), `:66-68`(`afterAll`), `:276-288`
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), ...))` 로 저장소 밖 OS 임시 디렉터리에만 쓰고, `afterAll` 에서 `fs.rmSync(root, { recursive: true, force: true })` 로 정리한다. vitest/jest 는 `beforeAll` 이 throw 해도 `afterAll` 을 실행하므로 부분 생성 상태에서도 정리가 보장된다. 저장소 실제 `plan/` 트리에는 어떤 쓰기도 없다(모든 `plan-scan.ts` 함수는 `fs.readFileSync`/`readdirSync`/`existsSync` 만 사용). 문제 없음, 참고용으로만 기재.

## 요약

리뷰 대상 4개 파일은 대체로 순수 함수 + 파라미터화된 `root` 입력 + 읽기 전용 fs 접근으로 설계돼 side effect 표면이 작다. 시그니처·공개 인터페이스 변경은 이 저장소 내부에서 3개 테스트 파일 외에 다른 소비자가 없음을 grep 으로 확인했고(하위호환 재-export 포함), 환경변수·네트워크·이벤트/콜백 관련 부작용은 없다. 다만 `plan-scan.ts` 안에서 `checkPlanFrontmatter` 가 명시적으로 방어한 gray-matter 의 프로세스-전역 캐시(`matter.cache`) 부작용을, 바로 아래 `findNonTerminalCompletedPlans` 가 놓쳤다 — 실제로 `gray-matter@4.0.3` 소스를 확인해 이 캐시가 "파싱 throw 시 부분 상태가 캐시에 남아 같은 content 의 재호출이 조용히 다른 결과를 낸다"는 문서화된 위험이 사실임을 검증했고, 같은 `plan/complete/**` 트리를 옵션 없이 재파싱하는 별도 소비자(`spec-plan-completion.test.ts`)가 실제로 존재해 크로스-파일 캐시 오염 경로가 이론이 아니라 실재함을 확인했다. 현재는 두 소비자의 "throw"/"빈 캐시" 경로가 모두 동일한 skip 결과로 수렴해 관측 가능한 오류는 없지만, 이는 우연한 수렴일 뿐 보장이 아니므로 일관성 있게 고쳐두는 것을 권한다.

## 위험도

MEDIUM
