# 문서화(Documentation) Review — `16_44_28`

## 리뷰 대상

이 세션은 `finalizeStalledExhausted` 트랜잭션 원자화 PR 의 4번째 리뷰 라운드다. 실질 코드
diff(`execution-engine.service.ts` / `.spec.ts`)는 이전 3라운드(`16_04_38`→`16_19_26`→
`16_31_53`)에서 이미 3회 검토·수정됐고, `git show HEAD:...` 로 직접 대조한 결과 JSDoc·
CHANGELOG·spec 미러 모두 실제 코드(`this.dataSource.transaction(async (manager) => {...})`
사용 확인)와 일치한다. 이번 라운드에서 실제로 남은 변경분은 (a) `plan/complete/`↔
`plan/in-progress/` 파일 rename 에 따른 dangling link 정정, (b) `plan/in-progress/
eia-stalled-atomicity.md` 체크리스트 갱신, (c) 3라운드분 리뷰·consistency 산출물 커밋이다.

## 발견사항

- **[WARNING]** plan 문서의 "판별력(뮤테이션)" 감사 표가 3라운드에 걸쳐 늘어난 실제 검증
  범위를 반영하지 못하고 라운드 1 상태에 멈춰 있다
  - 위치: `plan/in-progress/eia-stalled-atomicity.md` `## 판별력 (뮤테이션)` 절
    (55-60행) — 대조: 같은 파일 `## 체크리스트` 절(77-78행). 관련:
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md:275-279`
  - 상세: `eia-stalled-atomicity.md` 는 `3e64f2a0a`(라운드 1 구현) 커밋에서 생성된 뒤
    `git log --follow` 상 `749488801`(체크박스 hygiene 커밋) 한 번만 더 손이 갔고,
    `5ba4b125c`(라운드 2 W1/W4 fix)·`0d9c6166f`(라운드 3 W1 — Execution `WHERE id`
    하드닝)·`a184edc00`(라운드 3 W1 — 트랜잭션 예외 삼킴 계약 테스트)에서는 전혀
    수정되지 않았다. 그 결과 "판별력 (뮤테이션)" 표는 여전히 라운드 1의 두 뮤턴트
    (`dataSource.transaction` 제거 → RED 3/3, `affected=0` 조기 return 제거 → RED 1)
    만 나열한다. 그러나 각 세션 `RESOLUTION.md` 를 대조하면 이후 라운드에서 최소
    3개 뮤턴트가 추가로 검증됐다 — `16_19_26` RESOLUTION: *Execution `WHERE id`
    변조 2건 RED*, `16_04_38` RESOLUTION: *cascade WHERE 가드 변조 RED*, `16_31_53`
    RESOLUTION: *트랜잭션 예외 삼킴 RED*(누적 목록에 5개로 명시). 같은 파일의
    `## 체크리스트` 절(이번 라운드에서 `[x]` 로 막 갱신됨, 77-78행)은 "`/ai-review`
    CRITICAL 0 — 3라운드. `16_04_38`(W4)·`16_19_26`(W2)·`16_31_53`(W1) 전부 조치" 라고
    정확히 서술하는데, 바로 위 "판별력" 절은 그 3라운드가 실제로 무엇을 검증했는지
    보여주지 못해 **같은 문서 안에서 두 절이 서로 다른 시점을 가리킨다**. "정본
    트래커"(`spec-sync-external-interaction-api-gaps.md:275-279`)의 완료 서술도
    같은 초기 뮤턴트("3/3 RED")만 인용해 동일한 한 세대 뒤처짐을 그대로 물려받았다.
    이 저장소는 뮤테이션 판별력을 "패치가 아니라 실측 증거"로 취급하는 관례가 강하고
    (다수 plan 문서가 판별력 표를 감사 근거로 인용), 이 표만 보고 커버리지를 판단하면
    Execution `WHERE id`/cascade WHERE 가드/트랜잭션 예외 삼킴 세 계약이 실제로는
    뮤테이션으로 잠겨 있다는 사실을 놓친다.
  - 제안: `eia-stalled-atomicity.md` §판별력 표에 3개 행을 추가한다 — `Execution
    WHERE id 변조` → RED 2/2, `cascade WHERE 변조` → RED, `트랜잭션 중간 실패 삼킴`
    → RED(각 `RESOLUTION.md` 참조 링크 포함). 정본 트래커의 275-279행도 "3/3 RED"
    뒤에 누적 결과를 한 줄 추가하거나 `eia-stalled-atomicity.md` 를 가리키는 것으로
    충분하다면 그 사실을 명시.

