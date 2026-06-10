# API 계약(API Contract) Review 결과

## 발견사항

해당 없음.

본 변경 묶음(23개 파일)은 전부 **내부 성능 리팩토링**으로, HTTP API 계약 표면을 건드리지 않는다. 점검 관점별 확인 결과는 다음과 같다.

- **하위 호환성**: HTTP 컨트롤러·라우트·DTO 변경 없음. 영향받는 메서드는 모두 내부 service 계층.
  - `DashboardService.getSummary` — 6쿼리를 집계 2쿼리로 통합했으나 반환은 `DashboardSummary` 인터페이스(필드·반올림·changePercent·successRate 분모 의미론)를 그대로 유지. spec 의 `dashboard.service.spec` 이 의미론을 고정하고 경계값 테스트로 동등성 검증.
  - `WorkflowsService.importWorkflow` — 시그니처·반환(`savedWorkflow`) 불변. row 단위 save→배치 insert 로만 전환. (주의: `manager.insert` 가 `@BeforeInsert` hook/cascade 를 건너뛰나, Node/Edge 엔티티에 둘 다 없음을 코드 주석에서 확인.)
- **버전 관리**: API 버전 영향 없음 (엔드포인트 미변경).
- **응답 형식**: HTTP 응답 스키마 변경 없음. `S3Service.deleteMany` 의 `{ errored: string[] }` 는 내부 service 반환 형태이며 API 응답이 아님.
- **에러 응답**: HTTP 에러 응답 형식·상태 코드 변경 없음. KB 삭제의 S3 정리 실패는 기존과 동일하게 best-effort/warn 으로 삼키고 KB row 삭제는 진행(의미론 보존).
- **요청 검증**: 요청 매개변수·바디 검증 로직 변경 없음.
- **URL/경로 설계**: 경로·네이밍 변경 없음.
- **페이지네이션**: 목록 API 페이지네이션 변경 없음 (대시보드 최근 실행 limit 상수 불변).
- **인증/인가**: 엔드포인트 인증/인가 적용 변경 없음.

프론트엔드 변경(execution-store 인덱스 Map, `selectSortedNodeResults` accessor, 컴포넌트 정렬 소비처)은 클라이언트 내부 상태 관리이며 서버 API 계약과 무관하다.

## 요약

전 변경이 DB 쿼리 배치/집계, S3 배치 삭제, 모듈 단위 read-once 캐시, 프롬프트 카탈로그 캐시, 프론트 store 인덱싱 등 내부 성능 최적화에 한정된다. HTTP 라우트·DTO·응답 스키마·에러 형식·인증 어느 것도 변경되지 않았고, 외부에서 관찰 가능한 service 반환 형태(`DashboardSummary` 등)는 테스트로 동등성이 고정되어 클라이언트 영향이 없다. API 계약 관점의 위험 없음.

## 위험도

NONE
