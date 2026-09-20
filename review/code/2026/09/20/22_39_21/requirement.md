# 요구사항(Requirement) 리뷰 — trigger 동시 DELETE 감사 중복 수정 (RESOLUTION 후속 라운드)

## 검토 범위

본 라운드는 직전 리뷰(`review/code/2026/09/20/22_07_23`)의 requirement WARNING 1건(plan 범위 과장)과
side_effect·concurrency WARNING 1건(외부 teardown 중복 미문서화), 그리고 documentation·maintainability·
testing WARNING(CHANGELOG 누락·lock key 리터럴·genuine 실패 로그 미검증)에 대한 `RESOLUTION.md` 상의
5개 조치 커밋(`dac9c6a38`, `931877519`, `4abc730cb`, `4f4f924ae`, 그리고 이번 세션 문서 커밋
`195bc38e8`)을 실제 코드·문서와 대조해 검증했다. 핵심 구현(`triggers.service.ts` `remove()`)은
`bb0cfbe3b`에서 이미 확정되어 이번 라운드의 diff 자체에는 포함되지 않지만, spec fidelity 재확인을 위해
현재 상태를 직접 `Read`로 재확인했다.

## 발견사항

- **[INFO]** SUMMARY#2 조치(plan 범위 정정) 실측 확인 — 정확함
  - 위치: `plan/in-progress/trigger-dup-delete.md`(H1 헤딩, 정정 blockquote), `codebase/backend/src/modules/schedules/schedules.service.ts`(`remove()`, 약 299-345행)
  - 상세: `dac9c6a38`가 plan 제목을 "네 삭제 경로 중 마지막 한 자리" → "트리거·워크플로·워크스페이스 세 자리 중 마지막"으로 좁히고, `SchedulesService.remove()`에 대한 정정 blockquote를 추가했다. 직접 `schedules.service.ts:299-345`를 읽어 검증한 결과 이 주장은 사실과 일치한다: `if (schedule.triggerId)` 블록 안의 `m.delete(Trigger, triggerId)`는 advisory lock을 잡지만(연결된 트리거 행 보호), 그 뒤 `await this.scheduleRepository.remove(schedule)`(스케줄 자신의 행 삭제)는 트랜잭션·락·재조회 가드 **밖**에서 실행된다 — 동시 삭제 시 `SCHEDULE_DELETED` 감사가 이번에 트리거에서 고친 것과 같은 형태로 두 번 남을 수 있는 잔여 노출이 실제로 존재한다. `plan/in-progress/spec-draft-nullable-notation-followups.md`에 해당 developer 후속 항목이 신규 등재됐고, 기존 `TriggersService.remove()` 항목은 `[x]`로 정확히 처분됐다.
  - 제안: 조치 불요 — 이번 라운드에서 요구되는 코드 정정 없음.

- **[INFO]** SUMMARY#1 조치(teardown 중복 크로스레퍼런스) 실측 확인 — 정확함
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(트리거 자원 정리 sweeper 항목 아래 신규 불릿), `plan/in-progress/trigger-dup-delete.md`("이 PR 이 하지 않는 것")
  - 상세: 직전 라운드 side_effect·concurrency WARNING 1(락 취득 전 `releaseExternal` 이중 호출)에 대해 코드 변경 없이 문서 크로스레퍼런스만 추가한다는 RESOLUTION 판단은 타당하다 — 이 중복은 best-effort·실패 삼킴 경로이고(`concurrency.md`가 BullMQ `removeJobScheduler`·`teardownChatChannel` 소스로 실측), 이번 diff(락 안 재조회)의 스코프인 DB 행/감사 중복과는 다른 층위의 결함이라 이번 PR의 코드 정정 대상이 아니다.
  - 제안: 조치 불요.

- **[INFO]** SUMMARY#4 신규 단위 테스트(`remove() — genuine 삭제 실패는 반쯤 삭제된 상태를 logger.error 로 남긴다`)가 실제 구현 로그 문자열과 정확히 일치
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:4125-4146` vs `codebase/backend/src/modules/triggers/triggers.service.ts`의 `remove()` `.catch` 블록(`TriggersService.remove: trigger=${id} 의 행 삭제가 실패했다 — ... 이미 끝났으므로 ... 반쯤 삭제된 상태다 ...`)
  - 상세: 테스트는 `error.mock.calls`를 join한 문자열에 `'trig-l'`, `'이미 끝났으므로'`, `'반쯤 삭제된 상태'` 세 부분 문자열 포함을 단언한다. 세 문구 모두 현재 구현의 실제 로그 메시지에 그대로 존재함을 직접 `Read`로 대조 확인했다. `removeRejects: true` 옵션이 `repo.remove`를 `Error('lock timeout')`로 reject시키고 테스트는 `.rejects.toThrow('lock timeout')`으로 전파를 확인한다 — genuine(비-404) 실패 경로와 404(passthrough, 로그 없음) 경로를 갈라 검증하는 대칭 쌍(4030행 테스트)이 정확히 구성됐다.
  - 제안: 조치 불요.

- **[INFO]** SUMMARY#3 조치(e2e lock key 리터럴 제거) 확인 — `trigger-delete-concurrency.e2e-spec.ts`가 이제 `triggerConfigLockKey`를 `../src/modules/triggers/trigger-config-lock`에서 직접 import해 사용한다(로컬 `lockKey` 헬퍼 없음). advisory lock key 포맷 단일 진실원이 재확립됐다.
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts:8, 94`
  - 제안: 조치 불요.

