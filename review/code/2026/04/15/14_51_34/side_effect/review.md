## 발견사항

### 파일 2: `http-request.handler.ts`

**[WARNING] `bodyType: 'form'` 처리 제거로 인한 하위 호환성 파괴**
- 위치: `bodyType` 분기문
- 상세: 기존 `'form'` 분기가 `'x-www-form-urlencoded'`로 교체되었습니다. 이미 저장된 워크플로우 설정에 `bodyType: 'form'`이 있는 경우, 해당 브랜치가 사라졌으므로 `else` 분기(raw 처리)로 fallthrough되어 body가 `JSON.stringify(body)` 형태로 전송됩니다. 런타임 오류 없이 잘못된 동작이 발생합니다.
- 제안: 기존 `'form'` 값을 `'x-www-form-urlencoded'`와 동일하게 처리하는 alias 분기 추가 또는 마이그레이션 스크립트 적용

```typescript
} else if (bodyType === 'x-www-form-urlencoded' || bodyType === 'form') {
```

---

**[WARNING] `mergedHeaders`에 대한 `delete` 후 `fetchOptions.headers` 참조 불일치 가능성**
- 위치: `form-data` 분기, `delete mergedHeaders['Content-Type']`
- 상세: `fetchOptions.headers = mergedHeaders`는 객체 참조를 공유하므로 `delete mergedHeaders['Content-Type']`은 실제로 `fetchOptions.headers`에도 반영됩니다. 현재 코드는 정상 동작하나, 이후 `fetchOptions.headers`를 별도 복사하는 리팩터링 시 버그 발생 위험이 있는 묵시적 참조 결합입니다.
- 제안: 주석으로 참조 공유 의도를 명시하거나, `fetchOptions.headers`에서 직접 삭제하도록 명시

---

**[INFO] `toKeyValueEntries`가 배열 내 `'value'` 프로퍼티 없는 항목을 빈 문자열로 처리**
- 위치: `toKeyValueEntries` 함수
- 상세: `{ key: 'X-Foo' }` 처럼 `value`가 없는 항목은 `stringifyScalar(undefined)` → `''`으로 처리되어 헤더가 빈 값으로 전송됩니다. 의도된 동작이라면 허용되나, 키가 있고 값이 없는 경우 드롭 여부를 명시하지 않습니다.
- 제안: 정책을 주석으로 명시하거나 빈 value도 드롭하는 옵션 고려

---

**[INFO] `queryParams` 중복 키 처리 순서**
- 위치: 사용자 `queryParams` 및 `credentials.queryParams` 병합 로직
- 상세: 사용자 `queryParams`와 `credentials.queryParams`가 동일한 키를 가질 경우 URL에 중복 파라미터가 붙습니다(`URLSearchParams.append` 사용). 예: 사용자가 `token=user-val`을 보내고 API Key 인증도 `token=cred-val`이면 `?token=user-val&token=cred-val` 생성.
- 제안: 인증 자격증명 파라미터가 사용자 파라미터를 덮어쓰도록 merge 후 set 방식 사용 고려

---

### 파일 3: `integration-configs.tsx`

**[INFO] `authentication`이 `'integration'`에서 다른 값으로 변경 시 `integrationId`가 config에 잔류**
- 위치: `SelectField` onChange 핸들러
- 상세: 사용자가 `authentication`을 `'integration'` → `'none'`으로 변경하면 `IntegrationSelector`가 언마운트되지만 `config.integrationId` 값은 config 객체에 그대로 남습니다. 이후 백엔드로 전달 시 불필요한 `integrationId`가 포함될 수 있습니다.
- 제안: `authentication` 변경 시 `integrationId` 초기화

```tsx
onChange={(v) => onChange({ ...config, authentication: v, integrationId: v === 'integration' ? config.integrationId : undefined })}
```

---

### 파일 1: `http-request.handler.spec.ts`

**[INFO] `should drop header rows with empty keys` 테스트의 `Object.keys(headers).toHaveLength(1)` 가정**
- 위치: 해당 테스트 케이스
- 상세: 이 테스트는 `Content-Type`등 다른 기본 헤더가 없다고 가정합니다. 향후 핸들러가 기본 헤더를 추가하면 테스트가 깨질 수 있습니다. 특정 키의 부재를 확인하는 방식이 더 견고합니다.
- 제안: `toHaveLength(1)` 대신 빈 키 항목들이 없는지를 검증

---

## 요약

전반적으로 변경사항은 `headers`/`queryParams`의 데이터 형식을 `Record<string, string>`에서 `Array<{key, value}>`로 전환하는 명확한 목적을 가지며 구현도 견고합니다. 가장 주의할 부작용은 **기존에 저장된 `bodyType: 'form'` 설정값의 silent breakage**로, 런타임 오류 없이 잘못된 Content-Type과 body로 요청이 전송될 수 있습니다. 프론트엔드에서는 authentication 변경 시 `integrationId`가 config에 잔류하는 상태 누수가 있으나 백엔드 validate 로직이 `authentication !== 'integration'`일 때 `integrationId`를 무시하므로 즉각적인 오류는 발생하지 않습니다.

## 위험도

**MEDIUM** — `bodyType: 'form'` 하위 호환성 파괴가 기존 워크플로우에 silent regression을 유발할 수 있습니다.