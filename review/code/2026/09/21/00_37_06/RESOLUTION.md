# RESOLUTION — 스케줄 동시 DELETE 감사 중복 (리뷰 2라운드)

1라운드(`review/code/2026/09/21/00_06_01`)의 Warning 4건을 조치한 뒤 돌린 **fresh 라운드**.
결과: **Critical 0 · Warning 2** — 둘 다 조치했다.

## 조치 항목

| SUMMARY # | 발견 | 조치 |
|---|---|---|
| WARNING 2 (concurrency) | `!affected` 가 `0`(진짜 패배)과 `null`/`undefined`(드라이버 미보고)를 구분하지 않는다. **같은 락 서브시스템의 자매 함수 `rewriteTriggerConfigLocked` 는 이미 반대로 정해 뒀다** — «`affected` 가 `null`·`undefined` 면 판정하지 않는다. «모른다» 를 «없다» 로 읽으면 정상 쓰기를 실패로 뒤집는다» | 두 판정 모두 **`affected === 0` 명시 비교**로 바꾸고, 그 근거(자매 함수의 결정)를 주석에 인용했다. 뮤턴트로 판정이 살아 있음을 재확인(트리거 경로 판정 제거 → 1건만 RED) |
| WARNING 1 (documentation) | `CHANGELOG.md` 의 **트리거 항목** «남는 것» 이 «`SchedulesService.remove()` 는 아직 같은 결함을 갖고 있다» 고 적는데, 바로 위에 추가한 스케줄 항목이 그것을 닫았다고 기록해 같은 파일 안에서 모순된다 | 트리거 항목에 **«2026-09-21 해소» 각주**를 달았다(원문은 그때의 상태 기록으로 유지 — 트래커에서 쓰는 관례와 같다) |
| INFO 7 (선택) | 0-affected 테스트가 «스케줄 행을 건드리지 않는다» 를 직접 단언하지 않아 형제와 비대칭 | `expect(scheduleRepo.remove).not.toHaveBeenCalled()` 추가 |

나머지 INFO 는 조치 불요이거나 이미 등재됐다 — BullMQ `removeJob` 중복(세 문서에 명시된 잔여) ·
`3-schedule.md` §4 문서 격차(트래커) · `triggerId` NOT NULL 이라 도달 불가한 방어 분기.

## TEST 결과

- lint : 통과 · unit : 통과(52건) · build : 통과 · e2e : **통과 371/371**

### 뮤테이션 검증

`=== 0` 전환이 판정을 무르게 만들지 않았는지 확인했다 — 트리거 경로 판정 한 줄을 지운 뮤턴트에서
**1건만 RED**(나머지 51건 GREEN). `cp` 백업·원복, `git checkout` 미사용.

## 보류·후속 항목

- `IntegrationsService.remove()` — 같은 계열의 남은 자리. 1라운드 전에 트래커에 등재했다(grep 0→1 확인).
- BullMQ `removeJob` 중복 호출 — 락 밖 외부 호출이라 이 PR 밖. 형제 PR 들과 같은 처분.
