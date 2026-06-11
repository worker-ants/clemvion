# RESOLUTION — refresh rotation 원자화 최종 재리뷰 (05 C-1)

리뷰 세션: `review/code/2026/06/11/09_17_01/` (최종 재리뷰, fix 커밋 `abd77309` 이후 상태 대상).
위험도 **LOW** · Critical 0 · Warning 3 · INFO 13.

> 본 세션은 **마지막 코드 커밋(`abd77309`) 을 커버하는 종결 리뷰**다. 본 RESOLUTION 이후 코드 변경 없음
> (review/plan/spec-doc 만). 핵심·실질 개선(W2 TOCTOU 조건부 revoke, 테스트 커버리지, spec 다이어그램
> 정합)은 선행 커밋(`98aee7fb`/`abd77309`)에서 이미 반영됐고, 본 세션 잔여는 전부 LOW 폴리시다.

## 조치/수용 — Warning

| # | 카테고리 | 처리 | 근거 |
| --- | --- | --- | --- |
| W1 | Maintainability | **반영 완료(`abd77309`)** | `generateTokens` 의 EN 인라인 주석 2건(`// 15 minutes`, `// Create refresh token`)을 KO(`// 15분`, `// refresh token 생성`)로 통일. 함수 내 잔여 EN 주석은 본 변경이 추가한 것이 아닌 기존 코드 — 전수 한글화는 scope 밖 |
| W2 | Maintainability | **수용** | `refresh` describe 의 `findOne` mock 반복은 기존 테스트의 패턴을 답습한 것 — `beforeEach` 공통화는 가독성 개선이나 본 PR 의 원자화 목표와 무관. 별 정리 항목 |
| W3 | Testing | **반영 완료(`abd77309`)** | 롤백 테스트에 "revoke 는 시도됐으나 INSERT 실패로 트랜잭션 reject — 실 DB 에선 이 revoke 도 롤백(단위 mock 은 롤백 미재현)" 주석 추가. 호출 시퀀스 검증임을 명시 |

## 수용 — INFO (현행 유지/후속)

| # | 판단 | 근거 |
| --- | --- | --- |
| I1 | 후속 plan | `resolveTokenWorkspaceContext`+JWT sign 의 트랜잭션 밖 선계산(hold time 최소화)은 RESOLUTION(08_45_18) 후속 항목으로 등록됨 — refresh 빈도·트랜잭션 길이 작아 현 영향 미미 |
| I2 | 수용 | `stored.user===null` 가드 테스트 — 가드는 자명(reuse 분기와 동일 패턴), 데이터 손상 케이스라 발생 빈도 0에 수렴. 추가 가치 낮음 |
| I3 | 수용 | `affected: undefined/null` 분기 — `!result.affected` falsy 거부가 세 값을 모두 커버, 주석으로 의도 명시. pg 드라이버는 number 반환이라 실제 undefined/null 미발생 |
| I4·I8(보안 예외전파)·I12 | scope 밖/인프라 | 트랜잭션 에러 클라이언트 노출은 글로벌 예외 필터(기존) 책임 — 본 변경이 만든 경로 아님. 앱-DB 시각차(MoreThan(now))는 NTP 동기화 인프라 전제 |
| I5·I9·I10·I11·I13 | 폴리시/후속 | generateTokens 5-param→options 객체, 매직넘버(900/86400000) 상수화, 테스트 네이밍 통일 — 다음 시그니처/정리 시점. 본 PR 무관 |
| I6 | 확인 완료 | spec §1.4 노트의 구현 식별자(`EntityManager`) 참조는 `0bee352f`(impl-done W4/I4)에서 제거 완료 — diff 미포함은 그 선행 커밋 때문 |
| I7 | 수용(표현) | spec "JWT sign 은 트랜잭션 밖에서 선계산" 은 **개념적 독립성**(DB I/O 없어 commit/rollback 에 불참)을 뜻한다 — JWT sign 이 콜백 안에서 호출돼도 트랜잭션 의미·원자성에 영향 없음(리뷰도 "코드 버그 아님" 확인). 문구는 atomicity 관점의 정확한 기술로 유지 |

## TEST 결과

- **lint**: 통과 (eslint --fix)
- **unit**: 통과 (backend 6509; auth.service 193 — 조건부 revoke·affected=0·만료경로·롤백전파·user-null 가드)
- **build**: 통과 (`nest build`)
- **e2e**: 통과 (dockerized, 188 — auth refresh 흐름 실 DB 트랜잭션 경유)

## 보류·후속 항목

- 트랜잭션 hold time 최소화(I1): `generateTokens` 의 context resolve/JWT sign 을 콜백 밖 선계산.
- `registerWithInvitation` user+token INSERT 원자성 확장(08_45_18 INFO 8).
- 매직넘버 상수화·테스트 mock 공통화·네이밍 통일(폴리시).
