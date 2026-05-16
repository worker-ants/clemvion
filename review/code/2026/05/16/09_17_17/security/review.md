# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** 사용자 입력 키값에 대한 클라이언트 측 길이·형식 제한 없음
  - 위치: `integration-configs.tsx` — `fieldRowsToObject` 함수 및 `handleFieldRowsChange` 핸들러
  - 상세: `KeyValueEditor`에서 입력받은 key/value 쌍을 그대로 `Record<string, string>` 으로 변환해 upstream에 전달한다. 현재 코드는 키 이름이나 값의 길이, 허용 문자 범위에 대한 클라이언트 측 검증이 없다. 악의적 사용자가 매우 긴 문자열이나 특수문자를 key/value에 입력하더라도 프론트엔드 레이어에서 차단되지 않는다. 단, 이 설정값은 Cafe24 API 호출 시 백엔드에서 재검증될 것으로 예상되므로 현 컴포넌트 단독 위협은 낮다.
  - 제안: 백엔드에서 key/value 값 검증이 이루어지는지 확인하고, 필요하다면 `fieldRowsToObject` 또는 `handleFieldRowsChange` 에서 허용 길이(예: 256자)와 허용 문자 패턴(예: 영숫자·언더스코어)을 명시적으로 제한하는 로직을 추가한다.

- **[INFO]** `config.fields` 외부값을 타입 캐스팅 없이 `Record<string, unknown>` 으로 신뢰
  - 위치: `integration-configs.tsx` 라인 351–354 (`externalFields` 계산 블록)
  - 상세: `config.fields` 가 객체인지 배열인지를 런타임에 확인한 뒤 `as Record<string, unknown>` 으로 캐스팅한다. 이 경우 배열이 아닌 다른 비-객체 프리미티브(예: 문자열, 숫자)는 빈 객체로 폴백되므로 처리 자체는 안전하다. 그러나 `normalizeCafe24Fields` 내부에서 `config.fields` 의 각 value를 어떻게 처리하는지에 따라 잠재적 타입 혼동이 발생할 수 있다. `unknown` 타입의 value를 `String()` 강제 변환 없이 그대로 전달하면 런타임 오류로 이어질 수 있다.
  - 제안: `normalizeCafe24Fields` 에서 value를 처리할 때 `String(v ?? "")` 처럼 안전한 문자열 변환을 명시적으로 적용하고 있는지 확인한다. `objectsEqual` 함수는 이미 `String(a[k] ?? "")` 패턴을 사용하고 있어 일관성 유지 권장.

- **[INFO]** 테스트 코드에서 DOM 구조에 의존한 버튼 탐색 패턴
  - 위치: `cafe24-config.test.tsx` 라인 207–216 (`removeButton` 탐색 로직)
  - 상세: 삭제 버튼을 `row.querySelector("button:not([data-state])")` 와 `candidateButtons[candidateButtons.length - 1]` 순서로 조합해 선택한다. 이는 테스트 코드에서의 패턴이므로 프로덕션 보안에 직접 영향을 주지 않는다. 그러나 `data-testid` 또는 `aria-label` 없이 DOM 구조에만 의존하는 방식은 향후 UI 변경 시 의도치 않게 다른 버튼을 클릭하는 테스트 오탐(false positive)을 유발할 수 있어, 보안 관련 동작을 검증하는 테스트의 신뢰도를 낮춘다.
  - 제안: 삭제 버튼에 `data-testid="remove-field-row"` 또는 `aria-label` 을 추가해 DOM 위치에 의존하지 않는 명확한 선택자를 사용한다.

- **[INFO]** 이메일 주소가 커밋 메타데이터에 노출
  - 위치: 커밋 author 정보 `worker-ants <admin@getit.co.kr>`
  - 상세: 이는 git history의 일반적인 구성이며 직접적인 취약점은 아니다. 그러나 내부 이메일 주소가 공개 저장소에 노출될 경우 스팸·사회공학 공격의 단서가 될 수 있다.
  - 제안: 공개 저장소라면 git 커밋 이메일로 noreply 주소 사용을 검토한다. 비공개 저장소라면 현재 수준으로 충분하다.

## 요약

이번 변경은 Cafe24 노드 설정 패널의 `Fields` 편집 버퍼를 React 로컬 state로 분리하는 프론트엔드 UI 픽스 및 단위 테스트 추가로, 백엔드 계약·데이터 모델·인증/인가 로직은 변경되지 않았다. SQL 인젝션·XSS·커맨드 인젝션·경로 탐색 등 전통적 인젝션 벡터와 직접 관련된 코드 변경은 없으며, 하드코딩된 시크릿이나 API 키도 발견되지 않았다. 변경 범위가 순수 UI 상태 관리에 국한되고, `fieldRowsToObject` 의 빈 키 필터링은 오히려 빈 key가 객체에 유입되는 것을 방지하는 방어적 로직으로 평가된다. 사용자 입력 값에 대한 클라이언트 측 검증이 없는 점과 `config.fields` 타입 신뢰 방식은 백엔드 검증이 충분하다면 허용 가능한 수준이며, 모두 INFO 등급으로 분류된다.

## 위험도

NONE
