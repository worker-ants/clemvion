# 테스트(Testing) 리뷰

## 검증 수행 내역

- `npx jest src/modules/auth/login-history.service.spec.ts src/modules/executions/background-runs/background-runs.service.spec.ts` — 2 suites / 35 tests 전부 GREEN (baseline).
- 독립 뮤테이션 검증 2건 (scratch 사본 대조 후 `cp` 로 원복, `git status --short` 로 잔여물 없음 확인):
  - `login-history.service.ts` `decodeCursor` 의 `if (!isUuidShaped(id)) return null;` 를 주석 처리 → `login-history.service.spec.ts:194` 테스트가 RED (`andWhere` 가 `cursorId:"not-a-uuid"` 로 호출됨을 그대로 노출). 원복 후 12/12 GREEN.
  - `background-runs.service.ts` 의 `if (!isUuidShaped(parsed.i))` 조건을 `if (false && ...)` 로 무력화 → `background-runs.service.spec.ts:633` 테스트가 RED. 원복 후 23/23 GREEN.
  - 두 결과 모두 plan(`plan/in-progress/keyset-cursor-uuid-validation.md` M1·M2)이 주장한 표와 일치. developer 의 뮤테이션 주장이 재현 가능함을 확인.
- 작업 종료 시 `git status --short` 결과 리뷰 산출물 디렉터리(`review/code/**`, `review/consistency/**`)만 untracked 로 남아 저장소 오염 없음.

## 발견사항

- **[WARNING]** `background-runs.service.ts` 의 keyset 커서 검증에 "정상 UUID 커서가 실제로 통과해 쿼리에 반영되는" 완주(happy-path) 유닛 테스트가 없다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:633`~`681` (신규 두 케이스), 대비 대상은 같은 파일의 기존 `paginates via cursor` 케이스(`571`행대)
  - 상세: 이번 diff 가 추가한 두 케이스는 (a) 비-UUID 거부(`633`행, `rejects.toMatchObject`로 완주까지 확인)와 (b) nil UUID 통과 대조군(`655`행)이다. 그런데 (b) 는 주석에 명시된 대로 "완주를 단언하지 않는다" — `nodeExecutionRepo.createQueryBuilder` 를 이 테스트에서 전혀 mock 하지 않아, `isUuidShaped` 를 통과한 뒤 `findBackgroundNodeExecution` 단계에서 `undefined.where(...)` TypeError 로 죽는다. 테스트는 `err?.response?.code ?? null` 로 안전하게 흡수해 `code !== 'INVALID_CURSOR'` 만 확인한다. 그 결과 저장소 전체에 "표준 v4 UUID 형태의 정상 커서가 `decodeCursor` 를 통과해 `fetchBodyPage` 의 `andWhere`(`lastId: cursor.i`)에 실제로 바인딩되는" 것을 끝까지 확인하는 테스트가 하나도 없다(`grep -n "cursor:" background-runs.service.spec.ts` 결과 3건 전부 거부 케이스뿐). `login-history.service.spec.ts` 쪽은 `applies composite cursor filter when provided`(147행)가 `CURSOR_UUID` 로 이 역할을 완전히 수행하므로, 두 자매 파일의 커버리지가 비대칭이다.
  - 제안: `nodeExecutionRepo.createQueryBuilder` 를 `buildBgNodeExecQB`/`buildBodyPageQB`/`buildAggregateQB` 체인으로 완전히 세운 뒤, 유효한 v4 UUID 를 `i` 로 갖는 커서를 넣어 `getBackgroundRun` 이 정상 완주하고 `fetchBodyPage` 가 올바른 `lastId` 로 필터링했음을 확인하는 케이스를 하나 추가할 것을 권장한다(회귀 방지 — 향후 `isUuidShaped` 호출 부호나 조건이 뒤집혀도 잡을 수 있는 유일한 자리).

- **[INFO]** `[대조군]` 테스트(`background-runs.service.spec.ts:655`)의 판별력이 "무엇을 검증하는가"에 비해 간접적이다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:655`
  - 상세: 테스트 주석이 이 설계를 명시적으로 정당화하고 있고(mock 체인 미완성을 이유로 완주 단언을 피함), 실제로 뮤테이션(엄격한 술어 치환)에서 RED 로 반응하는 것도 확인했다(위 검증 내역). 다만 "성공 응답을 반환했는가"가 아니라 "그 뒤 아무 코드에서나 발생한 에러가 우연히 `INVALID_CURSOR` 가 아니었는가"를 보는 구조라, 판별력이 위 WARNING 이 지적하는 gap 이 메워지면 자연히 사라질 임시적 성격의 취약점이다. 별도 조치 없이 WARNING 항목 해결 시 함께 정리되면 충분하다.

