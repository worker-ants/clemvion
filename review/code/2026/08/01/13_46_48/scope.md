# 변경 범위(Scope) 리뷰 — 감사 로깅 커버리지 갭 13개 액션 구현 (7차 라운드)

## 방법론

프롬프트는 23개 파일(`AUDIT_ACTIONS` const, DTO, model-config/schedules/triggers/workflows
의 controller·module·service·spec 각각)의 "전체 파일 컨텍스트"만 제공하고 unified diff 블록은
없었다(3개 대형 spec/service 파일은 크기 제한으로 내용조차 실리지 않음). 대상 파일 목록이
`git diff origin/main...HEAD --name-only -- codebase/` 결과 23개와 정확히 일치해, 이번
프롬프트는 origin/main 대비 누적 diff 전체의 재검토임을 확인했다.

이전 라운드(`12_06_37/scope.md`, `12_44_54/scope.md`)가 이미 이 누적 diff를 전수 대조해
위험도 NONE으로 판정했으므로, 이번 라운드는 직전 scope 리뷰 시점(`12_44_54`, 커밋
`d538d909b`) 이후 실제로 추가된 5개 커밋(`6032e2444`→`a3fbb614d`→`0028b78a1`→`f040952a7`→
`a952d6616`, HEAD)의 diff를 `git show`/`git diff d538d909b..HEAD`로 전수 확인하고, 커밋
메시지가 선언한 항목과 1:1 대조했다. 아울러 `workflows.service.ts`·`triggers.service.ts`
(프롬프트에서 크기 제한으로 생략된 두 서비스 파일)의 origin/main 대비 전체 diff도 직접 열어
감사 기록 도입 목적을 벗어난 수정이 없는지 재확인했다.

## 스코프 대조 상세 (직전 라운드 이후 델타)

- **`6032e2444`(5차 리뷰 W1/W3 조치)**: `model-config.service.spec.ts`에
  `create(isDefault:true)` 트랜잭션 커밋 순서 테스트 1건, `triggers.service.spec.ts`에
  '저장 실패 시 감사 미기록' 불변식 테스트 1건만 추가. 프로덕션 코드 변경 없음 — 순수
  커버리지 갭 메움. 부수적으로 `review/**` 산출물과 `RESOLUTION.md`만 동반(스킬 쓰기 권한
  범위 내).
- **`a3fbb614d`(prettier)**: 직전 커밋에서 막 추가한 테스트 객체 리터럴 1곳의 줄바꿈만
  재포맷. `model-config.service.spec.ts` 단일 파일, 1 hunk. `--fix` 범위 이탈 없음(과거
  라운드가 반복 지적했던 패턴을 이번에도 정확히 회피).
- **`0028b78a1`(6차 리뷰 W1 — 컨트롤러 배선 테스트)**: `model-config.controller.spec.ts`
  (create/setDefault describe 추가) · `schedules.controller.spec.ts`(신규 파일) ·
  `triggers.controller.spec.ts`(배선 describe 추가) · `workflows.controller.spec.ts`(배선
  describe 추가) 4개 spec 파일에 순수 추가(diff 전부 `+`, 삭제 0줄). 컨트롤러·서비스
  프로덕션 코드는 손대지 않았다 — 기존 위치 인자 배선을 검증하는 테스트만 신규 추가되어
  "실제 요청 범위(감사 로깅 회귀 방지)"와 정확히 일치한다.
- **`f040952a7`(docs/review)**: `plan/in-progress/spec-sync-auth-gaps.md`(작업 plan 갱신) +
  `review/code/2026/08/01/10_05_53/RESOLUTION.md`(미조치표 stale 서술 정정) + 신규 리뷰
  세션 산출물. `codebase/` 변경 없음.
- **`a952d6616`(changelog)**: `CHANGELOG.md` 1줄만 수정 — `workflow.created`가 생성/복제
  외에 `importWorkflow`(4차 리뷰에서 이미 구현됨)도 커버함을 반영. `codebase/` 변경 없음.
- 델타 전체(`git diff d538d909b..HEAD --stat -- . ':!review/'`)에서 `codebase/`
  변경 파일은 위 5개 spec 파일뿐이며, 프로덕션 로직(controller/service/module) 수정은
  0건이다.

## 누적 diff 재확인 (프롬프트에서 내용이 생략된 두 서비스 파일)

- **`triggers.service.ts`**: `AUDIT_ACTIONS`/`AuditLogsService` import, `recordAudit` 헬퍼,
  `create`/`update`/`remove`에 `userId` 파라미터 추가 + 커밋 직후 `recordAudit` 호출,
  `chatChannel` 재조회 결과를 `return` 직행 대신 `result` 변수에 담아 sanitize를 함수 끝
  1곳으로 합친 것(감사 호출을 조기 `return` 이전에 두기 위한 불가피한 구조 변경)뿐이다.
  비즈니스 로직(secret 마이그레이션, chatChannel setup, schedule 역동기화 순서)은 그대로다.
- **`workflows.service.ts`**: 동일 패턴 — `recordAudit` 헬퍼, `create`/`update`/`remove`/
  `duplicate`/`importWorkflow`가 트랜잭션 결과를 지역 변수(`created`/`duplicated`/
  `imported`)로 받아 커밋 후 `recordAudit`을 호출하도록 wrapping. 트랜잭션 콜백 내부의
  노드/엣지 복제·리매핑 로직 자체는 재인덴트(들여쓰기 변경)만 있을 뿐 그대로다 — 이는
  `dataSource.transaction(...)`의 반환값을 캡처해야 하는 기계적 결과이지 무관한
  리팩터링이 아니다.

## 발견사항

없음.

## 요약

직전 scope 라운드(`12_44_54`) 이후 5개 커밋은 (1) 리뷰가 지적한 테스트 커버리지 갭 2건에
대한 spec-only 추가, (2) 그 직후의 단일 파일 prettier 재포맷, (3) 컨트롤러→서비스 행위자
배선 검증 테스트 4개 파일 순수 추가, (4) plan/RESOLUTION 문서 정정, (5) CHANGELOG 1줄
정확화로 구성되며 전부 감사 로깅 작업(spec-sync-auth-gaps §4.1) 범위 안이다. 프로덕션
코드(controller/service/module) 변경은 델타에 전혀 없다. 크기 제한으로 프롬프트에서
생략됐던 `triggers.service.ts`·`workflows.service.ts`의 origin/main 대비 전체 diff도
직접 대조한 결과, 트랜잭션 결과 캡처를 위한 불가피한 재인덴트 외 로직 변경은 감사 기록
도입에 정확히 대응한다. 의도 밖 리팩터링, 기능 확장(over-engineering), 무관한 파일 수정,
불필요한 임포트·설정 변경, 의미 없는 포맷팅 혼입은 발견되지 않았다.

## 위험도

NONE
