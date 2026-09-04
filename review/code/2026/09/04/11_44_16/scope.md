# 변경 범위(Scope) 리뷰

## 커밋 구조 확인

리뷰 대상 diff(`cce8a188b..HEAD`, 34 파일)는 커밋 9개로 구성된다.

| 커밋 | 요지 |
|---|---|
| `fefec2b27` | Swagger DTO nullable/presence 계약 불일치 9곳 수정 + AST 기반 회귀 가드(`swagger-dto-contract-guard.ts`/`.spec.ts`) 신설 |
| `8691a2f25` | `execution-engine-residual-gaps.md` G2/G3 차단 전제 재실측(무관 주제) |
| `59f83058e`·`27d85e74c`·`a3111ab57`·`90db4b0f4` | 직전 code-review(`11_02_30`) WARNING 5건(W1~W5) 해소 |
| `0ff2d19d0` | 그 리뷰의 산출물(`RESOLUTION.md`·`SUMMARY.md`·`meta.json` 등) 커밋 |
| `2bd48a38b` | plan 실측표가 같은 PR 안에서 낡은 것을 정정 |
| `4be1249f1` | 직전 consistency-check(`11_33_21`) WARNING 2건(낡은 plan 참조·§5.4 요청 DTO 오적용) 해소 + 그 산출물 커밋 |

이 프로젝트 규약상 `/ai-review`·`--impl-done` 은 구현 완료 후 상시 승인된 강제 단계이고 그
산출물(`review/**`)은 gitignore 대상이 아니다(CLAUDE.md "외부 LLM 호출 정책", 사용자 메모리
`feedback_plan_checkbox_actual_state`). 파일 13~34(review/code, review/consistency 산출물)는
전부 이 표준 워크플로가 만든 부산물이며 별도 기능 추가가 아니므로 스코프 위반으로 보지 않는다.

## 발견사항

- **[INFO]** 무관한 주제 하나가 여전히 같은 diff 에 섞여 있다 — 이번에는 그 plan 문서가 **다른
  worktree 소유**라는 사실까지 확인됨
  - 위치: `plan/in-progress/execution-engine-residual-gaps.md` 게이트 54-69 (커밋 `8691a2f25`)
  - 상세: 이 블록은 execution-engine 의 G2(`errorPolicy: 'continue'` 용어 매핑)·G3(인터럽트 복구
    인프라) 차단 사유를 재확인하는 내용으로, 이번 diff 의 나머지 전부(Swagger DTO
    nullable/presence 계약 정정 + 가드 + 그 리뷰 대응)와 코드·주제 어느 쪽도 겹치지 않는다.
    직접 파일을 열어 frontmatter 를 확인하니 `worktree: spec-frontmatter-status-migration-027c17`
    로 선언돼 있다 — 즉 이 plan 문서 자신은 **현재 이 리뷰가 도는 worktree
    (`plan-in-progress-items-b0c80b`)의 소유가 아니라고 스스로 적어 두고 있다.** 다만 현재
    worktree 이름 자체가 "plan-in-progress-items" 라 이 세션의 상위 과제가 "plan/in-progress
    항목 전반을 훑는 것"일 가능성이 높고, 그렇다면 서로 다른 주제의 plan 항목을 함께 다루는 것은
    그 상위 과제 안에서는 예정된 동작이다. 코드 변경과는 섞이지 않고(파일 7~34 어디에도 G2/G3
    관련 코드 변경 없음) 커밋도 독립적이라, 직전 라운드(`11_02_30/scope.md`)의 판단(INFO/LOW)을
    유지한다 — 다만 "다른 worktree 소유 plan 을 이 worktree 에서 고쳤다"는 사실은 다음 사람이
    plan lifecycle 정합성을 볼 때 참고할 만해 명시해 둔다.
  - 제안: 상위 세션이 실제로 "plan/in-progress 전역 훑기"라면 현행 유지 무방. 아니라면 이 블록은
    별도 커밋/PR 로 분리하고, `execution-engine-residual-gaps.md` 의 `worktree:` 필드도 실제
    편집 주체에 맞게 갱신을 검토.

