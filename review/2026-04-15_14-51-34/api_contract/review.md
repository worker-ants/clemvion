### 발견사항

- **[WARNING]** `bodyType: 'form'` → `'x-www-form-urlencoded'` 명칭 변경으로 기존 저장된 워크플로우 설정이 묵시적으로 파손됨
  - 위치: `http-request.handler.ts` - `else if (bodyType === 'x-www-form-urlencoded')` 분기
  - 상세: 기존에 `bodyType: 'form'`으로 저장된 워크플로우 노드 설정은 이 분기에 해당하지 않아 `else` 브랜치로 떨어지며, `JSON.stringify(body)`가 실행됩니다. 런타임 오류 없이 조용히 `Content-Type: application/json`과 JSON 페이로드를 전송하므로, 서버 측에서 form-encoded body를 기대하는 경우 의도치 않은 동작이 발생합니다.
  - 제안: 마이그레이션 가드를 추가하거나, 두 값을 함께 처리합니다.
    ```typescript
    } else if (bodyType === 'x-www-form-urlencoded' || bodyType === 'form') {
    ```

- **[INFO]** `headers` / `queryParams` 포맷 변경 (Record → Array)은 하위 호환 처리됨
  - 위치: `toKeyValueRecord` / `toKeyValueEntries` 함수
  - 상세: 레거시 `Record<string, string>` 형식과 신규 `Array<{key, value}>` 형식을 모두 처리하는 폴백 로직이 구현되어 있어 기존 저장 데이터와의 호환성이 유지됩니다.
  - 제안: 해당 정책을 JSDoc에 명시적으로 문서화하면 향후 제거 시점 결정에 도움이 됩니다.

- **[INFO]** 프론트엔드의 `IntegrationSelector` 조건부 렌더링 추가는 계약 변경 없음
  - 위치: `integration-configs.tsx` - `{authentication === "integration" && ...}`
  - 상세: UI가 `authentication: 'integration'` 선택 시에만 `integrationId`를 노출하도록 변경된 것으로, 기존 설정 데이터 구조에 영향 없습니다. 단, `authentication`이 `'integration'`이 아닌 값으로 변경될 때 `integrationId`가 config 객체에 남아 있을 수 있습니다 (명시적 제거 없음).
  - 제안: 인증 방식 변경 시 연관 필드를 정리하는 것이 좋습니다.
    ```typescript
    onChange={(v) => onChange({ ...config, authentication: v, ...(v !== 'integration' && { integrationId: undefined }) })}
    ```

---

### 요약

이번 변경의 핵심은 노드 설정 계약(config schema)에서 `headers`/`queryParams`를 배열 형식으로 전환하고 `bodyType`의 명칭을 변경한 것입니다. 배열 포맷 전환은 `toKeyValueRecord`가 양쪽을 모두 수용하여 하위 호환성을 유지하고 있으나, `bodyType: 'form'` → `'x-www-form-urlencoded'` 리네이밍은 폴백 처리가 없어 해당 값으로 저장된 기존 워크플로우가 폼 인코딩 대신 JSON으로 묵시적으로 전송되는 breaking change입니다. 신규 `form-data` bodyType 추가와 인증 통합 UI 개선은 계약 확장 측면에서 문제없습니다.

### 위험도
**MEDIUM**