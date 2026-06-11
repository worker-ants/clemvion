# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1: ai-configs.tsx (삭제)

특이사항 없음. `text_classifier`·`information_extractor` 의 bespoke 컴포넌트
(`TextClassifierConfig`, `InformationExtractorConfig`) 전체를 삭제했다.
커밋 메시지 기준 "참조 0" — `override-registry.ts` 에서 import 가 함께 제거됐고,
다른 파일에서 이 두 컴포넌트를 직접 import 하는 경로가 없으면 고아 파일 삭제는
정확히 의도된 범위다. 포맷팅·주석 부분 변경 없이 파일 전체 삭제이므로 범위 초과
요소가 존재할 수 없다.

### 파일 2: override-registry.ts (수정)

- **[INFO]** AI 주석 문구 확장
  - 위치: registry 내 `// AI` 주석 블록 (변경 전 1행 → 변경 후 4행)
  - 상세: 기존 `// AI — ai_agent migrated to auto-form (schema-driven)` 단일 행이
    `// AI — ai_agent · text_classifier · information_extractor migrated to`로 시작하는
    4행 주석으로 교체됐다. V-02 해소 이유(cross-audit 참조·방출 widget 목록)를 인라인에
    기재한 것으로, 문서화 목적이며 기능 변경은 없다.
  - 제안: 주석 길이가 실질 코드보다 훨씬 길지만, 이후 유지보수자가 auto-form 이행 근거를
    찾을 때 유용하다. 허용 범위 내이나 `override-registry.ts` 상단의 JSDoc 블록에
    이미 "When the underlying zod schema … becomes expressive enough … remove its entry"
    라는 안내가 있으므로 인라인 주석에서 widget 목록 열거를 줄여도 충분하다.
    현재 상태가 오류를 유발하지는 않아 BLOCK 사유는 아니다.

기능 변경: `text_classifier`·`information_extractor` 키 제거, 해당 import 블록 제거.
범위 내 최소 변경이다.

### 파일 3: plan/in-progress/spec-code-cross-audit-2026-06-10.md (수정)

- **[INFO]** PR 번호 수정 (V-16/V-17 항목)
  - 위치: V-16/V-17 완료 항목 내 브랜치 참조 `본 PR` → `PR #533`
  - 상세: 이전 커밋(0d679d6a)에서 `rag-webchat-doc-strings` 브랜치가 머지됐고,
    해당 PR 번호가 #533 으로 확정됐으므로 추적 문서에 번호를 기재한 것이다. 이 변경은
    V-02 작업의 직접 범위는 아니지만, 동일 plan 파일의 연관 항목을 정확한 상태로
    갱신하는 housekeeping 이며 허용 가능하다. plan 파일은 진행 상황 추적 문서로,
    같은 파일 내 다른 완료 항목 번호 교정은 작업 경계를 크게 벗어나지 않는다.
  - 제안: 별도 커밋으로 분리하면 더 명확하지만 단독 1행 수정이라 현재 묶음이
    리뷰 복잡도를 높이지 않는다.

- V-02 완료 항목 추가 및 잔여 항목(V-02 제거) 갱신: 의도된 plan 업데이트다.

## 요약

이번 변경은 cross-audit V-02 위반 해소를 위해 `information_extractor`·`text_classifier`
의 bespoke 설정 UI 를 삭제하고 auto-form(schema-driven) 경로로 전환하는 것이 전부다.
수정된 3개 파일 모두 해당 목적에 직결되며, 관련 없는 리팩토링·기능 추가·설정 변경·
무관한 파일 수정은 발견되지 않는다. `override-registry.ts` 의 주석 확장이 다소 장황하고,
plan 파일에서 V-16/V-17 항목 PR 번호 보완이 V-02 커밋과 함께 묶인 점이 관찰됐으나,
두 사항 모두 허용 가능한 수준의 housekeeping 이며 기능·안전성에 영향을 주지 않는다.

## 위험도

NONE
