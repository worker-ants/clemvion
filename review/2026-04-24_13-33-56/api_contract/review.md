### 발견사항

- **[INFO]** `includeEvidence` 설정 필드 추가 — 옵트인, 하위 호환 유지
  - 위치: `text-classifier.schema.ts` — `includeEvidence: z.boolean().default(false)`
  - 상세: 새 필드는 기본값 `false`로 선언되어 기존 클라이언트가 필드를 생략해도 이전과 동일한 출력 구조를 받음. 출력 스키마에 `evidence: z.array(z.string()).optional()`로 추가되어 하위 호환성 유지.
  - 제안: 이상 없음.

- **[INFO]** 테스트 이름과 실제 동작 불일치
  - 위치: `text-classifier.handler.spec.ts:387` — `"should coerce non-string evidence items to strings (defensive)"`
  - 상세: 테스트 이름은 "coerce(강제 변환)"이라고 명시하지만 실제 구현(`sanitizeEvidence`)은 비문자열 항목을 문자열로 변환하는 것이 아니라 **drop(제거)**함. 테스트 기댓값 `['valid']`이 이를 증명. 계약 명세가 모호해질 수 있음.
  - 제안: 테스트 이름을 `"should drop non-string evidence items to preserve string[] contract"`으로 수정.

- **[INFO]** 프론트엔드 기본값과 스키마 기본값 간 기존 불일치 (이번 PR 미도입)
  - 위치: `ai-configs.tsx:65` — `(config.includeConfidence as boolean) ?? true`
  - 상세: `includeConfidence` 스키마 기본값은 `false`이나 UI 컴포넌트는 `true`로 표시. 이번 PR의 `includeEvidence`는 스키마(`false`)와 UI(`?? false`) 모두 `false`로 일치하여 문제 없음.
  - 제안: 이번 PR 범위 외이나, 기존 `includeConfidence` 불일치도 추후 정합성 보정 필요.

- **[INFO]** Spec 문서에 `output.result.*` wrapper 명시 — 계약 문서화 개선
  - 위치: `spec/4-nodes/3-ai-nodes.md` 출력 구조 섹션
  - 상세: 이번 변경으로 출력 구조 예시에 `result` wrapper가 명확히 추가됨. 핸들러의 실제 반환 구조(`output.result.*`)와 어댑터 이후 다운스트림이 접근하는 플랫 스키마(`textClassifierNodeOutputSchema`) 간의 계층이 스펙에서 처음 명문화됨. 기능 정확도는 맞으나, 스키마 파일의 주석("FLAT output schema after adapter unwraps")과 일치하는지 팀 내 확인 권장.
  - 제안: 이상 없음.

---

### 요약

이번 변경은 Text Classifier 노드에 `includeEvidence` 옵트인 필드를 추가하는 **순수 가산적(additive) 변경**이다. 새 설정 필드는 기본값 `false`를 가지며, 출력 필드 `evidence`는 스키마에서 `.optional()`로 정의되어 기존 클라이언트에 영향을 주지 않는다. 구현이 기존 `includeConfidence` 패턴을 충실히 따르고 있고, fallback 경로 및 JSON 파싱 실패 경로에서도 빈 배열 반환이 일관되게 처리된다. 테스트 이름 하나가 실제 동작(drop)과 불일치하는 점 외에 API 계약상 위험 요소는 없다.

### 위험도

**LOW**