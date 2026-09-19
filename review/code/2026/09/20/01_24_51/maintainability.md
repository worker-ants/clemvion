# 유지보수성(Maintainability) 리뷰 — column-guard-gaps (2라운드)

## 검토 범위

- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 유일한 실제 코드 변경(핵심 검토 대상). 전체 파일(664줄)을 직접 `Read` 로 열어 diff 반영 후 최종 상태를 확인했다.
- `plan/in-progress/column-guard-gaps.md` — 신규 plan 문서.
- `review/code/2026/09/20/01_00_21/*`, `review/consistency/2026/09/20/00_34_58/*` (18개 파일) — 1라운드 `/ai-review`·`--impl-prep` 산출물로 이번 커밋에 함께 실렸다. 함수·네이밍·중첩·매직넘버·순환 복잡도 등 이 관점의 8개 점검 항목이 적용될 코드가 없는 정적 마크다운/JSON 리포트이며, 프로젝트 컨벤션상 `review/**` 는 산출물 보관 위치라 그 자체가 유지보수성 문제는 아니다. 상세 라인 단위 검토는 생략한다.

## 1라운드 WARNING/INFO 후속 확인

1라운드 `SUMMARY.md`(WARNING #2)가 지적한 "`qr.connect()`/`qr.startTransaction()` 이 `try` 밖에 있어 실패 시 `release()` 누락 가능" 문제와 INFO #1(두 `readOnlyDataSourceOptions()` 호출부의 `try`/`finally` 관용구 불일치)이 커밋 `a71642fe0` 로 조치됐다고 `RESOLUTION.md` 가 주장한다. 실제 파일을 읽어 직접 대조했다.

- **WARNING #2 조치 확인됨**: `qr.connect()`(617행)·`qr.startTransaction()`(618행)이 이제 `try` 블록 **안**에 있고, `finally`(655~662행)는 `if (qr.isTransactionActive) await qr.rollbackTransaction();` 를 안쪽 `try`로, `release()` 를 별도 `finally` 로 분리해 롤백 실패가 release 를 막지 않는다. 주장대로 반영됐다.
- **INFO #1 조치 확인됨**: 기존 "컬럼 —" 테스트(568~577행)와 신규 "비교기 연결은 읽기 전용이다" 테스트(595~606행) 모두 이제 `initialize()` 를 `try` 안에서 호출하고 `finally` 에서 `if (readOnly.isInitialized) await readOnly.destroy();` 로 동일한 관용구를 쓴다. 더 이상 불일치가 없다.

## 발견사항

- **[INFO]** 부모 엔티티(user → workspace → workflow) 원시 SQL INSERT 3연쇄가 이 파일로 세 번째 반복
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 신규 테스트 `'선언한 DB 기본값은 값을 생략한 insert 뒤 엔티티로 돌아온다 …'` (619~630행)
  - 상세: 같은 3단계 체인이 `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts`(131·233·238·242행 부근)에도 원시 SQL로 반복돼 있음을 직접 grep 으로 확인했다(`INSERT INTO "user"` 매칭 3개 파일). 공유 헬퍼(`test/helpers/*.ts`)는 아직 없다. 1라운드 리뷰가 이미 INFO 로 지적했고 "이번 diff 가 새로 만든 패턴이 아니다(파일별 자기완결 컨벤션)"라는 판단에 동의한다 — 이 diff 만의 회귀는 아니다.
  - 제안: 조치 불요(1라운드와 동일 결론 유지). 네 번째 e2e 파일이 같은 체인을 필요로 하면 그때 `test/helpers/e2e-fixture.ts` 류 헬퍼 추출을 고려.

- **[INFO]** 신규 왕복 테스트가 단일 `it` 에서 세 책임(부모 픽스처 생성·`ModelConfig` 검증·`WorkflowAssistantSession` 검증)을 순차 수행해 46줄(614~663행)
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:614-663`
  - 상세: 두 컬럼이 같은 트랜잭션·같은 부모 행을 공유해야 하는 시나리오라 분리하면 픽스처가 중복된다. 내부는 순차 `await` 체인뿐이고 분기·중첩이 없어(끝의 `try`/`finally` 중첩 1단만 예외) 인지 부하는 낮다. 새 컬럼이 더 늘면 재고할 사안으로 plan의 "비대상" 절에서도 스코프를 두 컬럼으로 못박아 뒀다.
  - 제안: 조치 불요. 세 번째 대상 컬럼이 추가되면 분리·헬퍼화 재고.

- **[없음/개선 확인]** `log` → `sqlMemory` 리네이밍, 두 곳에 흩어져 있던 읽기 전용 `DataSource` 옵션을 `readOnlyDataSourceOptions()` 헬퍼(207~220행)로 추출한 DRY, `COLUMN_LEVEL_SAMPLES.caught` 각 표본 위 "어느 뮤턴트 → 어느 패턴" 주석(83~98행) 모두 가독성·의도 표현을 개선했다. 결함이 아니라 근거로 남긴다.

## 요약

2라운드 diff(21개 파일)에서 실제 코드는 `entity-schema-declarations.e2e-spec.ts` 하나뿐이며, 1라운드 SUMMARY 의 testing WARNING(커넥션 누수 가능성)과 INFO(관용구 불일치)가 커밋 `a71642fe0` 로 실제로 반영됐음을 파일을 직접 읽어 확인했다. 새로 도입된 유지보수성 결함은 없다 — 변수명 개선, 헬퍼 추출, 표본 주석 모두 개선 방향이고, 함수 길이·중첩·매직넘버·순환 복잡도 모두 무난하다. 남은 두 INFO(부모 픽스처 원시 SQL 3중 중복, 46줄 테스트)는 1라운드에서 이미 "조치 불요 — 향후 재고" 로 타당하게 처분된 사안으로 이번 라운드에서도 같은 결론이다. `review/**` 산출물 18개는 코드가 아니라 정적 리포트라 이 관점이 적용되지 않는다.

## 위험도

NONE
