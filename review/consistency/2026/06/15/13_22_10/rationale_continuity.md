# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
대상 spec: `spec/4-nodes/6-presentation/4-form.md`
diff 범위: `origin/main...HEAD`

---

## 발견사항

### 발견사항 1

- **[INFO]** 프론트엔드 테스트 주석의 MIME 종수 오기
  - target 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx` 라인 296 ("allowedMimeTypes 미설정 → 클라이언트가 §1 기본 **13종** 적용")
  - 과거 결정 출처: `spec/4-nodes/6-presentation/4-form.md` §1 본문 및 `## Rationale "file 검증은 cluster 로 분리 구현"` — "14종 MIME / 10MB·50MB / count 5" 를 공유 기본값으로 명시
  - 상세: 구현 `DEFAULT_FILE_ALLOWED_MIME_TYPES`(backend `form-mode.ts` / frontend `dynamic-form-ui.tsx` 미러 모두)에는 MIME 타입이 정확히 14개 정의되어 있으나, 테스트 주석이 13종으로 적혀 있다. 동작 자체는 올바르며(테스트는 거부 동작만 검사하고 전체 목록을 열거하지 않음), Rationale 연속성 침해는 아니고 문서 오기 수준이다.
  - 제안: 테스트 주석을 "기본 14종" 으로 수정한다.

---

## 요약

이번 구현 변경(form `type:'file'` 필드 검증 클러스터 도입)은 `spec/4-nodes/6-presentation/4-form.md ## Rationale` 에 기록된 핵심 결정들을 모두 충실히 따르고 있다.

1. **FIRST 오류만 반환 원칙**: `validateScalarField` / `validateFileField` 모두 첫 위반에서 즉시 반환하며, `validateAllFields` 가 필드 정의 순서의 단일 패스로 cross-type FIRST 오류 순서를 보존하고 있다 — spec Rationale "field 검증은 FIRST 오류만 반환" 과 일치.

2. **publisher chokepoint 단일 검증 지점**: file 검증은 `assertFormSubmissionValid`(`continueExecution` 내부)에서 `validateAllFields` 로만 수행되며, EIA / WS / UI 3 경로가 같은 진입점을 공유한다 — spec Rationale "검증 지점 = publisher 측 `continueExecution` chokepoint (3 경로 공통)" 과 일치.

3. **chat-channel modal 제외**: `hooks.service` 는 `validateFormSubmission`(scalar 전용 래퍼)만 호출하며 file 검증이 없다. 코드 주석도 "file 필드는 native modal 미수용이라 modal 에 도달하지 않으므로 불필요" 로 명시 — spec Rationale "file 검증은 chat-channel modal 경로에는 적용되지 않는다" 와 일치.

4. **`coerceFormSubmission` 제거 및 `coerceFormValue` per-field 대체**: 일괄 string 정규화 헬퍼 `coerceFormSubmission` 이 제거되고 scalar 전용 `coerceFormValue` 를 `validateAllFields` 에 주입하는 방식으로 전환됐다 — spec Rationale "scalar/file 단일 패스 도입으로 `coerceFormSubmission` 헬퍼는 제거되고 per-field `coerceFormValue`(scalar 전용)로 대체" 와 완전 일치.

5. **metadata-only 전달 (binary 미포함)**: `toFileMetadata`가 `{name, size, type, lastModified}`만 직렬화하며 binary를 전달하지 않는다. base64 인코딩이나 binary 직접 포함은 구현 어디에도 없다 — `spec/4-nodes/6-presentation/0-common.md ## Rationale "file 타입 metadata-only"` 의 "base64 인코딩 채택하지 않음 / file 타입을 클라이언트에서 차단하는 안 채택하지 않음" 기각 결정을 재도입하지 않음.

6. **비-file 필드 config echo 방지 (Principle 1.1)**: `extractFormFields` 가 `type === 'file'` 조건 안에서만 기본값을 주입하며, 비-file 필드에는 file 제약이 미주입된다 — spec §1 Principle 1.1 과 일치.

7. **frontend 상수 미러 구조**: frontend `dynamic-form-ui.tsx` 가 backend `DEFAULT_FILE_*` 를 복제하며, 코드 주석이 "SoT는 spec §1, 두 런타임 미러" 로 명시한다 — spec §1 비고 "기본값 상수 SoT: backend `form-mode.ts` `DEFAULT_FILE_*` (frontend `dynamic-form-ui.tsx` 가 동일 값 미러)" 와 일치.

기각된 대안(binary 전달, 클라이언트 차단, 전수 오류 수집, chokepoint 분산 구현, 일괄 string 정규화 등)을 재도입한 사례는 발견되지 않는다. 유일한 지적 사항은 테스트 주석의 "13종" 오기(INFO 등급)이며, 동작·설계 결정에는 영향이 없다.

---

## 위험도

LOW
