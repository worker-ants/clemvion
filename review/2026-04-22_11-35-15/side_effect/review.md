## 발견사항

### [CRITICAL] if-else 핸들러의 `eq`/`neq` 연산자가 strict에서 loose 비교로 변경됨
- **위치**: `if-else.handler.ts`, `condition-evaluator.util.ts`
- **상세**: 기존 코드는 `fieldValue === compareValue` (strict equality)를 사용했으나, 공유 유틸리티 `evaluateCondition`으로 교체되면서 `strictComparison` 미설정 시 `fieldValue == compareValue` (loose equality)가 기본값이 됨. 기존 배포된 if-else 노드 중 `'0' == 0 → true`, `'' == 0 → true` 등의 타입 비교를 의존하던 워크플로우가 조용히 오동작함. `strictComparison` 옵션이 없는 기존 노드 설정은 마이그레이션 없이 그냥 바뀜.
- **제안**: 기존 if-else 핸들러의 기본값을 `strict: true`로 유지하거나, `IfElseConfig`의 `strictComparison` 기본값을 `true`로 설정해 하위 호환성 확보.

---

### [CRITICAL] `stripControlFields`가 사용자 데이터 필드 `port`/`status`를 제거할 수 있음
- **위치**: `execution-engine.service.ts:2547~2597`, `stripControlFields` 메서드
- **상세**: 모든 핸들러 출력에서 `port`, `status`, `_resumeState`, `_selectedPort`를 제거한 뒤 다운스트림 노드에 전달함. 그러나 이 필드명들은 제어 메타데이터 전용이 아님. 예를 들어 DB 접속 정보를 반환하는 노드의 `{ host: 'db', port: 3306 }` 또는 상태 추적 노드의 `{ status: 'active' }` 같은 사용자 데이터 필드가 조용히 제거됨. `structuredOutputCache`(`$node["X"]`)는 보존되지만 `$input.port` 또는 `$input.status`로 접근하던 다운스트림 노드는 해당 값이 사라짐.
- **제안**: 제어 필드 구분을 네임스페이스 또는 별도 채널로 격리 (`__engine__` 프리픽스 등). 단기적으로는 제거 대상 필드 목록을 문서화하고, 기존 워크플로우 영향도 조사 필요.

---

### [WARNING] switch 핸들러: 문자열 `switchValue`의 경로 조회(path lookup) 제거
- **위치**: `switch.handler.ts:97~140`
- **상세**: 기존 코드는 문자열 `switchValue`를 `getNestedValue(input, switchValue)`로 경로 탐색했음. 변경 후 리터럴 비교만 수행. 기존 워크플로우 설정에 `switchValue: "user.role"` 형태로 경로를 저장한 경우, 이제 `input.user.role`이 아닌 리터럴 `"user.role"` 문자열과 비교하므로 항상 `default`로 라우팅됨. 주석에서 버그 수정이라 표현했으나 기존 사용자에게는 silent breaking change임.
- **제안**: DB에 저장된 기존 switch 노드 설정을 일괄 마이그레이션하거나, 배포 전 영향받는 워크플로우 인벤토리 확인 필요.

---

### [WARNING] `toEngineFlatShape`의 `port`/`status`가 출력 객체 내 동명 필드를 무조건 덮어씀
- **위치**: `handler-output.adapter.ts:153~174`
- **상세**: 기존에는 `base.status === undefined`일 때만 덮어썼으나, 이제 `adapted.status !== undefined`이면 무조건 덮어씀. 핸들러가 `output` 객체 내에 의도적으로 `status` 또는 `port` 데이터 필드를 두고 최상위에도 동명의 제어 필드를 선언한 경우, 출력 객체의 필드가 제어 값으로 교체됨. `_resumeState`는 기존 우선순위를 유지하므로 세 필드 간 처리 정책이 비대칭.
- **제안**: 주석에서 이 비대칭을 명시하거나 `_resumeState`도 동일 정책으로 통일.

---

### [WARNING] switch 핸들러 meta 구조 변경 — `expression` 필드 제거
- **위치**: `switch.handler.ts:120~135`
- **상세**: 기존 meta: `{ expression, value, matchedCase }` → 신규 meta: `{ mode, matchedCase, value? }`. `meta.expression`을 읽는 프론트엔드, 로깅, 또는 다운스트림 표현식이 `undefined`를 받게 됨. 특히 `$node["switch-node"].meta.expression`을 참조하는 워크플로우 표현식이 조용히 실패할 수 있음.
- **제안**: 이전 버전과의 호환성을 위해 value mode에서 `expression` 필드를 임시 유지하거나, 프론트엔드 코드에서 `meta.expression` 참조를 일괄 제거.

---

### [INFO] `hasDefault: null` 유효성 검사 동작 변경
- **위치**: `switch.handler.ts:82~84`
- **상세**: 기존 코드는 `hasDefault !== null && typeof hasDefault !== 'boolean'` 조건으로 `null`을 허용했음. 신규 코드는 `typeof hasDefault !== 'boolean'`만 검사하므로 `null`을 전달하면 "hasDefault must be a boolean" 에러 발생. 영향 범위는 좁으나 기존 설정 데이터에 `hasDefault: null`이 있을 경우 유효성 검사 실패.

---

### [INFO] `condition-evaluator.util.ts`의 `not_contains`: 비문자열 필드에 대해 `true` 반환
- **위치**: `condition-evaluator.util.ts:42`
- **상세**: `fieldValue` 또는 `compareValue`가 문자열이 아닐 때 `not_contains`가 `true`를 반환함. 기존 if-else 핸들러와 동일한 로직이므로 변경 사항은 없으나, switch의 expression mode에서 이 연산자를 처음 사용하는 경우 예상과 다를 수 있음.

---

## 요약

이번 변경의 핵심 의도(control field 누수 차단)는 타당하나 두 가지 심각한 부작용 위험이 있다. 첫째, `stripControlFields`가 `port`/`status` 같은 일반적인 필드명을 제어 메타데이터로 단정하고 제거하므로, 해당 이름의 사용자 데이터가 포함된 모든 기존 워크플로우에서 데이터 손실이 발생할 수 있다. 둘째, if-else 핸들러의 `eq`/`neq`가 strict에서 loose 비교로 조용히 변경되어 타입을 엄격히 구분하던 기존 조건 노드들이 오동작할 수 있다. switch의 경로 조회 제거와 meta 구조 변경도 기존 워크플로우와의 하위 호환성을 깨뜨린다.

## 위험도

**HIGH**