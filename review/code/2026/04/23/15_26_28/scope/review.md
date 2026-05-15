## 발견사항

- **[INFO]** `listModels` 응답 언래핑 로직 수정 포함
  - 위치: `frontend/src/lib/api/llm-configs.ts`, `listModels` 함수
  - 상세: `return data as ModelInfo[]` → `return (data?.data ?? data) as ModelInfo[]` 변경. 이번 기능(preview-models) 추가와 무관한 기존 함수 수정. `previewModels`와 동일한 패턴을 적용한 버그픽스로 보이나, 기술적으로는 원래 작업 범위 밖.
  - 제안: 별도 커밋으로 분리하거나, 이 변경이 실제 버그를 수정하는 것임을 PR 설명에 명시.

- **[INFO]** `previewModels` 서비스 메서드에 다중 줄 주석 블록 추가
  - 위치: `backend/src/modules/llm/llm.service.ts`, `previewModels` 메서드 상단
  - 상세: 7줄짜리 `/** ... */` 주석 블록. 프로젝트 컨벤션(CLAUDE.md)은 "Default to writing no comments. Never write multi-paragraph docstrings or multi-line comment blocks"를 명시. 단, 캐시 우회·에러 sanitize·API Key 비저장 등 보안 제약은 비자명한 WHY에 해당하므로 일부는 정당화됨.
  - 제안: 1줄로 핵심 제약("per-config 캐시 우회, API Key는 로그·캐시에 기록하지 않음")만 남기고 나머지 삭제.

---

## 요약

전체 변경사항은 "저장 전 폼 자격증명으로 모델 목록 미리보기" 기능에 일관되게 집중되어 있다. 백엔드 DTO·서비스·컨트롤러·테스트, 프론트엔드 API 클라이언트·컴포넌트·페이지·테스트, i18n, 문서, 스펙까지 모두 해당 기능의 범위 내에서 작성되었다. 유일한 스코프 이슈는 기존 `listModels`의 응답 언래핑 수정(기능과 무관한 기존 코드 수정)과 서비스 메서드의 과도한 주석 분량이며, 둘 다 경미한 수준이다.

## 위험도

**LOW**