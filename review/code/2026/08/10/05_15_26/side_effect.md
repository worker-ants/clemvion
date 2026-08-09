# 부작용(Side Effect) 리뷰

대상 커밋: `538e4b92f fix(harness): 파싱 실패 캐너리가 즉시 실제 위반 2건을 찾았다`
(프롬프트가 준 3개 파일의 "전체 파일 컨텍스트"는 이미 이 커밋을 반영한 최종 상태이므로,
실제 변경분은 `git diff HEAD~1..HEAD -- <세 파일>` 로 별도 확인했다.)

## 발견사항

- **[INFO]** `danglingSpecImpact` 시그니처 변경 — 파일시스템 결합 제거를 위한 의도된 breaking change, 영향 범위는 확인 완료
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:96` (`export function danglingSpecImpact(impact: unknown[], specExists: (p: string) => boolean): unknown[]`)
  - 상세: 종전 `danglingSpecImpact(root: string, impact: unknown[])` → `danglingSpecImpact(impact: unknown[], specExists: (p: string) => boolean)` 로 파라미터 개수·순서·타입이 모두 바뀌었다(공개 `export` 함수). 콜백 주입 방식으로 바꿔 자매 함수 `hasValidSpecImpact` 와 패턴을 통일하고, 이전 라운드 리뷰(WARNING: `fs.existsSync` 하드코딩으로 실 파일시스템에 결합, 빈 문자열/디렉터리 경로가 오통과)를 해소하는 개선이다. 호출부 전수 확인: `grep -rn "danglingSpecImpact"` 결과 이 파일 내부(같은 커밋에서 3곳 모두 갱신)만 존재하고 다른 codebase 파일·스크립트에서 구 시그니처로 부르는 곳은 없다. `tsc --noEmit`(0 에러) + `vitest run`(관련 3개 테스트 파일 986/986 GREEN, `plan-frontmatter.test.ts` 포함)로 실측 확인해 컴파일·런타임 모두 깨지는 곳이 없다.
  - 제안: 별도 조치 불요. 다만 `__tests__/` 하위 파일이 다른 스캐너(`spec-links.ts`)에서도 `plan-scan.ts` 를 import 하는 선례가 있으므로, 향후 이런 헬퍼 파일의 export 시그니처를 바꿀 때는 이번처럼 `grep` 전수 확인 + `tsc --noEmit` 을 관례로 유지할 것.

- **[INFO]** 신설 `makeSpecExists`/`findUnparseablePlans` 는 읽기 전용 파일시스템 접근만 수행
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:112`(`makeSpecExists`, `fs.statSync`), `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:184`(`findUnparseablePlans`, `fs.readFileSync`)
  - 상세: 두 함수 모두 파일 존재/파싱 여부를 확인하는 읽기(`statSync`/`readFileSync`)만 하고 쓰기·삭제는 없다. 기존 자매 함수(`findNonTerminalCompletedPlans`, `checkPlanFrontmatter` 등)와 동일한 읽기 전용 패턴이라 새로운 부작용 클래스는 아니다.
  - 제안: 없음.

- **[INFO]** 신규 테스트 `"every completed plan has parseable frontmatter"` 는 실제 저장소 `plan/complete/**` 상태에 결합된 CI 게이트를 새로 추가
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:174`(`it("every completed plan has parseable frontmatter", ...)`)
  - 상세: 이 테스트는 합성 fixture 가 아니라 `repoRoot()` 로 얻은 **실 저장소** `plan/complete/**` 를 스캔해, 이후 누군가 완료 plan frontmatter 를 손으로 편집하다 YAML 을 깨뜨리면 이 테스트가 빨개진다(그것이 이 커밋의 의도된 목적 — Gate C 우회를 막는 캐너리). `describe` 블록 내 기존 "no completed plan declares a `started`…" 테스트와 동일한 결합 패턴이라 새로운 종류의 리스크는 아니다. 실측: `vitest run` 결과 현재 저장소는 위반 0건으로 GREEN(같은 커밋이 `plan/complete/web-chat-quality-backlog.md` 등 실제 위반 2건을 함께 고쳤음을 `git diff --stat` 로 확인).
  - 제안: 없음(의도된 게이트 동작). 향후 이 테스트가 실패하면 원인은 실제 plan frontmatter 손상이지 이 PR 의 회귀가 아님을 유의.

- **[INFO]** `makeSpecExists` 의 경로 결합은 이론상 `root` 밖 경로도 stat 가능하나 입력원이 신뢰된 내부 데이터
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:114`(`fs.statSync(path.join(root, p))`)
  - 상세: `p` 가 `../../etc/passwd` 류를 포함하면 `path.join` 이 그대로 `root` 밖을 가리킬 수 있다. 다만 `p` 의 유일한 실제 소스는 저장소 안 `plan/complete/**` frontmatter 의 `spec_impact` 필드(신뢰된 내부 콘텐츠)이고, 부작용도 읽기 전용 `statSync` 뿐이라 side-effect 관점의 실질 위험은 없다.
  - 제안: 조치 불요(참고용 기록).

파일시스템 쓰기/삭제, 전역 변수 도입, 환경 변수 읽기·쓰기, 네트워크 호출, 이벤트/콜백 발생 패턴 변경은 세 파일 어디에도 없다. `plan-scan.test.ts` 의 임시 디렉터리 사용(`fs.mkdtempSync(os.tmpdir())` + `afterAll`/`finally` 의 `fs.rmSync`)은 이번 커밋에서 새로 추가된 assertion 한 줄(`findUnparseablePlans` 커버리지) 외에는 변경이 없고, 기존 임시 디렉터리 생성·정리 패턴을 그대로 재사용한다 — 실 저장소 `codebase/`·`spec/`·`plan/` 에 대한 쓰기는 없다.

## 요약

이번 커밋은 `danglingSpecImpact` 의 시그니처를 `(root, impact)` → `(impact, specExists)` 로 바꾸는 breaking change 를 포함하지만, 이는 이전 리뷰 라운드에서 지적된 "실 파일시스템 하드코딩 결합" WARNING 을 해소하기 위한 의도된 리팩터링이며 호출부 전수 확인(`grep`)·타입체크(`tsc --noEmit`)·전체 스위트 실행(`vitest run`, 986/986 GREEN)으로 외부 파손이 없음을 실측했다. 신설 `makeSpecExists`/`findUnparseablePlans` 는 읽기 전용 파일시스템 접근만 수행하며, 신규 CI 게이트 테스트("every completed plan has parseable frontmatter")는 실 저장소 데이터에 결합되지만 기존 sibling 테스트와 동일한 의도된 패턴이고 현재 GREEN 이다. 전역 상태·환경 변수·네트워크·이벤트 콜백에 대한 부작용은 발견되지 않았다.

## 위험도

LOW
