# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1: backend/src/migrations.spec.ts

- **[INFO]** 포맷팅 전용 변경 — 실질 변경 없음
  - 위치: 전체 diff (hunk 3개)
  - 상세: `findDuplicateVersions([...])` 호출부의 줄 길이 재배치만 이루어졌다. 기능·로직 변경 없이 Prettier가 적용한 포맷팅으로 보임.
  - 제안: 포맷팅 전용 커밋이라면 별도로 분리하거나 `.prettierrc` 설정을 안정화해 후속 리뷰 노이즈를 줄일 것.

---

### 파일 2: backend/src/modules/integrations/third-party-oauth.controller.ts

- **[INFO]** Swagger `@ApiOkResponse` description 줄 래핑 — 포맷팅 전용
  - 위치: diff hunk (line 235–238)
  - 상세: `description:` 문자열이 단일 줄에서 두 줄로 재배치되었고, 텍스트 내용은 동일하다. 기능 변경 없음.
  - 제안: 포맷팅 전용 변경이므로 별도 이슈 없음.

- **[WARNING]** 로직 변경이 포맷팅 변경과 같은 커밋/PR에 혼재 — diff 범위 추적 어려움
  - 위치: `cafe24Install` 핸들러 전체 (`line 322–407`), `oauthCallback` 핸들러 전체 (`line 420–513`), `isValidPostMessageOrigin` 함수 (`line 534–551`)
  - 상세: diff 헝크는 `@ApiOkResponse description` 포맷팅 1줄만 보이지만, **전체 파일 컨텍스트에는 실질적 로직 변경이 포함**되어 있다.
    1. `cafe24Install` 내 에러 응답 형식 변경 — `{ code, message }` → `{ error: { code, message } }` (API H-1 주석 참조)
    2. `isValidPostMessageOrigin` 함수 신규 추가 (SEC H-3)
    3. `acceptsHtml` 분기 신규 추가 — HTML 에러 페이지 렌더링
    4. `oauthCallback` 내 `targetOrigin` 검증 로직 신규 추가
  - 이 변경들은 diff에는 나타나지 않으므로, 이번 리뷰 대상 커밋이 아닐 가능성이 높다. 그러나 만약 동일 커밋에서 포맷팅 변경과 로직 변경이 함께 포함되어 있다면 **범위 초과** 에 해당한다.
  - 제안: 포맷팅 변경(Prettier 적용)과 로직 변경(에러 envelope 개편, `isValidPostMessageOrigin` 추가)은 반드시 다른 커밋으로 분리할 것.

---

### 파일 3: backend/src/nodes/integration/send-email/send-email.schema.spec.ts

- **[INFO]** 포맷팅 전용 변경 — 실질 변경 없음
  - 위치: diff hunk (line 237–577)
  - 상세: `expect(errors).toContain('Recipient (To) must include at least one address.')` 가 Prettier에 의해 두 줄로 래핑됨. 검증 로직·내용 동일.
  - 제안: 포맷팅 전용 커밋이면 이슈 없음.

---

### 파일 4: backend/src/nodes/logic/if-else/if-else.schema.ts

- **[INFO]** 문자열 리터럴 quote 스타일 변경 — 의미 동일, 포맷팅
  - 위치: `warningRules[1].message` (line 860)
  - 상세: `'First condition\'s field must be entered.'` → `"First condition's field must be entered."` — 이스케이프 제거를 위한 쌍따옴표 전환이며 런타임 문자열 값은 동일하다.
  - 제안: Prettier의 `singleQuote` 설정과 이스케이프 처리 결과이므로 기능상 문제 없음.

---

### 파일 5: backend/src/nodes/logic/parallel/parallel.schema.spec.ts

- **[INFO]** 포맷팅 전용 변경 — 실질 변경 없음
  - 위치: diff hunk (line 169–1059)
  - 상세: `expect(errors).toContain('branchCount must be a value between 2 and 16.')` 가 여러 줄에서 단일 줄로 재배치됨. 검증 내용 동일.
  - 제안: 이슈 없음.

---

### 파일 6: backend/src/nodes/logic/switch/switch.schema.spec.ts

- **[INFO]** 포맷팅 전용 변경 — 실질 변경 없음
  - 위치: diff hunk (line 273–1334)
  - 상세: `expect(errors).toContain('In Value mode, Switch Value must be entered.')` 가 여러 줄에서 단일 줄로 재배치됨. 검증 내용 동일.
  - 제안: 이슈 없음.

---

### 파일 7: backend/src/nodes/logic/variable-declaration/variable-declaration.schema.ts

- **[INFO]** 문자열 리터럴 quote 스타일 변경 — 의미 동일, 포맷팅
  - 위치: `warningRules[1].message` (line 652)
  - 상세: `'First variable\'s name must be entered.'` → `"First variable's name must be entered."` — 파일 4와 동일 패턴. 런타임 값 동일.
  - 제안: 이슈 없음.

---

### 파일 8: backend/src/nodes/logic/variable-modification/variable-modification.schema.ts

- **[INFO]** 문자열 리터럴 quote 스타일 변경 — 의미 동일, 포맷팅
  - 위치: `warningRules[1].message` (line 809)
  - 상세: `'First modification\'s target variable must be selected.'` → `"First modification's target variable must be selected."` — 파일 4, 7과 동일 패턴. 런타임 값 동일.
  - 제안: 이슈 없음.

---

### 파일 9: backend/src/nodes/presentation/carousel/carousel.schema.spec.ts

- **[INFO]** 포맷팅 전용 변경 — 실질 변경 없음
  - 위치: diff hunk (line 297–2014)
  - 상세: `expect(errors).toContain('In Dynamic mode, a Title field must be entered.')` 가 여러 줄에서 단일 줄로 재배치됨. 검증 내용 동일.
  - 제안: 이슈 없음.

---

## 요약

이번 변경의 절대 다수(파일 1, 3, 5, 6, 9)는 Prettier가 줄 길이 초과를 감지해 자동 적용한 **포맷팅 전용 재배치**이며, 실질적인 기능·로직 변경이 전혀 없다. 파일 4, 7, 8의 문자열 리터럴 quote 전환 역시 런타임 값이 동일하여 scope 이탈로 보기 어렵다. 다만 파일 2(`third-party-oauth.controller.ts`)는 diff 상에는 `@ApiOkResponse` description 래핑 한 줄만 나타나지만, 전체 파일 컨텍스트에 에러 응답 envelope 변경(`{ code, message }` → `{ error: { code, message } }`), `isValidPostMessageOrigin` 신규 함수, `acceptsHtml` HTML 에러 페이지 분기 등 **비포맷팅 로직 변경이 다수 포함**되어 있다. 이것들이 동일 커밋에 혼재했다면 포맷팅 전용 변경과 로직 변경을 분리해야 하며, 이미 별도 커밋으로 관리 중이라면 diff가 올바르게 분리된 상태이므로 issue 없다. 해당 사항의 명확한 확인이 권장된다.

## 위험도

LOW