## 확인했으나 문제 없음 (재확인)

- 프로덕션 JSDoc(`execution-engine.service.ts:3315-3344`)이 실제 구현
  (`this.dataSource.transaction(async (manager) => {...})`, 3357행)과 정확히 일치함을
  `Read`/`grep` 으로 직접 재확인 — 트랜잭션 여부를 문서만 보고 판단하지 않고 실제 실행
  경로를 열어 대조했다.
- 라운드 2 WARNING("JSDoc·인라인 주석 90% 중복")은 라운드 3 커밋에서 실제로 해소됨
  (인라인 주석이 "근거는 위 JSDoc 참조" 한 줄로 축약, 3353-3354행) — 재발 없음.
- `plan/complete/eia-db-wire-invariant.md`(rename) 로의 두 참조
  (`spec-sync-external-interaction-api-gaps.md:250`,
  `update-returning-tuple-shape.md:336`)가 실제 `git mv` 결과와 정확히 일치, dangling
  link 없음.
- `spec/5-system/4-execution-engine.md` §7.1 콜아웃과 §Rationale 양쪽이 같은 커밋에서
  트랜잭션화 사실로 동기 갱신됨(라운드 3 documentation 리뷰가 이미 확인한 상태 유지).
- CHANGELOG 항목(`## Unreleased — stalled 마감의 부분 커밋`)은 문제→원인→수정→수신자
  영향 형식을 따르고 실제 diff 와 일치.
- README·API 문서·환경변수 문서화 대상 없음 — 내부 트랜잭션 경계 수정으로 공개
  API·CLI·설정 변경 없음(3라운드 전부 동일 판정, 재확인 결과 유지).
- `review/code/2026/08/15/{16_04_38,16_19_26,16_31_53}/**` ·
  `review/consistency/2026/08/15/{15_54_20,16_19_57,16_32_26}/**` 는 이 저장소의 확립된
  관례(리뷰/consistency-check 산출물 커밋)이며 세션 번호·인용 내용이 실제 디스크 산출물과
  일치(`16_32_26/plan_coherence.md` 의 체크리스트 staleness 지적과 이번 라운드의
  `eia-stalled-atomicity.md` 체크박스 갱신이 서로 맞물림을 확인).

## 요약

핵심 코드(JSDoc·CHANGELOG·spec 미러)는 3라운드에 걸쳐 이미 꼼꼼히 정리됐고 이번 라운드에서
새로 만든 문서 결함은 없다. 다만 `plan/in-progress/eia-stalled-atomicity.md` 의 "판별력
(뮤테이션)" 감사 표가 라운드 1 시점에 멈춰 있어, 같은 문서 하단 체크리스트가 정확히 기록한
"3라운드 조치 완료"와 내용상 어긋난다 — 이후 두 라운드에서 추가로 잠근 3개 뮤테이션 계약
(Execution `WHERE id`, cascade WHERE 가드, 트랜잭션 예외 삼킴)이 이 문서만 봐서는 검증됐는지
알 수 없다. 정본 트래커의 완료 서술도 같은 한 세대 뒤처진 인용을 물려받았다. 기능적 위험은
없으나, 이 저장소가 뮤테이션 판별력을 감사 근거로 삼는 관례를 이 PR 자신의 최종 기록
문서에서 스스로 어긴 사례라 WARNING 으로 표시한다.

## 위험도

LOW
