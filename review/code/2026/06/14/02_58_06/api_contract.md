# API 계약(API Contract) 리뷰 결과

## 발견사항

### INFO: sort/order 쿼리 파라미터 신규 추가 — 하위 호환성 유지됨
- 위치: `workflows.service.ts` lines 1316–1330 (diff +13~+29), `page.tsx` SORT_OPTIONS
- 상세: `sort` 파라미터에 `last_run` 값이 신규 추가되었다. 기존 허용값(`created_at`, `updated_at`, `name`)은 `getSortColumn()` allowlist 를 그대로 통해 동작하므로, 기존 클라이언트가 `sort` 파라미터를 보내지 않거나 기존 값을 보낼 경우 동작 변화 없음. Breaking change 없음.
- 제안: 해당 없음.

### INFO: `last_run` sort — injection 안전성 확인됨
- 위치: `workflows.service.ts` line 1448–1452
- 상세: `sort === 'last_run'` 분기에서 correlated subquery 문자열은 사용자 입력 미반영 고정 리터럴이고, `orderDir` 는 `'ASC' | 'DESC'` 화이트리스트 타입으로 결정된다. Injection 위험 없음.
- 제안: 해당 없음.

### INFO: 프론트엔드 — "created" 기본값은 sort 파라미터 미전송
- 위치: `page.tsx` lines 2310–2316
- 상세: `sortKey === 'created'` 일 때 `sort`/`order` 파라미터를 전송하지 않아 백엔드 기본값(`created_at DESC`)에 의존한다. 백엔드 기본값과 일치하므로 계약상 문제 없음. 단, 미래에 백엔드 기본 정렬이 변경될 경우 암묵적 의존성이 드러날 수 있다.
- 제안: 향후 기본값 변경 시 `page.tsx` 도 함께 수정 필요함을 주석으로 표기하거나, 항상 `sort`/`order` 를 명시 전송하는 방식도 고려할 수 있다. 현 시점에서는 breaking issue 아님.

### INFO: `validateManualTrigger` 에러 응답 형식 비일관성
- 위치: `workflows.service.ts` lines 1896–1910 (`validateManualTrigger`)
- 상세: `validateManualTrigger` 는 `BadRequestException`을 `string` 메시지만으로 던진다(`throw new BadRequestException('Workflow must contain...')`). 반면 `findById`, `importWorkflow`의 `ConflictException`, `restoreVersion`, `evaluateGraphWarnings` 등은 모두 `{ code, message }` 객체 형식을 사용한다. 이는 에러 응답 포맷 비일관성으로, API 클라이언트가 에러 코드(`code` 필드)로 분기 처리하는 경우 해당 에러를 구분할 수 없다.
- 제안: 아래와 같이 통일:
  ```ts
  throw new BadRequestException({ code: 'MISSING_MANUAL_TRIGGER', message: 'Workflow must contain a Manual Trigger node' });
  throw new BadRequestException({ code: 'DUPLICATE_MANUAL_TRIGGER', message: 'Workflow cannot contain more than one Manual Trigger node' });
  ```

### INFO: `exportWorkflow` — edge `sourceNodeIndex` 가 -1 일 경우 응답에 포함될 수 있음
- 위치: `workflows.service.ts` lines 1577–1584
- 상세: `edges.map` 에서 `nodes.findIndex` 가 해당 노드 ID 를 찾지 못하면 `-1` 이 반환되어 `sourceNodeIndex: -1` 또는 `targetNodeIndex: -1` 이 export 응답에 포함된다. `importWorkflow` 는 이 범위 밖 인덱스를 skip 처리하지만, 클라이언트가 export JSON 을 직접 활용할 경우 `-1` 값이 혼란을 줄 수 있다. 데이터 무결성이 보장된 경우 발생 가능성은 낮으나, 방어적 처리가 없다.
- 제안: `findIndex` 결과가 `-1` 이면 해당 edge 를 skip 하거나 에러를 throw 하는 방어 로직 추가 고려.

## 요약

이번 변경의 핵심은 워크플로 목록 API에 `sort=last_run` 옵션을 추가한 것이다. 신규 파라미터는 기존 클라이언트에 영향을 주지 않는 additive change 이며, 입력 injection 차단(allowlist + 고정 subquery 리터럴)도 적절히 구현되어 있다. 응답 구조·페이지네이션·인증/인가 측면에서 신규 breaking change 는 없다. 다만 `validateManualTrigger` 에서 에러 응답 형식이 기존 코드베이스의 `{code, message}` 패턴에서 벗어나 단순 문자열로 던져지는 비일관성이 확인되어 INFO 수준으로 기록한다.

## 위험도

NONE

---

이 변경은 API 계약 관점에서 안전한 범위의 확장이며 클라이언트 breaking change 가 없다.
