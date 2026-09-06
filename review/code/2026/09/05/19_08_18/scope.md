# 변경 범위(Scope) 리뷰

## 검토 방법

이번 changeset(51개 파일, `origin/main` 대비 2645/36)은 세 커밋의 누적이다 —
`dfb2664af`(§5.4 스윕 1차: 14개 e2e 배선 + 트리거/스케줄 secret 유출 수정 + 23필드
선언 보정), `cb17f0870`(직전 라운드 `--impl-done`/`--ai-review` 지적 반영: optional/
nullable 금지 조합 정정 + 래칫 가드 신설 + 그 밖의 fix), `f7909a004`(두 라운드의 리뷰
산출물 커밋). 프롬프트 diff 와 `git diff origin/main --stat`(51개 파일 일치),
`git show cb17f0870`(두 번째 커밋 단독 diff)를 대조해 어느 변경이 최초 스윕 범위이고
어느 것이 자기 교정인지 구분했다. 저장소에는 아무것도 쓰지 않았다(`git status --short`
확인 완료, read-only 대조와 `npx jest`(단일 테스트, 부작용 없음) 실행만 수행).

## 발견사항

- **[INFO]** `workflow-crud.e2e-spec.ts` 에서 같은 모듈의 두 DTO(`ExportWorkflowDto`,
  `WorkflowDto`)를 import 두 줄로 나눠 적었다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` — `import { ExportWorkflowDto } from '../src/modules/workflows/dto/responses/workflow-response.dto';` 줄 바로 아래 기존 `WorkflowDto` import.
  - 상세: 순수 스타일 문제이고 기능 영향은 없다. 직전 라운드(`review/code/2026/09/05/18_23_02/scope.md`)가 이미 이 지점을 INFO 로 지적하고 "매우 사소해 이번 PR 을 막을 사유는 아니다"로 처분했으며, 이번 라운드(`cb17f0870`)에서도 그대로 남아 있다 — 새로 생긴 결함이 아니라 이미 알려진 채로 이월된 항목이다.
  - 제안: `import { ExportWorkflowDto, WorkflowDto } from '...';` 로 병합 가능하나 불요.

- **[INFO]** 한 PR/브랜치 안에 성격이 다른 세 관심사(① 14개 e2e 로 계약 검증자 배선 확장,
  ② 트리거 회전 secret 이중 유출 보안 수정, ③ 이전 커밋 자신이 도입한 §5.4 금지 조합
  위반의 자기 교정 + 세 번째 축 래칫 가드 신설)가 누적됐다.
  - 위치: `dfb2664af`(①·②) → `cb17f0870`(③) → `f7909a004`(리뷰 산출물 커밋)의 3커밋 시퀀스 전체.
  - 상세: ①·②는 CHANGELOG·plan 트래커가 명시하듯 "검증자를 넓히다가 실측으로 발견한 결함은 그 자리에서 고친다"는 원칙에 부합해 별도 PR 로 쪼갤 이유가 약하다(직전 라운드 scope.md 가 이미 이 결론을 냈다). ③은 새로 발견한 결함이 아니라 **같은 브랜치의 직전 커밋이 스스로 만든 위반**을 같은 PR 안에서 `--impl-done`/`--ai-review` 게이트가 잡아 즉시 되돌린 것이고, 이는 프로젝트 규약(`CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무")이 명시적으로 기대하는 흐름이다 — 스코프 위반이 아니라 오히려 그 규약이 의도한 대로 작동한 사례다. 다만 이후 `git log`/`git blame` 으로 "이 브랜치가 무엇을 했는가"를 추적할 때, 세 관심사가 커밋 경계로는 분리돼 있지만(각 커밋 메시지가 정확히 자기 범위만 서술) 최종 병합 시점에는 한 PR 로 뭉쳐 보일 수 있다는 점만 참고로 남긴다.
  - 제안: 조치 불요 — 이미 근거·경계가 커밋 메시지·CHANGELOG·plan 트래커에 정확히 기록돼 있다.

