# Rationale 연속성 검토 결과

검토 모드: --impl-done  
범위: spec/2-navigation/4-integration.md  
diff-base: origin/main  
검토 일시: 2026-06-19

---

## 발견사항

발견된 Critical 또는 Warning 등급 항목 없음.

### [INFO] `@internal` 내보내기 JSDoc 태그 제거

- **target 위치**: `page.tsx` 에서 제거된 `DangerTab` 선언부 (diff `-/** @internal exported for unit testing (danger-tab.test.tsx) only. */`)
- **과거 결정 출처**: `spec/2-navigation/4-integration.md` 의 Rationale 에는 컴포넌트 파일 분리 경계에 관한 명시적 결정이 없음. 단, CLAUDE.md 정보 저장 위치 원칙("단일 진실 원칙")상 공개 내보내기가 더 명확한 구조임.
- **상세**: 원래 `page.tsx` 의 `DangerTab` 은 `@internal exported for unit testing only` 주석과 함께 선언됐었다. 추출 후 `danger-tab.tsx` 에서는 해당 JSDoc 태그가 없고 일반 `export function` 으로 선언됐다. 이는 의도의 단순 명확화(전용 파일이므로 `@internal` 이 불필요)이며 기각된 대안 재도입도, invariant 위반도 아니다.
- **제안**: 현 상태로 문제 없음. 필요하다면 `danger-tab.tsx` 에 파일 레벨 주석으로 "통합 상세 위험 구역 탭" 목적을 한 줄 추가하는 것을 선택적으로 고려할 수 있음.

---

## 요약

이번 변경은 `DangerTab` 컴포넌트를 `page.tsx` 에서 `danger-tab.tsx` 로 코드를 그대로 이동한 순수 기계적 리팩터다. `spec/2-navigation/4-integration.md` 의 `## Rationale` — 삭제 흐름(§4.7 precheck → 차단 다이얼로그), SMTP/SSRF 가드, Attention 술어, install_token 승격, 사용처 추적 MCP 포함, activity log 3컬럼 설계 등 — 어느 항목도 이번 변경에 의해 번복되거나 우회되지 않았다. 동작·API 계약·상태 머신 어느 것도 변경이 없으며, 테스트 임포트 경로(`danger-tab.test.tsx` 의 import 경로 수정)도 리팩터의 자연스러운 후속이다. Rationale 연속성 관점에서 위험 요소는 없다.

---

## 위험도

NONE
