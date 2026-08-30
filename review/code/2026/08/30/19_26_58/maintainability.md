# 유지보수성(Maintainability) 코드 리뷰

## 검증 방법

`git diff --stat origin/main...HEAD` 로 이번 리뷰가 커버하는 실제 diff(3개 코드 커밋
`1a12088f2`·`519671792`·`9d5e001bf` 누적분: `CHANGELOG.md`, `execution-engine.service.ts`,
`execution-engine.service.spec.ts`, plan 2개, spec 2개)를 확인했다. `execution-engine.service.ts`
는 8,865줄짜리 파일이라 프롬프트에 diff 가 생략돼 있어, `git diff origin/main...HEAD -- <path>`
로 전체 hunk 를 직접 열어 대조했다. 저장소 파일은 뮤테이션하지 않았다(읽기 전용 `Read`/`Bash grep`
만 사용, 종료 시 `git status --short` 확인 완료 — 리뷰 산출물 디렉터리 외 변경 없음).

이 diff 는 `review/code/2026/08/30/17_36_15/`·`18_10_28/` 두 라운드가 이미 리뷰한 내용의
누적분이다(WARNING 해소 커밋들이 포함됨). 아래는 그 해소가 실제로 반영됐는지 독립적으로
재확인하고, 남은 여지를 다시 판단한 결과다.

## 발견사항

- **[INFO]** `updateExecutionStatus` 함수 길이가 169줄로 여전히 길다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8584`
    (`public async updateExecutionStatus(`) ~ `:8752` (닫는 `}`)
  - 상세: 직접 실측(8752-8584+1=169). `17_36_15` maintainability 라운드가 이 함수를
    168줄로 지적했고, 그 라운드가 제안한 `finishStatusTransition` 헬퍼 추출(WARNING #2,
    아래 참고)이 실제로 적용됐지만 그 헬퍼는 **중복 제거**가 목적이었지 **길이 축소**가
    목적이 아니었다 — 종결부 4줄을 함수 밖으로 빼는 대신 그 자리에 4줄짜리 함수 호출을
    남겨 순길이는 오히려 168→169로 늘었다(`18_10_28` W1 라운드가 이미 이 축 오류를
    스스로 정정해 기록해 두었다). 다만 본문을 실제로 읽어 보면 나쁜 168줄이 아니다 —
    두 개의 병렬 분기(`if (linkedNodeExec)` / `else`)가 각각 자기 완결적인 트랜잭션
    블록을 갖는 선형 구조이고, 중첩 깊이는 트랜잭션 콜백 1단만 추가돼 최대 2~3단을
    넘지 않으며, 순환 복잡도에 기여하는 분기점은 `if (linkedNodeExec)` 하나뿐이다.
    나머지는 이 저장소가 일관되게 쓰는 근거 주석(왜 이렇게 짰는지, 과거 어떤 결함을
    이렇게 막았는지)이 절반 이상을 차지한다.
  - 제안: 즉시 조치 불필요(이전 두 라운드의 판정에 동의). 다음에 이 함수를 다시
    건드릴 기회가 있으면, 두 분기의 "트랜잭션 열기 → 분기별 쓰기 로직 → 공통 종결부"
    골격 자체를 상위 헬퍼로 승격하는 리팩터를 후보로 남겨 둘 만하다(지금은 종결부만
    공유하고 트랜잭션 개시부는 여전히 두 곳에 복제돼 있다 — `let persisted = false;
    await this.dataSource.transaction(async (manager) => { ... });` 골격이
    `:8643-8664`·`:8709-8745` 에 각각 있다). 이번 diff 범위에서 강제할 사안은 아니다.

- **[INFO]** 신규 테스트 2건이 "트랜잭션 manager 를 경유한 UPDATE 호출만 필터링" 하는
  로직을 거의 동일하게 반복한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4836-4839`
    와 `:4860-4863` (`const txUpdateCalls = mockTxManagerQuery.mock.calls.filter((c) =>
    typeof c[0] === 'string' && /UPDATE execution/.test(c[0]));`)
  - 상세: 롤백 테스트와 공허-방지 테스트 두 곳에 3줄짜리 필터 로직이 리터럴로 복제돼
    있다. 로직 자체는 짧고 서로 다른 단언(`toBeGreaterThan(0)` vs `toBe(1)`)으로
    이어지므로 지금 당장 결함 위험은 낮지만, `mockTxManagerQuery` 를 전제로 하는
    이 스펙 파일에서 같은 필터가 앞으로 더 늘어날 가능성이 있다(파일 전역에
    `/UPDATE execution/` 매칭이 이미 22곳 — `17_36_15` maintainability INFO 3 이 지적).
  - 제안: 이번 diff 범위 밖이라 즉시 조치 불필요. 향후 유사 단언이 한두 곳 더
    늘어나면 `getTxUpdateCalls(mockTxManagerQuery)` 같은 공유 헬퍼로 뽑는 것을
    고려할 만하다.