- **[INFO]** WARNING 수정 하나가 리뷰어가 지목한 자리보다 넓게 고쳐졌다 — 의도적이고
  `RESOLUTION.md` 에 이미 자기 신고돼 있음
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 게이트
    48-53(`findCastOffenders`) · 122-126(`findUntypedNullableColumns`) · 256-259
    (`findStaleSpecCasts`) — 커밋 `59f83058e`
  - 상세: 직전 라운드 maintainability 리뷰어는 `swagger-dto-contract-guard.ts:125` 단 한 곳만
    지목했는데(SUMMARY #2), 수정은 형제 파일 `nullable-type-lie-cast-guard.ts` 안의 같은 결함
    3곳까지 함께 고쳤다. `RESOLUTION.md`(파일 13, "W3 확장 수정" 절)가 그 이유("지적된 한 자리만
    고치면 같은 저장소 관례 이탈이 세 곳 그대로 남는다")를 스스로 설명하고 있어 은폐된 확장은
    아니다 — "같은 결함 클래스를 형제 파일까지 정합화" 라는 근거가 합리적이고, 실제로도 순수
    문자열 정규화(`.split(path.sep).join('/')`) 추가뿐이라 동작 변경 위험이 낮다. 다만 엄밀히는
    이번 리뷰가 요청한 범위(그 한 줄)보다 넓은 수정이므로 기록해 둔다.
  - 제안: 문제 아님(정보성). 향후 "리뷰 지적 1곳 → 클래스 전체로 확장 수정" 패턴을 쓸 때는
    지금처럼 RESOLUTION 에 근거를 명시하는 관례를 유지할 것.

- **[NONE]** 핵심 코드 변경(`background-run-response.dto.ts` 8필드, `create-assistant-session.dto.ts`
  `llmConfigId`)은 커밋 메시지·CHANGELOG 가 선언한 "9곳"과 정확히 일치한다. `ApiPropertyOptional`
  import 제거는 더 이상 쓰이지 않게 된 데 따른 즉시 정리이지 드라이브바이 정리가 아니다.
- **[NONE]** 신규 가드(`swagger-dto-contract-guard.ts`/`.spec.ts`)는 presence·null 두 축만
  판정한다 — 요청 범위를 넘는 자동 수정·추가 축 확장 없음.
- **[NONE]** `temp-fixture.ts`/`temp-fixture.spec.ts` 추출과 async-thenable 가드는 직전 리뷰
  WARNING #3(side_effect)이 요구한 수정과 그 수정 자체를 검증하는 테스트로, 새로 만든 동작
  범위를 넘지 않는다.
- **[NONE]** `CHANGELOG.md`·`spec-draft-nullable-notation-followups.md`(파일 1, 12)의 나머지 수정은
  전부 이번 작업이 만든 실측치 갱신·완료 체크박스·후속 항목 등재이며, `QueryExecutionDto.workflowId`
  죽은 필드 등 새로 발견한 별건은 코드로 확장하지 않고 "이 PR 범위 밖 — 등재만"으로 명확히
  분리했다.
- **[NONE]** 포맷팅/주석/임포트 변경이 실질 변경과 뒤섞인 흔적 없음 — `git diff` 전수 확인 결과
  `console.log`/`debugger`/미사용 임포트 잔존 없음.

## 요약

핵심 변경(Swagger DTO nullable/presence 계약 불일치 9곳 수정 + AST 가드 신설 + 그 직전 두 차례
리뷰(`11_02_30` code-review, `11_33_21` consistency-check)의 WARNING 전량 해소)은 각 리뷰가
요청한 범위와 정확히 일치하고, 유일한 리팩터(`temp-fixture.ts` 추출)도 신규 가드 spec 이 직접
요구하는 최소 범위였다. WARNING 수정 하나(경로 정규화)가 지목된 한 자리에서 형제 파일 3곳까지
확장됐지만 `RESOLUTION.md` 에 근거가 명시돼 있어 은폐된 스코프 확장이 아니다. 유일한 잔여 관찰은
직전 라운드부터 이어지는 것으로, 완전히 무관한 주제(execution-engine G2/G3 재실측)가 같은 diff 에
섞여 있고 그 plan 문서 자신은 다른 worktree(`spec-frontmatter-status-migration-027c17`) 소유로
선언돼 있다는 점이다 — 코드 레벨 오염은 없고 현재 worktree 이름이 시사하는 "plan/in-progress
전역 훑기"라는 상위 과제 아래 있다면 설계대로다.

## 위험도

LOW
