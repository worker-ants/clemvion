# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `llm.module.ts` — `forwardRef(() => ModelConfigModule)` 임포트 추가 및 설명 주석 3줄 추가
  - 위치: `codebase/backend/src/modules/llm/llm.module.ts` lines 35, 43-46
  - 상세: `ModelConfigService` 주입에 필요한 모듈 등록이며, 주석은 순환 의존 해소 배경을 설명. 작업 의도(kind-agnostic 조회 경로)에 직결되므로 범위 내.
  - 제안: 없음.

- **[INFO]** `llm.service.ts` — `ModelConfigService` 임포트·생성자 파라미터 추가 및 `testConnection`·`listModels` 내 두 군데 `llmConfigService.findEntity` → `modelConfigService.findEntity` 교체
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts`
  - 상세: 두 메서드의 config 조회 경로를 kind 중립으로 교체하고, `testConnection` 반환 타입에 `dimension?: number` 추가 + embedding 분기 로직 신설. 이 변경들은 모두 PR 목적("embedding 연결 테스트 차원 자동감지 + kind-agnostic 조회") 에 직접 귀속.
  - 제안: 없음.

- **[INFO]** `model-config-response.dto.ts` — `ModelTestConnectionResultDto`에 `dimension?: number` 필드 추가
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` lines 1745-1750
  - 상세: 백엔드 응답 DTO를 서비스 반환 타입 변경과 일치시키는 최소 변경. 범위 내.
  - 제안: 없음.

- **[INFO]** `llm.service.spec.ts` — `mockModelConfigService` fixture 추가 + 생성자 호출부 파라미터 삽입 + `testConnection` describe 블록에 3개 테스트 케이스 추가
  - 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts`
  - 상세: 신규 동작(kind-agnostic 조회, embedding probe, 차원 반환)을 검증하는 테스트만 추가. 기존 테스트 수정 없음. 범위 내.
  - 제안: 없음.

- **[INFO]** `model-config-manager.test.tsx` — `describe("ModelConfigManager — embedding connection test dimension auto-detect")` 블록(4개 케이스) 추가
  - 위치: `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx` lines 1860-1975
  - 상세: 프론트엔드 dimension 자동감지 동작(persist, 중복 persist 방지, 실패 graceful, readonly 표시)을 검증하는 테스트. 기존 테스트 블록에 append만 했으며 기존 케이스 변경 없음. 범위 내.
  - 제안: 없음.

## 요약

변경 5개 파일 모두 "embedding 연결 테스트 시 차원 자동감지 + kind-agnostic 조회 회귀 수정" 이라는 단일 목적에 직결된다. 각 파일의 수정 범위는 해당 목적에 필요한 최소 범위(서비스 로직·모듈 등록·응답 DTO·단위 테스트·프론트엔드 테스트)로 한정되며, 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 노이즈, 임포트 정리, 기능 과확장 등은 발견되지 않는다.

## 위험도

NONE
