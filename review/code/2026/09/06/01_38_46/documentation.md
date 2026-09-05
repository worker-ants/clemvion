# 문서화(Documentation) Review

## 발견사항

- **[INFO]** `TriggerDto.workflow` / `ScheduleDto.trigger`·`trigger.workflow` 의 키-생략형 사유가
  아직 코드 주석에만 있고 nav-spec 본문(`spec/2-navigation/2-trigger-list.md`,
  `spec/2-navigation/3-schedule.md §4`)에는 옮겨지지 않았다.
  - 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`
    (`ScheduleTriggerRefDto.workflow` JSDoc), `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`
    (`TriggerDto.workflow` JSDoc)
  - 상세: §5.4 규약은 키-생략형 필드에 사유 문서화를 요구한다. 코드 쪽(필드 JSDoc + 내부
    `//` 주석)은 이번 PR 이 정확하고 상세하게 채웠지만, 그 사유를 spec 본문으로 옮기는
    작업은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미체크 항목
    (`ScheduleDto.trigger/workflow 를 nav-spec 에 문서화`, planner 담당)으로 이미 등재돼
    있다. 즉 이것은 이 PR 이 새로 만든 갭이 아니라 기존에 인지되고 추적 중인 갭이다 —
    developer 권한으로 spec 을 고칠 수 없으므로(§자기-반증형 소정정 다섯 조건 미충족:
    이 문장은 developer 가 쓴 예고가 아니라 신규 API 계약이다) 이 PR 범위에서 닫을 사안이
    아니다.
  - 제안: 조치 불요 — 이미 planner 턴으로 등재됨. 다음 planner 세션에서 두 nav-spec 파일에
    반영하면 된다.

- **[INFO]** `workflow-crud.e2e-spec.ts` 에서 `ExportWorkflowDto` 와 `WorkflowDto` 를 같은
  모듈에서 별도 `import` 문 두 줄로 가져온다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` — `import { ExportWorkflowDto } from '../src/modules/workflows/dto/responses/workflow-response.dto';`
    바로 아래 줄에 이미 `WorkflowDto` import 가 있다.
  - 상세: 기능·문서화 정확성에 영향 없는 스타일 수준의 사소한 흠. 한 줄로 병합 가능했던
    자리다.
  - 제안: `import { ExportWorkflowDto, WorkflowDto } from '...';` 로 병합. 이번 PR 을 막을
    사유는 아니다.

## 확인한 항목 (문제 없음)

- **CHANGELOG.md**: 신규 "Unreleased" 섹션이 발견 경위(무엇을, 어떻게 찾았는지) · 영향 범위 ·
  원인(방어가 "한 칸씩 좁았다" 는 세 번의 재발 서사) · 수정 내용 · 회귀 테스트 근거(뮤턴트
  실행 결과) · 함께 정정한 23필드 목록 · 래칫 신설까지 전부 갖춰 기존 CHANGELOG 항목들의
  형식·상세도와 일관되다. 보안 결함(트리거 회전 secret 유출)과 문서 성격 변경(필드 선언
  보정)이 한 섹션에 섞여 있지만 "§5.4 스윕 도중 실측으로 발견된" 인과관계가 명시돼 있어
  추적성에 문제가 없다.
- **DTO JSDoc**: `AlertRuleDto`·`IntegrationDto`·`KnowledgeBaseDto`·`ScheduleDto`·`TriggerDto`
  에 추가된 24개 필드 전부 필드 단위 JSDoc(`/** ... */`)을 갖췄고, `@ApiProperty` 선택
  근거(§5.4 기본형 vs 키 생략형)를 블록 주석으로 설명한다. `appUrl` 처럼 첫 판이 틀렸던
  자리는 "e2e 가 선언을 반증했다" 는 정정 경위까지 남겼다(`integration-response.dto.ts`).
- **인라인 주석의 정확성**: `sanitizeChatChannelForResponse` → `sanitizeForResponse` 개명에
  맞춰 참조하던 주석(`chat-channel-trigger-create.e2e-spec.ts`)까지 갱신됐다. 저장소
  전체(`codebase/`, `spec/`)에 옛 이름에 대한 살아있는 참조가 남아 있는지 확인했고, `review/`
  아래 과거 리뷰 아카이브(정책상 SoT 아님, 수정 대상 아님)에만 남아 있어 문제 없다.
- **복잡한 로직의 인라인 설명**: `TriggersService.sanitizeForResponse`(비밀이 사는 네 축과
  세 번 연속 좁게 틀렸던 이력을 표로 정리), `SchedulesController.toResponse`(불변식 위반 시
  왜 로그에만 진단을 남기고 응답 바디는 고정 문구인지, CWE-209 근거까지), `contractForDto`
  의 promise 캐싱(격리 단위가 "worker" 가 아니라 "테스트 파일" 이라는 이전 정정까지) 등
  까다로운 설계 결정에 "왜" 를 남기는 수준이 일관되게 높다.
- **plan 트래커 갱신**: `spec-draft-nullable-notation-followups.md` 는 이전 라운드의 잘못된
  서술(예: "메모이제이션 미착수", `ScheduleDto.trigger` 를 "키 생략형으로 확정")을 삭제하지
  않고 취소선(`~~...~~`)으로 남긴 채 실측 근거와 함께 정정하는 이 저장소의 관례를 그대로
  따른다.
- **README/설정 문서**: 새 환경변수·설정 옵션·CLI 플래그가 추가되지 않았으므로 README
  업데이트 필요성 없음.
- **API 문서**: 엔드포인트 URL·메서드 변경은 없다. 응답 바디의 필드 추가는 OpenAPI
  데코레이터(`@ApiProperty`)로 즉시 문서화되며 이것이 이 저장소의 API 문서 SoT다(별도
  Swagger 정적 파일 없음).

## 요약

`sweep-response-contract` 브랜치는 §5.4 응답-계약 검증자 배선 확대 과정에서 드러난 실제
버그(트리거 회전 secret 2차 유출) 수정과 5개 DTO 24필드 선언 보정을 포함하는데, 문서화
관점에서는 전 파일에 걸쳐 예외적으로 높은 수준을 유지한다 — 모든 신규 필드에 JSDoc, 모든
비자명한 설계 결정(왜 컨트롤러에서 좁히는지, 왜 `select:false` 대신 응답 경계 스트립인지,
왜 세 번 연속 방어가 좁았는지)에 "왜" 주석, CHANGELOG 는 발견·원인·영향·수정·검증을 모두
갖춘 완결된 서사, plan 트래커는 이전 오류 서술을 취소선으로 남기며 정정한다. 개명된 함수
(`sanitizeChatChannelForResponse`→`sanitizeForResponse`)를 참조하던 주석까지 놓치지 않고
갱신했다. 발견된 유일한 흠은 스타일 수준의 import 분리 하나이며, 남은 spec-doc 미러링 갭
(nav-spec 에 `trigger`/`workflow` 키-생략 사유 반영)은 이미 planner 담당 백로그 항목으로
정확히 등재돼 있어 이 PR 의 결함이 아니다.

## 위험도

NONE