- **[INFO]** 기존 결함을 정상으로 고정하고 있던 fixture 를 정정한 처리가 적절하다.
  - 위치: `codebase/backend/src/modules/auth/login-history.service.spec.ts:147`~`163` (`applies composite cursor filter when provided`)
  - 상세: 종전 fixture 의 커서 id 가 `'cursor-id'`(비-UUID)였던 것을 실제 컬럼 형태(UUID)로 교정했다. plan 문서(`keyset-cursor-uuid-validation.md` 체크리스트)에 "수정 전 프로브가 실제로 RED 였다"는 근거가 기록되어 있고, 이는 이 프로젝트 메모리가 반복 경고하는 "기존 fixture 가 결함을 정상으로 고정" 패턴을 정확히 식별하고 고친 사례다. 회귀 아님, 오히려 모범 사례로 기록해 둔다.

- **[INFO]** 두 파일의 새 negative 테스트 모두 "무엇이 거부했는지"까지 단언해 인접 가드에 흡수되지 않도록 설계됐다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:648`~`652` (`rejects.toMatchObject({ response: { code: 'INVALID_CURSOR' } })`)
  - 상세: `rejects.toThrow(BadRequestException)` 류의 클래스만 보는 단언이 아니라 `code` 값까지 확인하므로, 소유권 검증이나 limit 검증 등 같은 `BadRequestException`/`NotFoundException` 을 던지는 인접 분기가 우연히 통과시키는 것을 방지한다. 이 저장소 메모리가 지적해 온 "`.toThrow()` 는 무엇이 던졌는지 안 본다" 결함 클래스를 이미 회피하고 있다. 문제 없음, 긍정 기록.

## 요약

이번 변경(keyset 커서 `id`/`i` 성분에 `isUuidShaped` 검증 추가)에 대한 테스트는 전반적으로 탄탄하다 — 두 파일 모두 (1) 비-UUID 거부, (2) 과도하게 엄격한 술어를 쓰면 안 된다는 것을 고정하는 nil-UUID 대조군, (3) 기존 결함을 정상으로 고정하던 fixture 정정을 갖추고 있고, developer 가 plan 문서에 남긴 4건의 뮤테이션 결과(M1~M4, 전부 예측대로 RED)는 이번 리뷰에서 2건을 독립 재현해 확인했다(원복 후 baseline 35/35 GREEN, 저장소 오염 없음). 유일한 실질적 갭은 `background-runs.service.ts` 쪽에 "정상적인 v4 UUID 커서가 실제로 쿼리에 반영되어 완주하는" happy-path 테스트가 없다는 점이다 — 자매 파일(`login-history.service.spec.ts`)에는 동등한 테스트(`CURSOR_UUID` 사용)가 있어 비대칭이 두드러지며, 이 gap 때문에 `isUuidShaped` 호출부의 조건 반전 같은 회귀는 unit 레벨에서 잡히지 않는다(e2e 에도 커서 케이스가 없어 안전망이 없다). 그 외 mock 적절성·테스트 격리·가독성 면에서는 지적 사항이 없다.

## 위험도

LOW
