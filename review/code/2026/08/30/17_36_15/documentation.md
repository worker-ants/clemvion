# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 미갱신 — 이 저장소 자신의 확립된 관례를 어겼다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:1308`(`- [x] **updateExecutionStatus else 분기 트랜잭션화**` 항목, "완료" 로 체크됨) / `plan/in-progress/update-returning-tuple-shape.md:238`(같은 항목을 "완료" 로 체크). 대상 파일 `CHANGELOG.md` 자체는 이번 diff 에 없음(4파일 중 미포함).
  - 상세: 이 커밋(`1a12088f2`)은 `updateExecutionStatus` else 분기의 guarded UPDATE 를 `dataSource.transaction` 으로 감싸, shape 위반 throw 가 이제 실제로 UPDATE 를 롤백하게 고쳤다 — 커밋 메시지 스스로 "가드가 막으려던 무기한 대기가 가드가 발동한 순간에 생긴다" 는 심각한 결함을 고친다고 서술한다. 그런데 이 plan 계열은 정확히 이 급의 수정마다 **CHANGELOG 를 별도 체크리스트 항목으로 명시**해 온 확립된 관례가 있다 — 같은 `update-returning-tuple-shape.md` 안에서만도 `- [x] CHANGELOG — 이번 결함 Unreleased 항목 + 기존 1·5·6·7 소급 정정`(라인 233)과 `- [x] **CHANGELOG Unreleased 항목**`(라인 264) 두 건이 이미 있다. 게다가 `CHANGELOG.md` 에는 이 정확한 코드 경로를 다루는 기존 항목("`UPDATE … RETURNING` 의 결과를 8곳이 행 배열로 오인했다" 섹션의 5번 — `updateExecutionStatus` 의 `persisted` 가 항상 `true` 였다는 서술)이 이미 있고, 그 파일은 같은 섹션 안에서 "소급 정정 (날짜)" 블록을 덧붙이는 패턴을 반복 사용한다(예: retry_last_turn 섹션·AI multi-turn 섹션 끝의 `> 소급 정정 (2026-08-14)`). 즉 이번 트랜잭션화 완료는 바로 그 자리에 후속 addendum 을 붙이기 좋은, 이 저장소가 스스로 세운 관례상 CHANGELOG 대상이다. 이 fix 는 내부 리팩터가 아니라 "DB 는 terminal 인데 종결 이벤트가 안 나가고 stuck recovery 에도 안 잡히는" 실사용자 영향 있는 결함 클래스의 완결편이라 운영 가시성 관점에서도 누락 비용이 크다.
  - 제안: `CHANGELOG.md` 의 "`UPDATE … RETURNING` 의 결과를 8곳이 행 배열로 오인했다" 섹션 끝에 이번 트랜잭션화(② 완료)를 다루는 짧은 "소급 정정" 또는 신규 addendum 블록을 추가한다. 두 plan 파일 체크리스트에도 (기존 관례처럼) "CHANGELOG 반영" 여부를 별도 항목으로 명시해 다음 사람이 이 diff 만 보고 "완료" 로 오인하지 않게 한다.

- **[INFO]** `spec_impact` 로 선언된 spec 파일이 이번 diff 에서 손대지 않았다 — 스코프 확인 필요
  - 위치: `plan/in-progress/update-returning-tuple-shape.md`(frontmatter `spec_impact:` 목록, `spec/5-system/4-execution-engine.md` 포함) / 대상 spec 파일 `spec/5-system/4-execution-engine.md:98`("원자성 보장" 단락, 미변경).
  - 상세: 이 plan 의 frontmatter 는 `spec/5-system/4-execution-engine.md` 를 영향 대상으로 명시하고 있고, 바로 직전 커밋(`5fbcd20b8`, 오늘 날짜)이 같은 plan 의 다른 항목(①: 튜플 오인 버그)을 위해 이 spec 파일에 "소급 각주 (2026-08-30)" 를 실제로 추가한 전례가 있다(spec 라인 53-62). 그런데 이번 diff(② 트랜잭션화)는 그 spec 파일을 건드리지 않는다. spec 라인 98 의 "원자성 보장" 단락은 `linkedNodeExec` 짝 전이 분기의 단일 트랜잭션 보장만 상세히 서술하고, else 분기(단일 엔티티 terminal 전이)가 이번에 얻은 트랜잭션 롤백 안전장치는 언급이 없다 — 두 분기가 대칭적인 트랜잭션 배선을 갖게 됐는데 문서는 한쪽만 설명한다.
  - 제안: 이 변경이 "내부 방어적 안전장치"(shape 위반이라는, 정상 운영에서는 발생하지 않아야 하는 경로에 대한 롤백 보장)로 판단되면 spec 영향 없음으로 판정을 명시적으로 남기고, 만약 "else 분기도 이제 트랜잭션 안전"이라는 사실이 spec 독자(예: 장애 대응자가 "stuck recovery 가 못 잡는 상태가 가능한가"를 spec 만 보고 판단하는 경우)에게 유의미하면 §1.1 원자성 보장 단락에 한 줄 추가하는 편이 낫다. `complete/` 이동 전에 이 판단을 plan 에 명시할 것.

