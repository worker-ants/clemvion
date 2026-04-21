# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `width: 0` 입력값이 DTO 유효성 검사를 통과해 LLM 레이아웃 공식의 `??` 폴백을 무력화하고 노드 겹침을 유발할 수 있음

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **유효성 검증** | `@IsNumber()`만 선언되어 `width: 0` / 음수 값이 통과됨. `??` 연산자는 `0`을 falsy로 간주하지 않아 `x = predecessor.x + 0 + 32`가 되어 노드가 겹침 (requirement → **MEDIUM**, testing, security, api_contract, architecture, side_effect 공통 지적) | `assistant-message-request.dto.ts:60,68` | `@Min(1)` 또는 `@IsPositive()` 추가. 상한도 `@Max(10000)` 추가 권장 |
| 2 | **테스트 누락** | `width: 0`, `width: NaN`, 음수 경계값 케이스가 전혀 테스트되지 않음. `typeof NaN === 'number'`는 `true`라 spread 조건 통과 후 `JSON.stringify`에서 `null`로 직렬화되어 LLM이 null 기반 계산 시도 가능 | `workflow-view.spec.ts`, `workflow-assistant-stream.service.spec.ts` | 0/NaN/음수 케이스 명시적 테스트 추가. DTO validator 단위 테스트(`plainToInstance` + `validate`) 추가 |
| 3 | **코드 중복** | `...(typeof n.width === 'number' ? { width: n.width } : {})` 패턴이 두 파일에서 width/height 쌍으로 총 4회 반복. 폴백 정책 변경 시 누락 수정 위험 | `workflow-view.ts:52-53`, `workflow-assistant-stream.service.ts:743-744` | `spreadMeasured(node)` 헬퍼 함수로 추출 후 양쪽에서 임포트 |
| 4 | **매직 넘버 산재** | `250`(기본 폭), `80`(기본 높이), `32`(gap), `24`(sibling gap)가 시스템 프롬프트 문자열 안에 인라인 리터럴로 삽입되어 변경 시 타입 안전성 없음 (maintainability, architecture 공통 지적) | `system-prompt.ts:106-111` | 파일 상단에 `LAYOUT_DEFAULT_WIDTH`, `LAYOUT_DEFAULT_HEIGHT` 등 상수 선언 후 템플릿 리터럴에서 참조 |
| 5 | **아키텍처** | React Flow v11/v12 버전 분기 로직(`measured ?? legacy` 분기 + 타입 캐스팅)이 컴포넌트에 직접 내장. 동일 패턴이 다른 컴포넌트로 확산될 위험 (architecture, maintainability 공통 지적) | `assistant-panel.tsx:103-110` | 에디터 스토어 레이어 또는 `getNodeMeasuredSize(node)` 유틸로 정규화 로직 격리 |
| 6 | **테스트 스타일** | 동일 `describe` 블록 내에서 `async/await`와 `return .then()` 패턴이 혼재 (testing, maintainability 공통 지적) | `workflow-assistant-stream.service.spec.ts:1542, 1601` | 두 번째 테스트도 `async/await`로 통일 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **문서화** | `height?` 필드에 JSDoc 없음. `width?`는 상세 JSDoc 있으나 `height?`는 선언만 있음. `workflow-view.ts`의 공유 JSDoc도 height 폴백(80px) 미언급 (documentation, maintainability 공통 지적) | `shadow-workflow.ts:12-18`, `workflow-view.ts` JSDoc | `height?`에 한 줄 JSDoc 추가. `workflow-view.ts` JSDoc에 "height 없으면 80px 폴백" 명시 |
| 2 | **타입 안전성** | 테스트 픽스처 타입 불일치를 `as never`로 억제. DTO 필드 추가 시 정적 검증 신뢰성 저하 (dependency, testing 공통 지적) | `workflow-assistant-stream.service.spec.ts:1568, 1613` | `baseDto`에 `width`/`height` 필드 추가 또는 `as unknown as AssistantMessageRequestDto`로 변경 |
| 3 | **Dead code 위험** | React Flow 버전이 확정되면 v11/v12 분기 중 한 경로가 영구 dead code가 됨 | `assistant-panel.tsx:103-110` | `frontend/package.json`에서 `@xyflow/react` 버전 확인 후 불필요한 분기 제거 |
| 4 | **테스트 품질** | 시스템 프롬프트 검증이 regex 문자열 매칭에 의존. JSON 키 순서·공백 변경에 취약 | `workflow-assistant-stream.service.spec.ts:1570-1572` | JSON 블록 추출 후 `JSON.parse` + 구조 비교 방식으로 전환 |
| 5 | **테스트 격리성** | `toShadowSnapshot`이 private 메서드라 서비스 전체를 통해서만 간접 검증 가능. 리팩토링에 취약 | `workflow-assistant-stream.service.ts:733` | standalone 순수 함수로 추출 고려 |
| 6 | **스펙 불일치** | 스펙 문서의 `sourceId`/`targetId`가 실제 DTO의 `sourceNodeId`/`targetNodeId`와 불일치 (이번 변경과 무관한 기존 문제) | `spec/3-workflow-editor/4-ai-assistant.md:§5.2` | 스펙 문서 필드명 수정 |
| 7 | **주석 언어** | `assistant.ts` JSDoc은 영어, `shadow-workflow.ts`·`workflow-view.ts`는 한국어로 혼재 | `frontend/src/lib/api/assistant.ts:80-86` | 팀 내 주석 언어 컨벤션 확정 후 일관 적용 |
| 8 | **아키텍처** | `ShadowNode`에 렌더링 측정값(`width`/`height`)이 포함되어 프레젠테이션 레이어 정보가 도메인 모델에 혼재. 현재 규모에서는 수용 가능 | `shadow-workflow.ts:8-15` | 현재 유지 가능. 향후 비대해지면 `dimensions` 중첩 객체로 분리 검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Requirement | **MEDIUM** | `width: 0`이 `??` 폴백을 무력화하여 레이아웃 계산 오류 유발 가능 |
| Security | LOW | DTO에 `@Min`/`@Max` 없어 비현실적 치수가 LLM 프롬프트에 삽입 가능 |
| Testing | LOW | 경계값(0, NaN, 음수) 미검증, DTO validator 테스트 부재 |
| Architecture | LOW | React Flow 버전 분기 로직이 컴포넌트에 혼재, 폴백 상수 산재 |
| Maintainability | LOW | 스프레드 패턴 4중 중복, 매직 넘버 산재, async 스타일 불일치 |
| API Contract | LOW | 범위 검증 없음, 전반적 설계는 하위 호환 유지 |
| Performance | LOW | 조건부 spread 임시 객체 생성(현 규모에서 무시 가능), LLM 토큰 소폭 증가 |
| Documentation | LOW | `height?` JSDoc 비대칭, height 폴백값 미언급 |
| Side Effect | LOW | React Flow 버전 캐스팅 취약, 범위 검증 미적용 |
| Concurrency | LOW | React Flow 측정값 비결정적 타이밍 (서버 폴백으로 이미 처리됨) |
| Dependency | LOW | React Flow 이중 경로 dead code 가능성, `as never` 캐스팅 |
| Database | **NONE** | 해당 없음 (인메모리 변경만 포함) |
| Scope | **NONE** | 모든 변경이 단일 기능 목표에 일치, 범위 이탈 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 이유 |
|----------|------|
| Database | 변경사항 전체가 인메모리 처리, DB 접근 계층 미포함 |
| Scope | 10개 파일 전체가 단일 기능(React Flow 측정값 전파) 범위 내 |

