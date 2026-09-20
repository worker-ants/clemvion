# 문서화(Documentation) 리뷰 — rotate 동시성(lost update) 수정

## 발견사항

- **[WARNING]** 같은 클래스의 선례(`trigger-config-lost-update.md`)는 `CHANGELOG.md` 에 항목을 남겼는데, 이번 rotate lost-update 수정에는 대응 항목이 없다.
  - 위치: `CHANGELOG.md` (변경 없음 — 이 PR 의 diff 에 파일 자체가 없음), 대조 대상 `CHANGELOG.md:125` `## Unreleased — PATCH 가 동시에 커밋된 컬럼을 옛 값으로 되돌렸다 (이론적 TOCTOU 가 아니었다)`
  - 상세: `plan/in-progress/rotate-lost-update.md` 는 이번 결함을 "같은 모듈의 재인증 콜백(CONC H-3)" 및 `trigger-config-lost-update.md` 와 같은 클래스의 lost-update 로 명시적으로 규정하고, 처방도 그 두 선례를 그대로 따른다(락 밖 외부 호출 → 락 안 재읽기·머지·UPDATE). `trigger-config-lost-update.md` 는 정확히 같은 성격의 결함(동시 쓰기가 먼저 커밋된 컬럼을 조용히 되돌림)에 대해 "고친 것"·"함께 실측으로 확정한 것" 구조의 `CHANGELOG.md` 항목을 남겼다. 이번 수정도 배포 전 "연결 테스트가 도는 수 초 동안 동시 rotate 가 있으면 한쪽 필드가 조용히 사라졌다" 는, 운영·지원 담당자가 알아야 할 실사용자 영향이 있는 결함이었다(외부 계약은 200 그대로라 API 문서 변경은 불필요하지만, CHANGELOG 는 API 계약과 별개로 "배포 전후 동작이 달라진 사실"을 기록하는 문서다). `plan/in-progress/rotate-lost-update.md` 의 체크리스트(9개 항목, `/ai-review`·`--impl-done`·트래커 해소만 남음)에는 CHANGELOG 갱신 항목이 없다.
  - 제안: `trigger-config-lost-update.md` 항목과 같은 형식으로 `CHANGELOG.md` 에 "Unreleased" 항목을 추가한다 — 결함(연결 테스트 수 초 창에서 동시 rotate 시 나중 커밋이 먼저 커밋된 필드를 되돌림) · 고친 것(락 안 재읽기 위에 머지, `pessimistic_write`) · 남는 것(서로 다른 필드를 동시에 바꾸면 그 조합 자체는 테스트되지 않음, plan §B 인용)을 요약. plan 체크리스트에도 이 항목을 추가해 `plan/complete/` 이동 전에 놓치지 않게 한다.

- **[INFO]** `spec/data-flow/5-integration.md` 의 rotate 서술이 이번에 도입한 잠금 메커니즘을 언급하지 않아, 인접한 OAuth 재인증 콜백 시퀀스와 정보 비대칭이 남는다 — 단 이미 인지·유예된 사항이다.
  - 위치: `spec/data-flow/5-integration.md` 65~67행 (rotate 산문, `SELECT ... FOR UPDATE` 미언급) vs 100~104행 (재인증 콜백, 잠금 명시)
  - 상세: `/consistency-check --impl-prep`(`review/consistency/2026/09/20/16_58_56`, BLOCK: NO)의 cross_spec INFO#1 이 이미 같은 지점을 지적했고, "비차단, `spec_impact: none` 유지 가능"으로 결론 내렸다. `plan/in-progress/rotate-lost-update.md` 는 이 INFO 를 체크리스트에 반영하지 않았지만, 원 리포트가 명시적으로 선택 사항(optional)이라고 적었으므로 이 자체는 새로운 결함이 아니다. 다만 재확인 차 기록해 둔다 — 다음에 이 문서를 읽는 사람이 rotate 와 재인증의 동시성 처리 대칭성을 spec 만 보고 오판하지 않도록, 여력이 있을 때 한 줄 추가할 만하다.
  - 제안: (선택) `spec/data-flow/5-integration.md` 65~67행 근처에 "rotate 도 CONC H-3 와 동일한 `pessimistic_write` 메커니즘을 쓴다" 한 줄 추가. 필수는 아니며 이 PR 을 막지 않는다.

## 검증 노트 (주석 정확성 대조)

아래는 이번 diff 의 인라인 주석이 근거로 든 문서·코드를 직접 열어 대조한 결과다 — 모두 정확했다:

- `integrations.service.ts` 의 `// **4-integration.md Rationale 이 기각한 advisory lock 의 재도입이 아니다**` 주석(락 블록 진입 직전)이 인용하는 기각 사유("lock 보유 중 HTTP 요청을 transaction 안에 묶어야 해 DB 커넥션 점유가 늘어난다")는 `spec/2-navigation/4-integration.md:1494` 원문과 일치한다.
- 같은 주석이 인용하는 `integration-oauth.service.ts` `CONC H-3` 블록(재인증 콜백의 `pessimistic_write` 재읽기)은 `codebase/backend/src/modules/integrations/integration-oauth.service.ts:723-731` 에 실제로 존재하며 서술과 일치한다.
- `integrations.service.spec.ts` 의 `dataSource` mock 주석 "같은 모듈 형제 `integration-oauth.service.spec.ts` 와 같은 패턴" 은 그 파일의 `dataSource`/`transaction` mock 구조와 실제로 일치한다.
- `integration-rotate-concurrency.e2e-spec.ts` 상단 JSDoc 이 인용하는 `plan/complete/trigger-config-lost-update.md §C` (테스트가 직접 락을 쥐는 기법) 는 해당 문서의 `## C. 검증 — 동시성은 unit 이 못 잡는다` 절 서술과 일치한다.
- 단위 테스트의 `findOne` 호출 횟수 주석(`// 셋: requireEntity · 락 안 재읽기 · 저장 뒤 응답용`, `toHaveBeenCalledTimes(3)`)은 실제 `rotate()` 구현의 `requireEntity` 내부 1회 + 트랜잭션 내 재읽기 1회 + 저장 뒤 재조회 1회의 세 자리와 일치한다.

## 요약

코드·테스트의 인라인 주석 품질은 이 리포지토리의 평소 수준을 상회한다 — advisory lock 기각과의 구분, CONC H-3 와의 대응, 부분 `update` 를 유지하는 이유가 모두 근거와 함께 정확히 적혀 있고, 실제로 열어 대조한 모든 인용(spec Rationale, 형제 서비스 코드, 선례 plan 문서)이 사실과 일치했다. 새 JSDoc 이 필요한 공개 API 표면 변화는 없고(rotate() 의 외부 계약은 그대로 200), README·API 문서 갱신도 불필요하다(spec_impact: none 은 이미 `/consistency-check --impl-prep` BLOCK: NO 로 검증됨). 유일한 실질적 갭은 같은 클래스의 선례가 남긴 `CHANGELOG.md` 항목을 이번 PR 은 아직 남기지 않았다는 점이다 — 게이트가 강제하는 사항은 아니지만, 이 저장소의 일관된 관행과 plan 이 스스로 인용한 선례에 비추면 `plan/complete/` 이동 전에 채워 넣는 것이 맞다.

## 위험도

LOW
