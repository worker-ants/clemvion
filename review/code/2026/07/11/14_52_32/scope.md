# 변경 범위(Scope) 리뷰

## 검증 방법

`prompt_file` 의 diff 만으로는 판단이 어려운 부분(파일 1이 신규처럼 보이는 이유, DTO 내용의 실질 변경 여부, plan 체크박스 정합성)은 워크트리에서 `git diff origin/main -M`, `git log`, `git show <commit>` 으로 실제 커밋 경계와 rename 여부를 직접 확인했다.

## 발견사항

- **[INFO]** DTO 재배치(파일 1~7)는 계획 항목과 1:1로 정합
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/*.ts`, `interaction.controller.ts`, `interaction.service.ts`, `interaction.controller.spec.ts`
  - 상세: `git diff origin/main -M --diff-filter=R` 로 확인한 결과 `dto/responses.dto.ts`→`execution-status-response.dto.ts`(유사도 78%), `dto/responses.dto.spec.ts`→`execution-status-response.dto.spec.ts`(유사도 95%) 가 rename 으로 감지된다. 신규로 보이는 `execution-status-response.dto.ts` 본문을 origin/main 의 구 `responses.dto.ts` 와 대조한 결과 **바이트 단위로 동일**하며, 유일한 차이는 서브디렉토리 한 단계 깊어짐에 따른 상대경로 보정(`ConversationThread` import `../../../`→`../../../../`, spec 링크 JSDoc `../` 6→7개)뿐이다. `interact-ack-response.dto.ts`/`refresh-token-response.dto.ts` 로 분리된 내용도 구 파일의 해당 export 를 그대로 옮긴 것이고, controller/service/controller.spec 의 diff 는 import 경로 변경뿐 로직 변경이 없다. 이는 `plan/in-progress/eia-context-schema-followups.md` 의 "`external-interaction` 모듈 응답 DTO 위치 정규화" 항목(swagger.md §5-1 준수)과 정확히 일치하는 순수 이관이며, `execution-status-response.dto.spec.ts` 도 신규 테스트가 아니라 같은 파일의 이동이다. 스코프 이탈 없음.

- **[WARNING]** plan 파일 커밋이 본 작업과 무관한 두 체크박스만 반영, 정작 본 작업의 체크박스는 미반영
  - 위치: `plan/in-progress/eia-context-schema-followups.md` (커밋 `aa9a25300`, diff 상 "파일 8")
  - 상세: 이 브랜치는 두 개의 분리된 커밋으로 구성된다 — `31bbbac31`(DTO 재배치, 위 INFO 항목) 과 `aa9a25300`(plan 문서 체크박스 정정). 후자는 "channel-web-chat 타입체크를 harness 에 배선"(C2)·"spec-link 가드의 CI trigger 확대"(W-spec-link-ci) 두 항목을 `[x]` 로 바꾸는데, 커밋 메시지 자체가 밝히듯 이 둘은 **본 브랜치가 아니라 이미 머지된 별개 PR #913**(`git log` 상 `21bb5ac54`)에서 완료된 작업이다 — 즉 이번 diff 의 코드 변경(파일 1~7, DTO 재배치)과 아무 관련이 없다. 더 눈에 띄는 점은, 정작 이번 브랜치가 실제로 완료한 "`external-interaction` 모듈 응답 DTO 위치 정규화" 항목(같은 파일 16번째 줄)은 diff 이후에도 여전히 `- [ ]` 미체크 상태로 남아 있다는 것이다 — plan 파일을 건드리면서도 자기 작업의 체크박스는 갱신하지 않고, 관련 없는 타 PR 의 뒤늦은 문서 동기화만 끼워 넣은 형태.
  - 제안: 별도 커밋으로 이미 분리돼 있으므로 코드 리스크는 없으나, (1) 이 plan 문서 동기화 커밋은 별도 PR/브랜치로 분리하거나, (2) 같은 PR 에 유지할 경우 "DTO 위치 정규화" 항목도 함께 `[x]` 처리해 이번 PR 이 실제로 완료한 작업과 plan 상태를 일치시킬 것. (참고: 프로젝트 규약 "plan 체크박스 = 실제 상태".)

- **[INFO]** 포맷팅/주석/임포트/설정 파일 변경 없음
  - 상세: 리뷰 대상 전 파일에 걸쳐 로직과 무관한 공백·개행 재정렬, 불필요한 주석 추가/삭제, 미사용 임포트, `.eslintrc`/`tsconfig`/CI 설정 등 무관한 변경은 발견되지 않았다. 임포트 변경은 모두 파일 이동에 따른 경로 갱신이며 실질적으로 참조하는 심볼 집합은 변경 없음(`grep` 으로 구 경로 잔존 참조 0건 확인).

## 요약

핵심 코드 변경(파일 1~7)은 `plan/in-progress/eia-context-schema-followups.md` 가 명시한 "external-interaction 모듈 응답 DTO 위치 정규화" 작업 범위에 정확히 부합하는 순수 파일 이관 + import 표면 갱신이며, 로직·wire 계약 변경이 전혀 없다(rename 감지 + 내용 diff 로 실증). 유일한 스코프 이탈은 plan 문서를 갱신하는 두 번째 커밋으로, 본 작업과 무관한 별개 PR(#913)의 완료 항목 체크박스만 정정하고 정작 본 작업 항목은 미체크로 남겨 — 코드 리스크는 없지만 문서 정합성 관점에서 범위 밖 수정이다.

## 위험도

LOW
