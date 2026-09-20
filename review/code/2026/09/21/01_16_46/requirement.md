# 요구사항(Requirement) 리뷰 — schedule-dup-delete (4라운드, 01_16_46)

## 검토 범위와 방법

이 라운드는 3라운드(`review/code/2026/09/21/00_56_52`)의 유일한 WARNING(testing #1 — `affected === 0`
판정의 존재 이유인 "모른다(null/undefined) 를 없다(0) 로 읽지 않는다"를 검증하는 뮤테이션 가드 부재)을
조치한 커밋 `210808701`까지 포함한 diff다. 실질 코드 변경은 여전히 3개 파일
(`schedules.service.ts`, `schedules.service.spec.ts`, `schedule-delete-concurrency.e2e-spec.ts`)뿐이고,
`schedules.service.ts` 자체는 이번 커밋에서 변경되지 않았다 — 신규 대조군 테스트 2건만 추가됐다.

`Read`/`Grep`/`git show`/`git log`로 현재 저장소 상태를 직접 열어 diff·이전 3라운드 리뷰의 주장을
재대조했다. 저장소에 뮤테이션을 가하지 않았다(`git status --short` 확인 결과 이 세션 출력 디렉터리
외 잔여 없음 — clean).

## 확인한 것

- **신규 대조군 테스트가 실제로 그 갭을 닫는다**: `schedules.service.spec.ts:827-874`에 추가된 두 테스트
  (`'삭제 — affected 를 보고하지 않는 드라이버에서는 404 로 뒤집지 않는다 (트리거 경로)'`,
  `'삭제 — 같은 대조군 (triggerId 없는 방어 분기)'`)는 각각 `triggerRepo.delete`/`scheduleRepo.delete`에
  `for (const affected of [undefined, null])` 루프로 두 값을 주입하고, `service.remove(...)`가
  **404를 던지지 않고 정상 resolve**하며 `auditLogs.record`가 호출됨을 단언한다. 자매 함수
  `rewriteTriggerConfigLocked`의 대조군(`trigger-config-lock.spec.ts:176-185`)과 형태가 정확히 대칭이다.
  기본 mock(`triggerRepo` delete `{ affected: 1 }`, `scheduleRepo` delete `{ affected: 1 }`)과 신규
  `mockResolvedValueOnce`가 충돌 없이 오버라이드됨을 확인했다.
- **판정 로직 자체(`schedules.service.ts:308-388`)는 이번 커밋에서 변경되지 않았고**, 3라운드까지
  검증된 상태 그대로다 — `if (schedule.triggerId)` 분기는 advisory lock 트랜잭션 안에서
  `m.delete(Trigger, triggerId)`의 `affected === 0`을 판별자로 404, 그 외(`triggerId` 없음, 엔티티
  NOT NULL 제약상 도달 불가)는 `scheduleRepository.delete({id, workspaceId})`의 `affected === 0`을
  판별자로 404. `.catch`는 `NotFoundException`만 조용히 재던지고 그 외는 로그 후 재던진다.
- **엔티티 실측 재확인**: `schedule.entity.ts:25-29` — `triggerId: string`(nullable 미지정, NOT NULL),
  `trigger` FK `onDelete: 'CASCADE'`. CASCADE 때문에 트리거 삭제 시 스케줄 행도 DB가 함께 지우므로
  "스케줄 행 자체의 affected"로는 판정 불가하다는 코드·plan·CHANGELOG의 핵심 근거가 실측과 일치한다.
- **e2e(`schedule-delete-concurrency.e2e-spec.ts`)** 전문을 직접 읽어 대조: advisory lock을 별도
  커넥션(`locker`)으로 선점해 실제 겹침을 만들고, 공허성 가드(`Promise.race` 1.5초)로 "아직 안
  끝남"을 먼저 확인한 뒤 `[204, 404]` 상태쌍 + `audit_log` 1건 + CASCADE로 스케줄 행 0건까지
  검증한다. 참조 심볼(`triggerConfigLockKey`, `createDbClient`, `registerAndLogin` 등) 모두 실존.