## 확인한 개선사항 (참고 — 새 결함 아님)

- **`finishStatusTransition` 추출은 정확히 의도대로 동작한다.** `17_36_15` maintainability
  WARNING("두 분기의 종결부 4줄이 손으로 복제돼 있다")이 지적한 대상을
  `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8768-8779`
  의 `private finishStatusTransition(...)` 로 정확히 추출했고, 두 호출부(`:8665`,
  `:8746`)가 동일한 시그니처로 위임한다. 헬퍼 자체의 JSDoc(`:8754-8767`)이 "왜
  추출했는가"(형제 분기 drift 이력)를 명시해, 다음에 종결부 로직이 바뀔 때 한쪽만
  고치는 경로가 구조적으로 막혔다 — 이 저장소가 반복 겪은 결함 클래스에 대한
  정확한 처방이다.
- **JSDoc 호출부 개수 정정(`9d5e001bf`)도 실측과 일치한다.** `18_10_28` W1 이 지적한
  "11곳 전수 대조" 문구가 실제로는 파일 내부 직접 호출만 센 것이었는데, 현재
  JSDoc(`:8565-8582`)은 "20곳(파일 내 11 + `EngineDriver` 경유 9)" 으로 정정하고
  "이 확인은 어휘적(lexical) 범위" 라는 한계까지 명시한다 — 안 한 확인을 했다고
  쓰지 않는 정직한 서술이며, 유지보수성 관점에서 다음 독자가 신뢰할 수 있는 문서다.
- 네이밍(`finishStatusTransition`, `elseStatusesSql`, `mockTxManagerQuery`)·중첩
  깊이·매직 넘버 관점에서는 새로 도입된 결함이 없다. SQL 파라미터는 전부 `$1`~`$8`
  위치 바인딩이고, 트랜잭션 콜백 패턴은 같은 파일의 짝 전이 분기·`lockNonTerminalExecutionRow`
  가 이미 쓰던 관용구를 그대로 재사용해 스타일 일관성을 유지한다.
- `plan/in-progress/*.md` 2건·`CHANGELOG.md`·`spec/**` 2건의 변경은 진행 상황 서술·
  소급 각주 갱신으로, 코드가 아니라 추적 문서이며 유지보수성 관점의 코드 이슈에
  해당하지 않는다.

## 요약

이번 diff 는 `updateExecutionStatus` else 분기를 트랜잭션으로 감싸는 핵심 수정에,
직전 두 리뷰 라운드가 지적한 WARNING(종결부 4줄 중복, 호출부 개수 오기재)의 실제
해소가 더해진 누적분이다. 두 WARNING 모두 우회나 미봉이 아니라 구조적으로 올바르게
처리됐다 — 중복은 `finishStatusTransition` 헬퍼로, 개수 오류는 정확한 재실측과
확인 범위의 한계 명시로. 남은 항목은 함수 길이(169줄, 대부분 주석·선형 구조)와 신규
테스트의 사소한 3줄 중복 두 건뿐이며 둘 다 INFO 수준으로, 이전 라운드의 판정과
독립적으로 재확인해도 즉시 조치가 필요하지 않다. 새로 도입된 가독성·네이밍·중첩·
매직넘버·일관성 결함은 없다.

## 위험도

LOW