---

## 권장 조치사항

1. **[즉시 수정]** `AssistantWorkflowNodeDto.width`/`height`에 `@Min(1) @Max(10000)` 추가 — 0/음수 값이 LLM 레이아웃 공식의 `??` 폴백을 무력화하는 MEDIUM 위험 차단
2. **[단기 수정]** `workflow-view.spec.ts`에 `width: 0`, `width: NaN`, 음수 경계값 케이스 추가 및 DTO validator 단위 테스트 작성
3. **[단기 수정]** 조건부 스프레드 패턴을 `spreadMeasured()` 헬퍼로 추출하고, `system-prompt.ts`의 레이아웃 상수를 파일 상단에 선언
4. **[단기 수정]** 테스트 파일의 `as never` → `as unknown as AssistantMessageRequestDto` 교체 및 async 스타일 통일
5. **[중기 개선]** React Flow v11/v12 버전 분기 로직을 `getNodeMeasuredSize()` 유틸로 격리 및 `package.json` 버전 확인 후 dead code 정리
6. **[중기 개선]** `shadow-workflow.ts`의 `height?` JSDoc 추가 및 `workflow-view.ts`의 height 폴백값(80px) 명시
7. **[낮은 우선순위]** 스펙 문서의 `sourceId`/`targetId` → `sourceNodeId`/`targetNodeId` 오탈자 수정