- **[INFO]** `swagger-dto-contract-guard.ts` 에 신설된 세 번째 축(`findOptionalNullableResponseFields`,
  91줄)과 `swagger-dto-contract.spec.ts` 의 78건 래칫 목록(126줄)이 "§5.4 응답-계약 스윕"
  이라는 원래 작업 범위보다 넓어 보일 수 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`(`OptionalNullableOffender`/`isResponseDtoFile`/`findOptionalNullableResponseFields`), `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`(`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 목록 + 3개 신규 테스트).
  - 상세: 이 축은 새 기능 확장이 아니라, **바로 이 PR 의 첫 판(`dfb2664af`)이 §5.4 금지 조합을 23개 필드로 재도입한 것**을 두 consistency checker(`rationale_continuity`·`convention_compliance`)가 Critical 로 잡아낸 데 대한 구조적 재발 방지책이다 — "런타임 검증자(값 축)도 정적 가드(presence/null 축)도 이 조합을 구조적으로 못 본다"는 근거가 CHANGELOG·가드 JSDoc·consistency RESOLUTION 세 곳에 일관되게 남아 있다. 78건 목록은 새로 만든 부채가 아니라 **이미 존재하던 부채(종전에 알려진 10건)를 전수 술어로 처음 정확히 센 것**이라고 명시돼 있다. over-engineering 이 아니라 같은 결함 클래스의 두 번째(첫 판 자체) 재발에 대한 비례적 대응으로 판단한다.
  - 제안: 조치 불요.

- **[INFO]** `contractForDto` 메모이제이션(`response-contract.ts`, in-flight promise 캐시)과
  `allowMissing` 옵션 신설이 "14개 e2e 배선"이라는 핵심 작업과 별개의 코드 변경처럼 보일 수
  있다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts`.
  - 상세: 둘 다 배선 자체를 가능케 하는 전제조건으로 문서화돼 있다 — 메모이제이션이 없으면 14개 e2e 파일마다 `beforeAll` 보일러플레이트를 반복해야 했고(CHANGELOG "한 줄이 됐다"), `allowMissing` 은 `ExportWorkflowDto.formatVersion`(이미 spec 에 Planned 로 문서화된 기존 갭) 배선을 위해 필요한 최소 확장이다. 범위를 벗어난 편의 기능 추가가 아니라 배선 작업의 종속 요구사항이다.
  - 제안: 조치 불요.

## 확인한 항목 (스코프 이탈 아님)

- `IntegrationDto.consecutiveNetworkFailures`(FE 참조 0곳)는 제거가 아니라 선언만 했다 — "선언을 실제에 맞춘다"는 이번 PR 원칙에 정확히 부합하는 최소 개입이며, 제거는 wire 변경이라 별도 plan 항목(`spec-draft-nullable-notation-followups.md`)으로 명시적으로 미뤄 두었다.
- 리뷰 산출물 42개 파일(`review/code/2026/09/05/18_23_02/**`, `review/consistency/2026/09/05/18_23_03/**`)은 프로젝트 관례(코드 리뷰/일관성 검토 산출물은 해당 디렉터리에 커밋)에 부합하며, "무관한 파일 수정"이 아니다.
- `triggers.service.ts` 의 `sanitizeForResponse` 내부 재인덴트(공백만 다른 8줄, `git diff -w` 대조로 확인)는 조기 return 제거 + `config.notification.signing` 분기 추가로 기존 블록이 새 `if (cfg.chatChannel)` 안으로 들어가며 생긴 불가피한 부산물이지, 실질 변경과 무관하게 끼워 넣은 포맷팅이 아니다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신은 이 작업이 직접 만든 트래커 항목(`CanvasSaveResultDto`, `consecutiveNetworkFailures` 제거 검토, §5.4 스윕 2차)을 등재하는 것으로, 코드를 건드리지 않고 백로그에만 남겨 스코프 경계를 지킨 흔적이다.

## 요약

이 changeset 은 워크트리 이름(`sweep-response-contract`) 그대로 §5.4 응답-계약 검증자
배선을 4→18개 DTO 로 넓히는 작업이되, 그 과정에서 실측으로 드러난 보안 결함(트리거
회전 secret 이중 유출)과 검증자 자신의 사각지대(같은 PR 1차 커밋이 재도입한 §5.4 금지
조합)를 같은 브랜치 안에서 즉시 고친 3-커밋 시퀀스다. 각 확장(메모이제이션,
`allowMissing`, 세 번째 축 래칫 가드)은 전부 핵심 배선 작업의 종속 요구사항이거나
같은 PR 내부 리뷰 게이트가 지적한 자기 결함의 교정이며, 근거가 CHANGELOG·plan
트래커·커밋 메시지 세 곳에 일관되게 기록돼 있다. 손대지 않기로 한 항목(2차 스윕
후보, `consecutiveNetworkFailures` 제거)은 코드가 아니라 백로그에만 등재됐다. 유일한
잔여 흠은 이미 이전 라운드에서 조치 불요로 처분된 사소한 import 분리 1건이며, 의도
밖 리팩토링·무관한 파일 수정·불필요한 기능 확장·실질 변경에 섞인 포맷팅은 관측되지
않았다.

## 위험도

NONE