- **[INFO]** 신규 테스트 제목이 mocked `DataSource` 로는 검증할 수 없는 결론("롤백된다")을 단언하듯 표현
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4806` (`it('shape 위반 throw 가 트랜잭션 밖으로 나간다 — UPDATE 가 롤백된다', async () => {`)
  - 상세: 바로 위 JSDoc(gate 4793-4805)은 "여기서 고정하는 축은 두 개다: (a) UPDATE 가 트랜잭션 manager 를 경유하는가, (b) throw 가 트랜잭션 콜백 밖으로 전파되는가" 라고 스코프를 정확히 좁혀 뒀다 — 정직하고 좋은 서술이다. 하지만 `dataSource.transaction` mock(`useValue.transaction: jest.fn(async (cb) => { ...; return cb(manager); })`, 파일 1 gate 486-519)은 콜백을 그대로 실행할 뿐 실제 롤백 로직이 없으므로, 이 unit 테스트는 "트랜잭션이 열렸고 throw 가 밖으로 나갔다"(=TypeORM 이 실제로 롤백을 수행하기 위한 전제조건)만 관측할 수 있고 **실제 DB 롤백 자체는 검증하지 못한다**(그건 e2e/실 Postgres 영역). 테스트 `it()` 설명문이 "UPDATE 가 롤백된다"고 결론을 선언해, JSDoc 이 신중하게 좁혀 둔 범위보다 넓게 읽힐 수 있다.
  - 제안: 제목을 JSDoc 의 스코프와 일치시켜(예: "…트랜잭션 밖으로 나간다 — 롤백 전제조건(트랜잭션 경유+전파)을 고정한다") 다음 리뷰어가 "롤백 자체가 unit 테스트로 커버됐다"고 오인하지 않게 한다. (커밋 메시지는 e2e PASS 를 근거로 실 DB 경로 확인을 언급하지만, 그 e2e 는 일반 경로 실행 확인이지 이 특정 shape-위반 롤백 시나리오를 재현하는 전용 테스트는 아니다 — 아래 참고.)

## 그 외 확인한 것 (문제 없음)

- `execution-engine.service.ts` 의 새 트랜잭션 래핑 주변 인라인 주석(gate 8677-8690)은 종전 주석("트랜잭션 밖이라 throw 가 롤백을 부르지 못한다")을 정확히 대체했고, 코드 동작과 완전히 일치한다. 다른 곳에 같은 구문("트랜잭션 밖 단발 UPDATE")의 stale 사본이 남아있는지 grep 했으나 스펙 파일의 것(과거형 서술로 정확함)을 제외하고 없음.
- `execution-engine.service.spec.ts` 의 mock 재작성(gate 275-291) 주석은 "공유 대신 위임을 골랐다" 는 설계 근거를 정확히 서술하고, 실제 구현(`mockExecutionRepo.query(sql, ...rest)` 위임)과 일치한다.
- 신규 테스트 두 번째(gate 4836-4858, "정상 경로도 트랜잭션 manager 를 경유한다")는 "위 롤백 테스트가 공허하지 않다"는 이유를 스스로 명시해, vacuous-test 회귀를 방지하는 좋은 문서화 패턴이다.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 와 `plan/in-progress/update-returning-tuple-shape.md` 가 같은 항목("②: updateExecutionStatus 트랜잭션화")을 각각 추적하고 있었는데, 이번 diff 는 중복 서술을 만들지 않고 한쪽(`backend-lint-gate-broken-on-main.md`)을 원본으로 삼아 다른 쪽은 포인터만 남기는 방식으로 정리했다 — 이 저장소가 반복 학습한 "같은 항목을 두 트래커가 각자 세면 진행 상황이 두 번 세어진다" 교훈을 잘 적용했다.

## 요약

핵심 코드 변경(`updateExecutionStatus` else 분기의 트랜잭션 래핑) 자체의 인라인 주석·JSDoc·plan 체크리스트 서술은 정확하고 상세하며, 낡은 주석이나 명백한 오기술은 없었다. 다만 이 저장소가 이 정확한 코드 경로에 대해 스스로 세워 온 관례 — 유사 심각도 수정마다 CHANGELOG 에 dated 항목/addendum 을 남기는 것 — 를 이번엔 지키지 않았다는 점이 가장 뚜렷한 갭이다. 추가로 `spec_impact` 로 선언된 spec 파일이 이번 항목에서는 갱신되지 않은 점, 그리고 신규 테스트 제목이 mock 이 실제로 증명하지 못하는 "롤백" 결론을 선언형으로 표현한 점은 경미하지만 다음 독자의 오인을 부를 수 있어 함께 기록한다.

## 위험도

LOW
