# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 공유 백로그 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 를 이번 PR 이 함께 수정한다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4785` (신규 항목 삽입 지점)
  - 상세: 스케줄 삭제 결함을 고치는 김에, 착수 전 전수 조사(`grep AUDIT_ACTIONS.*_DELETED`)로 찾아낸 같은 결함 클래스의 다섯 번째 자리(`IntegrationsService.remove()`)를 이 PR 에서 고치지 않고 별도 트래커 항목으로만 등재했고, 기존 "동시 삭제 → 404 문서화 격차" 항목의 스코프 목록에 `3-schedule.md §4` 를 추가했다. 코드 수정 없이 백로그 문서만 늘린 것이라 기능적 스코프 크립은 아니지만, 이 PR 의 diff 가 "스케줄 삭제 버그 수정" 외에 다른 항목(통합 서비스 결함)의 존재를 등재하는 문서 작업까지 포함한다는 점은 리뷰어가 명시적으로 인지할 필요가 있다.
  - 제안: 실제 조치 없음. plan 체크리스트(`plan/in-progress/schedule-dup-delete.md` 체크박스)에 이 등재가 명시돼 있고, 직전 consistency-check(WARNING 1·2)가 바로 이 누락을 지적해 그 자리에서 반영한 것이므로 절차상 적절하다. 트래커 자체가 여러 plan 이 공유하는 문서이므로 사후 검토 시 "이 항목이 실제로 나중에 소화됐는지" 만 추적하면 된다.

- **[INFO]** `triggerId` 없는 방어 분기의 판별자를 `scheduleRepo.remove()` → `scheduleRepo.delete()` 로 교체 (핵심 수정과 직접 결부, 스코프 내)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 의 `else` 분기 (게이트 366~377행)
  - 상세: 원래 있던 `await this.scheduleRepository.remove(schedule);` 한 줄을, 트리거가 없는 방어 분기 전용으로 `delete({id, workspaceId})` + `affected` 404 판정으로 바꿨다. 요청 범위(동시 삭제 시 감사 중복 방지)에 정확히 부합하는 변경이며, 도달 불가능한 방어 분기라는 점도 주석·plan 문서에 명시돼 있어 별도 기능 확장으로 보이지 않는다.
  - 제안: 조치 불요. 스코프 내 정당한 변경.

- **[INFO]** 기존 테스트 3건의 mock 반환값 변경(`undefined` → `{ affected: 1 }`)은 계약 변경에 수반된 필수 수정
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` 게이트 56행(`scheduleRepo` delete mock), 76~79행(`triggerRepo` delete mock)
  - 상세: `delete()` 반환값의 `affected` 를 실제로 읽어 판정하도록 구현이 바뀌었으므로, 기존 mock 이 `undefined` 를 돌려주면 런타임에서 구조분해가 깨진다. 순수 리팩토링이 아니라 신규 계약을 반영하기 위한 불가피한 변경이다.
  - 제안: 조치 불요.

## 요약

diff 는 정확히 13개 파일로 구성되며, git 실측(`git diff --stat`)이 scope.md 의 파일 목록과 1:1로 일치한다 — 프로젝트 워크플로가 요구하는 구현 코드(2) + 신규 e2e 테스트(1) + plan 문서(2, 신규 plan + 공유 트래커 갱신) + `--impl-prep` consistency-check 산출물(8, SUMMARY 포함) 세트 그대로다. 핵심 수정(schedules.service.ts)은 "동시 DELETE 두 건이 schedule.deleted 감사를 두 번 남긴다"는 단일 결함에 정확히 대응하며, 형제 PR(#1368~#1370)과 동일한 패턴(락 안 delete 의 affected 를 판별자로)을 그대로 적용했을 뿐 새로운 추상화·헬퍼·설정 변경은 도입하지 않았다(plan 문서에도 "공용 헬퍼 추출은 이 PR 이 하지 않는다"고 명시). 테스트 변경은 신규 계약(delete가 affected를 반환)에 기존 mock을 맞춘 것과 새 회귀 테스트 1건 추가뿐이며, import 추가(`DeleteResult`)도 그 테스트에서만 쓰인다. 유일하게 언급할 만한 점은 착수 전 전수 조사에서 발견한 동일 결함 클래스의 다섯 번째 자리(`IntegrationsService.remove()`)를 이 PR에서 고치지 않고 공유 백로그 문서에 등재만 한 것인데, 이는 스코프를 넓힌 것이 아니라 오히려 스코프를 명시적으로 좁게 유지하기 위한 절차(plan 문서의 "이 PR 이 하지 않는 것" 섹션, consistency-check WARNING 반영)로 판단된다. 포맷팅·주석·무관 리팩토링·설정 변경·불필요한 임포트 정리 등 스코프 이탈 징후는 발견되지 않았다.

## 위험도
NONE