- **spec fidelity**: `spec/2-navigation/2-trigger-list.md:318`이 "동시 삭제: 두 번째는
  `404 RESOURCE_NOT_FOUND`"를 명시하고, 코드는 이 계약을 스케줄 축에 그대로 확장했다 — 코드는
  기존 정책과 정합. `spec/2-navigation/3-schedule.md` §4(`142`행, API 표)는 이 계약을 서술하지
  않는 침묵이며, `plan/in-progress/spec-draft-nullable-notation-followups.md:4795`에 이미
  등재돼 추적 중임을 재확인했다(회색지대, 모순 아님 — SPEC-DRIFT 아님).
- TODO/FIXME/HACK/XXX 계열 미완성 마커: 대상 3개 코드 파일 grep 결과 0건.
- `plan/in-progress/schedule-dup-delete.md` 체크리스트의 미완료 항목(`/ai-review` 수렴,
  `--impl-done`, 트래커 해소+`plan/complete/` 이동)은 이 라운드가 수렴되면 세션 마무리 단계에서
  처리될 성격으로, 3라운드까지의 결론과 동일하게 비차단 사항이다.

## 발견사항

- **[INFO]** `spec/2-navigation/3-schedule.md` §4는 여전히 "동시 삭제 → 두 번째 요청 404" 계약을
  서술하지 않는다 (spec 침묵 — 회색지대, 모순 아님, SPEC-DRIFT 아님)
  - 위치: `spec/2-navigation/3-schedule.md:142` (`| DELETE | /api/schedules/:id | 삭제 |`)
  - 상세: 3라운드까지 반복 확인된 것과 동일한 상태. 코드는 트리거 목록 §4.4의 기존 정책을
    스케줄 축으로 정확히 확장했으나 그 사실이 스케줄 spec 문서 본문에는 아직 없다. 이미 트래커에
    등재돼 있고 이번 PR 자신의 diff(파일 6)가 그 스코프를 실제로 넓혔다.
  - 제안: 조치 불요 — 트래커 처리를 기다린다. `project-planner` 소관, 본 reviewer는 spec을 직접
    수정하지 않는다.
- **[INFO]** `triggerId` 없는 방어 분기(`schedules.service.ts:372-381`)는 엔티티 NOT NULL 제약상
  현재 도달 불가한 죽은 코드 — 3라운드까지와 동일한 관찰 재확인
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:372-381`
  - 상세: 신규 대조군 테스트가 이 분기까지 커버했지만, 프로덕션 경로에서 실행될 일은 없다는
    사실 자체는 바뀌지 않았다. `triggerId`가 nullable로 바뀌는 시점 재검토 대상.
  - 제안: 조치 불요.

CRITICAL은 없다. 3라운드에 걸쳐 지적된 WARNING(문서 3중 복제, `affected` truthiness, CHANGELOG
인접 모순, `null`/`undefined` 뮤테이션 가드 부재) 전부가 커밋 히스토리·현재 소스·테스트
assertion을 직접 대조해 실제로 해소됐음을 확인했고, 이번 라운드에서 새로 도입된 결함은 찾지
못했다.

## 요약

`SchedulesService.remove()`의 동시 DELETE 중복 감사 결함 수정은 형제 PR(#1369·#1370)이 확립한
"advisory lock + 락이 보호하는 실제 쓰기의 `affected`를 판별자로" 패턴을 `schedule.trigger_id →
trigger`의 `ON DELETE CASCADE`로 인해 판정 기준이 달라지는 스케줄 축에 정확히 확장했다. 4라운드에
걸친 리뷰-조치 사이클(리터럴 3중복→헬퍼 추출, `!affected`→`affected === 0` 명시 비교,
CHANGELOG 인접 모순→해소 각주, `null`/`undefined` 뮤테이션 가드 부재→자매 함수와 대칭인 대조군
테스트 추가)이 모두 실물 대조로 검증됐다. 기능 완전성(트리거 있음/없음 두 분기 × affected
0/1/null/undefined 네 값), 에러 시나리오(`NotFoundException` 조기 분리로 거짓 경보 방지),
반환값(모든 경로가 명시적으로 완주 또는 404 예외로 귀결), 테스트 커버리지(값 기준 분기 + 판정
연산자의 의미론 양쪽 모두 뮤테이션으로 검증됨)가 모두 확인됐다. 유일하게 남는 spec 갭
(`3-schedule.md` §4의 서술 침묵)은 코드-spec 모순이 아니라 이미 트래커에 등재된 알려진 문서
격차다. CRITICAL/WARNING 급 신규 발견사항은 없다 — 이번 라운드는 요구사항 관점에서 수렴 상태다.

## 위험도

NONE
