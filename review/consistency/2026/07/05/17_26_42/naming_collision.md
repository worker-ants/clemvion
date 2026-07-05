# 신규 식별자 충돌 검토 — trigger-list-cron-nextrun (spec/2-navigation/)

## 조사 방법 메모

`_prompts/naming_collision.md` 에 첨부된 "target" 블록은 `spec/2-navigation/` 폴더 전체(이미 `status: implemented` 인 기존 spec)를 그대로 번들한 것이었고, 실제 신규 변경분(diff)은 프롬프트에 없었다. worktree 이름(`trigger-list-cron-nextrun`)과 커밋 이력(`fix(triggers): schedule 트리거 상세에 cron/timezone/nextRunAt 포함` 등)을 근거로 실제 작업 범위를 역추적했다:

- `spec/2-navigation/2-trigger-list.md` §1 화면 구조 / §2.1 은 이미 트리거 **목록**에 "다음 실행 시각" 노출을 명시한다.
- 그러나 현재 구현은 `TriggersService.findAll()` (`codebase/backend/src/modules/triggers/triggers.service.ts:78-135`, `GET /api/triggers`) 이 `schedule` 테이블을 join 하지 않아 목록 응답에는 `cronExpression`/`timezone`/`nextRunAt` 이 채워지지 않는다. 오직 `findOneDetail()` (단건 조회) 만 schedule row 를 조회해 세 필드를 채운다.
- `TriggerDto` (`trigger-response.dto.ts:44-56`) 의 필드 주석도 "schedule 타입 트리거 **단건 조회 시에만** 채워짐" 이라고 명시한다.
- 즉 본 작업의 실질 목표는 목록 endpoint 에 스케줄 next-run 정보를 채우는 것 — spec 문구와 구현 갭을 메우는 작업으로 추정된다. 아래 검토는 이 갭을 메우는 구현이 **기존에 이미 확립된 식별자를 그대로 재사용**하는지, 그 과정에서 새 식별자가 필요한지를 기준으로 수행했다.

## 발견사항

### [INFO] `TriggerDto` 필드 주석의 "단건 조회 시에만" 이 목록 확장 후 stale 예정
- target 신규 식별자: 없음 (기존 `cronExpression` / `timezone` / `nextRunAt` 재사용 예정)
- 기존 사용처: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:44-56`의 JSDoc — "Cron 식 (schedule 타입 트리거 단건 조회 시에만 채워짐)" / "다음 실행 예정 시각 (schedule 타입 트리거 단건 조회 시에만 채워짐)"
- 상세: 신규 식별자 충돌은 아니지만, `GET /api/triggers` (목록) 에도 동일 필드를 채우도록 확장하면 이 주석이 사실과 어긋나게 된다. 같은 필드명을 "단건 전용" → "목록·단건 공통" 으로 의미 확장하는 것이므로 엄밀히는 충돌이 아니라 **문서 스코프 변경**이지만, 스펙 반영 시 이 주석도 함께 갱신하지 않으면 이후 리더가 "목록에는 없는 필드" 로 오인할 수 있다.
- 제안: 구현 PR 에서 DTO 주석을 "schedule 타입 트리거에서만 채워짐(목록·단건 공통)" 등으로 동시 정정. `2-trigger-list.md` §3 API 표의 `GET /api/triggers` 설명 행에도 "schedule 타입은 cronExpression/nextRunAt 포함" 을 명시해 스펙-코드-DTO 3자 정합을 맞출 것을 권장 (신규 식별자 도입 없이 해결 가능).

### [INFO] 목록 findAll 확장 시 재사용할 이름이 이미 전역에서 일관됨 — 충돌 없음 확인
- target 신규 식별자: (예상) 없음. `findAll()` 에 `leftJoinAndSelect('t.schedule', 's')` 류 패턴 추가 + 응답 매핑 시 기존 `cronExpression`/`timezone`/`nextRunAt` 필드를 그대로 사용하는 설계가 자연스럽다.
- 기존 사용처:
  - DB 컬럼 SoT: `spec/1-data-model.md:255,258` (`cron_expression`, `next_run_at`)
  - Schedule 서비스: `codebase/backend/src/modules/schedules/schedules.service.ts` (`cronExpression`, `nextRunAt`, 로컬 변수 `nextRun` — 단수, `computeNextRuns()`)
  - Trigger 상세: `triggers.service.ts:162-164` (`findOneDetail`), DTO `trigger-response.dto.ts:44-56`
  - 프론트엔드: `codebase/frontend/src/app/(main)/triggers/page.tsx:69-70,215-216,811-812`, `components/triggers/cards/schedule-config-card.tsx`, `components/triggers/trigger-delete-dialog.tsx` 전부 동일 필드명(`cronExpression`, `nextRunAt`) 사용
- 상세: 이름 공간 전체(DB 컬럼 → 서비스 → DTO → 프론트)가 이미 `cronExpression`/`timezone`/`nextRunAt` 로 강하게 정렬돼 있어, 목록 endpoint 확장 시 **새 식별자를 도입할 필요가 없다** — 기존 이름 재사용이 오히려 올바른 설계다. `schedules.service.ts` 의 지역 변수 `nextRun`(단수, 함수 스코프 한정)은 DTO 필드 `nextRunAt` 과 이름이 겹치지 않고 스코프도 분리돼 있어 혼동 소지 없음.
- 제안: 구현 시 새 필드/새 쿼리 파라미터(`includeNextRun` 류)를 만들지 말고 기존 `TriggerDto.cronExpression/timezone/nextRunAt` 을 목록에도 그대로 채우는 방식을 유지할 것. (이미 계획된 것으로 보이나, 신규 식별자 회피를 명시적으로 재확인하는 차원의 기록.)

### [INFO] `GET /api/schedules/:id/preview` · `POST /api/schedules/preview` 와 endpoint 경로 충돌 없음
- target 신규 식별자: 없음
- 기존 사용처: `spec/2-navigation/3-schedule.md:137-138`
- 상세: 트리거 목록에 next-run 을 노출하는 이번 작업은 `GET /api/triggers` 응답 확장에 그치고 별도 endpoint 를 신설하지 않을 것으로 예상되므로, Schedule 모듈의 `preview` 계열 endpoint 와 경로·의미 충돌이 발생하지 않는다.
- 제안: 없음 (참고용 확인).

## 요약

이번 target 은 실제로는 신규 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV 키·파일 경로 중 어느 것도 새로 도입하지 않는 것으로 추정된다 — 트리거 목록(`GET /api/triggers`)에 이미 스펙(§1·§2.1)이 약속하고 DTO 에도 이미 존재하는 `cronExpression`/`timezone`/`nextRunAt` 필드를 채워 넣는 **구현 갭 보강**(spec 문구는 이미 있으나 `findAll` 이 미채움)에 가깝다. 이름 공간 전체(DB 컬럼 → 서비스 → DTO → 프론트엔드)가 이미 하나의 명명으로 강하게 정렬돼 있어 신규 식별자 충돌 리스크는 발견되지 않았다. 유일한 보완 지점은 DTO 필드 JSDoc 의 "단건 조회 전용" 문구가 목록 확장 후 stale 해진다는 점(INFO) 뿐이며, 이는 명명 충돌이 아니라 주석 동기화 이슈다. 실제 target 문서(신규/변경 diff)가 이 프롬프트에 포함되지 않았으므로, 만약 구현 과정에서 이 예상과 다른 새 식별자(새 쿼리 파라미터, 새 DTO 서브타입 등)가 실제로 도입된다면 그 시점에 본 체크를 재실행할 것을 권장한다.

## 위험도

NONE
