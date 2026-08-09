# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** 모듈 로드 시점(import-time) throw — 소비 스위트 전체에 대한 의도된 연쇄 부작용
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:88` (`assertAllUnique(ALL_WS);`), 함수 정의는 `:73-86`, `ALL_WS` 선언은 `:54-71`
  - 상세: 이 파일은 기존에 순수 상수 export 만 있던 모듈이었는데, 이번 변경으로 모듈 최상위(top-level)에서 `assertAllUnique(ALL_WS)` 를 즉시 호출하도록 바뀌었다. 이는 "부작용 없는 상수 모듈"에서 "import 시점에 throw 할 수 있는 모듈"로 계약이 바뀐 것이며, 이 모듈을 import 하는 세 소비 스위트(`workspace.decorator.spec.ts` · `roles.guard.spec.ts` · `workspace-context.util.spec.ts`) 전부가 값 충돌 시 "Test suite failed to run" 으로 동시에 실패하게 된다(에러 메시지에도 명시). 다만 이 자체는 의도된 설계로, docstring(`:54-61`)에 근거·트레이드오프가 상세히 적혀 있고 뮤테이션 테스트(`OTHER_WS`↔`VICTIM_WS` 값 충돌 시 RED, plan `:305-307` 실측 기록)로 로드베어링임이 검증됐다. 순수 부작용 관점에서는 "새로운 import-time side effect 도입"이라는 사실 자체를 로그로 남겨 둔다 — production 빌드가 `__test-utils__` 를 tsc 로 컴파일한다는 docstring(원본 파일 `:21-22`)이 있으므로, 향후 이 디렉터리가 실제 런타임 코드에서 잘못 import 되는 일이 생기면 이 최상위 호출도 함께 실행된다는 점을 유의해야 한다(현재는 테스트 전용 소비만 확인됨, 실제 프로덕션 import 경로는 없음).
  - 제안: 추가 조치 불필요 — 의도된 설계이고 문서화·검증이 충분하다. 다만 이 fixtures 디렉터리를 프로덕션 코드가 import 하지 않는다는 불변식이 향후에도 유지되는지는 (`__test-utils__` 를 3곳째 만들 때 `tsconfig.build.json` exclude 검토 항목이 plan 에 이미 등재돼 있음) 계속 추적하면 된다.

- **[INFO]** `plan/in-progress/auth-guard-reflection-hardening.md` frontmatter `worktree:` 필드가 원 작업 worktree 와 다른 값으로 변경됨
  - 위치: `plan/in-progress/auth-guard-reflection-hardening.md:3` (`worktree: auth-guard-reflection-hardening-9c31f2` → `worktree: harness-changeset-exclusion`)
  - 상세: 이 plan 은 제목·본문이 전부 "RolesGuard reflection 경화"(`#1108`) 작업을 다루는데, frontmatter 의 `worktree:` 값이 그 작업과 무관해 보이는 `harness-changeset-exclusion` 으로 바뀌었다. 이번 세션의 실제 작업 디렉터리(`Working directory: .../worktrees/harness-changeset-exclusion`)와는 일치하므로 "지금 이 편집을 수행 중인 worktree"를 정직하게 반영한 값이며, 원 worktree(`auth-guard-reflection-hardening-9c31f2`)가 이미 회수/재사용됐을 가능성이 있다. 코드 실행에 영향을 주는 부작용은 아니지만, `worktree:` 필드를 근거로 소유권을 판별하는 도구(`.claude/tools/ensure-worktree.sh`, plan-lifecycle 자동화, 다른 checker 의 `plan_coherence` 판정 등)가 있다면 이후 이 plan 에 대한 "소유 worktree" 판정이 달라질 수 있다는 점은 공유 상태(문서 메타데이터) 변경으로서 기록해 둔다.
  - 제안: 의도적 변경으로 보이나, plan-lifecycle 규약상 이런 cross-worktree 편집이 허용된 패턴인지(예: 원 worktree 회수 후 후속 항목만 별도 worktree 에서 체크하는 경우) 팀 컨벤션 문서에 이미 정의돼 있는지 확인 권장. 별도 조치는 불필요.

- **[INFO]** 신규 export `ALL_WS` 는 타입 레벨(`as const`)로만 readonly — 런타임 freeze 없음
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:63-71`
  - 상세: `export const ALL_WS = [...] as const;` 는 TypeScript 타입 체커 상으로만 튜플/리터럴 타입을 부여할 뿐, 런타임에는 일반 배열이라 `Object.freeze` 가 없으면 소비 코드가 `.push()`/`[i]=` 등으로 공유 배열을 변조할 수 있다. 테스트 전용 fixture 이고 세 소비 스위트가 값을 읽기만 하는 현재 사용 패턴에서는 실질 위험이 낮다.
  - 제안: 필요하다면 `Object.freeze(ALL_WS)` 추가를 고려할 수 있으나, 현재 범위에서는 실익이 크지 않아 필수 지적은 아니다.

- 나머지 변경(`uuid.spec.ts` 주석 정리, `workspace-id-fixtures.spec.ts` 신규 테스트 파일의 `readFileSync` 사용, `plan/*.md` 체크리스트 갱신)은 순수 문서/주석 정리이거나 읽기 전용 파일시스템 접근(테스트 코드가 형제 소스 파일을 읽어 배선을 검증)이라 부작용 관점에서 특이사항 없음. 함수/메서드 시그니처 변경, 전역 변수 도입, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경은 이번 diff 어디에도 없음.

## 요약

이번 변경의 핵심 부작용은 `workspace-id-fixtures.ts` 모듈에 **import 시점에 실행되는 유일성 검증 호출**을 추가한 것으로, 값이 충돌하면 이 모듈을 사용하는 세 스위트가 동시에 "Test suite failed to run" 으로 실패하게 만드는 의도된 연쇄 효과다. 이는 뮤테이션 테스트로 로드베어링임이 실증됐고 docstring 에 근거가 충분히 남아 있어 위험한 부작용이라기보다 설계된 방어 장치다. `plan/*.md` 의 `worktree:` 필드 변경은 실제 작업 디렉터리와 일치하는 정직한 갱신으로 보이나 소유권 추적 도구에 영향을 줄 수 있어 기록해 둔다. 그 외 항목은 문서·주석 정리와 읽기 전용 테스트 코드라 부작용이 없다. 시그니처/공개 API 파괴적 변경, 전역 상태 오염, 환경변수·네트워크 부작용은 발견되지 않았다.

## 위험도

LOW
