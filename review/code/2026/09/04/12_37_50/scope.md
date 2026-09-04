# 변경 범위(Scope) 리뷰

## 검토 대상 확인

`git diff origin/main...HEAD` 기준 68개 파일. 실질 코드/문서 변경은 파일 1~18(`CHANGELOG.md`,
`common/__test-utils__/{source-scan,temp-fixture}.{ts,spec.ts}`, DTO 2개, repo-guards 9개,
`plan/in-progress/spec-draft-nullable-notation-followups.md`)이고, 나머지 50개(파일 19~68)는
`review/code/2026/09/04/{11_02_30,11_44_16,12_17_50}/**` + `review/consistency/2026/09/04/11_33_21/**`
— 이 저장소 표준 워크플로(`/ai-review`·`--impl-done` 은 구현 완료 후 상시 승인된 강제 단계,
CLAUDE.md "외부 LLM 호출 정책")가 만든 산출물이라 스코프 위반이 아니다.

핵심 주제는 단일하다 — "Swagger `@ApiProperty`/`@ApiPropertyOptional` 선언과 TS 타입의
nullable/presence 불일치(계약 거짓) 9곳 수정 + 그 축을 잡는 신규 AST 가드
(`swagger-dto-contract-guard.ts`/`.spec.ts`) 신설" 이며, 그 위에 3회 code-review
(`11_02_30`→`11_44_16`→`12_17_50`)·1회 consistency-check(`11_33_21`)의 WARNING 을 순차
해소한 fix 커밋들이 쌓여 있다.

## 발견사항

- **[NONE]** 이전 두 라운드(1R `review/code/2026/09/04/11_02_30/scope.md`, 2R
  `review/code/2026/09/04/11_44_16/scope.md`)와 직전 라운드(3R
  `review/code/2026/09/04/12_17_50/scope.md`)가 3회 연속 WARNING 으로 지목했던
  `plan/in-progress/execution-engine-residual-gaps.md`(브랜치 주제와 무관한 execution-engine
  G2 재실측, 커밋 `8691a2f25`, 다른 worktree 소유 선언 파일)가 **이번 라운드 diff 에는 없다**.
  - 위치: (부재 확인) `git diff origin/main...HEAD -- plan/in-progress/execution-engine-residual-gaps.md`
    → 0줄. 최신 커밋 `fd5697f92`(`git show fd5697f92 -- plan/in-progress/execution-engine-residual-gaps.md`)
    가 `8691a2f25` 의 삽입 16줄을 그대로 되돌렸다(diff 상 순삭제 16줄, 다른 수정 없음).
  - 상세: 커밋 메시지가 "W2 — 무관한 plan 편집 분리 … 3라운드 연속 지적됐다. 되돌렸고, 내용은
    유효하므로 별 브랜치로 따로 올린다" 로 명시한다. `git diff origin/main HEAD -- <그 파일>`
    이 완전히 빈 것으로 원복이 정확함을 확인했다(cp 원복이 아니라 정상 커밋 되돌리기).
  - 제안: 없음 — 이미 해소됐다. 되돌린 내용을 실제로 별 브랜치로 올릴 것인지는 이 리뷰
    스코프 밖(사용자/다음 세션 확인 사항).

