# 변경 범위(Scope) 리뷰

## 커밋 구조 확인

리뷰 대상 브랜치(`claude/entity-nullable-batch3`, `origin/main..HEAD`)는 커밋 2개로 구성된다.

| 커밋 | 요지 | 대상 파일 |
|---|---|---|
| `fefec2b27` `fix(dto): OpenAPI 선언과 TS 타입이 어긋난 9곳 + 그 축을 무는 가드` | Swagger DTO nullable/presence 계약 불일치 9곳 수정 + AST 기반 회귀 가드 신설 | 파일 1~6, 8 |
| `8691a2f25` `docs(plan): G2 차단 전제 재실측 — 둘 다 유효, 유예 유지` | `execution-engine-residual-gaps.md` 의 G2(errorPolicy `continue`) 차단 사유 재확인 | 파일 7 |

## 발견사항

- **[INFO]** 서로 무관한 두 작업(Swagger DTO 계약 수정, execution-engine G2 상태 재확인)이 한 리뷰 배치(브랜치)에 섞여 있다
  - 위치: `plan/in-progress/execution-engine-residual-gaps.md` 전체 (커밋 `8691a2f25`)
  - 상세: 파일 1~6·8 은 "`@ApiPropertyOptional`/TS 타입 불일치 9곳 수정 + 재발 방지 가드"라는 단일 주제로 일관되지만, 파일 7 은 완전히 다른 기능 영역(execution-engine 의 SIGTERM 중단 시 `errorPolicy='continue'` 분기, G2 항목)을 다룬다. 코드 변경도 전혀 겹치지 않고 커밋도 독립적으로 분리돼 있어 "의도 이상의 변경"이 코드에 섞여 들어간 것은 아니다 — 각 커밋 자체는 원자적이고 스스로 잘 설명된다. 다만 파일 7 의 워크트리(`plan-in-progress-items-b0c80b`)명이 "plan in-progress 항목 훑기"라는 이 세션의 상위 과제를 시사하므로, 두 커밋이 그 상위 과제 아래 묶인 것으로 보인다.
  - 제안: 두 커밋이 별개 PR 로 분리 가능하면 리뷰·머지 단위를 나누는 편이 diff 를 더 명확하게 만든다. 이미 이 worktree 의 상위 과제(plan/in-progress 항목 재검토)가 두 항목을 함께 포함하는 것이 맞다면 현행 유지도 무방 — blocking 사안은 아니다.

- **[INFO]** `nullable-type-lie-cast.spec.ts` 안의 지역 `withFiles` 헬퍼를 공유 파일(`temp-fixture.ts`)로 추출
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` (게이트 25, 41-51) / `codebase/backend/src/common/__test-utils__/temp-fixture.ts` 전체
  - 상세: 이번 PR 이 신설하는 `swagger-dto-contract.spec.ts` 가 같은 tmpdir 픽스처 골격을 필요로 하면서 두 번째 소비처가 생겼다. 커밋 메시지·docstring 모두 "사본 5개를 없앤 직후에 새 사본을 만들지 않기 위해서"라는 근거를 명시하고, 순수 함수 이동만 있을 뿐 동작 변경이 없다(코드가 그대로 옮겨졌음을 diff 로 확인). 리팩토링이지만 이번 작업(새 가드 spec 추가)이 직접 요구하는 최소 범위이며 무관한 정리가 아니다 — 문제로 보지 않는다.
  - 제안: 없음 (정보성 기록).

- **[NONE]** `background-run-response.dto.ts` 의 8개 데코레이터 변경은 커밋 메시지가 명시한 "8곳"(`finishedAt`·`durationMs`×2·`inputData`·`outputData`·`error`·`nextCursor`·`completedAt`)과 정확히 일치한다. `ApiPropertyOptional` import 제거도 더 이상 쓰이지 않아 남긴 것이 아니라 실제로 사용처가 없어진 데 따른 정리다 — 드라이브바이 정리가 아니라 이번 변경이 만든 dead import 를 즉시 제거한 것.
- **[NONE]** `create-assistant-session.dto.ts` 는 `llmConfigId` 필드 1줄만 변경 — 커밋이 설명하는 "반대 방향 1곳"과 일치.
- **[NONE]** 신규 파일(`swagger-dto-contract-guard.ts`, `swagger-dto-contract.spec.ts`) 은 이번에 고친 계약 불일치 축을 재발 방지하는 가드로, 수정 자체가 요구하는 "재발 방지 가드"라는 명시적 목표(커밋 메시지, `spec-draft-nullable-notation-followups.md` 후속 항목)에 부합한다. 과도한 기능 확장(예: presence 축 자동 수정, 다른 축까지 판정 확장)은 없다 — presence·null 두 축만 판정.
- **[NONE]** `spec-draft-nullable-notation-followups.md` 변경은 이번 수정으로 갱신된 실측치(101→103, 18→17, 129건) 반영, 완료 체크박스 갱신, 새로 발견한 별건(`QueryExecutionDto.workflowId` 죽은 필드)을 "이 PR 범위 밖 — 등재만"으로 명확히 분리해 적었다 — 코드로 확장하지 않고 문서 등재에 그쳐 스코프를 스스로 지켰다.
- **[NONE]** 포맷팅/주석/임포트 변경이 실질 변경과 뒤섞인 흔적 없음 — 모든 diff hunk 가 목적과 직결된다.

## 요약

핵심 변경(파일 1~6, 8, 커밋 `fefec2b27`)은 "Swagger DTO nullable/presence 계약 불일치 9곳 수정 + 그 축을 잡는 AST 가드 신설"이라는 단일 목적에 정확히 부합하며, 유일한 리팩토링(`temp-fixture.ts` 추출)도 신규 가드가 직접 요구하는 최소 범위였다. 다만 브랜치에는 완전히 무관한 두 번째 커밋(`8691a2f25`, execution-engine G2 상태 재확인, 파일 7)이 함께 실려 있어 diff 전체로 보면 두 개의 독립 주제가 한 리뷰 배치에 섞여 있다 — 각 커밋 자체는 원자적이고 자기 완결적이라 "의도 이상의 변경"이 코드 레벨에서 섞인 것은 아니며, 워크트리명(`plan-in-progress-items`)이 시사하는 상위 세션 과제(plan 항목 훑기) 아래 있는 것으로 보인다.

## 위험도

LOW
