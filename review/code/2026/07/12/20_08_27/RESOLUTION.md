# RESOLUTION — fresh ai-review 2R (20_08_27)

원 리뷰: `review/code/2026/07/12/20_08_27/SUMMARY.md` — RISK MEDIUM, CRITICAL 0, WARNING 2.

## WARNING (2건 — 전부 반영)

- **W1 (테스트) — drift 가드가 SoT 순서 회귀를 무음 통과**: `enum===[...SoT]` 는 파생 심볼
  비교라 tautological, 엔티티 체크는 `.sort()` 로 순서 면제 → 배열 재정렬 시 21건 green(reviewer
  mutation-test 실증). **반영**: 신규 `execution-status.literal.spec.ts` 에 **하드코딩 순서 pin**
  (`expect([...EIA_EXECUTION_STATUS_VALUES]).toEqual(['pending','running','waiting_for_input','completed','failed','cancelled'])`)
  + 엔티티 집합 동등성 이관. 두 DTO spec 은 "그 DTO 의 enum 이 SoT 를 반영하는지"만 유지(중복 제거 = I3).
- **W2 (문서) — plan 완료 노트 stale**: 상수명(`EXECUTION_STATUS_VALUES`→실제 `EIA_`)·spread(→직접
  참조)·테스트 건수(15→21)가 최종 코드와 어긋남. **반영**: L33 완료 노트를 최종 코드에 맞춰 정정.

## INFO
- **I1**: swagger.md §5-1 `*.literal.ts` 공유-SoT 패턴 명문화 후속을 plan "잔여(별 slice)" 목록에
  명시 등재(약속만 있고 미추적이던 상태 해소). 실제 §5-1 spec 편집은 planner 트랙 별 후속.
- **I2 (Object.freeze)**: skip — 기존 관례(INTERACT_COMMANDS·explore-tools 동명 상수)와 일치,
  두 소비처 미변형이라 실질 무위험. 단일 const 만 freeze 하는 convention 일탈 회피.
- **I3 (중복 drift 로직)**: W1 해소로 `execution-status.literal.spec.ts` 에 SoT 불변식 통합 완료.

## maintainability disk-write gap
2R 연속 disk-write gap(1R requirement, 2R maintainability). 순수 DRY 리팩터라 유지보수성은
개선 방향이며 인접 reviewer(scope/side_effect/documentation) 커버 — 실질 미해소 없음 판정.

## 검증
- build: PASS (nest build)
- lint: PASS
- unit: PASS (DTO/SoT 스키마 회귀 21 — 순서 pin 포함)
- e2e: 통과 (253 tests, backend supertest — 무회귀; 초기 postgres 기동 실패는 Docker VM 디스크
  포화였고 `builder/image prune`(~57GB 확보) 후 green, 코드 무관)

fresh `/ai-review --branch origin/main` 3R 후속(수렴 확인).