- **[NONE]** 경로 정규화(`toPosixPath`/`toPosixRelative`) 적용 범위가 라운드를 거치며 1곳→4곳
  (1R fix)→8곳(2R 추출)→"실은 4곳 누락됨을 재발견해 진짜 8곳 전부"(3R fix) 로 넓어졌다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/{engine-error-code-anchor-guard.ts:170,196,
    masked-reject-callers-guard.ts:142, nullable-type-lie-cast-guard.ts:52,126,259,
    production-build-devdep-guard.ts:120}`, `audit-action-binding.spec.ts:63-66`,
    `websocket-events.types.spec.ts:312`
  - 상세: 확장은 매 라운드 자기 신고(RESOLUTION.md "W3 확장 수정" 절, 커밋 메시지에 "지적
    자리보다 넓게 고침"/"세 자리 동시 수정" 명시)됐고, 넓힌 근거("형제 가드 관례 이탈이 세 곳
    더 있다")도 검증 가능한 주장이라 매번 실측(`grep 'path\.relative('`)으로 뒷받침됐다.
    직접 재검증: 현재 `grep -rn 'path\.relative(' codebase/backend/src | grep -v
    'toPosixPath\|toPosixRelative'` → **0건**. 3R 커밋이 스스로 지적한 "고친 것만 세고 결함은
    안 셌다"(2R 의 검증 패턴이 이미 정규화된 자리만 매칭하는 결함)라는 자기반증도 이번엔
    반대 방향 패턴(`path.relative(` 자체)으로 재검증돼 있어 신뢰할 만하다. 각 확장이 신규
    기능이 아니라 이미 저장소에 존재하던 단일 관례(크로스플랫폼 경로 정규화)를 일관되게
    적용하는 것에 그쳐, 기능 확장(over-engineering)이 아니다.
  - 제안: 문제 아님(정보성) — 스코프 확장이 반복됐지만 매번 자기신고+검증됐고 최종적으로
    저장소 전수 스캔 0건으로 수렴했다.

- **[NONE]** `background-run-response.dto.ts` 8개 데코레이터 변경 + `ApiPropertyOptional`
  import 제거, `create-assistant-session.dto.ts` `llmConfigId` 1줄 변경 — 커밋 메시지가 선언한
  "9곳"과 정확히 일치한다. import 제거는 사용처가 없어진 데 따른 즉시 정리이지 드라이브바이
  정리가 아니다.
- **[NONE]** 신규 가드(`swagger-dto-contract-guard.ts`) 는 presence·null 두 축만 판정한다 —
  자동 수정, 3번째 축, 다른 데코레이터 종류로의 확장 없음. `Transform` 예외 하나도 실측
  근거(1,096개 중 18개, 그중 축이 갈리는 것 1개)를 문서화했다.
  - 참고: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 전문을
    직접 `Read`/`grep` 로 확인 — 프롬프트에는 크기 제한으로 diff 가 생략돼 있었다.
- **[NONE]** `temp-fixture.ts`/`temp-fixture.spec.ts` 신설(`nullable-type-lie-cast.spec.ts` 안의
  지역 `withFiles` 추출) + async-thenable 즉시 실패 처리 + rejection 핸들러 부착은 새 소비처
  (`swagger-dto-contract.spec.ts`)가 요구하는 최소 범위이자 리뷰 W4→3R W3 로 이어진 자기 검증
  루프의 결과다. `nullable-type-lie-cast.spec.ts` 의 지역 `withFixture` 도 공유 헬퍼로 위임하도록
  정정돼 서술("얇은 래퍼")과 구현이 일치한다.
- **[NONE]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 변경은 이번 작업이
  만든 실측치 갱신(101→103 등, AST 재측정 근거 명시)·완료 체크박스(`[x]` 계약 거짓 9곳)·후속
  항목 등재이며, `QueryExecutionDto.workflowId` 죽은 필드 등 새로 발견한 별건은 코드로 확장하지
  않고 "이 draft 범위 밖 — 등재만"으로 명확히 분리했다.
- **[NONE]** `CHANGELOG.md` 신규 항목은 자매 커밋(`invitedBy`·`ipWhitelist`)과 동일 포맷으로
  9곳 수정만 기술한다 — 무관한 서술 삽입 없음.
- **[NONE]** 포맷팅/주석/임포트 변경이 실질 변경과 뒤섞인 흔적 없음. 확인한 임포트 변경은
  전부 `toPosixRelative` 도입에 따른 정당한 추가/제거이며, `masked-reject-callers-guard.ts`·
  `swagger-dto-contract-guard.ts` 의 `path` import 제거는 실사용 0(주석 언급만 있던 자리는
  `grep 'path\.'` 로 직접 재확인)을 확인 후의 정당한 정리다.

## 요약

핵심 변경(Swagger DTO nullable/presence 계약 불일치 9곳 수정 + AST 가드 신설)은 4개 리뷰
라운드를 거치며 범위가 흔들리지 않았고, 유일한 리팩터(`temp-fixture.ts`/`toPosixPath`·
`toPosixRelative` 추출)도 신규 가드가 직접 요구하는 최소 범위였다. 3라운드 연속 지적됐던
유일한 실질 스코프 위반 — 무관한 `execution-engine-residual-gaps.md` G2 plan 편집 — 은 최신
커밋(`fd5697f92`)에서 완전히 되돌려졌음을 `git diff`/`git show` 로 직접 확인했다. 경로
정규화 확장은 라운드마다 넓어졌지만 매번 자기신고·재검증을 거쳤고 현재 저장소 전수 스캔이
잔여 0건임을 직접 재현했다. `review/code/**`·`review/consistency/**` 산출물 50개는 이 저장소의
표준 강제 워크플로 산출물이라 스코프 위반이 아니다. 블로킹할 스코프 이슈는 없다.

## 위험도

NONE
