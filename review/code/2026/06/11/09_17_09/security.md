### 발견사항

- **[INFO]** 삭제된 `ai-configs.tsx` 에 하드코딩된 시크릿 없음
  - 위치: 파일 전체 (삭제됨)
  - 상세: `TextClassifierConfig`, `InformationExtractorConfig` 컴포넌트 내 API 키, 토큰, 비밀번호 등 하드코딩된 시크릿 없음. 사용자 입력을 그대로 상위 `onChange` 에 전달하는 UI 레이어.
  - 제안: 해당 없음. 삭제로 인해 코드 표면이 축소됨.

- **[INFO]** `override-registry.ts` 변경 — 공격 표면 축소
  - 위치: `override-registry.ts` 62~68번 라인
  - 상세: `text_classifier`, `information_extractor` 를 OVERRIDE_REGISTRY 에서 제거해 수동 bespoke 폼 대신 schema-driven auto-form 으로 이행. 이 변경은 코드 경로를 줄이는 방향이므로 보안 리스크 증가 없음.
  - 제안: 해당 없음.

- **[INFO]** `applyClearFields` 에서 프로토타입 오염 방어 확인됨
  - 위치: `/codebase/frontend/src/components/editor/settings-panel/auto-form/utils.ts` 84~101번 라인
  - 상세: `clearFields` 를 처리할 때 `__proto__`, `constructor`, `prototype` 키를 `UNSAFE_KEYS` 셋으로 필터링해 프로토타입 오염 공격을 방어하고 있음. auto-form 으로 이행한 두 AI 노드도 이 경로를 공유하므로 기존 방어가 적용됨.
  - 제안: 현행 유지.

- **[INFO]** `FieldArrayWidget` 의 비구조적(non-structured) 항목에 대해 raw JSON textarea 사용
  - 위치: `/codebase/frontend/src/components/editor/settings-panel/auto-form/widgets.tsx` 454~461번 라인
  - 상세: `itemSchema.properties` 가 없는 배열 필드는 `JSON.stringify`/`JSON.parse` 왕복으로 처리함. 파싱 오류는 묵시적으로 무시(`catch {}`)하며 유효하지 않은 JSON 은 저장되지 않음. `text_classifier`·`information_extractor` 의 배열 필드(`categories`, `outputSchema`)는 구조화된 객체 스키마(`properties` 있음)이므로 이 raw 경로에 해당하지 않음.
  - 제안: 현행 로직으로 두 AI 노드는 안전. 다른 노드가 비구조적 배열을 추가할 경우 raw textarea 의 입력 새니타이징 누락 여부를 별도 검토할 것.

- **[INFO]** plan 문서 변경 — 보안 관련 없음
  - 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md`
  - 상세: V-02 완료 표시 및 잔여 항목 갱신. 내부 추적 문서이며 실행 가능한 코드 없음.
  - 제안: 해당 없음.

### 요약

이번 변경은 bespoke AI 노드 설정 폼(`ai-configs.tsx`)을 삭제하고 schema-driven auto-form 으로 이행하는 것이다. 삭제된 코드에는 하드코딩된 시크릿, 인젝션 취약점, 인증/인가 우회, 안전하지 않은 암호화 등 보안 취약점이 없었으며, 이행 대상인 auto-form 경로(`schema-form.tsx`, `widgets.tsx`, `utils.ts`)는 프로토타입 오염 방어(`UNSAFE_KEYS`), 안전한 JSON 파싱(try/catch), 정형 입력 렌더링을 갖추고 있다. 코드 표면이 축소되는 방향의 변경이므로 보안 리스크는 증가하지 않는다.

### 위험도

NONE