- **[INFO]** spec fidelity 재확인 — `spec/2-navigation/2-trigger-list.md:318` §4.4와 line-level 일치
  - 위치: `spec/2-navigation/2-trigger-list.md:318`("동시 삭제: 두 클라이언트가 동시에 같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`"), `codebase/backend/src/modules/triggers/triggers.service.ts:1090-1094`(`const fresh = await m.findOne(...); if (!fresh) this.throwTriggerNotFound();`), `:412-416`(`throwTriggerNotFound(): never { throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', ... }) }`)
  - 상세: 에러 코드·문구·재조회 스코프(`where: { id, workspaceId }`, 원 조회와 동일 workspace 경계 유지) 모두 spec 문언과 정확히 일치한다. 이전 consistency-check(`review/consistency/2026/09/20/21_43_47`)가 지적한 "§4.4가 caveat 없이 확정 사실처럼 서술돼 있으나 코드가 아직 그렇지 않다"는 gap은 이번 구현으로 실제 사실이 됐다 — spec 문서 자체는 이미 옳게 서술돼 있었으므로 SPEC-DRIFT가 아니다.
  - 제안: 조치 불요.

- **[INFO]** CHANGELOG.md(SUMMARY#5) 3단 구성(문제/고친 것/판별력 실측) 내용 검증 — 형제 항목과 형식·수치 일치
  - 위치: `CHANGELOG.md:3-31`
  - 상세: `[204, 204]`→`[204, 404]`, 감사 2건→1건이라는 실측값, 첫 뮤턴트 무효(440줄·116건 실패) → 고유 앵커 180자 뮤턴트 재측정 이력이 plan(`trigger-dup-delete.md` 체크리스트)과 정확히 일치한다. "남는 것" 절도 `SchedulesService.remove()` 잔여와 외부 provider teardown 중복 미해결을 정확히 반영한다.
  - 제안: 조치 불요.

WARNING/CRITICAL 없음 — 직전 라운드의 requirement WARNING 1건은 완전히 해소됐고, 이번 라운드에서 새로
도입된 요구사항 결함을 찾지 못했다.

## 점검 관점별 확인 결과 (요약)

- **기능 완전성**: 트리거 삭제 경로의 감사 중복 결함은 완전히 닫혔다. 스케줄 자신의 행 삭제(별개 경로)는
  의도적으로 스코프 밖이며 정확히 후속 등재됨.
- **엣지 케이스**: workspaceId 스코프 유지, 정상(행 존재) 경로 회귀 없음(기존 lost-update 테스트가 고정).
- **TODO/FIXME**: 없음.
- **의도와 구현 간 괴리**: 이번 라운드 조치 후 plan 제목·본문·CHANGELOG·트래커 서술이 실제 코드 범위와
  정확히 일치 — 직전 라운드의 "네 자리 완결" 과장은 해소됨.
- **에러 시나리오**: `NotFoundException` passthrough(로그 없음) vs genuine 실패(로그 있음) 두 경로 모두
  신규 단위 테스트로 검증됨(뮤테이션 판별력 실측 포함).
- **데이터 유효성**: 재조회 조건절이 원 조회와 동일 스코프.
- **비즈니스 로직**: spec §4.4 규칙을 정확히 반영, 선행 워크플로/워크스페이스 PR과 일관된 형태.
- **반환값**: `remove(): Promise<void>` 계약 유지, 실패 시 예외로 신호 — 모든 경로 적절.
- **관련 spec 본문 일치**: 위 spec fidelity 참조 — line-level 일치, SPEC-DRIFT 아님.

## 뮤테이션 검증 안내

이번 라운드에서는 가설 확인을 위한 코드 뮤테이션을 직접 수행하지 않았다 — 정적 대조(spec 문언 vs 구현
문자열, RESOLUTION 주장 vs 소스 재확인)만으로 결론에 도달했다. 저장소 파일은 `Read`/`grep`으로만
조회했고 아무것도 쓰거나 되돌리지 않았다. 세션 종료 시점 `git status --short`는 본 세션의 출력 디렉터리
(`review/code/2026/09/20/22_39_21/`)만 untracked로 보고하며 다른 잔여 변경은 없다.

## 요약

`RESOLUTION.md`가 기록한 5개 조치 커밋을 소스 코드·spec·plan·트래커·CHANGELOG와 직접 대조 검증한 결과,
직전 라운드의 requirement WARNING(plan 범위 과장)은 제목·본문 정정과 `SchedulesService.remove()` 후속
백로그 등재로 완전히 해소됐고, 그 주장(스케줄 자신의 행 삭제가 락·재조회 밖에서 실행된다)은 소스를 직접
읽어 사실임을 확인했다. 신규 단위 테스트(genuine 실패 로그 단언)는 실제 구현의 로그 문자열과 정확히
일치하고, e2e의 lock key import 교체도 정상 반영됐다. 핵심 구현(`triggers.service.ts` `remove()`)은
spec `2-trigger-list.md` §4.4와 에러 코드·검증 스코프까지 line-level로 일치하며 SPEC-DRIFT나 신규
요구사항 결함을 발견하지 못했다.

## 위험도

NONE
