# 신규 식별자 충돌 검토 — `spec/2-navigation/` (impl-done, diff-base `origin/main`)

## 검토 전제 확인

- **scope(`spec/2-navigation/`) 델타: 0개 파일.** 이 브랜치는 `1-workflow-list.md` / `2-trigger-list.md` / `3-schedule.md` 등 어떤 spec 문서도 수정하지 않았다. 번들에 실린 전문은 참조용 컨텍스트일 뿐, 신규 식별자(요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로)가 이 영역에서 새로 도입되지 않았다.
- **실제 구현 diff: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` 1개 파일, +122/-9줄.** 절대경로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/sched-recalc-unit-9c4e17`)에서 `git diff origin/main...HEAD -- codebase/` 로 재확인했고, 위 프롬프트 diff 와 동일함을 확인했다 — 추가 변경분 없음. 신규 프로덕션 코드·엔티티·DTO·endpoint·이벤트·ENV var 없음, 순수 단위 테스트 추가다.

이 두 가지로 인해 본 6개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·파일 경로) 중 spec 문서 신규 도입에 해당하는 항목은 전부 해당 없음(델타 0)이다. 다만 diff 가 실제로 도입한 유일한 새 식별자 — 로컬 테스트 헬퍼 함수명 — 는 기존 사용처와 대조했다.

## 발견사항

- **[WARNING]** 로컬 테스트 헬퍼 `scheduleRow` 가 다른 스펙 파일에 이미 있는 동명 헬퍼와 이름은 같고 형태(shape)가 다르다
  - target 신규 식별자: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:373` — `function scheduleRow(overrides: Partial<Schedule> = {}): Schedule` (id `'sch-1'`, `nextRunAt` 포함, overrides 병합 지원)
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2293` — `const scheduleRow = () => ({ id: 'sched-1', triggerId: 'trig-1', workspaceId: 'ws-1', cronExpression: '0 9 * * *', timezone: 'Asia/Seoul', isActive: true }) as unknown as Schedule` (인자 없음, `nextRunAt` 필드 자체가 없음, id 접두도 `sched-1`로 다름)
  - 상세: 두 헬퍼는 서로 다른 파일의 `describe` 블록에 지역 스코프로 선언돼 있어 컴파일/런타임 충돌은 없다 (import·export 관계 없음). 그러나 같은 "schedule 도메인 fixture 빌더"라는 동일한 역할을 하는 함수에 동일한 이름 `scheduleRow` 를 쓰면서 시그니처(무인자 vs `overrides` 병합)와 반환 shape(id `sched-1` vs `sch-1`, `nextRunAt` 유무)가 다르다. 두 스펙 파일은 스케줄↔트리거로 밀접하게 연관된 도메인이라(`triggers.service.spec.ts` 도 schedule 타입 트리거를 다룸), 향후 두 파일을 나란히 보거나 한쪽 패턴을 다른 쪽에 복붙하는 개발자가 "같은 이름이니 같은 계약"이라고 오인하기 쉽다.
  - 제안: 필수 조치는 아니다(스코프 격리로 CRITICAL 아님). 다만 향후 정리 시 도메인을 구분하는 접두/접미를 붙이는 편이 안전하다 — 예: `schedules.service.spec.ts` 쪽을 `buildScheduleRow(overrides)` 로, 또는 `triggers.service.spec.ts` 쪽 fixture 를 `triggerScheduleRow` 로 개명해 "무엇의 schedule 행인지"를 이름에서 드러낸다.

- **[INFO]** 검토 스코프(spec/2-navigation)와 실제 diff(schedules 서비스 유닛 테스트) 가 물리적으로 분리
  - target 신규 식별자: 없음(spec 델타 0)
  - 기존 사용처: N/A
  - 상세: 이번 impl-done 검토가 `spec/2-navigation/` 을 scope 로 잡았지만 실제 변경은 `codebase/backend/src/modules/schedules/` 의 단위 테스트뿐이라, 신규 식별자 충돌 관점에서 점검할 대상 자체가 사실상 없었다. 이는 결함이 아니라 코드 전용 PR 의 정상적인 형태이며(prompt 의 명시적 전제), CRITICAL 근거로 쓰지 않았다.
  - 제안: 조치 불필요.

## 요약

이번 diff 는 `spec/2-navigation/` 을 전혀 수정하지 않았고(델타 0), 실제 변경은 `schedules.service.spec.ts` 에 재계산 게이트(cron/timezone 변경 시 `nextRunAt` 재계산)를 검증하는 단위 테스트 3건과 공유 fixture 헬퍼 `scheduleRow` 하나를 추가한 것뿐이다. 신규 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV/설정키·spec 파일 경로 중 어느 것도 새로 도입되지 않아 해당 관점들은 전부 해당 없음이다. 유일하게 관찰할 만한 점은 새로 추가된 로컬 헬퍼 `scheduleRow` 가 `triggers.service.spec.ts` 에 이미 있는 동명 헬퍼와 이름은 같으나 시그니처·반환 shape 가 다르다는 것인데, 둘 다 파일-지역 스코프라 실질적 충돌(컴파일 오류·런타임 오작동)은 없고 가독성 차원의 WARNING에 그친다.

## 위험도

LOW
